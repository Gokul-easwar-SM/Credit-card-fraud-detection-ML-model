"""Model training, anomaly blend, probability calibration, and threshold optimization.

Models:
  1. Logistic Regression (balanced baseline)
  2. Random Forest (balanced)
  3. LightGBM (primary supervised champion)
  4. Isolation Forest (unsupervised anomaly model for novelty & cold-start)

Calibration:
  - Platt scaling (Sigmoid) on the validation set via CalibratedClassifierCV(cv='prefit').

Thresholds:
  - Optimization via expected cost = FN * amount + FP * C_fp.
  - Three risk bands: Low (Monitor), Medium (Verify), High (Investigate).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.features import FEATURE_NAMES
from app.ml.pipeline import ScoreCalibrator, TrainedPipeline
from ml_training.dataset import SplitDataset, prepare_dataset


def optimize_thresholds(
    y_val: pd.Series,
    p_val: np.ndarray,
    val_amounts: pd.Series | None = None,
    c_fp: float = 50.0,
) -> dict[str, Any]:
    """Find cost-optimal threshold and operational risk bands on validation data.

    Parameters
    ----------
    y_val : pd.Series
        True validation labels (0/1).
    p_val : np.ndarray
        Predicted probabilities on validation set.
    val_amounts : pd.Series | None
        Transaction amounts for FN loss calculation. If None, uses average fraud cost.
    c_fp : float
        Assumed cost of a false positive (human analyst review, default ₹50).

    Returns
    -------
    dict[str, Any]
        Threshold configuration dictionary.
    """
    y_arr = np.asarray(y_val, dtype=int)
    amounts = np.asarray(val_amounts if val_amounts is not None else np.full_like(y_arr, 1500.0, dtype=float))

    best_thresh = 0.5
    min_cost = float("inf")
    candidate_thresholds = np.linspace(0.05, 0.95, 91)

    for th in candidate_thresholds:
        pred = (p_val >= th).astype(int)
        fn_mask = (y_arr == 1) & (pred == 0)
        fp_mask = (y_arr == 0) & (pred == 1)

        cost = float(amounts[fn_mask].sum() + fp_mask.sum() * c_fp)
        if cost < min_cost:
            min_cost = cost
            best_thresh = float(th)

    # Risk bands:
    # Low: < threshold_low (Monitor)
    # Medium: threshold_low <= p < threshold_high (Verify via SMS)
    # High: >= threshold_high (Investigate via Analyst queue)
    t_low = float(max(0.10, round(best_thresh * 0.5, 3)))
    t_high = float(min(0.90, max(best_thresh, round(best_thresh * 1.25, 3))))

    return {
        "threshold_optimal": round(best_thresh, 4),
        "threshold_low": t_low,
        "threshold_high": t_high,
        "cost_assumptions": {
            "c_fp_inr": c_fp,
            "c_fn_metric": "transaction_amount_inr",
            "min_validation_cost_inr": round(min_cost, 2),
        },
        "risk_bands": {
            "low": {"max": t_low, "action": "monitor", "review_required": False},
            "medium": {"min": t_low, "max": t_high, "action": "verify", "review_required": False},
            "high": {"min": t_high, "max": 1.0, "action": "investigate", "review_required": True},
        },
    }


def train_pipeline(
    data: SplitDataset,
    c_fp: float = 50.0,
    out_dir: Path | None = None,
) -> tuple[TrainedPipeline, dict[str, Any]]:
    """Train baseline, candidate, anomaly models, calibrate probabilities, and tune thresholds."""
    X_train = data.X_train[list(FEATURE_NAMES)]
    y_train = data.y_train
    X_val = data.X_val[list(FEATURE_NAMES)]
    y_val = data.y_val

    # 1. Baseline Logistic Regression
    lr = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)),
    ])
    lr.fit(X_train, y_train)

    # 2. Baseline Random Forest
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    # 3. Champion LightGBM
    lgbm = LGBMClassifier(
        n_estimators=150,
        learning_rate=0.05,
        max_depth=6,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    lgbm.fit(X_train, y_train)

    # 4. Calibration on Validation set
    raw_val_probs = lgbm.predict_proba(X_val)[:, 1]
    calibrator = ScoreCalibrator(method="sigmoid")
    calibrator.fit(raw_val_probs, y_val)

    # 5. Anomaly model (Isolation Forest on genuine training transactions)
    genuine_train = X_train[y_train == 0]
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.01,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(genuine_train)

    # Calculate normalization scale for anomaly scores
    train_anom = -iso.decision_function(genuine_train)
    anom_min = float(np.percentile(train_anom, 1))
    anom_max = float(np.percentile(train_anom, 99))

    # Construct pipeline object
    pipeline = TrainedPipeline(
        supervised_model=lgbm,
        calibrated_model=calibrator,
        anomaly_model=iso,
        baseline_lr=lr,
        baseline_rf=rf,
        thresholds={},
        feature_names=FEATURE_NAMES,
        anomaly_min=anom_min,
        anomaly_max=anom_max,
        blend_weight=0.10,
    )

    # 6. Optimize thresholds on Validation predictions
    p_val_blended = pipeline.predict_proba(X_val)
    val_amounts = data.meta_val["amount"] if "amount" in data.meta_val.columns else None
    thresholds = optimize_thresholds(y_val, p_val_blended, val_amounts=val_amounts, c_fp=c_fp)
    pipeline.thresholds = thresholds

    # Training summary
    summary = {
        "n_train": len(X_train),
        "n_train_fraud": int(y_train.sum()),
        "train_fraud_rate": float(y_train.mean()),
        "n_val": len(X_val),
        "n_val_fraud": int(y_val.sum()),
        "val_fraud_rate": float(y_val.mean()),
        "feature_importances": {
            feat: float(imp)
            for feat, imp in zip(FEATURE_NAMES, lgbm.feature_importances_)
        },
        "thresholds": thresholds,
    }

    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, out_dir / "model.joblib")
        (out_dir / "thresholds.json").write_text(json.dumps(thresholds, indent=2))
        (out_dir / "features.json").write_text(json.dumps(list(FEATURE_NAMES), indent=2))

    return pipeline, summary
