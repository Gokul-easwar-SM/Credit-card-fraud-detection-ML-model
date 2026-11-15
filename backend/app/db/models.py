"""In-memory data models for FraudSentinel.

Replaces SQLAlchemy declarative tables with lightweight in-memory dataclasses.
Maintains full schema and attribute compatibility across all routers and services.
"""
from __future__ import annotations

from app.db.memory_store import (
    Alert,
    AuditLog,
    Card,
    Customer,
    CustomerResponse,
    Device,
    Investigation,
    ModelVersion,
    Prediction,
    Transaction,
    User,
    memory_store,
)

ROLES = ("analyst", "admin")
SOURCES = ("simulator", "manual", "sandbox")
CHANNELS = ("pos", "online", "atm")
PRED_LABELS = ("genuine", "potential_fraud")
RISK_BANDS = ("low", "medium", "high")
ACTIONS = ("monitor", "verify", "investigate")
ALERT_CHANNELS = ("simulated", "sms", "telegram")
ALERT_STATUSES = ("pending", "sent", "failed", "delivered")
INVESTIGATION_STATUSES = ("pending_review", "under_investigation", "confirmed_fraud", "marked_genuine")
CUSTOMER_RESPONSES = ("yes_me", "not_me")
ENVIRONMENTS = ("sandbox", "production")
CARD_STATUSES = ("active", "frozen", "blocked")

__all__ = [
    "User",
    "Customer",
    "Card",
    "Device",
    "Transaction",
    "ModelVersion",
    "Prediction",
    "Investigation",
    "Alert",
    "CustomerResponse",
    "AuditLog",
    "memory_store",
    "ROLES",
    "SOURCES",
    "CHANNELS",
    "PRED_LABELS",
    "RISK_BANDS",
    "ACTIONS",
    "ALERT_CHANNELS",
    "ALERT_STATUSES",
    "INVESTIGATION_STATUSES",
    "CUSTOMER_RESPONSES",
    "ENVIRONMENTS",
    "CARD_STATUSES",
]
