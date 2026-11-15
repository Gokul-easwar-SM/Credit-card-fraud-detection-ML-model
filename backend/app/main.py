"""FastAPI application entrypoint for the Credit Card Fraud Detection System.

Configured for fast deployment (Render / Vercel) with an in-memory high performance store.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, auth, cards, customers, health, investigations, metrics, relationships, simulator, stream, transactions
from app.api.auth import init_default_users
from app.api.customers import init_default_customers
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.memory_store import memory_store
from app.services.scoring import ModelService
from app.services.simulator_service import simulator_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging(get_settings().log_level)
    # 1. Validate and load model artifacts at startup
    ModelService.get_instance()

    # 2. Seed default users, demo customer DEMO001, and realistic baseline transactions
    memory_store.seed_defaults()
    init_default_users()
    init_default_customers()

    yield

    # Ensure background simulator stops gracefully on shutdown
    simulator_service.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="FraudSentinel - Explainable Fraud Intelligence API",
        description="High-performance in-memory fraud detection backend for transaction scoring and analyst operations.",
        version="2.0.0",
        lifespan=lifespan,
    )

    # Enable CORS for the React/TypeScript frontend (localhost, Vercel, Render)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    @app.get("/", tags=["root"])
    def root():
        return {
            "name": "FraudSentinel AI Intelligence API",
            "version": "2.0.0",
            "status": "online",
            "docs": "/docs",
            "health": "/health",
            "message": "FraudSentinel backend is running successfully on Render with in-memory store and ML models loaded.",
        }

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(customers.router)
    app.include_router(cards.router)
    app.include_router(transactions.router)
    app.include_router(investigations.router)
    app.include_router(alerts.router)
    app.include_router(metrics.router)
    app.include_router(relationships.router)
    app.include_router(stream.router)
    app.include_router(simulator.router)

    return app


app = create_app()
