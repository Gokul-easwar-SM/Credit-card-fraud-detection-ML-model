"""API routes for fraud investigations queue and analyst review."""
from __future__ import annotations

import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user
from app.db.memory_store import (
    Alert,
    Customer,
    Investigation,
    Prediction,
    Transaction,
    User,
    memory_store,
)
from app.schemas.investigation import (
    InvestigationDetailResponse,
    InvestigationListItem,
    InvestigationUpdateRequest,
    PaginatedInvestigationsResponse,
)
from app.schemas.transaction import AlertSummary, TransactionDetailResponse
from app.services.scoring import (
    ModelService,
    _build_response,
    build_customer_history_summary,
    compute_features_single,
    get_customer_history,
    get_device_history,
)
from app.services.sms_service import resolve_alert_delivery_meta, sms_service

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.get("", response_model=PaginatedInvestigationsResponse)
def list_investigations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    status_filter: str | None = Query(None, alias="status", description="Filter by investigation status"),
    search: str | None = Query(None, description="Search transaction ID, customer ID, or notes"),
    sort_by: str = Query("priority", pattern="^(priority|time|amount)$", description="Sort order"),
) -> PaginatedInvestigationsResponse:
    """List investigations with status filtering, search, and priority sorting."""
    invs = memory_store.list_investigations()

    matched: list[tuple[Investigation, Transaction, Customer, Prediction | None, str | None]] = []
    for inv in invs:
        if status_filter and inv.status != status_filter:
            continue

        txn = memory_store.get_transaction(inv.transaction_id)
        if not txn:
            continue

        cust = memory_store.get_customer(txn.customer_id)
        if not cust:
            continue

        pred = memory_store.get_prediction_by_txn_id(txn.id)
        analyst = memory_store.get_user_by_id(inv.analyst_id) if inv.analyst_id else None
        analyst_uname = analyst.username if analyst else None

        if search and search.strip():
            s = search.strip().lower()
            txn_match = s in txn.external_txn_id.lower()
            cust_match = s in cust.external_customer_id.lower()
            notes_match = inv.notes and s in inv.notes.lower()
            if not (txn_match or cust_match or notes_match):
                continue

        matched.append((inv, txn, cust, pred, analyst_uname))

    # Sorting
    if sort_by == "time":
        matched.sort(key=lambda x: x[1].occurred_at, reverse=True)
    elif sort_by == "amount":
        matched.sort(key=lambda x: float(x[1].amount), reverse=True)
    else:  # priority: priority_score = calibrated_score * amount
        matched.sort(
            key=lambda x: (
                (float(x[3].calibrated_score) if (x[3] and x[3].calibrated_score is not None) else 0.5)
                * float(x[1].amount)
            ),
            reverse=True,
        )

    total = len(matched)
    offset = (page - 1) * page_size
    paged = matched[offset : offset + page_size]

    items: list[InvestigationListItem] = []
    for inv, txn, cust, pred, analyst_uname in paged:
        calib = float(pred.calibrated_score) if (pred and pred.calibrated_score is not None) else 0.5
        amt = float(txn.amount)
        fps = getattr(pred, "financial_priority_score", None) or round(amt * calib, 2)
        p_cat = getattr(pred, "priority_category", None)
        if not p_cat:
            if fps >= 10000.0:
                p_cat = "Critical"
            elif fps >= 2500.0:
                p_cat = "High"
            elif fps >= 500.0:
                p_cat = "Medium"
            else:
                p_cat = "Low"
        decision = getattr(pred, "decision", "review")

        items.append(
            InvestigationListItem(
                id=inv.id,
                transaction_id=txn.id,
                external_txn_id=txn.external_txn_id,
                external_customer_id=cust.external_customer_id,
                occurred_at=txn.occurred_at,
                amount=amt,
                channel=txn.channel,
                risk_band=pred.risk_band if pred else "medium",
                raw_score=float(pred.raw_score) if pred else 0.5,
                calibrated_score=float(pred.calibrated_score) if (pred and pred.calibrated_score is not None) else None,
                status=inv.status,
                priority_score=fps,
                decision=decision,
                priority_category=p_cat,
                financial_priority_score=fps,
                analyst_username=analyst_uname,
                notes=inv.notes,
                updated_at=inv.updated_at,
            )
        )

    pages = max(1, math.ceil(total / page_size))
    return PaginatedInvestigationsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{inv_id}", response_model=InvestigationDetailResponse)
