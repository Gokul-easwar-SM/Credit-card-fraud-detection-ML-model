"""Pydantic schemas for customer verification alerts and responses."""
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class AlertResponse(BaseModel):
    id: int
    transaction_id: int
    external_txn_id: str
    customer_id: int
    external_customer_id: str
    channel: str
    message: str
    status: str
    delivery_state: str | None = None
    provider: str | None = None
    provider_message_id: str | None = None
    phone_masked: str | None = None
    error: str | None = None
    attempts: int
    customer_response: str | None = None
    created_at: datetime
    updated_at: datetime


class CustomerResponseRequest(BaseModel):
    response: str = Field(
        ...,
        pattern="^(yes_me|not_me)$",
        description="Customer response: 'yes_me' (genuine) or 'not_me' (fraud)",
    )
