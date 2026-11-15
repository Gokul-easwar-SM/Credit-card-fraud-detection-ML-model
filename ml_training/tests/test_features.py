"""Comprehensive tests for the shared behavioural feature engineering pipeline.

Verifies:
  1. Contract: FEATURE_NAMES integrity.
  2. Cold-start handling: no NaNs, documented fallbacks for new customers/channels/devices.
  3. Equivalence: compute_features_batch matches compute_features_single for any transaction.
  4. Leakage prevention: modifying or deleting future rows never affects earlier row features.
  5. Correctness of circular hour distance, velocity windows (1h, 24h), speed capping, and device sharing.
  6. Schema and domain validation: bad amounts, invalid channels, bad coords, missing columns.
"""
from __future__ import annotations

import datetime as dt
from datetime import timezone

import numpy as np
import pandas as pd
import pytest

from app.ml.features import (
    COLD_START_TIME_GAP_SEC,
    FEATURE_NAMES,
    MAX_SPEED_KMH,
    FeatureValidationError,
    compute_features_batch,
    compute_features_single,
    haversine_km,
    validate_transaction_record,
    validate_transactions_dataframe,
)
from ml_training.simulation import SimConfig, generate

UTC = timezone.utc


# ------------------------------------------------------------------ fixtures
@pytest.fixture(scope="module")
def sim_data():
    cfg = SimConfig(n_customers=50, days=30, seed=123, fraud_rate=0.02, drift_day=20)
    _, tx = generate(cfg)
    return tx


# ------------------------------------------------------------------ 1. Contract
def test_feature_names_contract():
    assert isinstance(FEATURE_NAMES, tuple)
    assert len(FEATURE_NAMES) == 13
    assert len(set(FEATURE_NAMES)) == 13
    for name in FEATURE_NAMES:
        assert isinstance(name, str) and len(name) > 0


def test_features_json_matches_contract():
    import json
    from pathlib import Path

    json_path = Path("backend/app/ml/features.json")
    assert json_path.exists(), "features.json does not exist"
    loaded = json.loads(json_path.read_text())
    assert tuple(loaded) == FEATURE_NAMES


# ------------------------------------------------------------------ 2. Cold Start
def test_cold_start_single_transaction():
    """A customer's very first transaction must yield finite values and documented fallbacks."""
    txn = {
        "external_customer_id": "CUST_NEW_01",
        "occurred_at": "2026-05-01T10:00:00Z",
        "amount": 2500.0,
        "channel": "online",
        "lat": 12.9716,
        "lon": 77.5946,
        "device_key": "DEV_NEW_99",
    }
    feats = compute_features_single(txn, customer_history=None, device_history=None)

    assert set(feats.keys()) == set(FEATURE_NAMES)
    for k, v in feats.items():
        assert np.isfinite(v), f"Feature {k} returned non-finite value {v}"

    assert feats["history_length"] == 0.0
    assert feats["amount_zscore"] == 0.0
    assert feats["amount_ratio_mean"] == 1.0
    assert feats["hour_deviation"] == 0.0
    assert feats["time_since_last_txn_sec"] == COLD_START_TIME_GAP_SEC
    assert feats["velocity_1h_count"] == 0.0
    assert feats["velocity_1h_amount"] == 0.0
    assert feats["velocity_24h_count"] == 0.0
    assert feats["velocity_24h_amount"] == 0.0
    assert feats["speed_kmh"] == 0.0
    assert feats["is_new_device"] == 1.0  # first time this customer uses a device
    assert feats["is_new_channel"] == 1.0  # first time using online channel
    assert feats["device_shared_cust_count"] == 0.0


def test_cold_start_second_transaction():
    """With exactly 1 prior transaction, z-score is 0.0 (std undefined with N=1) but ratio is computed."""
    t0 = pd.Timestamp("2026-05-01T10:00:00Z")
    t1 = pd.Timestamp("2026-05-01T12:00:00Z")
    hist = pd.DataFrame([
        {
            "external_customer_id": "CUST_02",
            "occurred_at": t0,
            "amount": 1000.0,
            "channel": "online",
            "lat": 12.9716,
            "lon": 77.5946,
            "device_key": "DEV_CUST_02",
        }
    ])
    txn2 = {
        "external_customer_id": "CUST_02",
        "occurred_at": t1,
        "amount": 2500.0,
        "channel": "online",
        "lat": 12.9716,
        "lon": 77.5946,
        "device_key": "DEV_CUST_02",
    }
    feats = compute_features_single(txn2, customer_history=hist)

    assert feats["history_length"] == 1.0
    assert feats["amount_zscore"] == 0.0  # undefined sample variance
    assert feats["amount_ratio_mean"] == pytest.approx(2.5)  # 2500 / 1000
    assert feats["time_since_last_txn_sec"] == pytest.approx(7200.0)  # 2 hours
    assert feats["is_new_device"] == 0.0  # same device used before
    assert feats["is_new_channel"] == 0.0  # same channel used before


