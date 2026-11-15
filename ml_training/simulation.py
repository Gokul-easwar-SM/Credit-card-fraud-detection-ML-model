"""Synthetic card-transaction simulator (training data for the live model).

ALL data produced here is synthetic. Fraud is injected by rules, so a model trained on it
will look better than it would on real bank data. Every row carries source='simulator'
and is_simulated=True. The simulator clock is IST (+05:30).

Customer behaviour: each customer has a home city, typical spend, active hours, channel
mix, one or two personal devices and optionally a multi-day trip.

Fraud patterns (injected as episodes against a victim customer):
  amount_spike       one very large purchase
  velocity_burst     many rapid transactions
  impossible_travel  card used in a far city shortly after a genuine local use
  new_device_night   unknown device, night-time, elevated amount
  shared_device_ring one fraudster device hitting several customers
  low_and_slow       DRIFT pattern, only after `drift_day`: normal amounts, daytime,
                     new device. A model trained before the drift should handle it poorly.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

IST = timezone(timedelta(hours=5, minutes=30))
DAY = 86_400.0

CITIES: dict[str, tuple[float, float]] = {
    "Coimbatore": (11.0168, 76.9558), "Chennai": (13.0827, 80.2707),
    "Bengaluru": (12.9716, 77.5946), "Hyderabad": (17.3850, 78.4867),
    "Mumbai": (19.0760, 72.8777), "Pune": (18.5204, 73.8567),
    "Delhi": (28.6139, 77.2090), "Kolkata": (22.5726, 88.3639),
    "Kochi": (9.9312, 76.2673), "Ahmedabad": (23.0225, 72.5714),
}
CHANNELS = ("pos", "online", "atm")
BASE_PATTERNS = ("amount_spike", "velocity_burst", "impossible_travel",
                 "new_device_night", "shared_device_ring")
DRIFT_PATTERN = "low_and_slow"
_BASE_WEIGHTS = np.array([0.25, 0.20, 0.20, 0.20, 0.15])
GENUINE_LABEL_DELAY_DAYS = 45  # no chargeback within this window => assumed genuine


@dataclass(frozen=True)
class SimConfig:
    n_customers: int = 2000
    days: int = 120
    seed: int = 42
    fraud_rate: float = 0.01           # target share of fraudulent rows
    drift_day: int | None = 90         # day index when the drift pattern starts; None = no drift
    start: datetime = datetime(2026, 1, 1, tzinfo=IST)

    def __post_init__(self) -> None:
        if self.n_customers < 10:
            raise ValueError("n_customers must be >= 10")
        if self.days < 7:
            raise ValueError("days must be >= 7")
        if not 0 < self.fraud_rate < 0.2:
            raise ValueError("fraud_rate must be in (0, 0.2)")
        if self.drift_day is not None and not 0 < self.drift_day < self.days:
            raise ValueError("drift_day must be within (0, days) or None")


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in km (works on scalars and numpy arrays)."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(a))


# ------------------------------------------------------------------ customers
def _make_customers(cfg: SimConfig, rng: np.random.Generator) -> list[dict]:
    names = list(CITIES)
    customers = []
    for i in range(cfg.n_customers):
        city = names[int(rng.integers(len(names)))]
        lat, lon = CITIES[city]
        trip = None
        if rng.random() < 0.15:
            other = names[int(rng.integers(len(names)))]
            if other != city:
                trip = (int(rng.integers(0, cfg.days - 5)), int(rng.integers(2, 6)), CITIES[other])
        cid = f"CUST{i + 1:05d}"
        customers.append({
            "external_customer_id": cid, "home_city": city,
            "home_lat": float(lat + rng.normal(0, 0.05)), "home_lon": float(lon + rng.normal(0, 0.05)),
            "avg_amount": float(np.clip(rng.lognormal(np.log(1200), 0.6), 150, 20000)),
            "rate": float(rng.uniform(0.3, 2.5)),             # genuine transactions per day
            "hour_mu": float(rng.uniform(11, 20)), "hour_sd": float(rng.uniform(1.5, 3.5)),
            "channel_p": rng.dirichlet([5, 4, 1]),
            "dev_a": f"DEV-{cid}-A", "dev_b": f"DEV-{cid}-B", "trip": trip,
        })
    return customers


# ------------------------------------------------------------------ genuine
def _genuine(c: dict, cfg: SimConfig, rng: np.random.Generator) -> pd.DataFrame:
    counts = rng.poisson(c["rate"], size=cfg.days)
    n = int(counts.sum())
    day = np.repeat(np.arange(cfg.days), counts)
    hour = rng.normal(c["hour_mu"], c["hour_sd"], n) % 24
    t = np.round(day * DAY + hour * 3600)
    channel = rng.choice(CHANNELS, size=n, p=c["channel_p"])
    amount = np.maximum(1.0, np.round(rng.lognormal(np.log(c["avg_amount"]), 0.5, n), 2))
    lat = np.full(n, c["home_lat"]); lon = np.full(n, c["home_lon"])
    if c["trip"] is not None:
        s, length, (tlat, tlon) = c["trip"]
        m = (day >= s) & (day < s + length)
        lat = np.where(m, tlat, lat); lon = np.where(m, tlon, lon)
    lat = lat + rng.normal(0, 0.03, n); lon = lon + rng.normal(0, 0.03, n)
    use_b = rng.random(n) < 0.10
    device = np.where(channel == "online", np.where(use_b, c["dev_b"], c["dev_a"]), None)
    return pd.DataFrame({
        "external_customer_id": c["external_customer_id"], "device_key": device, "t": t,
        "amount": amount, "channel": channel, "lat": lat, "lon": lon,
        "is_fraud": False, "fraud_pattern": None,
    })


# ------------------------------------------------------------------ fraud episodes
def _row(c, t, amount, channel, device, lat=None, lon=None, pattern=""):
    return {
        "external_customer_id": c["external_customer_id"], "device_key": device, "t": float(round(t)),
        "amount": float(max(1.0, round(amount, 2))), "channel": channel,
        "lat": c["home_lat"] if lat is None else lat, "lon": c["home_lon"] if lon is None else lon,
        "is_fraud": True, "fraud_pattern": pattern,
    }


class _Episodes:
    def __init__(self, cfg, rng, customers, genuine):
        self.cfg, self.rng, self.customers, self.genuine = cfg, rng, customers, genuine
        self.dev_counter = 0
        self.window = (0.0, float(cfg.days))  # (first_day, last_day_exclusive) for new episodes

    def _new_device(self, prefix="DEV-F"):
        self.dev_counter += 1
        return f"{prefix}{self.dev_counter:06d}"

    def _victim(self):
        return self.customers[int(self.rng.integers(len(self.customers)))]

    def make(self, pattern: str) -> list[dict]:
        return getattr(self, f"_{pattern}")()

    def _random_t(self, margin_days: float = 0.0) -> float:
        """Random time inside the current window, leaving `margin_days` before its end."""
        lo, hi = self.window
        return float(self.rng.uniform(lo * DAY, max(lo + 0.01, hi - margin_days) * DAY))

    def _amount_spike(self):
        c, r = self._victim(), self.rng
        online = r.random() < 0.6
        return [_row(c, self._random_t(), c["avg_amount"] * r.uniform(8, 30),
                     "online" if online else "atm", self._new_device() if online else None,
                     pattern="amount_spike")]

    def _velocity_burst(self):
        c, r = self._victim(), self.rng
        t = self._random_t(margin_days=1)
        dev = c["dev_a"] if r.random() < 0.5 else self._new_device()
        rows = []
        for _ in range(int(r.integers(5, 13))):
            t += r.uniform(30, 200)
            rows.append(_row(c, t, c["avg_amount"] * r.uniform(0.3, 1.5), "online", dev,
                             pattern="velocity_burst"))
        return rows

    def _impossible_travel(self):
        r = self.rng
        for _ in range(50):  # find a victim that has genuine history
            c = self._victim()
            g = self.genuine[c["external_customer_id"]]
            g = g[(g["t"] >= self.window[0] * DAY) & (g["t"] < (self.window[1] - 0.1) * DAY)]
            if len(g):
                break
        else:
            return []
        a = g.iloc[int(r.integers(len(g)))]
        dist = haversine_km(a["lat"], a["lon"], np.array([v[0] for v in CITIES.values()]),
                            np.array([v[1] for v in CITIES.values()]))
        far = [k for k, d in zip(CITIES, dist) if d > 800]
        lat, lon = CITIES[far[int(r.integers(len(far)))]]
        return [_row(c, a["t"] + r.uniform(20 * 60, 90 * 60), c["avg_amount"] * r.uniform(1, 6),
                     "pos", None, lat, lon, "impossible_travel")]

    def _new_device_night(self):
        c, r = self._victim(), self.rng
        day = int(self._random_t() // DAY)
        t = day * DAY + r.uniform(0, 4.5) * 3600
        return [_row(c, t, c["avg_amount"] * r.uniform(2, 10), "online", self._new_device(),
                     pattern="new_device_night")]

    def _shared_device_ring(self):
        r = self.rng
        dev = self._new_device("DEV-R")
        t0 = self._random_t(margin_days=2)
        rows = []
        for _ in range(int(r.integers(3, 9))):
            c = self._victim()
            for _ in range(int(r.integers(1, 3))):
                rows.append(_row(c, t0 + r.uniform(0, 36 * 3600), c["avg_amount"] * r.uniform(1.5, 5),
                                 "online", dev, pattern="shared_device_ring"))
        return rows

    def _low_and_slow(self):
        c, r = self._victim(), self.rng
        day = int(self._random_t(margin_days=1) // DAY)
        t = day * DAY + r.uniform(10, 15) * 3600
        dev = self._new_device("DEV-S")
        rows = []
        for _ in range(int(r.integers(3, 7))):
            t += r.uniform(40, 180) * 60
            rows.append(_row(c, t, c["avg_amount"] * r.uniform(0.8, 1.6), "online", dev,
                             pattern=DRIFT_PATTERN))
        return rows


# ------------------------------------------------------------------ public API
def generate(cfg: SimConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (customers, transactions). Deterministic for a given config."""
    rng = np.random.default_rng(cfg.seed)
    customers = _make_customers(cfg, rng)
    genuine = {c["external_customer_id"]: _genuine(c, cfg, rng) for c in customers}

    ep = _Episodes(cfg, rng, customers, genuine)
    if cfg.drift_day is None:
        periods = [(0, cfg.days, BASE_PATTERNS, 0.0)]
    else:  # same fraud RATE in both periods; after drift, half the episodes use the new pattern
        periods = [(0, cfg.drift_day, BASE_PATTERNS, 0.0),
                   (cfg.drift_day, cfg.days, (*BASE_PATTERNS, DRIFT_PATTERN), 0.5)]
    fraud_rows: list[dict] = []
    for lo, hi, patterns, p_drift in periods:
        n_genuine = sum(int(((g["t"] >= lo * DAY) & (g["t"] < hi * DAY)).sum()) for g in genuine.values())
        target = int(np.ceil(cfg.fraud_rate * n_genuine / (1 - cfg.fraud_rate)))
        ep.window = (float(lo), float(hi))
        rows: list[dict] = []
        for p in patterns:                   # guarantee every pattern appears at least once
            rows += ep.make(p)
        while len(rows) < target:
            p = DRIFT_PATTERN if rng.random() < p_drift else str(rng.choice(BASE_PATTERNS, p=_BASE_WEIGHTS))
            rows += ep.make(p)
        fraud_rows += rows

    df = pd.concat([*genuine.values(), pd.DataFrame(fraud_rows)], ignore_index=True)
    df = df[df["t"] < cfg.days * DAY].sort_values("t", kind="stable").reset_index(drop=True)
    df["external_txn_id"] = [f"SIM-{i + 1:07d}" for i in range(len(df))]
    df["occurred_at"] = pd.Timestamp(cfg.start) + pd.to_timedelta(df["t"], unit="s")
    delay_days = np.where(df["is_fraud"], rng.uniform(7, GENUINE_LABEL_DELAY_DAYS, len(df)),
                          GENUINE_LABEL_DELAY_DAYS)
    df["label_available_at"] = df["occurred_at"] + pd.to_timedelta(delay_days, unit="D")
    df["source"] = "simulator"
    df["is_simulated"] = True
    cols = ["external_txn_id", "external_customer_id", "device_key", "occurred_at", "amount",
            "channel", "lat", "lon", "source", "is_simulated", "is_fraud", "fraud_pattern",
            "label_available_at"]
    cust_df = pd.DataFrame(customers)[["external_customer_id", "home_city", "home_lat",
                                       "home_lon", "avg_amount"]].assign(is_simulated=True)
    return cust_df, df[cols]


