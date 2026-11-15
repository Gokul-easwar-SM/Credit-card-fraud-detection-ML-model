"""API routes for transactions: submission, scoring, querying, and explainability."""
from __future__ import annotations

import math
from typing import Any
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Response, status

from app.db.memory_store import (
    Customer,
    Device,
    Transaction,
    memory_store,
)
from app.services.scoring import (
    ModelService,
    _build_response,
    build_customer_history_summary,
    compute_features_single,
    get_customer_history,
    get_device_history,
    process_transaction,
)
from app.schemas.transaction import (
    PaginatedTransactionsResponse,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    txn_in: TransactionCreate,
    response: Response,
) -> TransactionResponse:
    """Ingest a transaction, compute behavioural features, score risk in real time, and persist in memory.

    Enforces idempotency: repeated submissions with the same external_txn_id return the
    existing record with status 200 and 'X-Idempotent: true' header.
    """
    model_service = ModelService.get_instance()
    res, is_duplicate = process_transaction(memory_store, txn_in, model_service=model_service)

    if is_duplicate:
        response.status_code = status.HTTP_200_OK
        response.headers["X-Idempotent"] = "true"

    return res


@router.get("", response_model=PaginatedTransactionsResponse)
def list_transactions(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    risk_band: str | None = Query(None, description="Filter by risk band: low, medium, high"),
    channel: str | None = Query(None, description="Filter by channel: pos, online, atm"),
    source: str | None = Query(None, description="Filter by source: simulator, manual, sandbox"),
    is_simulated: bool | None = Query(None, description="Filter synthetic transactions"),
    search: str | None = Query(None, description="Search transaction or customer ID"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
) -> PaginatedTransactionsResponse:
    """List transactions with filtering, search, pagination, and sorting."""
    txns = memory_store.list_transactions()

    # Filtering
    filtered = []
    for t in txns:
        pred = memory_store.get_prediction_by_txn_id(t.id)
        cust = memory_store.get_customer(t.customer_id)

        if risk_band:
            if not pred or pred.risk_band != risk_band:
                continue
        if channel and t.channel != channel:
            continue
        if source and t.source != source:
            continue
        if is_simulated is not None and t.is_simulated != is_simulated:
            continue
        if search and search.strip():
            q = search.strip().lower()
            cust_ext = cust.external_customer_id.lower() if cust else ""
            if q not in t.external_txn_id.lower() and q not in cust_ext:
                continue
        filtered.append(t)

    # Sorting
    reverse_sort = sort_order == "desc"
    filtered.sort(key=lambda t: t.occurred_at, reverse=reverse_sort)

    total_items = len(filtered)
    total_pages = max(1, math.ceil(total_items / page_size))
    offset = (page - 1) * page_size
    paged = filtered[offset : offset + page_size]

    items = [_build_response(memory_store, t) for t in paged]
    return PaginatedTransactionsResponse(
        items=items,
        total=total_items,
        page=page,
        page_size=page_size,
        pages=total_pages,
    )


@router.get("/{txn_id}", response_model=TransactionDetailResponse)
def get_transaction(txn_id: int) -> TransactionDetailResponse:
    """Retrieve full transaction details including SHAP explanation, dual factors, and customer history."""
    txn = memory_store.get_transaction(txn_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    base_res = _build_response(memory_store, txn)
    cust = memory_store.get_customer(txn.customer_id)
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

    return TransactionDetailResponse(
        **base_res.model_dump(),
        shap_values=exp["shap_values"],
        top_drivers=exp["top_drivers"],
        factors_increasing_risk=exp.get("factors_increasing_risk"),
        factors_reducing_risk=exp.get("factors_reducing_risk"),
        customer_history_summary=cust_summary,
    )


@router.get("/{txn_id}/explanation")
def get_transaction_explanation(txn_id: int) -> dict[str, Any]:
    """Retrieve on-demand TreeSHAP explanations and counterfactual advice for a scored transaction."""
    txn = memory_store.get_transaction(txn_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    cust = memory_store.get_customer(txn.customer_id)
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

    return {
        "transaction_id": txn.id,
        "external_txn_id": txn.external_txn_id,
        "shap_values": exp["shap_values"],
        "top_drivers": exp["top_drivers"],
        "factors_increasing_risk": exp.get("factors_increasing_risk", []),
        "factors_reducing_risk": exp.get("factors_reducing_risk", []),
        "reason_codes": exp["reason_codes"],
        "counterfactual_hint": exp["counterfactual_hint"],
    }
