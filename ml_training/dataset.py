"""Dataset preparation and temporal splitting with label-delay awareness.

Strict temporal partitioning:
  - Training window: [0, train_days). Only rows where label_available_at <= train_days are usable labels.
  - Validation window: [train_days, val_days). Used to tune decision thresholds and calibrate probabilities.
  - Test window: [val_days, total_days). Completely held-out evaluation set spanning pre-drift and post-drift.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.ml.features import FEATURE_NAMES, compute_features_batch
from ml_training.simulation import SimConfig, generate


@dataclass(frozen=True)
class SplitDataset:
    X_train: pd.DataFrame
    y_train: pd.Series
    X_val: pd.DataFrame
    y_val: pd.Series
    meta_val: pd.DataFrame
    X_test: pd.DataFrame
    y_test: pd.Series
    meta_test: pd.DataFrame
    raw_txns: pd.DataFrame
    train_cutoff: pd.Timestamp
    val_cutoff: pd.Timestamp


def prepare_dataset(
    cfg: SimConfig | None = None,
    train_days: int = 60,
    val_days: int = 80,
    data_dir: Path | None = None,
) -> SplitDataset:
    """Generate or load simulation data, compute behavioural features, and partition temporally.

    Parameters
    ----------
    cfg : SimConfig | None
        Simulation configuration. Defaults to 2,000 customers, 120 days, seed=42, drift_day=90.
    train_days : int
        Cutoff day for training transactions.
    val_days : int
        Cutoff day separating validation and test transactions.
    data_dir : Path | None
        Optional directory to cache generated CSVs.

    Returns
    -------
    SplitDataset
        Split features, labels, and evaluation metadata.
    """
    if cfg is None:
        cfg = SimConfig(n_customers=2000, days=120, seed=42, fraud_rate=0.01, drift_day=90)

    if not (0 < train_days < val_days < cfg.days):
        raise ValueError(f"Must have 0 < train_days ({train_days}) < val_days ({val_days}) < total days ({cfg.days})")

    # 1. Generate or load transactions
    if data_dir is not None and (data_dir / "transactions.csv.gz").exists():
        tx = pd.read_csv(data_dir / "transactions.csv.gz")
        tx["occurred_at"] = pd.to_datetime(tx["occurred_at"])
        tx["label_available_at"] = pd.to_datetime(tx["label_available_at"])
    else:
        _, tx = generate(cfg)
        if data_dir is not None:
            data_dir.mkdir(parents=True, exist_ok=True)
            tx.to_csv(data_dir / "transactions.csv.gz", index=False)

    # 2. Compute behavioural features
    features_df = compute_features_batch(tx)

    # 3. Define temporal cutoffs
    t0 = tx["occurred_at"].min()
    train_cut = t0 + pd.Timedelta(days=train_days)
    val_cut = t0 + pd.Timedelta(days=val_days)

    # 4. Filter splits
    # Training: occurred before train_cut AND label arrived by train_cut (no lookahead on label)
    train_mask = (tx["occurred_at"] < train_cut) & (tx["label_available_at"] <= train_cut)
    val_mask = (tx["occurred_at"] >= train_cut) & (tx["occurred_at"] < val_cut)
    test_mask = tx["occurred_at"] >= val_cut

    y_train = tx.loc[train_mask, "is_fraud"].astype(int).copy()
    if y_train.nunique() < 2:
        raise ValueError(
            f"Training split contains only {y_train.nunique()} class(es). "
            f"Because genuine labels have a 45-day delay, train_days must be > 45."
        )

    meta_cols = [
        "external_txn_id",
        "external_customer_id",
        "occurred_at",
        "amount",
        "channel",
        "device_key",
        "is_fraud",
        "fraud_pattern",
    ]

    return SplitDataset(
        X_train=features_df.loc[train_mask].copy(),
        y_train=tx.loc[train_mask, "is_fraud"].astype(int).copy(),
        X_val=features_df.loc[val_mask].copy(),
        y_val=tx.loc[val_mask, "is_fraud"].astype(int).copy(),
        meta_val=tx.loc[val_mask, meta_cols].copy(),
        X_test=features_df.loc[test_mask].copy(),
        y_test=tx.loc[test_mask, "is_fraud"].astype(int).copy(),
        meta_test=tx.loc[test_mask, meta_cols].copy(),
        raw_txns=tx,
        train_cutoff=train_cut,
        val_cutoff=val_cut,
    )
