"""API routes for customer profile management and card associations."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from fastapi import APIRouter, HTTPException, Query, status

from app.db.memory_store import Card, Customer, memory_store
from app.schemas.customer import (
    CardSummary,
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerListItem,
    DemoPhoneUpdateRequest,
)

router = APIRouter(prefix="/customers", tags=["customers"])


def get_customer_name(external_id: str) -> str:
    """Return friendly name for demo customer or standard formatting."""
    if external_id == "DEMO001":
        return "FraudSentinel Demo Customer"
    return f"Customer {external_id}"


def mask_phone_number(phone: str | None) -> str | None:
    """Mask registered phone number to preserve confidentiality."""
    if not phone:
        return None
    cleaned = phone.strip()
    if len(cleaned) >= 10:
        return f"{cleaned[:3]} ••••• ••{cleaned[-3:]}"
    return f"••••••{cleaned[-3:]}" if len(cleaned) >= 3 else "••••"


def _build_card_summary(card: Card | None) -> CardSummary | None:
    if card is None:
        return None
    return CardSummary(
        id=card.id,
        card_number_masked=card.card_number_masked,
        card_type=card.card_type,
        status=card.status,
        daily_limit=float(card.daily_limit),
        current_day_spend=float(card.current_day_spend),
        international_enabled=card.international_enabled,
        online_enabled=card.online_enabled,
        last_freeze_reason=card.last_freeze_reason,
    )


def _find_customer(identifier: str) -> Customer | None:
    """Find customer by integer ID or external_customer_id in memory store."""
    return memory_store.get_customer(identifier)


@router.get("", response_model=list[CustomerListItem])
def list_customers(
    search: str | None = Query(None, description="Search by customer ID or home city"),
    limit: int = Query(50, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Offset"),
) -> list[CustomerListItem]:
    """List registered customer profiles and their primary card for selection."""
    customers = memory_store.list_customers()
    if search and isinstance(search, str) and search.strip():
        q = search.strip().lower()
        customers = [
            c for c in customers
            if q in c.external_customer_id.lower() or (c.home_city and q in c.home_city.lower())
        ]

    limit_val = limit if isinstance(limit, int) else 50
    offset_val = offset if isinstance(offset, int) else 0
    paged = customers[offset_val : offset_val + limit_val]

    results: list[CustomerListItem] = []
    for c in paged:
        card = memory_store.get_card_by_customer_id(c.id)
        results.append(
            CustomerListItem(
                id=c.id,
                external_customer_id=c.external_customer_id,
                name=get_customer_name(c.external_customer_id),
                home_city=c.home_city,
                home_lat=c.home_lat,
                home_lon=c.home_lon,
                avg_amount=float(c.avg_amount) if c.avg_amount is not None else None,
                phone_masked=mask_phone_number(c.phone_e164),
                primary_card=_build_card_summary(card),
                is_simulated=c.is_simulated,
                created_at=c.created_at,
            )
        )
    return results


@router.get("/{identifier}", response_model=CustomerDetailResponse)
def get_customer_profile(identifier: str) -> CustomerDetailResponse:
    """Retrieve full customer profile, associated card status, and authorized devices."""
    customer = _find_customer(identifier)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{identifier}' not found in registry",
        )

    card = memory_store.get_card_by_customer_id(customer.id)
    card_summaries = [_build_card_summary(card)] if card else []

    prior_txns = memory_store.get_customer_prior_transactions(customer.id, datetime.now(timezone.utc))
    devices = list({
        memory_store.get_device(t.device_id).device_key
        for t in prior_txns
        if t.device_id and memory_store.get_device(t.device_id)
    })
    if not devices:
        devices = [f"DEV-{customer.external_customer_id}-A"]

    return CustomerDetailResponse(
        id=customer.id,
        external_customer_id=customer.external_customer_id,
        name=get_customer_name(customer.external_customer_id),
        home_city=customer.home_city,
        home_lat=customer.home_lat,
        home_lon=customer.home_lon,
        avg_amount=float(customer.avg_amount) if customer.avg_amount is not None else None,
        phone_masked=mask_phone_number(customer.phone_e164),
        phone_e164=customer.phone_e164,
        is_simulated=customer.is_simulated,
        created_at=customer.created_at,
        cards=card_summaries,
        devices=devices,
    )


@router.put("/{identifier}/phone", response_model=CustomerDetailResponse)
def update_customer_phone(
    identifier: str,
    req: DemoPhoneUpdateRequest,
) -> CustomerDetailResponse:
    """Update customer's registered mobile phone number."""
    customer = _find_customer(identifier)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{identifier}' not found",
        )

    customer.phone_e164 = req.phone_e164.strip()
    return get_customer_profile(identifier)


@router.post("", response_model=CustomerDetailResponse, status_code=status.HTTP_201_CREATED)
def create_customer(req: CustomerCreateRequest) -> CustomerDetailResponse:
    """Register a new customer profile and issue a simulated primary card."""
    existing = memory_store.get_customer(req.external_customer_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer '{req.external_customer_id}' already registered",
        )

    cust = memory_store.create_customer(
        external_customer_id=req.external_customer_id,
        home_city=req.home_city or "Coimbatore",
        home_lat=req.home_lat or 11.0168,
        home_lon=req.home_lon or 76.9558,
        avg_amount=Decimal(str(req.avg_amount or 1500.0)),
        phone_e164=req.phone_e164,
        is_simulated=True,
    )

    last4 = f"{random.randint(1000, 9999)}"
    memory_store.create_card(
        customer_id=cust.id,
        card_number_masked=f"•••• •••• •••• {last4}",
        card_type=req.card_type,
        status="active",
        daily_limit=Decimal(str(req.daily_limit)),
    )

    return get_customer_profile(cust.external_customer_id)


def init_default_customers(_db: Any = None) -> None:
    """Ensure baseline demo customers are initialized in memory store."""
    memory_store.seed_defaults()
