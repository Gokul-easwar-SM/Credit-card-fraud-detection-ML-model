"""Lightweight in-memory data store for FraudSentinel.

Replaces database (SQLite / SQLAlchemy / Alembic) with high-performance,
thread-safe in-memory collections suitable for fast deployment (Render / Vercel)
and academic demonstrations.

NOTE: As per academic demo design, state resides in memory and resets cleanly
when the backend restarts.
"""
from __future__ import annotations

import random
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import bcrypt


def _hash_pw(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


IST = timezone(timedelta(hours=5, minutes=30))


@dataclass
class User:
    id: int
    username: str
    password_hash: str
    role: str = "analyst"
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Card:
    id: int
    customer_id: int
    card_number_masked: str
    card_type: str = "Visa Signature"
    status: str = "active"  # "active", "frozen", "blocked"
    daily_limit: Decimal = Decimal("150000.00")
    current_day_spend: Decimal = Decimal("0.00")
    international_enabled: bool = True
    online_enabled: bool = True
    last_freeze_reason: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Customer:
    id: int
    external_customer_id: str
    name: str | None = None
    home_city: str | None = "Coimbatore"
    home_lat: float | None = 11.0168
    home_lon: float | None = 76.9558
    avg_amount: Decimal | None = Decimal("1450.00")
    std_amount: Decimal | None = Decimal("420.00")
    typical_hours: str = "08:30 - 21:30"
    common_channels: list[str] = field(default_factory=lambda: ["pos", "online"])
    phone_e164: str | None = "+919876542019"
    is_simulated: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Device:
    id: int
    device_key: str
    device_type: str = "mobile_browser"
    os: str = "Android"
    first_seen_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Transaction:
    id: int
    external_txn_id: str
    customer_id: int
    device_id: int | None
    occurred_at: datetime
    amount: Decimal
    currency: str = "INR"
    channel: str = "pos"
    lat: float | None = None
    lon: float | None = None
    merchant_id: str | None = None
    merchant_name: str | None = None
    merchant_category: str | None = None
    terminal_id: str | None = None
    city: str | None = None
    ip_address: str | None = None
    location_source: str = "terminal_pos"
    prev_txn_id: int | None = None
    prev_city: str | None = None
    prev_lat: float | None = None
    prev_lon: float | None = None
    prev_merchant: str | None = None
    distance_from_prev_km: float | None = None
    time_since_prev_sec: float | None = None
    speed_kmh: float | None = None
    is_unusual_location: bool = False
    source: str = "bank_switch"
    is_simulated: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ModelVersion:
    id: int
    version: str
    artifact_path: str
    feature_names: list
    thresholds: dict
    metrics: dict
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Prediction:
    id: int
    transaction_id: int
    model_version_id: int
    raw_score: float
    calibrated_score: float
    predicted_label: str
    risk_band: str
    recommended_action: str
    reason_codes: list[str] = field(default_factory=list)
    decision: str = "approve"
    financial_priority_score: float = 0.0
    priority_category: str = "Low"
    evidence_sufficiency: str = "mature"
    device_shared_cust_count: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Investigation:
    id: int
    transaction_id: int
    status: str = "pending_review"  # "pending_review", "under_investigation", "confirmed_fraud", "marked_genuine"
    notes: str | None = None
    analyst_id: int | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Alert:
    id: int
    transaction_id: int
    prediction_id: int | None
    channel: str = "simulated"
    message: str = ""
    status: str = "pending"  # "pending", "sent", "failed", "delivered"
    provider_message_id: str | None = None
    error: str | None = None
    attempts: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class CustomerResponse:
    id: int
    alert_id: int
    response: str
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class AuditLog:
    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: str | None
    details: dict | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class MemoryStore:
    """Thread-safe in-memory database replacement."""

    _instance: MemoryStore | None = None

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._seq = {
            "user": 0,
            "customer": 0,
            "card": 0,
            "device": 0,
            "transaction": 0,
            "model_version": 0,
            "prediction": 0,
            "investigation": 0,
            "alert": 0,
            "response": 0,
            "audit": 0,
        }
        self.users: dict[int, User] = {}
        self.users_by_username: dict[str, User] = {}

        self.customers: dict[int, Customer] = {}
        self.customers_by_ext_id: dict[str, Customer] = {}

        self.cards: dict[int, Card] = {}
        self.cards_by_customer_id: dict[int, Card] = {}

        self.devices: dict[int, Device] = {}
        self.devices_by_key: dict[str, Device] = {}

        self.transactions: dict[int, Transaction] = {}
        self.transactions_by_ext_id: dict[str, Transaction] = {}

        self.model_versions: dict[int, ModelVersion] = {}
        self.predictions: dict[int, Prediction] = {}
        self.predictions_by_txn_id: dict[int, Prediction] = {}

        self.investigations: dict[int, Investigation] = {}
        self.investigations_by_txn_id: dict[int, Investigation] = {}

        self.alerts: dict[int, Alert] = {}
        self.alerts_by_txn_id: dict[int, list[Alert]] = {}

        self.customer_responses: dict[int, CustomerResponse] = {}
        self.audit_logs: list[AuditLog] = []

        self.seed_defaults()

    @classmethod
    def get_instance(cls) -> MemoryStore:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _next_id(self, entity: str) -> int:
        self._seq[entity] += 1
        return self._seq[entity]

    def reset(self) -> None:
        """Reset in-memory state cleanly and reseed defaults."""
        with self._lock:
            self.users.clear()
            self.users_by_username.clear()
            self.customers.clear()
            self.customers_by_ext_id.clear()
            self.cards.clear()
            self.cards_by_customer_id.clear()
            self.devices.clear()
            self.devices_by_key.clear()
            self.transactions.clear()
            self.transactions_by_ext_id.clear()
            self.model_versions.clear()
            self.predictions.clear()
            self.predictions_by_txn_id.clear()
            self.investigations.clear()
            self.investigations_by_txn_id.clear()
            self.alerts.clear()
            self.alerts_by_txn_id.clear()
            self.customer_responses.clear()
            self.audit_logs.clear()
            for k in self._seq:
                self._seq[k] = 0
            self.seed_defaults()

    # --- Seeding ---
    def seed_defaults(self) -> None:
        """Seed initial users, realistic demo customer profiles with 20-35 historical transactions each."""
        with self._lock:
            # 1. Users
            if not self.users:
                self.create_user("analyst", "analyst123", "analyst")
                self.create_user("admin", "admin123", "admin")

            # 2. Customers & Cards
            if not self.customers_by_ext_id.get("DEMO001"):
                now = datetime.now(timezone.utc)
                from app.services.terminal_registry import REGISTERED_TERMINALS, ONLINE_GATEWAYS

                # Profile 1: Aarav Patel (DEMO001) - Established Mature Profile in Coimbatore
                demo_cust = self.create_customer(
                    external_customer_id="DEMO001",
                    name="Aarav Patel (Primary Demo)",
                    home_city="Coimbatore",
                    home_lat=11.0168,
                    home_lon=76.9558,
                    avg_amount=Decimal("1450.00"),
                    std_amount=Decimal("420.00"),
                    typical_hours="08:30 - 21:30",
                    common_channels=["pos", "online", "atm"],
                    phone_e164="+919876542019",
                )
                self.create_card(
                    customer_id=demo_cust.id,
                    card_number_masked="•••• •••• •••• 9901",
                    card_type="Visa Signature",
                    status="active",
                    daily_limit=Decimal("150000.00"),
                )
                dev_a = self.get_or_create_device("DEV-DEMO001-A")
                dev_a.device_type = "mobile_android"
                dev_a.os = "Android 14 (Pixel 8 Pro)"
                dev_b = self.get_or_create_device("DEV-DEMO001-B")
                dev_b.device_type = "laptop_chrome"
                dev_b.os = "macOS (Chrome 128)"

                # Seed 32 historical transactions across 28 days for DEMO001
                cbe_terms = [
                    REGISTERED_TERMINALS["TERM-CBE-POS-101"],
                    REGISTERED_TERMINALS["TERM-CBE-POS-102"],
                    REGISTERED_TERMINALS["TERM-CBE-POS-103"],
                    REGISTERED_TERMINALS["ATM-CBE-01"],
                ]
                for day_offset in range(28, 0, -1):
                    # 1 to 2 transactions per day
                    t_time = now - timedelta(days=day_offset, hours=random.randint(2, 6), minutes=random.randint(10, 50))
                    term = cbe_terms[day_offset % len(cbe_terms)]
                    is_online = (day_offset % 4 == 0)
                    ch = "online" if is_online else term.channel
                    amt = Decimal(str(round(random.uniform(250.0, 3200.0), 2)))
                    t_hist = self.create_transaction(
                        external_txn_id=f"TXN-HIST-D001-{day_offset:03d}",
                        customer_id=demo_cust.id,
                        device_id=dev_a.id if is_online else None,
                        occurred_at=t_time,
                        amount=amt,
                        currency="INR",
                        channel=ch,
                        lat=term.lat,
                        lon=term.lon,
                        merchant_id="MERCH-ONL-AMZN" if is_online else term.merchant_id,
                        merchant_name="Amazon India Marketplace" if is_online else term.merchant_name,
                        merchant_category="ecommerce_marketplace" if is_online else term.merchant_category,
                        terminal_id="GATEWAY-AMZN" if is_online else term.terminal_id,
                        city="Coimbatore",
                        ip_address="49.37.112.45" if is_online else None,
                        location_source="ip_geolocation" if is_online else ("terminal_pos" if ch == "pos" else "atm_registry"),
                        distance_from_prev_km=round(random.uniform(0.5, 4.2), 2),
                        time_since_prev_sec=round(random.uniform(43200.0, 86400.0), 1),
                        speed_kmh=round(random.uniform(5.0, 25.0), 1),
                        is_unusual_location=False,
                        source="bank_switch",
                        is_simulated=True,
                    )
                    self.create_prediction(
                        transaction_id=t_hist.id,
                        model_version_id=1,
                        raw_score=0.03,
                        calibrated_score=0.02,
                        predicted_label="genuine",
                        risk_band="low",
                        recommended_action="monitor",
                        decision="approve",
                        financial_priority_score=float(amt) * 0.02,
                        priority_category="Low",
                        evidence_sufficiency="mature",
                        reason_codes=["Standard baseline spend", "Recognized cardholder merchant corridor"],
                    )

                # Seed immediately previous transaction for DEMO001 (Coffee swipe in Coimbatore, 25 mins ago)
                last_term = REGISTERED_TERMINALS["TERM-CBE-POS-101"]
                t_last = self.create_transaction(
                    external_txn_id=f"TXN-PREV-D001-COFFEE",
                    customer_id=demo_cust.id,
                    device_id=None,
                    occurred_at=now - timedelta(minutes=25),
                    amount=Decimal("380.00"),
                    currency="INR",
                    channel="pos",
                    lat=last_term.lat,
                    lon=last_term.lon,
                    merchant_id=last_term.merchant_id,
                    merchant_name=last_term.merchant_name,
                    merchant_category=last_term.merchant_category,
                    terminal_id=last_term.terminal_id,
                    city="Coimbatore",
                    location_source="terminal_pos",
                    distance_from_prev_km=1.8,
                    time_since_prev_sec=28800.0,
                    speed_kmh=0.2,
                    is_unusual_location=False,
                    source="bank_switch",
                    is_simulated=True,
                )
                self.create_prediction(
                    transaction_id=t_last.id,
                    model_version_id=1,
                    raw_score=0.02,
                    calibrated_score=0.01,
                    predicted_label="genuine",
                    risk_band="low",
                    recommended_action="monitor",
                    decision="approve",
                    financial_priority_score=3.8,
                    priority_category="Low",
                    evidence_sufficiency="mature",
                    reason_codes=["Routine morning spend", "Local home corridor"],
                )

                # Profile 2: Priya Sharma (CUST00001) - Chennai Mature Profile
                c1 = self.create_customer(
                    external_customer_id="CUST00001",
                    name="Priya Sharma",
                    home_city="Chennai",
                    home_lat=13.0827,
                    home_lon=80.2707,
                    avg_amount=Decimal("2800.00"),
                    std_amount=Decimal("850.00"),
                    typical_hours="09:00 - 22:00",
                    common_channels=["pos", "online"],
                    phone_e164="+919876542001",
                )
                self.create_card(
                    customer_id=c1.id,
                    card_number_masked="•••• •••• •••• 4182",
                    card_type="Visa Platinum",
                    status="active",
                    daily_limit=Decimal("200000.00"),
                )
                dev_c1 = self.get_or_create_device("DEV-CUST00001-A")
                dev_c1.device_type = "mobile_ios"
                dev_c1.os = "iOS 18 (iPhone 15)"

                che_terms = [
                    REGISTERED_TERMINALS["TERM-CHE-POS-201"],
                    REGISTERED_TERMINALS["TERM-CHE-POS-202"],
                    REGISTERED_TERMINALS["ATM-CHE-01"],
                ]
                for day_offset in range(24, 0, -1):
                    t_time = now - timedelta(days=day_offset, hours=random.randint(1, 4))
                    term = che_terms[day_offset % len(che_terms)]
                    amt = Decimal(str(round(random.uniform(600.0, 4800.0), 2)))
                    t_c1 = self.create_transaction(
                        external_txn_id=f"TXN-HIST-C001-{day_offset:03d}",
                        customer_id=c1.id,
                        device_id=dev_c1.id if day_offset % 3 == 0 else None,
                        occurred_at=t_time,
                        amount=amt,
                        currency="INR",
                        channel=term.channel,
                        lat=term.lat,
                        lon=term.lon,
                        merchant_id=term.merchant_id,
                        merchant_name=term.merchant_name,
                        merchant_category=term.merchant_category,
                        terminal_id=term.terminal_id,
                        city="Chennai",
                        location_source="terminal_pos" if term.channel == "pos" else "atm_registry",
                        distance_from_prev_km=round(random.uniform(0.8, 6.0), 2),
                        time_since_prev_sec=round(random.uniform(36000.0, 72000.0), 1),
                        speed_kmh=round(random.uniform(5.0, 30.0), 1),
                        is_unusual_location=False,
                        source="bank_switch",
                        is_simulated=True,
                    )
                    self.create_prediction(
                        transaction_id=t_c1.id,
                        model_version_id=1,
                        raw_score=0.03,
                        calibrated_score=0.02,
                        predicted_label="genuine",
                        risk_band="low",
                        recommended_action="monitor",
                        decision="approve",
                        financial_priority_score=float(amt) * 0.02,
                        priority_category="Low",
                        evidence_sufficiency="mature",
                        reason_codes=["Routine retail spend", "Verified Chennai home corridor"],
                    )

                # Profile 3: Vikram Reddy (CUST00002) - Bengaluru Mature Profile (1 past verified alert)
                c2 = self.create_customer(
                    external_customer_id="CUST00002",
                    name="Vikram Reddy",
                    home_city="Bengaluru",
                    home_lat=12.9716,
                    home_lon=77.5946,
                    avg_amount=Decimal("3500.00"),
                    std_amount=Decimal("1200.00"),
                    typical_hours="10:00 - 23:00",
                    common_channels=["pos", "online", "atm"],
                    phone_e164="+919876542002",
                )
                self.create_card(
                    customer_id=c2.id,
                    card_number_masked="•••• •••• •••• 7731",
                    card_type="Mastercard World",
                    status="active",
                    daily_limit=Decimal("300000.00"),
                )
                dev_c2 = self.get_or_create_device("DEV-CUST00002-A")
                blr_terms = [
                    REGISTERED_TERMINALS["TERM-BLR-POS-301"],
                    REGISTERED_TERMINALS["TERM-BLR-POS-302"],
                    REGISTERED_TERMINALS["ATM-BLR-01"],
                ]
                for day_offset in range(30, 0, -1):
                    t_time = now - timedelta(days=day_offset, hours=random.randint(2, 5))
                    term = blr_terms[day_offset % len(blr_terms)]
                    amt = Decimal(str(round(random.uniform(900.0, 6500.0), 2)))
                    t_c2 = self.create_transaction(
                        external_txn_id=f"TXN-HIST-C002-{day_offset:03d}",
                        customer_id=c2.id,
                        device_id=dev_c2.id if day_offset % 2 == 0 else None,
                        occurred_at=t_time,
                        amount=amt,
                        currency="INR",
                        channel=term.channel,
                        lat=term.lat,
                        lon=term.lon,
                        merchant_id=term.merchant_id,
                        merchant_name=term.merchant_name,
                        merchant_category=term.merchant_category,
                        terminal_id=term.terminal_id,
                        city="Bengaluru",
                        location_source="terminal_pos" if term.channel == "pos" else "atm_registry",
                        source="bank_switch",
                        is_simulated=True,
                    )
                    self.create_prediction(
                        transaction_id=t_c2.id,
                        model_version_id=1,
                        raw_score=0.04,
                        calibrated_score=0.03,
                        predicted_label="genuine",
                        risk_band="low",
                        recommended_action="monitor",
                        decision="approve",
                        financial_priority_score=float(amt) * 0.03,
                        priority_category="Low",
                        evidence_sufficiency="mature",
                        reason_codes=["Routine tech corridor spend"],
                    )

                # Profile 4: Ananya Iyer (CUST00003) - Mumbai Luxury/Retail Profile
                c3 = self.create_customer(
                    external_customer_id="CUST00003",
                    name="Ananya Iyer",
                    home_city="Mumbai",
                    home_lat=19.0760,
                    home_lon=72.8777,
                    avg_amount=Decimal("5200.00"),
                    std_amount=Decimal("1800.00"),
                    typical_hours="11:00 - 22:30",
                    common_channels=["pos", "online"],
                    phone_e164="+919876542003",
                )
                self.create_card(
                    customer_id=c3.id,
                    card_number_masked="•••• •••• •••• 5590",
                    card_type="Visa Infinite",
                    status="active",
                    daily_limit=Decimal("500000.00"),
                )

                # Profile 5: Rajesh Kumar (CUST00004) - Delhi Profile
                c4 = self.create_customer(
                    external_customer_id="CUST00004",
                    name="Rajesh Kumar",
                    home_city="Delhi",
                    home_lat=28.6139,
                    home_lon=77.2090,
                    avg_amount=Decimal("1850.00"),
                    std_amount=Decimal("600.00"),
                    typical_hours="09:00 - 20:00",
                    common_channels=["pos", "online", "atm"],
                    phone_e164="+919876542004",
                )
                self.create_card(
                    customer_id=c4.id,
                    card_number_masked="•••• •••• •••• 8211",
                    card_type="Mastercard Platinum",
                    status="active",
                    daily_limit=Decimal("150000.00"),
                )

                # Profile 6: Sneha Verma (CUST00005) - Cold-Start Profile (Only 1 transaction)
                c5 = self.create_customer(
                    external_customer_id="CUST00005",
                    name="Sneha Verma (New Account - Cold Start)",
                    home_city="Hyderabad",
                    home_lat=17.3850,
                    home_lon=78.4867,
                    avg_amount=Decimal("1200.00"),
                    std_amount=Decimal("300.00"),
                    typical_hours="09:00 - 21:00",
                    common_channels=["pos"],
                    phone_e164="+919876542005",
                )
                self.create_card(
                    customer_id=c5.id,
                    card_number_masked="•••• •••• •••• 1044",
                    card_type="Visa Classic",
                    status="active",
                    daily_limit=Decimal("75000.00"),
                )
                # Seed only 1 initial transaction for CUST00005 to demonstrate cold-start handling
                t_cold = self.create_transaction(
                    external_txn_id="TXN-COLD-C005-01",
                    customer_id=c5.id,
                    device_id=None,
                    occurred_at=now - timedelta(days=2),
                    amount=Decimal("850.00"),
                    currency="INR",
                    channel="pos",
                    lat=17.4359,
                    lon=78.3828,
                    merchant_id="MERCH-HYD-MALL-01",
                    merchant_name="Inorbit Mall Cyberabad",
                    merchant_category="retail",
                    terminal_id="TERM-HYD-POS-601",
                    city="Hyderabad",
                    location_source="terminal_pos",
                    source="bank_switch",
                    is_simulated=True,
                )
                self.create_prediction(
                    transaction_id=t_cold.id,
                    model_version_id=1,
                    raw_score=0.08,
                    calibrated_score=0.07,
                    predicted_label="genuine",
                    risk_band="low",
                    recommended_action="monitor",
                    decision="approve",
                    financial_priority_score=59.5,
                    priority_category="Low",
                    evidence_sufficiency="cold_start",
                    reason_codes=["Account onboarding activation swipe", "Cold-start profile (<3 transactions)"],
                )

                # Seed relationship graph cluster: shared device between CUST00002 and CUST00003
                shared_dev = self.get_or_create_device("DEV-MULE-SHARED-09")
                shared_dev.device_type = "mobile_android"
                t2 = self.create_transaction(
                    external_txn_id="TXN-SEED-MULE-01",
                    customer_id=c2.id,
                    device_id=shared_dev.id,
                    occurred_at=now - timedelta(hours=3),
                    amount=Decimal("48500.00"),
                    currency="INR",
                    channel="online",
                    lat=12.9716,
                    lon=77.5946,
                    source="simulator",
                    is_simulated=True,
                )
                self.create_prediction(
                    transaction_id=t2.id,
                    model_version_id=1,
                    raw_score=0.78,
                    calibrated_score=0.74,
                    predicted_label="potential_fraud",
                    risk_band="high",
                    recommended_action="investigate",
                    decision="decline",
                    financial_priority_score=53835.0,
                    priority_category="Critical",
                    evidence_sufficiency="developing",
                    device_shared_cust_count=2,
                    reason_codes=["Shared hardware device across multiple cardholder IDs", "High value burst attempt"],
                )
                self.create_investigation(
                    transaction_id=t2.id,
                    status="pending_review",
                    notes="Automated priority alert: Shared device cluster identified across CUST00002 and CUST00003.",
                )

                t3 = self.create_transaction(
                    external_txn_id="TXN-SEED-MULE-02",
                    customer_id=c3.id,
                    device_id=shared_dev.id,
                    occurred_at=now - timedelta(hours=2, minutes=45),
                    amount=Decimal("52000.00"),
                    currency="INR",
                    channel="online",
                    lat=19.0760,
                    lon=72.8777,
                    source="simulator",
                    is_simulated=True,
                )
                self.create_prediction(
                    transaction_id=t3.id,
                    model_version_id=1,
                    raw_score=0.82,
                    calibrated_score=0.79,
                    predicted_label="potential_fraud",
                    risk_band="high",
                    recommended_action="investigate",
                    decision="decline",
                    financial_priority_score=61620.0,
                    priority_category="Critical",
                    evidence_sufficiency="developing",
                    device_shared_cust_count=2,
                    reason_codes=["Rapid cross-account transaction on shared device DEV-MULE-SHARED-09"],
                )
                self.create_investigation(
                    transaction_id=t3.id,
                    status="pending_review",
                    notes="Automated priority alert: Rapid repeat on shared device DEV-MULE-SHARED-09 within 15 mins.",
                )

    # --- User operations ---
    def create_user(self, username: str, plain_pw: str, role: str = "analyst") -> User:
        with self._lock:
            uid = self._next_id("user")
            user = User(
                id=uid,
                username=username,
                password_hash=_hash_pw(plain_pw),
                role=role,
                is_active=True,
            )
            self.users[uid] = user
            self.users_by_username[username] = user
            return user

    def get_user_by_username(self, username: str) -> User | None:
        with self._lock:
            return self.users_by_username.get(username)

    def get_user_by_id(self, uid: int) -> User | None:
        with self._lock:
            return self.users.get(uid)

    # --- Customer operations ---
    def create_customer(
        self,
        external_customer_id: str,
        name: str | None = None,
        home_city: str | None = None,
        home_lat: float | None = None,
        home_lon: float | None = None,
        avg_amount: Decimal | None = None,
        std_amount: Decimal | None = None,
        typical_hours: str | None = "08:30 - 21:30",
        common_channels: list[str] | None = None,
        phone_e164: str | None = None,
        is_simulated: bool = True,
    ) -> Customer:
        with self._lock:
            cid = self._next_id("customer")
            c = Customer(
                id=cid,
                external_customer_id=external_customer_id,
                name=name or (f"Customer {external_customer_id}" if external_customer_id != "DEMO001" else "Aarav Patel (Demo)"),
                home_city=home_city,
                home_lat=home_lat,
                home_lon=home_lon,
                avg_amount=avg_amount,
                std_amount=std_amount or Decimal("400.00"),
                typical_hours=typical_hours or "08:30 - 21:30",
                common_channels=common_channels or ["pos", "online"],
                phone_e164=phone_e164,
                is_simulated=is_simulated,
            )
            self.customers[cid] = c
            self.customers_by_ext_id[external_customer_id] = c
            return c

    def get_customer(self, identifier: str | int) -> Customer | None:
        with self._lock:
            if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
                c = self.customers.get(int(identifier))
                if c:
                    return c
            return self.customers_by_ext_id.get(str(identifier))

    def list_customers(self) -> list[Customer]:
        with self._lock:
            # DEMO001 first, then others
            items = list(self.customers.values())
            items.sort(key=lambda c: (0 if c.external_customer_id == "DEMO001" else 1, c.id))
            return items

    # --- Card operations ---
    def create_card(
        self,
        customer_id: int,
        card_number_masked: str,
        card_type: str = "Visa Signature",
        status: str = "active",
        daily_limit: Decimal = Decimal("150000.00"),
        current_day_spend: Decimal = Decimal("0.00"),
        international_enabled: bool = True,
        online_enabled: bool = True,
    ) -> Card:
        with self._lock:
            cid = self._next_id("card")
            card = Card(
                id=cid,
                customer_id=customer_id,
                card_number_masked=card_number_masked,
                card_type=card_type,
                status=status,
                daily_limit=daily_limit,
                current_day_spend=current_day_spend,
                international_enabled=international_enabled,
                online_enabled=online_enabled,
            )
            self.cards[cid] = card
            self.cards_by_customer_id[customer_id] = card
            return card

    def get_card(self, card_id: int) -> Card | None:
        with self._lock:
            return self.cards.get(card_id)

    def get_card_by_customer_id(self, customer_id: int) -> Card | None:
        with self._lock:
            return self.cards_by_customer_id.get(customer_id)

    def list_cards(self) -> list[Card]:
        with self._lock:
            return list(self.cards.values())

    # --- Device operations ---
    def get_or_create_device(self, device_key: str) -> Device:
        with self._lock:
            if device_key in self.devices_by_key:
                return self.devices_by_key[device_key]
            did = self._next_id("device")
            dev = Device(id=did, device_key=device_key)
            self.devices[did] = dev
            self.devices_by_key[device_key] = dev
            return dev

    def get_device(self, device_id: int) -> Device | None:
        with self._lock:
            return self.devices.get(device_id)

    # --- Transaction operations ---
    def create_transaction(
        self,
        external_txn_id: str,
        customer_id: int,
        device_id: int | None,
        occurred_at: datetime,
        amount: Decimal,
        currency: str = "INR",
        channel: str = "pos",
        lat: float | None = None,
        lon: float | None = None,
        merchant_id: str | None = None,
        merchant_name: str | None = None,
        merchant_category: str | None = None,
        terminal_id: str | None = None,
        city: str | None = None,
        ip_address: str | None = None,
        location_source: str = "terminal_pos",
        prev_txn_id: int | None = None,
        prev_city: str | None = None,
        prev_lat: float | None = None,
        prev_lon: float | None = None,
        prev_merchant: str | None = None,
        distance_from_prev_km: float | None = None,
        time_since_prev_sec: float | None = None,
        speed_kmh: float | None = None,
        is_unusual_location: bool = False,
        source: str = "bank_switch",
        is_simulated: bool = True,
    ) -> Transaction:
        with self._lock:
            tid = self._next_id("transaction")
            txn = Transaction(
                id=tid,
                external_txn_id=external_txn_id,
                customer_id=customer_id,
                device_id=device_id,
                occurred_at=occurred_at,
                amount=amount,
                currency=currency,
                channel=channel,
                lat=lat,
                lon=lon,
                merchant_id=merchant_id,
                merchant_name=merchant_name,
                merchant_category=merchant_category,
                terminal_id=terminal_id,
                city=city,
                ip_address=ip_address,
                location_source=location_source,
                prev_txn_id=prev_txn_id,
                prev_city=prev_city,
                prev_lat=prev_lat,
                prev_lon=prev_lon,
                prev_merchant=prev_merchant,
                distance_from_prev_km=distance_from_prev_km,
                time_since_prev_sec=time_since_prev_sec,
                speed_kmh=speed_kmh,
                is_unusual_location=is_unusual_location,
                source=source,
                is_simulated=is_simulated,
            )
            self.transactions[tid] = txn
            self.transactions_by_ext_id[external_txn_id] = txn
            return txn

    def get_transaction(self, tid: int) -> Transaction | None:
        with self._lock:
            return self.transactions.get(tid)

    def get_transaction_by_ext_id(self, ext_id: str) -> Transaction | None:
        with self._lock:
            return self.transactions_by_ext_id.get(ext_id)

    def list_transactions(self) -> list[Transaction]:
        with self._lock:
            return list(self.transactions.values())

    def get_customer_prior_transactions(self, customer_id: int, occurred_at: datetime) -> list[Transaction]:
        with self._lock:
            # Strictly earlier transactions
            occ = occurred_at.astimezone(timezone.utc) if occurred_at.tzinfo else occurred_at.replace(tzinfo=timezone.utc)
            txns = [
                t for t in self.transactions.values()
                if t.customer_id == customer_id and (
                    t.occurred_at.astimezone(timezone.utc) if t.occurred_at.tzinfo else t.occurred_at.replace(tzinfo=timezone.utc)
                ) < occ
            ]
            txns.sort(key=lambda t: t.occurred_at)
            return txns

    def get_device_prior_transactions(self, device_id: int, occurred_at: datetime) -> list[Transaction]:
        with self._lock:
            occ = occurred_at.astimezone(timezone.utc) if occurred_at.tzinfo else occurred_at.replace(tzinfo=timezone.utc)
            txns = [
                t for t in self.transactions.values()
                if t.device_id == device_id and (
                    t.occurred_at.astimezone(timezone.utc) if t.occurred_at.tzinfo else t.occurred_at.replace(tzinfo=timezone.utc)
                ) < occ
            ]
            txns.sort(key=lambda t: t.occurred_at)
            return txns

    # --- Prediction operations ---
    def create_prediction(
        self,
        transaction_id: int,
        model_version_id: int,
        raw_score: float,
        calibrated_score: float,
        predicted_label: str,
        risk_band: str,
        recommended_action: str,
        reason_codes: list[str] | None = None,
        decision: str = "approve",
        financial_priority_score: float = 0.0,
        priority_category: str = "Low",
        evidence_sufficiency: str = "mature",
        device_shared_cust_count: int = 1,
    ) -> Prediction:
        with self._lock:
            pid = self._next_id("prediction")
            pred = Prediction(
                id=pid,
                transaction_id=transaction_id,
                model_version_id=model_version_id,
                raw_score=raw_score,
                calibrated_score=calibrated_score,
                predicted_label=predicted_label,
                risk_band=risk_band,
                recommended_action=recommended_action,
                reason_codes=reason_codes or [],
                decision=decision,
                financial_priority_score=financial_priority_score,
                priority_category=priority_category,
                evidence_sufficiency=evidence_sufficiency,
                device_shared_cust_count=device_shared_cust_count,
            )
            self.predictions[pid] = pred
            self.predictions_by_txn_id[transaction_id] = pred
            return pred

    def get_prediction_by_txn_id(self, txn_id: int) -> Prediction | None:
        with self._lock:
            return self.predictions_by_txn_id.get(txn_id)

    # --- Investigation operations ---
    def create_investigation(
        self,
        transaction_id: int,
        status: str = "pending_review",
        notes: str | None = None,
        analyst_id: int | None = None,
    ) -> Investigation:
        with self._lock:
            iid = self._next_id("investigation")
            inv = Investigation(
                id=iid,
                transaction_id=transaction_id,
                status=status,
                notes=notes,
                analyst_id=analyst_id,
            )
            self.investigations[iid] = inv
            self.investigations_by_txn_id[transaction_id] = inv
            return inv

    def get_investigation(self, iid: int) -> Investigation | None:
        with self._lock:
            return self.investigations.get(iid)

    def get_investigation_by_txn_id(self, txn_id: int) -> Investigation | None:
        with self._lock:
            return self.investigations_by_txn_id.get(txn_id)

    def list_investigations(self) -> list[Investigation]:
        with self._lock:
            return list(self.investigations.values())

    # --- Alert operations ---
    def create_alert(
        self,
        transaction_id: int,
        prediction_id: int | None,
        channel: str,
        message: str,
        status: str = "pending",
        provider_message_id: str | None = None,
        error: str | None = None,
        attempts: int = 1,
    ) -> Alert:
        with self._lock:
            aid = self._next_id("alert")
            alert = Alert(
                id=aid,
                transaction_id=transaction_id,
                prediction_id=prediction_id,
                channel=channel,
                message=message,
                status=status,
                provider_message_id=provider_message_id,
                error=error,
                attempts=attempts,
            )
            self.alerts[aid] = alert
            if transaction_id not in self.alerts_by_txn_id:
                self.alerts_by_txn_id[transaction_id] = []
            self.alerts_by_txn_id[transaction_id].append(alert)
            return alert

    def get_alert(self, aid: int) -> Alert | None:
        with self._lock:
            return self.alerts.get(aid)

    def get_alerts_by_txn_id(self, txn_id: int) -> list[Alert]:
        with self._lock:
            return list(self.alerts_by_txn_id.get(txn_id, []))

    def list_alerts(self) -> list[Alert]:
        with self._lock:
            return list(self.alerts.values())

    # --- Customer responses ---
    def create_customer_response(self, alert_id: int, response: str) -> CustomerResponse:
        with self._lock:
            crid = self._next_id("response")
            resp = CustomerResponse(id=crid, alert_id=alert_id, response=response)
            self.customer_responses[crid] = resp
            return resp

    def get_customer_response_by_alert_id(self, alert_id: int) -> CustomerResponse | None:
        with self._lock:
            for r in self.customer_responses.values():
                if r.alert_id == alert_id:
                    return r
            return None

    # --- Audit log ---
    def log_audit(
        self,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        user_id: int | None = None,
        details: dict | None = None,
    ) -> AuditLog:
        with self._lock:
            alid = self._next_id("audit")
            rec = AuditLog(
                id=alid,
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details,
            )
            self.audit_logs.append(rec)
            return rec

    def list_audit_logs(self) -> list[AuditLog]:
        with self._lock:
            return list(self.audit_logs)


memory_store = MemoryStore.get_instance()
