"""Live transaction simulator service for real-time streaming demonstration."""
from __future__ import annotations

import logging
import random
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas.transaction import TransactionCreate
from app.services.scoring import process_transaction

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

CITIES: list[tuple[str, float, float]] = [
    ("Chennai", 13.0827, 80.2707),
    ("Coimbatore", 11.0168, 76.9558),
    ("Bengaluru", 12.9716, 77.5946),
    ("Hyderabad", 17.3850, 78.4867),
    ("Mumbai", 19.0760, 72.8777),
    ("Delhi", 28.6139, 77.2090),
    ("Kolkata", 22.5726, 88.3639),
    ("Kochi", 9.9312, 76.2673),
]

CHANNELS = ["pos", "online", "atm"]


class SimulatorService:
    """Manages background synthetic transaction generation."""

    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._is_running = False
        self._rate_hz: float = 1.0
        self._emitted_count: int = 0
        self._last_emitted_at: datetime | None = None
        self._lock = threading.Lock()

        # Predefined customer profiles for realistic history
        self._customers = [f"CUST_{i:04d}" for i in range(1, 101)]
        self._customer_cities = {
            cid: random.choice(CITIES) for cid in self._customers
        }
        self._customer_devices = {
            cid: f"DEV_{cid}_{random.randint(1, 2)}" for cid in self._customers
        }

    def start(self, rate_hz: float = 1.0) -> dict[str, Any]:
        """Start background simulation thread."""
        with self._lock:
            if self._is_running:
                self._rate_hz = rate_hz
                return self.get_status()

            self._rate_hz = max(0.1, min(10.0, rate_hz))
            self._stop_event.clear()
            self._is_running = True
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

        logger.info("Simulator started at rate %.1f Hz", self._rate_hz)
        return self.get_status()

    def stop(self) -> dict[str, Any]:
        """Stop background simulation thread."""
        with self._lock:
            if not self._is_running:
                return self.get_status()
            self._stop_event.set()
            self._is_running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

        logger.info("Simulator stopped.")
        return self.get_status()

    def get_status(self) -> dict[str, Any]:
        """Return current status of simulator."""
        return {
            "is_running": self._is_running,
            "rate_hz": self._rate_hz,
            "emitted_count": self._emitted_count,
            "last_emitted_at": self._last_emitted_at.isoformat() if self._last_emitted_at else None,
        }

    def inject_pattern(self, pattern: str, customer_id: str | None = None) -> list[dict[str, Any]]:
        """Instantly generate an explicit fraud pattern episode for live demonstration."""
        cid = customer_id or random.choice(self._customers)
        city_name, lat, lon = self._customer_cities[cid]
        now = datetime.now(timezone.utc)
        results = []

        SessionLocal = get_sessionmaker()

        if pattern == "amount_spike":
            # 1. Ensure established customer baseline spend
            base_txn = TransactionCreate(
                external_txn_id=f"SIM_BASE_{uuid.uuid4().hex[:8]}",
                external_customer_id=cid,
                device_key=self._customer_devices[cid],
                occurred_at=now - timedelta(hours=2),
                amount=round(random.uniform(300.0, 800.0), 2),
                channel="pos",
                lat=lat,
                lon=lon,
                source="simulator",
                is_simulated=True,
            )
            # 2. Extreme amount spike relative to baseline
            spike_amt = round(random.uniform(65_000.0, 95_000.0), 2)
            txn_in = TransactionCreate(
                external_txn_id=f"SIM_SPIKE_{uuid.uuid4().hex[:8]}",
                external_customer_id=cid,
                device_key=self._customer_devices[cid],
                occurred_at=now,
                amount=spike_amt,
                channel="online",
                lat=lat,
                lon=lon,
                source="simulator",
                is_simulated=True,
            )
            process_transaction(txn_in=base_txn)
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        elif pattern == "impossible_travel":
            # 1. Genuine local txn in customer's home city
            first_txn = TransactionCreate(
                external_txn_id=f"SIM_LEGIT_{uuid.uuid4().hex[:8]}",
                external_customer_id=cid,
                device_key=self._customer_devices[cid],
                occurred_at=now - timedelta(minutes=5),
                amount=round(random.uniform(250.0, 1200.0), 2),
                channel="pos",
                lat=lat,
                lon=lon,
                source="simulator",
                is_simulated=True,
            )
            # 2. Far city txn 5 minutes later (> 1500 km away)
            far_city = "Delhi" if city_name in ("Chennai", "Coimbatore", "Bengaluru", "Kochi") else "Chennai"
            far_lat, far_lon = [(la, lo) for (c, la, lo) in CITIES if c == far_city][0]

            second_txn = TransactionCreate(
                external_txn_id=f"SIM_TRAVEL_{uuid.uuid4().hex[:8]}",
                external_customer_id=cid,
                device_key=None,
                occurred_at=now,
                amount=round(random.uniform(3000.0, 8500.0), 2),
                channel="atm",
                lat=far_lat,
                lon=far_lon,
                source="simulator",
                is_simulated=True,
            )
            r1, _ = process_transaction(txn_in=first_txn)
            r2, _ = process_transaction(txn_in=second_txn)
            results.extend([r1.model_dump(mode="json"), r2.model_dump(mode="json")])

        elif pattern == "new_device_night":
            # Night time, unknown device, elevated amount
            night_time = now.replace(hour=2, minute=random.randint(10, 50))
            txn_in = TransactionCreate(
                external_txn_id=f"SIM_NIGHT_{uuid.uuid4().hex[:8]}",
                external_customer_id=cid,
                device_key=f"DEV_UNKNOWN_{uuid.uuid4().hex[:6]}",
                occurred_at=night_time,
                amount=round(random.uniform(18_000.0, 40_000.0), 2),
                channel="online",
                lat=lat + random.uniform(-0.05, 0.05),
                lon=lon + random.uniform(-0.05, 0.05),
                source="simulator",
                is_simulated=True,
            )
            res, _ = process_transaction(txn_in=txn_in)
            results.append(res.model_dump(mode="json"))

        elif pattern == "velocity_burst":
            # Rapid barrage of 4 transactions in 60 seconds
            for i in range(4):
                txn_in = TransactionCreate(
                    external_txn_id=f"SIM_BURST_{uuid.uuid4().hex[:8]}",
                    external_customer_id=cid,
                    device_key=self._customer_devices[cid],
                    occurred_at=now - timedelta(seconds=(4 - i) * 15),
                    amount=round(random.uniform(4_500.0, 9_500.0), 2),
                    channel="online",
                    lat=lat,
                    lon=lon,
                    source="simulator",
                    is_simulated=True,
                )
                res, _ = process_transaction(txn_in=txn_in)
                results.append(res.model_dump(mode="json"))

        elif pattern == "shared_device_ring":
            # Ring device hitting 4 distinct customers
            ring_dev = f"DEV_RING_FRAUD_{uuid.uuid4().hex[:4]}"
            victim_cids = random.sample(self._customers, 4)
            for v_cid in victim_cids:
                v_city, v_lat, v_lon = self._customer_cities[v_cid]
                txn_in = TransactionCreate(
                    external_txn_id=f"SIM_RING_{uuid.uuid4().hex[:8]}",
                    external_customer_id=v_cid,
                    device_key=ring_dev,
                    occurred_at=now,
                    amount=round(random.uniform(7_000.0, 16_000.0), 2),
                    channel="online",
                    lat=v_lat,
                    lon=v_lon,
                    source="simulator",
                    is_simulated=True,
                )
                res, _ = process_transaction(txn_in=txn_in)
                results.append(res.model_dump(mode="json"))

        else:
            raise ValueError(f"Unknown pattern '{pattern}'. Available: amount_spike, impossible_travel, new_device_night, velocity_burst, shared_device_ring")

        with self._lock:
            self._emitted_count += len(results)
            self._last_emitted_at = now

        return results

    def _run_loop(self) -> None:
        """Background emission loop."""
        iteration = 0

        while not self._stop_event.is_set():
            delay = 1.0 / max(0.1, self._rate_hz)
            time.sleep(delay)
            if self._stop_event.is_set():
                break

            iteration += 1
            now = datetime.now(timezone.utc)

            # Occasional fraud pattern every ~25 transactions
            if iteration % 25 == 0:
                pattern = random.choice([
                    "amount_spike",
                    "impossible_travel",
                    "new_device_night",
                    "velocity_burst",
                ])
                try:
                    self.inject_pattern(pattern)
                except Exception as exc:
                    logger.warning("Error injecting periodic pattern: %s", exc)
                continue

            # Standard genuine transaction
            cid = random.choice(self._customers)
            _, lat, lon = self._customer_cities[cid]
            chan = random.choice(CHANNELS)
            dev_key = self._customer_devices[cid] if chan == "online" else None

            # Typical transaction amount ₹150 - ₹2,500
            amt = round(random.expovariate(1 / 750.0) + 100.0, 2)
            amt = min(amt, 8000.0)

            txn_in = TransactionCreate(
                external_txn_id=f"SIM_TXN_{uuid.uuid4().hex[:10]}",
                external_customer_id=cid,
                device_key=dev_key,
                occurred_at=now,
                amount=amt,
                channel=chan,
                lat=lat + random.uniform(-0.02, 0.02),
                lon=lon + random.uniform(-0.02, 0.02),
                source="simulator",
                is_simulated=True,
            )

            try:
                process_transaction(txn_in=txn_in)
                with self._lock:
                    self._emitted_count += 1
                    self._last_emitted_at = now
            except Exception as exc:
                logger.error("Simulator emission error: %s", exc)


# Global singleton
simulator_service = SimulatorService()