# ------------------------------------------------------------------ 3. Batch vs Single Equivalence
def test_batch_single_equivalence(sim_data):
    """Features computed by compute_features_batch must match compute_features_single row-for-row."""
    batch_feats = compute_features_batch(sim_data)
    assert len(batch_feats) == len(sim_data)
    assert list(batch_feats.columns) == list(FEATURE_NAMES)
    assert not batch_feats.isna().any().any(), "Batch features contained NaNs"

    # Select representative test rows: early, middle, late, across various customers
    sample_indices = [
        0, 1, 5, 25, 100, 250, 500, len(sim_data) // 2, len(sim_data) - 1
    ]

    for idx in sample_indices:
        row = sim_data.iloc[idx]
        t = pd.Timestamp(row["occurred_at"])
        cid = row["external_customer_id"]
        dev = row["device_key"]

        # History strictly before t
        c_hist = sim_data[(sim_data["external_customer_id"] == cid) & (sim_data["occurred_at"] < t)]
        d_hist = (
            sim_data[(sim_data["occurred_at"] < t) & (sim_data["device_key"] == dev)]
            if dev is not None and pd.notna(dev)
            else None
        )

        single_feats = compute_features_single(row.to_dict(), customer_history=c_hist, device_history=d_hist)

        for feat in FEATURE_NAMES:
            val_batch = float(batch_feats.iloc[idx][feat])
            val_single = float(single_feats[feat])
            assert val_batch == pytest.approx(val_single, abs=1e-4), (
                f"Mismatch at row {idx} for feature '{feat}': batch={val_batch}, single={val_single}"
            )


# ------------------------------------------------------------------ 4. Temporal Leakage Prevention
def test_temporal_leakage_future_modification(sim_data):
    """Mutating or adding future events must NOT change features of earlier events."""
    split_idx = len(sim_data) // 2
    cutoff_time = pd.Timestamp(sim_data.iloc[split_idx]["occurred_at"])

    # Original features
    orig_feats = compute_features_batch(sim_data)
    earlier_mask = sim_data["occurred_at"] <= cutoff_time
    earlier_orig = orig_feats.loc[earlier_mask]

    # Mutate future rows (change amounts, locations, channels, devices)
    mutated = sim_data.copy()
    future_mask = mutated["occurred_at"] > cutoff_time
    mutated.loc[future_mask, "amount"] = mutated.loc[future_mask, "amount"] * 100.0
    mutated.loc[future_mask, "channel"] = "atm"
    mutated.loc[future_mask, "lat"] = 28.6139  # Delhi
    mutated.loc[future_mask, "lon"] = 77.2090

    mutated_feats = compute_features_batch(mutated)
    earlier_mutated = mutated_feats.loc[earlier_mask]

    pd.testing.assert_frame_equal(earlier_orig, earlier_mutated)


def test_temporal_leakage_future_deletion(sim_data):
    """Deleting future events entirely must leave earlier features unaffected."""
    split_idx = len(sim_data) // 2
    cutoff_time = pd.Timestamp(sim_data.iloc[split_idx]["occurred_at"])

    orig_feats = compute_features_batch(sim_data)
    earlier_orig = orig_feats.loc[sim_data["occurred_at"] <= cutoff_time]

    truncated_data = sim_data[sim_data["occurred_at"] <= cutoff_time].copy()
    truncated_feats = compute_features_batch(truncated_data)

    pd.testing.assert_frame_equal(earlier_orig, truncated_feats)


# ------------------------------------------------------------------ 5. Logic Correctness
def test_circular_hour_deviation():
    """Circular distance across midnight: 23:30 to 00:30 is 1.0 hour, not 23.0 hours."""
    t0 = pd.Timestamp("2026-05-01T23:30:00Z")
    t1 = pd.Timestamp("2026-05-02T00:30:00Z")

    hist = pd.DataFrame([
        {
            "external_customer_id": "C_CIRC",
            "occurred_at": t0,
            "amount": 100.0,
            "channel": "pos",
            "lat": 13.0827,
            "lon": 80.2707,
            "device_key": None,
        }
    ])
    txn = {
        "external_customer_id": "C_CIRC",
        "occurred_at": t1,
        "amount": 120.0,
        "channel": "pos",
        "lat": 13.0827,
        "lon": 80.2707,
        "device_key": None,
    }
    feats = compute_features_single(txn, customer_history=hist)
    assert feats["hour_deviation"] == pytest.approx(1.0, abs=0.05)


