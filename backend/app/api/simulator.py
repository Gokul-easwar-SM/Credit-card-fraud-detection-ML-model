"""API routes for controlling the live transaction simulator."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.simulator_service import simulator_service

router = APIRouter(prefix="/simulator", tags=["simulator"])


class StartSimulatorRequest(BaseModel):
    rate_hz: float = Field(1.0, ge=0.1, le=10.0, description="Emissions per second (0.1 to 10.0)")


class InjectPatternRequest(BaseModel):
    pattern: str = Field(
        ...,
        pattern="^(amount_spike|impossible_travel|new_device_night|velocity_burst|shared_device_ring)$",
        description="Fraud attack pattern to inject",
    )
    customer_id: str | None = Field(None, description="Optional target victim customer ID")


@router.get("/status")
def get_simulator_status() -> dict[str, Any]:
    """Retrieve current simulator running status, rate, and total emitted counts."""
    return simulator_service.get_status()


@router.post("/start")
def start_simulator(req: StartSimulatorRequest = StartSimulatorRequest()) -> dict[str, Any]:
    """Start background streaming simulator emitting realistic transactions."""
    return simulator_service.start(rate_hz=req.rate_hz)


@router.post("/stop")
def stop_simulator() -> dict[str, Any]:
    """Stop the background streaming simulator."""
    return simulator_service.stop()


@router.post("/inject")
def inject_pattern(req: InjectPatternRequest) -> list[dict[str, Any]]:
    """Instantly inject a specific fraud attack pattern for live testing and demonstration."""
    try:
        return simulator_service.inject_pattern(pattern=req.pattern, customer_id=req.customer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