def write_dataset(cfg: SimConfig, out_dir: Path) -> dict:
    """Generate and save CSVs plus a data card describing exactly what was produced."""
    out_dir.mkdir(parents=True, exist_ok=True)
    customers, txns = generate(cfg)
    customers.to_csv(out_dir / "customers.csv.gz", index=False)
    txns.to_csv(out_dir / "transactions.csv.gz", index=False)
    card = {
        "synthetic": True,
        "config": json.loads(json.dumps(asdict(cfg), default=str)),
        "n_customers": len(customers), "n_transactions": len(txns),
        "n_fraud": int(txns["is_fraud"].sum()),
        "fraud_rate": float(txns["is_fraud"].mean()),
        "fraud_by_pattern": txns.loc[txns["is_fraud"], "fraud_pattern"].value_counts().to_dict(),
        "time_range": [str(txns["occurred_at"].min()), str(txns["occurred_at"].max())],
        "notes": "Fraud is rule-injected; results on this data are optimistic vs. real data.",
    }
    (out_dir / "data_card.json").write_text(json.dumps(card, indent=2))
    return card


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate synthetic card transaction data")
    ap.add_argument("--customers", type=int, default=2000)
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--fraud-rate", type=float, default=0.01)
    ap.add_argument("--drift-day", type=int, default=90, help="0 disables drift")
    ap.add_argument("--out", type=Path, default=Path("data/simulated"))
    a = ap.parse_args()
    cfg = SimConfig(a.customers, a.days, a.seed, a.fraud_rate, a.drift_day or None)
    print(json.dumps(write_dataset(cfg, a.out), indent=2))


if __name__ == "__main__":
    main()
