"""API routes for bank-side transaction event simulation & scenario injection."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.scoring import process_transaction
from app.services.simulator_service import simulator_service
from app.services.terminal_registry import REGISTERED_TERMINALS, ONLINE_GATEWAYS, IP_GEOLOCATION_TABLE

router = APIRouter(prefix="/simulator", tags=["simulator"])


class StartSimulatorRequest(BaseModel):
    rate_hz: float = Field(1.0, ge=0.1, le=5.0, description="Emissions per second (0.1 to 5.0)")


class ScenarioRequest(BaseModel):
    scenario: str = Field(
        ...,
        description="Bank fraud or genuine scenario name",
    )
    customer_id: str | None = Field(default="DEMO001", description="Persistent customer ID (e.g. DEMO001)")


class CustomBankEventRequest(BaseModel):
    customer_id: str = Field(default="DEMO001", description="Persistent customer ID")
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    channel: str = Field(..., pattern="^(pos|online|atm)$", description="Payment channel")
    terminal_id: str | None = Field(default=None, description="Registered POS terminal or ATM ID")
    merchant_id: str | None = Field(default=None, description="Merchant identifier or online gateway")
    ip_address: str | None = Field(default=None, description="Client IP address for online payments")
    device_key: str | None = Field(default=None, description="Device fingerprint where applicable")


@router.get("/status")
def get_simulator_status() -> dict[str, Any]:
    """Retrieve current bank switch generator running status, emission rate, and emitted count."""
    return simulator_service.get_status()


@router.get("/terminals")
def get_registered_terminals() -> dict[str, Any]:
    """Retrieve catalog of registered bank terminals, ATMs, and online gateways for event simulation."""
    return {
        "terminals": [
            {
                "terminal_id": t.terminal_id,
                "merchant_id": t.merchant_id,
                "merchant_name": t.merchant_name,
                "merchant_category": t.merchant_category,
                "channel": t.channel,
                "city": t.city,
                "lat": t.lat,
                "lon": t.lon,
                "address": t.address,
            }
            for t in REGISTERED_TERMINALS.values()
        ],
        "online_gateways": [
            {"gateway_id": gid, **ginfo}
            for gid, ginfo in ONLINE_GATEWAYS.items()
        ],
        "ip_presets": [
            {"ip": ip, **info}
            for ip, info in IP_GEOLOCATION_TABLE.items()
        ],
    }


@router.post("/start")
def start_simulator(req: StartSimulatorRequest = StartSimulatorRequest()) -> dict[str, Any]:
    """Start continuous background transaction streaming from bank switch."""
    return simulator_service.start(rate_hz=req.rate_hz)


@router.post("/stop")
def stop_simulator() -> dict[str, Any]:
    """Stop continuous streaming from bank switch."""
    return simulator_service.stop()


@router.post("/scenario")
@router.post("/inject")
def inject_scenario(req: ScenarioRequest) -> list[dict[str, Any]]:
    """Trigger one of the 7 controlled bank test scenarios.
    
    Supported scenarios:
    1. normal_usual_location: Normal POS purchase at home city.
    2. high_value_unusual_location: Extreme spend spike in another city.
    3. stolen_card_another_city: Unauthorized ATM cash withdrawal across state lines.
    4. impossible_travel: Rapid consecutive swipes with impossible physical travel speed.
    5. new_device_unusual_location: Unrecognized device at late night with unusual geo-IP.
    6. high_velocity_burst: Burst of rapid transactions within minutes.
    7. normal_new_location: Modest genuine purchase in a new city (travel, not fraud).
    """
    try:
        scenario_name = req.scenario
        # Backward compatibility aliases
        if scenario_name == "amount_spike":
            scenario_name = "high_value_unusual_location"
        elif scenario_name == "velocity_burst":
            scenario_name = "high_velocity_burst"
        elif scenario_name == "new_device_night":
            scenario_name = "new_device_unusual_location"

        return simulator_service.inject_scenario(scenario_name=scenario_name, customer_id=req.customer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/event", response_model=TransactionResponse)
def emit_custom_bank_event(req: CustomBankEventRequest) -> TransactionResponse:
    """Simulate a single incoming bank payment switch event with registered terminal or online gateway."""
    now = datetime.now(timezone.utc)
    txn_id = f"BNK-SWT-{uuid.uuid4().hex[:10].upper()}"

    txn_in = TransactionCreate(
        external_txn_id=txn_id,
        external_customer_id=req.customer_id,
        device_key=req.device_key,
        occurred_at=now,
        amount=req.amount,
        channel=req.channel,
        terminal_id=req.terminal_id,
        merchant_id=req.merchant_id,
        ip_address=req.ip_address,
        source="bank_switch",
        is_simulated=True,
    )

    res, _ = process_transaction(txn_in=txn_in)
    return res
