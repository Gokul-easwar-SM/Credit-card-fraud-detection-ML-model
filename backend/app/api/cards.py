"""API routes for customer card portfolio management and security controls."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.memory_store import Card, Customer, User, memory_store

router = APIRouter(prefix="/cards", tags=["cards"])


class CardResponse(BaseModel):
    id: int
    customer_id: int
    external_customer_id: str
    card_number_masked: str
    card_type: str
    status: str
    daily_limit: float
    current_day_spend: float
    international_enabled: bool
    online_enabled: bool
    last_freeze_reason: str | None = None
    updated_at: str


class FreezeCardRequest(BaseModel):
    reason: str = "Fraud prevention hold"


class CardSettingsRequest(BaseModel):
    daily_limit: float | None = None
    international_enabled: bool | None = None
    online_enabled: bool | None = None


def _card_to_response(card: Card) -> CardResponse:
    cust = memory_store.get_customer(card.customer_id)
    ext_id = cust.external_customer_id if cust else f"CUST_{card.customer_id}"
    return CardResponse(
        id=card.id,
        customer_id=card.customer_id,
        external_customer_id=ext_id,
        card_number_masked=card.card_number_masked,
        card_type=card.card_type,
        status=card.status,
        daily_limit=float(card.daily_limit),
        current_day_spend=float(card.current_day_spend),
        international_enabled=card.international_enabled,
        online_enabled=card.online_enabled,
        last_freeze_reason=card.last_freeze_reason,
        updated_at=card.updated_at.isoformat(),
    )


@router.get("", response_model=dict[str, Any])
def list_cards(
    status_filter: str | None = Query(None, alias="status", description="Filter by card status: active, frozen, blocked"),
    search: str | None = Query(None, description="Search by customer ID or masked card number"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> dict[str, Any]:
    """List customer cards with spend utilization and active status."""
    cards = memory_store.list_cards()

    if status_filter:
        cards = [c for c in cards if c.status == status_filter]

    if search and search.strip():
        q = search.strip().lower()
        matched = []
        for c in cards:
            cust = memory_store.get_customer(c.customer_id)
            ext_id = cust.external_customer_id.lower() if cust else ""
            if q in ext_id or q in c.card_number_masked.lower():
                matched.append(c)
        cards = matched

    # Sort: updated_at descending
    cards.sort(key=lambda c: c.updated_at, reverse=True)
    total = len(cards)
    offset = (page - 1) * page_size
    paged = cards[offset : offset + page_size]

    items = [_card_to_response(c).model_dump() for c in paged]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/{customer_id}", response_model=CardResponse)
def get_card_by_customer(customer_id: str) -> CardResponse:
    """Retrieve card details by customer ID or external customer identifier."""
    cust = memory_store.get_customer(customer_id)
    if cust is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    card = memory_store.get_card_by_customer_id(cust.id)
    if card is None:
        # Create deterministic fallback card
        card = memory_store.create_card(
            customer_id=cust.id,
            card_number_masked="•••• •••• •••• 9901",
            card_type="Visa Signature",
            status="active",
        )
    return _card_to_response(card)


@router.post("/{card_id}/toggle-freeze", response_model=CardResponse)
def toggle_card_freeze(
    card_id: int,
    req: FreezeCardRequest,
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Toggle card status between active and frozen with audit logging."""
    card = memory_store.get_card(card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    prev_status = card.status
    new_status = "active" if card.status == "frozen" else "frozen"
    card.status = new_status
    card.last_freeze_reason = req.reason if new_status == "frozen" else None
    card.updated_at = datetime.now(timezone.utc)

    memory_store.log_audit(
        action="toggle_card_freeze",
        entity_type="card",
        entity_id=str(card.id),
        user_id=current_user.id,
        details={
            "previous_status": prev_status,
            "new_status": new_status,
            "reason": req.reason,
            "analyst": current_user.username,
        },
    )

    return _card_to_response(card)


@router.post("/{card_id}/block", response_model=CardResponse)
def block_card(
    card_id: int,
    req: FreezeCardRequest,
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Permanently block card due to confirmed fraud."""
    card = memory_store.get_card(card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    card.status = "blocked"
    card.last_freeze_reason = req.reason
    card.updated_at = datetime.now(timezone.utc)

    memory_store.log_audit(
        action="block_card",
        entity_type="card",
        entity_id=str(card.id),
        user_id=current_user.id,
        details={
            "status": "blocked",
            "reason": req.reason,
            "analyst": current_user.username,
        },
    )

    return _card_to_response(card)


@router.patch("/{card_id}/settings", response_model=CardResponse)
def update_card_settings(
    card_id: int,
    req: CardSettingsRequest,
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Update transaction limits and channel permissions."""
    card = memory_store.get_card(card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    if req.daily_limit is not None:
        card.daily_limit = Decimal(str(req.daily_limit))
    if req.international_enabled is not None:
        card.international_enabled = req.international_enabled
    if req.online_enabled is not None:
        card.online_enabled = req.online_enabled

    card.updated_at = datetime.now(timezone.utc)
    return _card_to_response(card)
