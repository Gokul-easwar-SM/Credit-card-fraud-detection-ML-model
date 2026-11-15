import json

import numpy as np
import pytest

from ml_training.simulation import (
    BASE_PATTERNS, CHANNELS, DAY, DRIFT_PATTERN, SimConfig, generate, haversine_km, write_dataset,
)

CFG = SimConfig(n_customers=150, days=60, seed=7, fraud_rate=0.02, drift_day=40)


@pytest.fixture(scope="module")
def data():
    return generate(CFG)


# ---- config validation
@pytest.mark.parametrize("kw", [
    {"n_customers": 5}, {"days": 3}, {"fraud_rate": 0}, {"fraud_rate": 0.5},
    {"drift_day": 0}, {"drift_day": 999},
])
def test_invalid_config_rejected(kw):
    with pytest.raises(ValueError):
        SimConfig(**kw)


# ---- reproducibility
def test_same_seed_gives_identical_data(data):
    _, again = generate(CFG)
    assert data[1].equals(again)


def test_different_seed_gives_different_data(data):
    _, other = generate(SimConfig(n_customers=150, days=60, seed=8, fraud_rate=0.02, drift_day=40))
    assert not data[1]["amount"].equals(other["amount"])


# ---- basic data integrity
def test_ids_unique_and_rows_sorted_by_time(data):
    tx = data[1]
    assert tx["external_txn_id"].is_unique
    assert tx["occurred_at"].is_monotonic_increasing


def test_values_valid(data):
    tx = data[1]
    assert (tx["amount"] > 0).all()
    assert set(tx["channel"]) <= set(CHANNELS)
    assert tx[["lat", "lon", "occurred_at"]].notna().all().all()
    assert tx["lat"].between(5, 35).all() and tx["lon"].between(65, 95).all()


def test_every_row_is_marked_simulated(data):
    tx = data[1]
    assert (tx["source"] == "simulator").all()
    assert tx["is_simulated"].all()


def test_transactions_reference_existing_customers(data):
    cust, tx = data
    assert set(tx["external_customer_id"]) <= set(cust["external_customer_id"])
    assert cust["external_customer_id"].is_unique


def test_only_online_rows_have_a_device(data):
    tx = data[1]
    genuine = tx[~tx["is_fraud"]]
    assert genuine.loc[genuine["channel"] == "online", "device_key"].notna().all()
    assert genuine.loc[genuine["channel"] != "online", "device_key"].isna().all()


# ---- fraud properties
def test_fraud_rate_close_to_target(data):
    assert 0.015 <= data[1]["is_fraud"].mean() <= 0.03


def test_every_base_pattern_present(data):
    present = set(data[1].loc[data[1]["is_fraud"], "fraud_pattern"])
    assert set(BASE_PATTERNS) <= present


def test_genuine_rows_have_no_pattern(data):
    tx = data[1]
    assert tx.loc[~tx["is_fraud"], "fraud_pattern"].isna().all()
    assert tx.loc[tx["is_fraud"], "fraud_pattern"].notna().all()


def test_drift_pattern_only_after_drift_day(data):
    tx = data[1]
    drift = tx[tx["fraud_pattern"] == DRIFT_PATTERN]
    assert len(drift) > 0
    start = CFG.start + np.timedelta64(CFG.drift_day * 86400, "s")
    assert (drift["occurred_at"] >= start).all()


def test_no_drift_pattern_when_drift_disabled():
    _, tx = generate(SimConfig(n_customers=100, days=30, seed=1, fraud_rate=0.02, drift_day=None))
    assert DRIFT_PATTERN not in set(tx["fraud_pattern"].dropna())


def test_impossible_travel_follows_a_genuine_far_away_transaction(data):
    tx = data[1]
    bad = []
    for _, f in tx[tx["fraud_pattern"] == "impossible_travel"].iterrows():
        prev = tx[(tx["external_customer_id"] == f["external_customer_id"]) & (~tx["is_fraud"])
                  & (tx["occurred_at"] < f["occurred_at"])
                  & (tx["occurred_at"] >= f["occurred_at"] - np.timedelta64(100, "m"))]
        d = haversine_km(prev["lat"].to_numpy(), prev["lon"].to_numpy(), f["lat"], f["lon"])
        if not (len(prev) and (d > 700).any()):
            bad.append(f["external_txn_id"])
    assert not bad


def test_ring_device_is_shared_by_several_customers(data):
    ring = data[1][data[1]["fraud_pattern"] == "shared_device_ring"]
    assert ring.groupby("device_key")["external_customer_id"].nunique().max() >= 3


def test_velocity_burst_is_actually_fast(data):
    tx = data[1]
    burst = tx[tx["fraud_pattern"] == "velocity_burst"]
    assert burst.groupby("device_key").size().max() >= 5


# ---- delayed labels
def test_labels_arrive_after_the_transaction(data):
    tx = data[1]
    assert (tx["label_available_at"] > tx["occurred_at"]).all()
    delay = (tx["label_available_at"] - tx["occurred_at"]).dt.total_seconds() / DAY
    assert delay[tx["is_fraud"]].between(7, 45).all()
    assert (delay[~tx["is_fraud"]] == 45).all()


# ---- output
def test_haversine_known_distance():
    # Coimbatore -> Chennai is roughly 440-460 km
    assert 400 < float(haversine_km(11.0168, 76.9558, 13.0827, 80.2707)) < 500


def test_write_dataset_creates_files_and_honest_data_card(tmp_path):
    card = write_dataset(CFG, tmp_path)
    for name in ("customers.csv.gz", "transactions.csv.gz", "data_card.json"):
        assert (tmp_path / name).exists()
    saved = json.loads((tmp_path / "data_card.json").read_text())
    assert saved["synthetic"] is True
    assert saved["n_fraud"] == card["n_fraud"] > 0
    assert "optimistic" in saved["notes"]


def test_drift_changes_the_pattern_mix_not_the_fraud_rate():
    """Otherwise a drift monitor could 'detect' drift just from higher fraud prevalence."""
    cfg = SimConfig(n_customers=400, days=60, seed=3, fraud_rate=0.02, drift_day=30)
    _, tx = generate(cfg)
    cut = cfg.start + np.timedelta64(30 * 86400, "s")
    pre, post = tx[tx["occurred_at"] < cut], tx[tx["occurred_at"] >= cut]
    assert 0.5 < post["is_fraud"].mean() / pre["is_fraud"].mean() < 1.6
    assert DRIFT_PATTERN not in set(pre["fraud_pattern"].dropna())
    assert (post["fraud_pattern"] == DRIFT_PATTERN).sum() > 0
