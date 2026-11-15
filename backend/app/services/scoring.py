"""Scoring and fraud detection orchestration service.

Enforces:
  1. Safe model loading & schema validation.
  2. Idempotent transaction processing via unique external_txn_id.
  3. Real-time point-in-time behavioural feature extraction using memory_store history strictly prior to occurred_at.
  4. Probability calibration and risk-band assignment (Low: Monitor, Medium: Verify, High: Investigate).
  5. TreeSHAP local attributions and human-readable reason codes generation.
  6. Automated alert generation for Medium/High risk and investigation routing for High risk.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Tuple

import joblib
import numpy as np
import pandas as pd

from app.db.memory_store import (
    Alert,
    Card,
    Customer,
    Device,
    Investigation,
    ModelVersion,
    Prediction,
    Transaction,
    memory_store,
)
from app.ml.explain import FraudExplainer
from app.ml.features import (
    FEATURE_NAMES,
    compute_features_single,
    validate_transaction_record,
)
from app.ml.pipeline import ScoreCalibrator, TrainedPipeline
from app.schemas.transaction import (
    AlertSummary,
    InvestigationSummary,
    PredictionDetail,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionResponse,
)


class ModelService:
    """Manages the in-memory trained fraud detection champion pipeline and SHAP explainer."""

    _instance: ModelService | None = None

    def __init__(self, artifacts_dir: Path | None = None) -> None:
        if artifacts_dir is None:
            artifacts_dir = Path(__file__).resolve().parent.parent / "ml" / "artifacts"
            if not artifacts_dir.exists():
                artifacts_dir = Path(__file__).resolve().parent.parent.parent.parent / "models"

        self.artifacts_dir = artifacts_dir
        self.model_path = artifacts_dir / "model.joblib"
        self.thresholds_path = artifacts_dir / "thresholds.json"
        self.features_path = artifacts_dir / "features.json"

        self.pipeline: Any = None
        self.thresholds: dict[str, Any] = {}
        self.feature_names: tuple[str, ...] = FEATURE_NAMES
        self.explainer: FraudExplainer | None = None
        self.version_tag = "lgbm_v1_champion"

        self._load_and_validate()

    @classmethod
    def get_instance(cls, artifacts_dir: Path | None = None) -> ModelService:
        if cls._instance is None:
            cls._instance = cls(artifacts_dir)
        return cls._instance

    def _load_and_validate(self) -> None:
        """Load artifacts and enforce strict feature schema alignment."""
        if not self.model_path.exists():
            raise RuntimeError(f"Trained model artifact not found at {self.model_path}")
        if not self.thresholds_path.exists():
            raise RuntimeError(f"Thresholds artifact not found at {self.thresholds_path}")
        if not self.features_path.exists():
            raise RuntimeError(f"Features artifact not found at {self.features_path}")

        # 1. Load pipeline & thresholds (with safe fallback for historical artifacts)
        if "ml_training.train" not in sys.modules:
            try:
                import ml_training.train  # type: ignore
            except ImportError:
                import types
                _compat_mod = types.ModuleType("ml_training.train")
                _compat_mod.ScoreCalibrator = ScoreCalibrator
                _compat_mod.TrainedPipeline = TrainedPipeline
                if "ml_training" not in sys.modules:
                    _parent = types.ModuleType("ml_training")
                    _parent.train = _compat_mod
                    sys.modules["ml_training"] = _parent
                sys.modules["ml_training.train"] = _compat_mod

        self.pipeline = joblib.load(self.model_path)
        self.thresholds = json.loads(self.thresholds_path.read_text(encoding="utf-8"))
        loaded_features = json.loads(self.features_path.read_text(encoding="utf-8"))

        # 2. Strict Schema Verification: refuse to start on mismatch
        if tuple(loaded_features) != FEATURE_NAMES:
            raise RuntimeError(
                f"Feature schema mismatch refusal! "
                f"Pipeline requires {FEATURE_NAMES}, but model expects {tuple(loaded_features)}"
            )

        if tuple(self.pipeline.feature_names) != FEATURE_NAMES:
            raise RuntimeError(
                f"Model pipeline feature mismatch refusal! "
                f"Pipeline requires {FEATURE_NAMES}, but model pipeline was trained on {tuple(self.pipeline.feature_names)}"
            )

        # 3. Instantiate TreeSHAP explainer
        self.explainer = FraudExplainer(self.pipeline.supervised_model, feature_names=FEATURE_NAMES)

    def ensure_model_version_record(self, _db: Any = None) -> ModelVersion:
        """Ensure active ModelVersion record exists in memory."""
        metrics_path = self.artifacts_dir / "metrics.json"
        if not metrics_path.exists():
            metrics_path = self.artifacts_dir.parent.parent.parent / "models" / "metrics.json"

        metrics_data = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}
        return ModelVersion(
            id=1,
            version=self.version_tag,
            artifact_path=str(self.model_path),
            feature_names=list(self.feature_names),
            thresholds=self.thresholds,
            metrics=metrics_data,
            is_active=True,
        )


def get_customer_history(db: Any, customer_id: int, occurred_at: datetime) -> pd.DataFrame:
    """Query strictly prior transactions for this customer from memory store."""
    txns = memory_store.get_customer_prior_transactions(customer_id, occurred_at)
    if not txns:
        return pd.DataFrame()

    data = []
    for t in txns:
        dev = memory_store.get_device(t.device_id) if t.device_id else None
        data.append({
            "occurred_at": t.occurred_at,
            "amount": float(t.amount),
            "channel": t.channel,
            "lat": t.lat,
            "lon": t.lon,
            "device_key": dev.device_key if dev else None,
        })
    df = pd.DataFrame(data)
    df["occurred_at"] = pd.to_datetime(df["occurred_at"], utc=True)
    return df


def get_device_history(db: Any, device_id: int, occurred_at: datetime) -> pd.DataFrame:
    """Query strictly prior transactions on this device across all customers from memory store."""
    txns = memory_store.get_device_prior_transactions(device_id, occurred_at)
    if not txns:
        return pd.DataFrame()

    data = []
    for t in txns:
        cust = memory_store.get_customer(t.customer_id)
        dev = memory_store.get_device(t.device_id) if t.device_id else None
        data.append({
            "occurred_at": t.occurred_at,
            "external_customer_id": cust.external_customer_id if cust else "",
            "device_key": dev.device_key if dev else "",
        })
    df = pd.DataFrame(data)
    df["occurred_at"] = pd.to_datetime(df["occurred_at"], utc=True)
    return df


def build_customer_history_summary(
    db: Any,
    customer: Customer,
    current_txn_occurred_at: datetime,
) -> dict[str, Any]:
    """Compile customer historical baseline for human analyst dossier review."""
    prior_txns = memory_store.get_customer_prior_transactions(customer.id, current_txn_occurred_at)

    known_devices = list({
        memory_store.get_device(t.device_id).device_key
        for t in prior_txns
        if t.device_id and memory_store.get_device(t.device_id)
    })
    if not known_devices:
        known_devices = [f"DEV-{customer.external_customer_id}-A"]

    amounts = [float(t.amount) for t in prior_txns]
    avg_amt = float(round(float(np.mean(amounts)), 2)) if amounts else float(customer.avg_amount or 1250.0)

    usual_cities = [customer.home_city or "Coimbatore"]
    if len(prior_txns) >= 3:
        usual_cities = list(set([customer.home_city or "Coimbatore"]))

    prev_fraud_count = 0
    prev_flagged_count = 0
    for t in prior_txns:
        pred = memory_store.get_prediction_by_txn_id(t.id)
        if pred:
            if pred.risk_band in ("medium", "high"):
                prev_flagged_count += 1
            inv = memory_store.get_investigation_by_txn_id(t.id)
            if inv and inv.status == "confirmed_fraud":
                prev_fraud_count += 1

    if len(prior_txns) >= 2:
        try:
            oldest_dt = prior_txns[0].occurred_at
            latest_dt = prior_txns[-1].occurred_at
            delta_days = max(1.0, (latest_dt - oldest_dt).total_seconds() / 86400.0)
            txns_per_week = round((len(prior_txns) / delta_days) * 7, 1)
            freq_desc = f"{txns_per_week} transactions / week"
        except Exception:
            freq_desc = "Normal pacing (1-2 txns/day)"
    else:
        freq_desc = "Standard baseline (1-2 txns/day)"

    card = memory_store.get_card_by_customer_id(customer.id)

    return {
        "customer_id": customer.external_customer_id,
        "name": (
            "FraudSentinel Demo Customer"
            if customer.external_customer_id == "DEMO001"
            else f"Customer {customer.external_customer_id}"
        ),
        "home_city": customer.home_city or "Coimbatore",
        "card_number_masked": card.card_number_masked if card else "•••• •••• •••• 9901",
        "card_status": card.status if card else "active",
        "total_transactions": len(prior_txns),
        "avg_amount": avg_amt,
        "min_amount": min(amounts) if amounts else avg_amt,
        "max_amount": max(amounts) if amounts else avg_amt,
        "purchase_frequency": freq_desc,
        "usual_locations": usual_cities,
        "known_devices": known_devices,
        "previous_fraud_count": prev_fraud_count,
        "previous_flagged_count": prev_flagged_count,
    }


def process_transaction(
    db: Any = None,
    txn_in: TransactionCreate | None = None,
    model_service: ModelService | None = None,
) -> Tuple[TransactionResponse, bool]:
    """Score, persist in memory, and trigger alerts for a transaction with idempotency protection."""
    if model_service is None:
        model_service = ModelService.get_instance()

    # 1. Idempotency Check
    existing_txn = memory_store.get_transaction_by_ext_id(txn_in.external_txn_id)
    if existing_txn is not None:
        return _build_response(memory_store, existing_txn), True

    # 2. Lookup or create Customer
    cust = memory_store.get_customer(txn_in.external_customer_id)
    if cust is None:
        cust = memory_store.create_customer(
            external_customer_id=txn_in.external_customer_id,
            home_city=None,
            home_lat=txn_in.lat,
            home_lon=txn_in.lon,
            avg_amount=Decimal(str(txn_in.amount)),
            is_simulated=txn_in.is_simulated,
        )

    # 3. Lookup or create Device if provided
    device: Device | None = None
    if txn_in.device_key:
        device = memory_store.get_or_create_device(txn_in.device_key)

    # 4. Fetch strictly prior history from memory store
    cust_hist = get_customer_history(memory_store, cust.id, txn_in.occurred_at)
    dev_hist = get_device_history(memory_store, device.id, txn_in.occurred_at) if device is not None else None

    # 5. Compute behavioural features
    features = compute_features_single(
        current_txn=txn_in.model_dump(),
        customer_history=cust_hist,
        device_history=dev_hist,
    )

    # 6. ML Scoring & Risk Banding
    feat_df = pd.DataFrame([features])[list(model_service.feature_names)]
    calibrated_score = float(model_service.pipeline.predict_proba(feat_df)[0])
    raw_supervised_score = float(model_service.pipeline.supervised_model.predict_proba(feat_df)[:, 1][0])

    # Rule-assisted hybrid safeguards for severe physical velocity and spend shocks
    if features.get("speed_kmh", 0) > 500 or (features.get("amount_ratio_mean", 1) > 20 and float(txn_in.amount) >= 20000):
        calibrated_score = max(calibrated_score, 0.88)
    elif features.get("is_new_device", 0) == 1 and float(txn_in.amount) >= 12000:
        calibrated_score = max(calibrated_score, 0.28)

    risk_band = str(model_service.pipeline.predict_band(calibrated_score))

    # 4-Tier Decision Policy (approve, verify, review, decline)
    th_low = float(model_service.thresholds.get("threshold_low", 0.15))
    if th_low < 0.18:
        th_low = 0.18  # Ensure routine spend up to 18% is frictionless approved
    th_med = float(model_service.thresholds.get("threshold_optimal", 0.35))
    th_high = float(model_service.thresholds.get("threshold_high", 0.65))
    if th_high <= th_med:
        th_high = 0.65

    if calibrated_score <= th_low:
        decision = "approve"
        recommended_action = "approve"
        predicted_label = "genuine"
    elif calibrated_score <= th_med:
        decision = "verify"
        recommended_action = "verify"
        predicted_label = "potential_fraud"
    elif calibrated_score <= th_high:
        decision = "review"
        recommended_action = "investigate"
        predicted_label = "potential_fraud"
    else:
        decision = "decline"
        recommended_action = "decline"
        predicted_label = "potential_fraud"

    # Cold-Start / Evidence Sufficiency Indicator
    n_prior = len(cust_hist) if cust_hist is not None else 0
    if n_prior < 3:
        evidence_suff = "cold_start"
    elif n_prior < 10:
        evidence_suff = "developing"
    else:
        evidence_suff = "mature"

    # Device sharing graph count
    shared_cust_count = 1
    if device is not None:
        prior_dev_txns = memory_store.get_device_prior_transactions(device.id, txn_in.occurred_at)
        cust_set = {t.customer_id for t in prior_dev_txns} | {cust.id}
        shared_cust_count = len(cust_set)

    # Intelligent Financial Priority Score: Score * Amount * Risk Multipliers
    fps_multiplier = 1.0
    if features.get("velocity_1h_count", 0) >= 3:
        fps_multiplier *= 1.25
    if features.get("is_new_device", 0) == 1:
        fps_multiplier *= 1.30
    if features.get("speed_kmh", 0) > 500:
        fps_multiplier *= 1.40
    hr = txn_in.occurred_at.hour
    if hr < 5 or hr >= 23:
        fps_multiplier *= 1.15
    if shared_cust_count > 1:
        fps_multiplier *= 1.50

    fin_priority = round(float(calibrated_score) * float(txn_in.amount) * fps_multiplier, 2)
    if fin_priority >= 10000.0 or decision == "decline":
        p_category = "Critical"
    elif fin_priority >= 2500.0 or decision == "review":
        p_category = "High"
    elif fin_priority >= 500.0 or decision == "verify":
        p_category = "Medium"
    else:
        p_category = "Low"

    # 7. TreeSHAP Explanation & Plain-English Reason Codes
    exp = model_service.explainer.explain_transaction(features, top_k=3, threshold_high=th_high)

    # 8. Persist Transaction in memory
    txn = memory_store.create_transaction(
        external_txn_id=txn_in.external_txn_id,
        customer_id=cust.id,
        device_id=device.id if device is not None else None,
        occurred_at=txn_in.occurred_at,
        amount=Decimal(str(txn_in.amount)),
        currency=txn_in.currency,
        channel=txn_in.channel,
        lat=txn_in.lat,
        lon=txn_in.lon,
        source=txn_in.source,
        is_simulated=txn_in.is_simulated,
    )

    # 9. Persist Prediction in memory
    mv = model_service.ensure_model_version_record()
    pred = memory_store.create_prediction(
        transaction_id=txn.id,
        model_version_id=mv.id,
        raw_score=raw_supervised_score,
        calibrated_score=calibrated_score,
        predicted_label=predicted_label,
        risk_band=risk_band,
        recommended_action=recommended_action,
        reason_codes=exp["reason_codes"],
        decision=decision,
        financial_priority_score=fin_priority,
        priority_category=p_category,
        evidence_sufficiency=evidence_suff,
        device_shared_cust_count=shared_cust_count,
    )

    # 10. Automated Alert if Verify, Review, or Decline
    alert_record: Alert | None = None
    if decision in ("verify", "review", "decline") or risk_band in ("medium", "high"):
        alert_record = memory_store.create_alert(
            transaction_id=txn.id,
            prediction_id=pred.id,
            channel="simulated",
            message=(
                f"[SECURITY ALERT] Transaction of INR {txn_in.amount:,.2f} flagged "
                f"({decision.upper()} - {p_category} Priority). Reply YES if authorized, or NO to freeze card."
            ),
            status="pending",
        )

    # 11. Automated Investigation record if Review or Decline (or High Risk)
    inv_record: Investigation | None = None
    if decision in ("review", "decline") or risk_band == "high":
        inv_record = memory_store.create_investigation(
            transaction_id=txn.id,
            status="pending_review",
            notes=(
                f"Automated {decision.upper()} decision: calibrated score {calibrated_score:.3f}, "
                f"priority ₹{fin_priority:,.0f} ({p_category}). "
                f"Reason: {exp['reason_codes'][0] if exp['reason_codes'] else 'Elevated score'}"
            ),
        )

    # If critical decline, proactively mark card as temporary protected hold
    if decision == "decline":
        card = memory_store.get_card_by_customer_id(cust.id)
        if card and card.status != "frozen":
            card.status = "frozen"
            card.last_freeze_reason = f"Critical risk auto-decline on transaction #{txn.id} (Score {calibrated_score:.3f})"
            card.updated_at = datetime.now(timezone.utc)

    res = _build_response(memory_store, txn, pred, alert_record, inv_record, exp)
    try:
        from app.services.stream_service import stream_broker
        stream_broker.publish_sync(res.model_dump(mode="json"))
    except Exception:
        pass

    return res, False


def _build_response(
    store: Any,
    txn: Transaction,
    pred: Prediction | None = None,
    alert: Alert | None = None,
    inv: Investigation | None = None,
    exp: dict[str, Any] | None = None,
) -> TransactionResponse:
    """Helper to convert memory models to TransactionResponse."""
    cust = memory_store.get_customer(txn.customer_id)
    dev_key = None
    if txn.device_id is not None:
        dev = memory_store.get_device(txn.device_id)
        dev_key = dev.device_key if dev else None

    if pred is None:
        pred = memory_store.get_prediction_by_txn_id(txn.id)

    if alert is None:
        alerts = memory_store.get_alerts_by_txn_id(txn.id)
        alert = alerts[-1] if alerts else None

    if inv is None:
        inv = memory_store.get_investigation_by_txn_id(txn.id)

    mv_version = "lgbm_v1_champion"

    pred_detail = None
    if pred is not None:
        pred_detail = PredictionDetail(
            id=pred.id,
            raw_score=pred.raw_score,
            calibrated_score=pred.calibrated_score if pred.calibrated_score is not None else pred.raw_score,
            predicted_label=pred.predicted_label,
            risk_band=pred.risk_band,
            recommended_action=pred.recommended_action,
            reason_codes=pred.reason_codes or [],
            counterfactual_hint=exp.get("counterfactual_hint") if exp else None,
            model_version=mv_version,
            decision=getattr(pred, "decision", "approve"),
            financial_priority_score=getattr(pred, "financial_priority_score", 0.0),
            priority_category=getattr(pred, "priority_category", "Low"),
            evidence_sufficiency=getattr(pred, "evidence_sufficiency", "mature"),
            device_shared_cust_count=getattr(pred, "device_shared_cust_count", 1),
        )

    alert_summary = None
    if alert is not None:
        from app.services.sms_service import resolve_alert_delivery_meta
        meta = resolve_alert_delivery_meta(alert, cust.phone_e164 if cust else None)
        alert_summary = AlertSummary(
            id=alert.id,
            channel=alert.channel,
            status=alert.status,
            message=alert.message,
            delivery_state=meta["delivery_state"],
            provider=meta["provider"],
            provider_message_id=meta["provider_message_id"],
            phone_masked=meta["phone_masked"],
            error=meta["error"],
            dispatched_at=alert.created_at,
        )

    inv_summary = None
    if inv is not None:
        inv_summary = InvestigationSummary(
            id=inv.id,
            status=inv.status,
            notes=inv.notes,
        )

    return TransactionResponse(
        id=txn.id,
        external_txn_id=txn.external_txn_id,
        external_customer_id=cust.external_customer_id if cust else "",
        device_key=dev_key,
        occurred_at=txn.occurred_at,
        amount=float(txn.amount),
        currency=txn.currency,
        channel=txn.channel,
        lat=txn.lat,
        lon=txn.lon,
        source=txn.source,
        is_simulated=txn.is_simulated,
        prediction=pred_detail,
        alert=alert_summary,
        investigation=inv_summary,
    )
