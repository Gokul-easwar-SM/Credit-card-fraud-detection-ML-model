"""Pydantic schemas for investigations."""
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.transaction import AlertSummary, TransactionDetailResponse


class InvestigationListItem(BaseModel):
    id: int
    transaction_id: int
    external_txn_id: str
    external_customer_id: str
    occurred_at: datetime
    amount: float
    channel: str
    risk_band: str
    raw_score: float
    calibrated_score: float | None
    status: str
    priority_score: float
    decision: str | None = "review"
    priority_category: str | None = "Medium"
    financial_priority_score: float | None = None
    analyst_username: str | None = None
    notes: str | None = None
    updated_at: datetime


class PaginatedInvestigationsResponse(BaseModel):
    items: list[InvestigationListItem]
    total: int
    page: int
    page_size: int
    pages: int


class InvestigationDetailResponse(BaseModel):
    id: int
    status: str
    notes: str | None = None
    analyst_id: int | None = None
    analyst_username: str | None = None
    updated_at: datetime
    transaction: TransactionDetailResponse
    customer_verification: AlertSummary | None = None


class InvestigationUpdateRequest(BaseModel):
    status: str = Field(
        ...,
        pattern="^(pending_review|under_investigation|confirmed_fraud|marked_genuine|escalated|step_up_requested)$",
        description="Updated human decision status",
    )
    notes: str | None = Field(None, max_length=2000, description="Analyst investigation rationale")
