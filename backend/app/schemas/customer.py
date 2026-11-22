"""Pydantic schemas for customer profiles and associated card data."""
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CardSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_number_masked: str
    card_type: str
    status: str
    daily_limit: float
    current_day_spend: float
    international_enabled: bool
    online_enabled: bool
    last_freeze_reason: str | None = None


class CustomerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_customer_id: str
    name: str | None = None
    home_city: str | None = None
    home_lat: float | None = None
    home_lon: float | None = None
    avg_amount: float | None = None
    phone_masked: str | None = None
    primary_card: CardSummary | None = None
    is_simulated: bool = True
    created_at: datetime


class CustomerDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_customer_id: str
    name: str | None = None
    home_city: str | None = None
    home_lat: float | None = None
    home_lon: float | None = None
    avg_amount: float | None = None
    std_amount: float | None = None
    typical_hours: str | None = None
    common_channels: list[str] = Field(default_factory=list)
    total_historical_txns: int = 0
    usual_locations: list[str] = Field(default_factory=list)
    previous_fraud_count: int = 0
    previous_flagged_count: int = 0
    phone_masked: str | None = None
    phone_e164: str | None = None
    is_simulated: bool = True
    created_at: datetime
    cards: list[CardSummary] = Field(default_factory=list)
    devices: list[str] = Field(default_factory=list)


class DemoPhoneUpdateRequest(BaseModel):
    phone_e164: str = Field(..., min_length=10, max_length=20, description="Customer registered phone number in E.164 format (e.g. +919876543210)")


class CustomerCreateRequest(BaseModel):
    external_customer_id: str = Field(..., min_length=3, max_length=64, description="Unique customer identifier (e.g. CUST00101)")
    home_city: str | None = Field(None, description="Registered home city")
    home_lat: float | None = Field(None, description="Home latitude")
    home_lon: float | None = Field(None, description="Home longitude")
    avg_amount: float | None = Field(1500.0, ge=1.0, description="Typical average transaction amount (INR)")
    phone_e164: str | None = Field(None, description="Registered phone in E.164 format (e.g. +919876542019)")
    card_type: str = Field("Visa Signature", description="Credit card product tier")
    daily_limit: float = Field(100000.0, ge=1000.0, description="Daily spend limit (INR)")
