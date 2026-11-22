"""Bank-side transaction event simulator & scenario controller.

Simulates incoming payment events emitted by core banking switch infrastructure
(POS terminals, ATM networks, and E-Commerce Payment Gateways).

Implements 7 controlled academic test scenarios:
1. normal_usual_location: Routine transaction at customer's usual location.
2. high_value_unusual_location: Severe spend shock in an unusual city.
3. stolen_card_another_city: Unauthorized ATM withdrawal in another city.
4. impossible_travel: Consecutive transactions with physical travel speed > 1,500 km/h.
5. new_device_unusual_location: Unrecognized device at late night with unusual geo-IP.
6. high_velocity_burst: Burst of rapid transactions within minutes.
7. normal_new_location: Modest genuine purchase in a new city (travel, not fraud).
"""
from __future__ import annotations

import logging
import random
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.memory_store import memory_store
from app.schemas.transaction import TransactionCreate
from app.services.scoring import process_transaction
from app.services.terminal_registry import REGISTERED_TERMINALS, ONLINE_GATEWAYS, IP_GEOLOCATION_TABLE

logger = logging.getLogger(__name__)


class BankTransactionSimulator:
    """Enterprise bank transaction event controller and synthetic scenario generator."""

    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._is_running = False
        self._rate_hz: float = 1.0
        self._emitted_count: int = 0
        self._last_emitted_at: datetime | None = None
        self._lock = threading.Lock()

        # Stable persistent customer IDs seeded in memory store
        self.stable_customers = ["DEMO001", "CUST00001", "CUST00002", "CUST00003", "CUST00004", "CUST00005"]

    def get_status(self) -> dict[str, Any]:
        """Return live telemetry of bank switch generator."""
        with self._lock:
            return {
                "is_running": self._is_running,
                "rate_hz": self._rate_hz,
                "emitted_count": self._emitted_count,
                "last_emitted_at": self._last_emitted_at.isoformat() if self._last_emitted_at else None,
                "environment": "Bank Core Switch Simulator (Sandbox / Academic Demo)",
            }

    def start(self, rate_hz: float = 1.0) -> dict[str, Any]:
        """Start continuous background transaction streaming from bank switch."""
        with self._lock:
            if self._is_running:
                self._rate_hz = rate_hz
                return self.get_status()

            self._rate_hz = max(0.2, min(5.0, rate_hz))
            self._stop_event.clear()
            self._is_running = True
            self._thread = threading.Thread(target=self._run_streaming_loop, daemon=True)
            self._thread.start()

        logger.info("Bank Switch Simulator started streaming at %.1f Hz", self._rate_hz)
        return self.get_status()

    def stop(self) -> dict[str, Any]:
        """Stop background streaming."""
        with self._lock:
            if not self._is_running:
                return self.get_status()
            self._stop_event.set()
            self._is_running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

        logger.info("Bank Switch Simulator stopped.")
        return self.get_status()

    def inject_scenario(self, scenario_name: str, customer_id: str | None = None) -> list[dict[str, Any]]:
        """Trigger one of the 7 controlled bank fraud & genuine test scenarios.

        Each scenario generates real incoming transaction events that pass through
        the complete scoring pipeline, persist in memory, and publish to the analyst SSE stream.
        """
        cid = customer_id or "DEMO001"
        cust = memory_store.get_customer(cid)
        if cust is None:
            cid = "DEMO001"
            cust = memory_store.get_customer("DEMO001")

        now = datetime.now(timezone.utc)
        results: list[dict[str, Any]] = []

        # -------------------------------------------------------------
        # Scenario 1: Normal transaction at customer's usual location
        # -------------------------------------------------------------
        if scenario_name in ("normal_usual_location", "normal_coffee"):
            term = REGISTERED_TERMINALS["TERM-CBE-POS-101"] if cust.home_city == "Coimbatore" else (
                REGISTERED_TERMINALS.get(f"TERM-{cust.home_city[:3].upper()}-POS-101") or REGISTERED_TERMINALS["TERM-CBE-POS-101"]
            )
            txn_in = TransactionCreate(
                external_txn_id=f"BNK-NORM-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now,
                amount=450.00,
                channel="pos",
                terminal_id=term.terminal_id,
                merchant_id=term.merchant_id,
                merchant_name=term.merchant_name,
                merchant_category=term.merchant_category,
                city=term.city,
                lat=term.lat,
                lon=term.lon,
                source="bank_switch",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 2: High-value transaction at an unusual location
        # -------------------------------------------------------------
        elif scenario_name in ("high_value_unusual_location", "amount_spike"):
            # Customer from Coimbatore/Chennai transacting at Mumbai luxury jeweler for ₹88,500
            term = REGISTERED_TERMINALS["TERM-MUM-POS-401"]  # Zaveri Jewellers Mumbai
            txn_in = TransactionCreate(
                external_txn_id=f"BNK-HVAL-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now,
                amount=88500.00,
                channel="pos",
                terminal_id=term.terminal_id,
                merchant_id=term.merchant_id,
                merchant_name=term.merchant_name,
                merchant_category=term.merchant_category,
                city=term.city,
                lat=term.lat,
                lon=term.lon,
                source="bank_switch",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 3: Stolen-card transaction in another city (ATM cashout)
        # -------------------------------------------------------------
        elif scenario_name in ("stolen_card_another_city", "stolen_card_atm"):
            # Physical ATM cash withdrawal in Kolkata (>1800 km away)
            term = REGISTERED_TERMINALS["ATM-KOL-01"]  # PNB ATM Park Street Kolkata
            txn_in = TransactionCreate(
                external_txn_id=f"BNK-STLN-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now,
                amount=25000.00,
                channel="atm",
                terminal_id=term.terminal_id,
                merchant_id=term.merchant_id,
                merchant_name=term.merchant_name,
                merchant_category=term.merchant_category,
                city=term.city,
                lat=term.lat,
                lon=term.lon,
                source="bank_switch",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 4: Impossible travel between consecutive transactions
        # -------------------------------------------------------------
        elif scenario_name == "impossible_travel":
            # Event 1: Genuine swipe in Chennai 15 minutes ago
            term_che = REGISTERED_TERMINALS["TERM-CHE-POS-201"]  # Apollo Pharmacy Chennai
            t1 = TransactionCreate(
                external_txn_id=f"BNK-TRV1-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now - timedelta(minutes=15),
                amount=650.00,
                channel="pos",
                terminal_id=term_che.terminal_id,
                merchant_id=term_che.merchant_id,
                merchant_name=term_che.merchant_name,
                merchant_category=term_che.merchant_category,
                city=term_che.city,
                lat=term_che.lat,
                lon=term_che.lon,
                source="bank_switch",
                is_simulated=True,
            )
            r1, _ = process_transaction(txn_in=t1)
            results.append(r1.model_dump(mode="json"))

            # Event 2: Immediate POS swipe in Delhi now (1,760 km away in 15 mins -> >7,000 km/h!)
            term_del = REGISTERED_TERMINALS["TERM-DEL-POS-501"]  # Croma Connaught Place Delhi
            t2 = TransactionCreate(
                external_txn_id=f"BNK-TRV2-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now,
                amount=14800.00,
                channel="pos",
                terminal_id=term_del.terminal_id,
                merchant_id=term_del.merchant_id,
                merchant_name=term_del.merchant_name,
                merchant_category=term_del.merchant_category,
                city=term_del.city,
                lat=term_del.lat,
                lon=term_del.lon,
                source="bank_switch",
                is_simulated=True,
            )
            r2, _ = process_transaction(txn_in=t2)
            results.append(r2.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 5: New device and unusual location (late night online)
        # -------------------------------------------------------------
        elif scenario_name in ("new_device_unusual_location", "new_device_night"):
            # Unseen hardware ID, night-time (02:35 AM), Delhi IP address
            night_time = now.replace(hour=2, minute=random.randint(15, 45))
            txn_in = TransactionCreate(
                external_txn_id=f"BNK-DEVN-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=f"DEV-UNRECOGNIZED-{uuid.uuid4().hex[:6].upper()}",
                occurred_at=night_time,
                amount=42500.00,
                channel="online",
                terminal_id="GATEWAY-APLE",
                merchant_id="MERCH-ONL-APLE",
                merchant_name="Apple Store Online India",
                merchant_category="electronics",
                ip_address="115.112.78.90",  # Delhi IP
                source="bank_switch",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 6: High transaction velocity (rapid succession burst)
        # -------------------------------------------------------------
        elif scenario_name in ("high_velocity_burst", "velocity_burst"):
            amounts = [8500.00, 14200.00, 26000.00, 41500.00]
            delays = [18, 12, 6, 0]  # minutes ago
            for i in range(4):
                t_in = TransactionCreate(
                    external_txn_id=f"BNK-VEL{i+1}-{uuid.uuid4().hex[:8].upper()}",
                    external_customer_id=cid,
                    device_key=f"DEV-{cid}-A",
                    occurred_at=now - timedelta(minutes=delays[i]),
                    amount=amounts[i],
                    channel="online",
                    terminal_id="GATEWAY-FLPK",
                    merchant_id="MERCH-ONL-FLPK",
                    merchant_name="Flipkart Internet Marketplace",
                    merchant_category="ecommerce_marketplace",
                    ip_address="49.37.112.45",
                    source="bank_switch",
                    is_simulated=True,
                )
                res, _ = process_transaction(txn_in=t_in)
                results.append(res.model_dump(mode="json"))

        # -------------------------------------------------------------
        # Scenario 7: Normal transaction from a new location (not fraud!)
        # -------------------------------------------------------------
        elif scenario_name in ("normal_new_location", "travel_coffee_genuine"):
            # Customer travels domestically (e.g. Coimbatore to Bengaluru for business).
            # To simulate genuine travel (and not impossible travel teleportation),
            # timestamp occurs after realistic travel duration (5+ hours after prior transaction)
            prior = memory_store.get_customer_prior_transactions(cust.id, now)
            t_occurred = now
            if prior:
                last_p = prior[-1]
                diff_sec = (now - last_p.occurred_at).total_seconds()
                if diff_sec < 18000:  # less than 5 hours
                    t_occurred = last_p.occurred_at + timedelta(hours=5, minutes=20)

            term = REGISTERED_TERMINALS["TERM-BLR-POS-302"]  # Third Wave Coffee Koramangala
            txn_in = TransactionCreate(
                external_txn_id=f"BNK-TRVL-OK-{uuid.uuid4().hex[:8].upper()}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=t_occurred,
                amount=780.00,  # Modest normal spend!
                channel="pos",
                terminal_id=term.terminal_id,
                merchant_id=term.merchant_id,
                merchant_name=term.merchant_name,
                merchant_category=term.merchant_category,
                city=term.city,
                lat=term.lat,
                lon=term.lon,
                source="bank_switch",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        else:
            raise ValueError(
                f"Unknown scenario '{scenario_name}'. Supported scenarios: "
                f"normal_usual_location, high_value_unusual_location, stolen_card_another_city, "
                f"impossible_travel, new_device_unusual_location, high_velocity_burst, normal_new_location"
            )

        with self._lock:
            self._emitted_count += len(results)
            self._last_emitted_at = now

        return results

    def _run_streaming_loop(self) -> None:
        """Background continuous transaction stream generator."""
        iteration = 0
        terminal_list = list(REGISTERED_TERMINALS.values())

        while not self._stop_event.is_set():
            delay = 1.0 / max(0.1, self._rate_hz)
            time.sleep(delay)
            if self._stop_event.is_set():
                break

            iteration += 1
            now = datetime.now(timezone.utc)

            # Pick a customer from stable pool
            cid = random.choice(self.stable_customers[:5])
            cust = memory_store.get_customer(cid)
            if cust is None:
                continue

            # Every 15th transaction emit an attack pattern
            if iteration % 15 == 0:
                pattern = random.choice([
                    "high_value_unusual_location",
                    "impossible_travel",
                    "new_device_unusual_location",
                    "stolen_card_another_city",
                ])
                try:
                    self.inject_scenario(pattern, customer_id=cid)
                except Exception as exc:
                    logger.warning("Error injecting stream pattern: %s", exc)
                continue

            # Routine normal transaction
            # 70% in customer's home city
            if random.random() < 0.70:
                home_terms = [t for t in terminal_list if t.city == cust.home_city]
                term = random.choice(home_terms) if home_terms else random.choice(terminal_list)
            else:
                term = random.choice(terminal_list)

            chan = term.channel
            amt = round(random.uniform(150.0, float(cust.avg_amount or 1500.0) * 1.4), 2)
            dev_key = f"DEV-{cid}-A" if chan == "online" else None

            txn_in = TransactionCreate(
                external_txn_id=f"BNK-STRM-{uuid.uuid4().hex[:10].upper()}",
                external_customer_id=cid,
                device_key=dev_key,
                occurred_at=now,
                amount=amt,
                channel=chan,
                terminal_id=term.terminal_id,
                merchant_id=term.merchant_id,
                merchant_name=term.merchant_name,
                merchant_category=term.merchant_category,
                city=term.city,
                lat=term.lat,
                lon=term.lon,
                source="bank_switch",
                is_simulated=True,
            )

            try:
                process_transaction(txn_in=txn_in)
                with self._lock:
                    self._emitted_count += 1
                    self._last_emitted_at = now
            except Exception as exc:
                logger.error("Simulator stream emission error: %s", exc)


# Global singleton
simulator_service = BankTransactionSimulator()
