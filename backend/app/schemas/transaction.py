"""Pydantic schemas for transaction ingestion, filtering, scoring, and response."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionCreate(BaseModel):
    """Payload for submitting a transaction to be scored and persisted."""

    external_txn_id: str = Field(..., min_length=1, max_length=64, description="Unique transaction ID from source")
    external_customer_id: str = Field(..., min_length=1, max_length=64, description="Unique customer ID")
    device_key: str | None = Field(default=None, max_length=64, description="Device fingerprint (required for online)")
    occurred_at: datetime = Field(..., description="Timestamp of transaction occurrence")
    amount: float = Field(..., gt=0, description="Transaction amount (must be strictly positive)")
    channel: Literal["pos", "online", "atm"] = Field(..., description="Payment channel")
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude of transaction")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude of transaction")
    source: Literal["simulator", "manual", "sandbox"] = Field(default="manual", description="Transaction origin")
    is_simulated: bool = Field(default=False, description="Flag indicating synthetic transaction")
    currency: str = Field(default="INR", max_length=3, description="ISO currency code")

    @field_validator("occurred_at")
    @classmethod
    def ensure_valid_datetime(cls, v: datetime) -> datetime:
        if v is None:
            raise ValueError("occurred_at must be a valid datetime")
        return v


class PredictionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_score: float
    calibrated_score: float
    predicted_label: str
    risk_band: str
    recommended_action: str
    reason_codes: list[str] = Field(default_factory=list)
    counterfactual_hint: str | None = None
    model_version: str
    decision: str = "approve"
    financial_priority_score: float = 0.0
    priority_category: str = "Low"
    evidence_sufficiency: str = "mature"
    device_shared_cust_count: int = 1


class AlertSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel: str
    status: str
    message: str
    delivery_state: str | None = None
    provider: str | None = None
    provider_message_id: str | None = None
    phone_masked: str | None = None
    error: str | None = None
    dispatched_at: datetime | None = None


class InvestigationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    notes: str | None = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_txn_id: str
    external_customer_id: str
    device_key: str | None = None
    occurred_at: datetime
    amount: float
    currency: str
    channel: str
    lat: float | None = None
    lon: float | None = None
    source: str
    is_simulated: bool
    prediction: PredictionDetail | None = None
    alert: AlertSummary | None = None
    investigation: InvestigationSummary | None = None


class TransactionDetailResponse(TransactionResponse):
    """Detailed transaction response with full SHAP attributions, dual factor drivers, and customer history."""

    shap_values: dict[str, float] | None = None
    top_drivers: list[dict[str, Any]] | None = None
    factors_increasing_risk: list[dict[str, Any]] | None = None
    factors_reducing_risk: list[dict[str, Any]] | None = None
    customer_history_summary: dict[str, Any] | None = None


class PaginatedTransactionsResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