def get_investigation(inv_id: int) -> InvestigationDetailResponse:
    """Retrieve full investigation details including transaction, TreeSHAP explanation, and customer alert."""
    inv = memory_store.get_investigation(inv_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation with ID {inv_id} not found",
        )

    txn = memory_store.get_transaction(inv.transaction_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    cust = memory_store.get_customer(txn.customer_id)
    analyst = memory_store.get_user_by_id(inv.analyst_id) if inv.analyst_id else None
    analyst_uname = analyst.username if analyst else None

    base_res = _build_response(memory_store, txn)
    dev = memory_store.get_device(txn.device_id) if txn.device_id else None

    ch_df = get_customer_history(memory_store, txn.customer_id, txn.occurred_at)
    dh_df = get_device_history(memory_store, dev.id, txn.occurred_at) if dev else None

    raw_dict = {
        "external_customer_id": cust.external_customer_id if cust else "",
        "occurred_at": txn.occurred_at,
        "amount": float(txn.amount),
        "channel": txn.channel,
        "lat": txn.lat,
        "lon": txn.lon,
        "device_key": dev.device_key if dev else None,
    }
    features = compute_features_single(raw_dict, customer_history=ch_df, device_history=dh_df)
    model_service = ModelService.get_instance()
    exp = model_service.explainer.explain_transaction(features, top_k=5)

    cust_summary = build_customer_history_summary(memory_store, cust, txn.occurred_at) if cust else None
    txn_detail = TransactionDetailResponse(
        **base_res.model_dump(),
        shap_values=exp["shap_values"],
        top_drivers=exp["top_drivers"],
        factors_increasing_risk=exp.get("factors_increasing_risk"),
        factors_reducing_risk=exp.get("factors_reducing_risk"),
        customer_history_summary=cust_summary,
    )

    alerts = memory_store.get_alerts_by_txn_id(txn.id)
    alert_summary = None
    if alerts:
        alert_row = alerts[-1]
        meta = resolve_alert_delivery_meta(alert_row, cust.phone_e164 if cust else None)
        alert_summary = AlertSummary(
            id=alert_row.id,
            channel=alert_row.channel,
            status=alert_row.status,
            message=alert_row.message,
            delivery_state=meta["delivery_state"],
            provider=meta["provider"],
            provider_message_id=meta["provider_message_id"],
            phone_masked=meta["phone_masked"],
            error=meta["error"],
            dispatched_at=alert_row.created_at,
        )

    return InvestigationDetailResponse(
        id=inv.id,
        status=inv.status,
        notes=inv.notes,
        analyst_id=inv.analyst_id,
        analyst_username=analyst_uname,
        updated_at=inv.updated_at,
        transaction=txn_detail,
        customer_verification=alert_summary,
    )


@router.patch("/{inv_id}", response_model=InvestigationDetailResponse)
def update_investigation(
    inv_id: int,
    req: InvestigationUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> InvestigationDetailResponse:
    """Update human investigation decision and notes.
    
    CRITICAL RULE:
    Human decision is stored strictly in `investigation.status`.
    The ML model output in `prediction` remains completely unaltered.
    """
    inv = memory_store.get_investigation(inv_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation with ID {inv_id} not found",
        )

    prev_status = inv.status
    inv.status = req.status
    inv.analyst_id = current_user.id
    if req.notes:
        inv.notes = req.notes
    inv.updated_at = datetime.now(timezone.utc)

    # If analyst confirmed fraud, automatically freeze card and dispatch customer SMS notification
    if req.status == "confirmed_fraud" and prev_status != "confirmed_fraud":
        txn = memory_store.get_transaction(inv.transaction_id)
        if txn is not None:
            cust = memory_store.get_customer(txn.customer_id)
            card = memory_store.get_card_by_customer_id(txn.customer_id)
            if card is not None and card.status != "frozen":
                card.status = "frozen"
                card.last_freeze_reason = f"Confirmed fraud on transaction #{txn.id} by analyst {current_user.username}"
                card.updated_at = datetime.now(timezone.utc)

            if cust is not None:
                sms_service.trigger_fraud_alert(
                    transaction=txn,
                    customer=cust,
                    card=card,
                    analyst_username=current_user.username,
                )

    memory_store.log_audit(
        action="investigation_decision",
        entity_type="investigation",
        entity_id=str(inv.id),
        user_id=current_user.id,
        details={
            "transaction_id": inv.transaction_id,
            "previous_status": prev_status,
            "new_status": req.status,
            "notes": req.notes,
            "analyst": current_user.username,
        },
    )

    return get_investigation(inv_id)


@router.get("/export/feedback")
def export_analyst_feedback() -> dict[str, Any]:
    """Export analyst decisions and feedback dataset for offline machine learning retraining and evaluation.
    
    Academic requirement Phase 10: Preserves ground truth labels without auto-retraining.
    """
    invs = memory_store.list_investigations()
    records = []
    for inv in invs:
        txn = memory_store.get_transaction(inv.transaction_id)
        if not txn:
            continue
        cust = memory_store.get_customer(txn.customer_id)
        pred = memory_store.get_prediction_by_txn_id(txn.id)
        analyst = memory_store.get_user_by_id(inv.analyst_id) if inv.analyst_id else None

        records.append({
            "investigation_id": inv.id,
            "transaction_id": txn.id,
            "external_txn_id": txn.external_txn_id,
            "customer_id": cust.external_customer_id if cust else "",
            "amount_inr": float(txn.amount),
            "occurred_at": txn.occurred_at.isoformat(),
            "channel": txn.channel,
            "ml_raw_score": pred.raw_score if pred else None,
            "ml_calibrated_score": pred.calibrated_score if pred else None,
            "ml_risk_band": pred.risk_band if pred else None,
            "ml_decision": getattr(pred, "decision", "review") if pred else None,
            "analyst_decision": inv.status,
            "analyst_username": analyst.username if analyst else "system",
            "analyst_notes": inv.notes,
            "ground_truth_label": 1 if inv.status == "confirmed_fraud" else (0 if inv.status == "marked_genuine" else None),
            "resolved_at": inv.updated_at.isoformat(),
        })

    return {
        "dataset_name": "FraudSentinel_Analyst_Feedback_Loop",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(records),
        "records": records,
    }
