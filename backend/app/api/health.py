"""Health check endpoint for Render, load balancers, and monitoring."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.db.memory_store import memory_store
from app.services.scoring import ModelService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check confirming ML model is loaded and in-memory store is healthy."""
    try:
        ms = ModelService.get_instance()
        model_status = "loaded" if ms.pipeline is not None else "unloaded"
    except Exception as e:
        logger.exception("Model service check failed: %s", e)
        model_status = "error"

    cust_count = len(memory_store.list_customers())
    return {
        "status": "ok",
        "storage": "in-memory",
        "persistence_note": "Academic demonstration: in-memory state resets when backend restarts.",
        "model_status": model_status,
        "customers_registered": str(cust_count),
    }