def test_velocity_windows_boundary():
    """Verify exact 1-hour and 24-hour window inclusion/exclusion."""
    t0 = pd.Timestamp("2026-05-01T12:00:00Z")
    # Transactions at:
    # t0 - 25h (excluded from both 1h and 24h)
    # t0 - 2h  (excluded from 1h, included in 24h)
    # t0 - 30m (included in both 1h and 24h)
    hist = pd.DataFrame([
        {
            "external_customer_id": "C_VEL",
            "occurred_at": t0 - pd.Timedelta(hours=25),
            "amount": 500.0,
            "channel": "pos",
            "lat": 13.0827,
            "lon": 80.2707,
            "device_key": None,
        },
        {
            "external_customer_id": "C_VEL",
            "occurred_at": t0 - pd.Timedelta(hours=2),
            "amount": 300.0,
            "channel": "pos",
            "lat": 13.0827,
            "lon": 80.2707,
            "device_key": None,
        },
        {
            "external_customer_id": "C_VEL",
            "occurred_at": t0 - pd.Timedelta(minutes=30),
            "amount": 200.0,
            "channel": "pos",
            "lat": 13.0827,
            "lon": 80.2707,
            "device_key": None,
        },
    ])
    txn = {
        "external_customer_id": "C_VEL",
        "occurred_at": t0,
        "amount": 100.0,
        "channel": "pos",
        "lat": 13.0827,
        "lon": 80.2707,
        "device_key": None,
    }
    feats = compute_features_single(txn, customer_history=hist)
    assert feats["velocity_1h_count"] == 1.0  # only t0 - 30m
    assert feats["velocity_1h_amount"] == 200.0
    assert feats["velocity_24h_count"] == 2.0  # t0 - 2h and t0 - 30m
    assert feats["velocity_24h_amount"] == 500.0  # 300 + 200


def test_speed_capping():
    """Haversine travel speed must be cleanly capped at MAX_SPEED_KMH."""
    t0 = pd.Timestamp("2026-05-01T12:00:00Z")
    t1 = t0 + pd.Timedelta(minutes=5)
    # Chennai to Delhi (~1750 km in 5 minutes => ~21,000 km/h)
    hist = pd.DataFrame([
        {
            "external_customer_id": "C_SPEED",
            "occurred_at": t0,
            "amount": 100.0,
            "channel": "pos",
            "lat": 13.0827,  # Chennai
            "lon": 80.2707,
            "device_key": None,
        }
    ])
    txn = {
        "external_customer_id": "C_SPEED",
        "occurred_at": t1,
        "amount": 200.0,
        "channel": "pos",
        "lat": 28.6139,  # Delhi
        "lon": 77.2090,
        "device_key": None,
    }
    feats = compute_features_single(txn, customer_history=hist)
    assert feats["speed_kmh"] == MAX_SPEED_KMH


def test_shared_device_count_increments():
    """Verify device_shared_cust_count increments as different customers use the same device."""
    t0 = pd.Timestamp("2026-05-01T10:00:00Z")
    t1 = pd.Timestamp("2026-05-01T11:00:00Z")
    t2 = pd.Timestamp("2026-05-01T12:00:00Z")

    d_hist = pd.DataFrame([
        {
            "external_customer_id": "CUST_A",
            "device_key": "SHARED_DEV_1",
            "occurred_at": t0,
        },
        {
            "external_customer_id": "CUST_B",
            "device_key": "SHARED_DEV_1",
            "occurred_at": t1,
        },
    ])

    # Now Customer C uses SHARED_DEV_1
    txn = {
        "external_customer_id": "CUST_C",
        "occurred_at": t2,
        "amount": 500.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
        "device_key": "SHARED_DEV_1",
    }
    feats = compute_features_single(txn, device_history=d_hist)
    assert feats["device_shared_cust_count"] == 2.0  # CUST_A and CUST_B


# ------------------------------------------------------------------ 6. Validation & Errors
@pytest.mark.parametrize("bad_val", [
    {"amount": -50.0},
    {"amount": 0.0},
    {"channel": "crypto"},
    {"lat": 150.0},
    {"lon": 250.0},
    {"external_customer_id": None},
    {"occurred_at": None},
])
def test_single_transaction_validation_errors(bad_val):
    valid = {
        "external_customer_id": "CUST_01",
        "occurred_at": "2026-05-01T10:00:00Z",
        "amount": 100.0,
        "channel": "pos",
        "lat": 13.0827,
        "lon": 80.2707,
    }
    valid.update(bad_val)
    with pytest.raises(FeatureValidationError):
        compute_features_single(valid)


def test_batch_dataframe_validation_missing_col():
    df = pd.DataFrame({
        "external_customer_id": ["C1"],
        "amount": [100.0],
        "channel": ["pos"],
        # missing lat, lon, occurred_at
    })
    with pytest.raises(FeatureValidationError):
        compute_features_batch(df)


def test_empty_dataframe_returns_empty_feature_frame():
    df = pd.DataFrame(columns=["external_customer_id", "occurred_at", "amount", "channel", "lat", "lon"])
    out = compute_features_batch(df)
    assert len(out) == 0
    assert list(out.columns) == list(FEATURE_NAMES)
