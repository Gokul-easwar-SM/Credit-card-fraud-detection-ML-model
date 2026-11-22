"""Pydantic schemas for transaction ingestion, filtering, scoring, and response."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionCreate(BaseModel):
    """Payload for submitting a transaction to be scored and persisted."""

    external_txn_id: str = Field(..., min_length=1, max_length=64, description="Unique transaction ID from source")
    external_customer_id: str = Field(..., min_length=1, max_length=64, description="Unique customer ID")
    device_key: str | None = Field(default=None, max_length=64, description="Device fingerprint (where applicable)")
    occurred_at: datetime = Field(..., description="Timestamp of transaction occurrence")
    amount: float = Field(..., gt=0, description="Transaction amount (must be strictly positive)")
    channel: Literal["pos", "online", "atm"] = Field(..., description="Payment channel")
    lat: float | None = Field(default=None, ge=-90.0, le=90.0, description="Latitude (derived from terminal/IP if omitted)")
    lon: float | None = Field(default=None, ge=-180.0, le=180.0, description="Longitude (derived from terminal/IP if omitted)")
    merchant_id: str | None = Field(default=None, max_length=64, description="Merchant identifier")
    merchant_name: str | None = Field(default=None, max_length=128, description="Merchant legal/trading name")
    merchant_category: str | None = Field(default=None, max_length=64, description="Merchant category code/classification")
    terminal_id: str | None = Field(default=None, max_length=64, description="Physical POS or ATM terminal identifier")
    city: str | None = Field(default=None, max_length=64, description="Transaction city")
    ip_address: str | None = Field(default=None, max_length=64, description="Customer IP address for online payments")
    source: Literal["simulator", "manual", "sandbox", "bank_switch"] = Field(default="bank_switch", description="Transaction origin")
    is_simulated: bool = Field(default=True, description="Flag indicating synthetic transaction")
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
    merchant_id: str | None = None
    merchant_name: str | None = None
    merchant_category: str | None = None
    terminal_id: str | None = None
    city: str | None = None
    ip_address: str | None = None
    location_source: str | None = None
    distance_from_prev_km: float | None = None
    time_since_prev_sec: float | None = None
    speed_kmh: float | None = None
    is_unusual_location: bool | None = None
    prev_txn_id: int | None = None
    prev_city: str | None = None
    prev_lat: float | None = None
    prev_lon: float | None = None
    prev_merchant: str | None = None
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
