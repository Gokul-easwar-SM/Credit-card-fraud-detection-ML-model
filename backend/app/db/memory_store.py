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
    home_city: str | None = "Coimbatore"
    home_lat: float | None = 11.0168
    home_lon: float | None = 76.9558
    avg_amount: Decimal | None = Decimal("1250.00")
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
    source: str = "manual"
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

    # --- Seeding ---
    def seed_defaults(self) -> None:
        """Seed initial users, demo customers, baseline transactions, and cards."""
        with self._lock:
            # 1. Users
            if not self.users:
                self.create_user("analyst", "analyst123", "analyst")
                self.create_user("admin", "admin123", "admin")

            # 2. Customers & Cards
            if not self.customers_by_ext_id.get("DEMO001"):
                demo_cust = self.create_customer(
                    external_customer_id="DEMO001",
                    home_city="Coimbatore",
                    home_lat=11.0168,
                    home_lon=76.9558,
                    avg_amount=Decimal("1250.00"),
                    phone_e164="+919876542019",
                )
                self.create_card(
                    customer_id=demo_cust.id,
                    card_number_masked="•••• •••• •••• 9901",
                    card_type="Visa Signature",
                    status="active",
                    daily_limit=Decimal("150000.00"),
                )

                # Seed baseline coffee transaction for DEMO001 in Coimbatore 15 mins prior
                now = datetime.now(timezone.utc)
                base_device = self.get_or_create_device("DEV-DEMO001-A")
                t_base = self.create_transaction(
                    external_txn_id=f"TXN-BASE-{int(now.timestamp()) - 900}",
                    customer_id=demo_cust.id,
                    device_id=base_device.id,
                    occurred_at=now - timedelta(minutes=15),
                    amount=Decimal("250.00"),
                    currency="INR",
                    channel="pos",
                    lat=11.0168,
                    lon=76.9558,
                    source="simulator",
                    is_simulated=True,
                )
                # Low risk prediction
                self.create_prediction(
                    transaction_id=t_base.id,
                    model_version_id=1,
                    raw_score=0.04,
                    calibrated_score=0.02,
                    predicted_label="genuine",
                    risk_band="low",
                    recommended_action="monitor",
                    reason_codes=["Standard baseline spend", "Recognized cardholder device"],
                )

            # 3. Seed other realistic customers
            cities = [
                ("Coimbatore", 11.0168, 76.9558),
                ("Chennai", 13.0827, 80.2707),
                ("Bengaluru", 12.9716, 77.5946),
                ("Hyderabad", 17.3850, 78.4867),
                ("Mumbai", 19.0760, 72.8777),
                ("Delhi", 28.6139, 77.2090),
                ("Kochi", 9.9312, 76.2673),
            ]
            for i in range(1, 16):
                cid = f"CUST{i:05d}"
                if cid not in self.customers_by_ext_id:
                    city, lat, lon = cities[(i - 1) % len(cities)]
                    c = self.create_customer(
                        external_customer_id=cid,
                        home_city=city,
                        home_lat=round(lat + random.uniform(-0.02, 0.02), 4),
                        home_lon=round(lon + random.uniform(-0.02, 0.02), 4),
                        avg_amount=Decimal(str(round(random.uniform(900.0, 7500.0), 2))),
                        phone_e164=f"+91987654{2000 + i:04d}",
                    )
                    last4 = f"{1000 + (i * 247) % 9000}"
                    self.create_card(
                        customer_id=c.id,
                        card_number_masked=f"•••• •••• •••• {last4}",
                        card_type="Visa Platinum" if i % 2 == 0 else "Mastercard World",
                        status="active",
                        daily_limit=Decimal("100000.00"),
                    )

            # 4. Seed realistic relationship graph cluster: shared hardware device between CUST00002 and CUST00003
            c2 = self.customers_by_ext_id.get("CUST00002")
            c3 = self.customers_by_ext_id.get("CUST00003")
            if c2 and c3 and not self.transactions_by_ext_id.get("TXN-SEED-MULE-01"):
                shared_dev = self.get_or_create_device("DEV-MULE-SHARED-09")
                shared_dev.device_type = "mobile_android"
                now = datetime.now(timezone.utc)
                t2 = self.create_transaction(
                    external_txn_id="TXN-SEED-MULE-01",
                    customer_id=c2.id,
                    device_id=shared_dev.id,
                    occurred_at=now - timedelta(hours=3),
                    amount=Decimal("48500.00"),
                    currency="INR",
                    channel="online",
                    lat=13.0827,
                    lon=80.2707,
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
                    lat=13.0827,
                    lon=80.2707,
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
        home_city: str | None = None,
        home_lat: float | None = None,
        home_lon: float | None = None,
        avg_amount: Decimal | None = None,
        phone_e164: str | None = None,
        is_simulated: bool = True,
    ) -> Customer:
        with self._lock:
            cid = self._next_id("customer")
            c = Customer(
                id=cid,
                external_customer_id=external_customer_id,
                home_city=home_city,
                home_lat=home_lat,
                home_lon=home_lon,
                avg_amount=avg_amount,
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
        source: str = "manual",
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
