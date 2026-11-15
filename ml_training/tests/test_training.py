"""Unit and integration tests for ML model training, calibration, explainability, and evaluation.

Verifies:
  1. Temporal split respects label delays (no future labels in training).
  2. Model training and probability calibration.
  3. Anomaly model integration for cold-start and novelty detection.
  4. Cost-optimal threshold tuning and risk-band assignment.
  5. TreeSHAP plain-English reason codes for various fraud patterns.
  6. Evaluation metrics generation including recall per pattern and bootstrap CIs.
  7. Pipeline serialization and reload parity.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

from app.ml.explain import FraudExplainer
from app.ml.features import FEATURE_NAMES
from ml_training.dataset import prepare_dataset
from ml_training.evaluate import evaluate_model_on_test
from ml_training.simulation import SimConfig
from ml_training.train import TrainedPipeline, optimize_thresholds, train_pipeline


@pytest.fixture(scope="module")
def dataset():
    # Deterministic configuration ensuring train_days > 45 for mature genuine labels
    cfg = SimConfig(n_customers=60, days=70, seed=99, fraud_rate=0.03, drift_day=55)
    return prepare_dataset(cfg, train_days=50, val_days=60)


@pytest.fixture(scope="module")
def trained_artifacts(dataset):
    pipeline, summary = train_pipeline(dataset)
    return pipeline, summary


# ------------------------------------------------------------------ 1. Temporal Split
def test_temporal_split_respects_label_delays(dataset):
    """Training rows must have occurred BEFORE train_cut AND label arrived BEFORE train_cut."""
    train_cut = dataset.train_cutoff
    raw = dataset.raw_txns

    # Every training row satisfies both conditions
    train_indices = dataset.X_train.index
    train_raw = raw.loc[train_indices]

    assert (train_raw["occurred_at"] < train_cut).all(), "Found training txn occurring after cutoff"
    assert (train_raw["label_available_at"] <= train_cut).all(), "Label leakage: training txn label arrived after cutoff"


def test_validation_and_test_windows(dataset):
    """Validation and test sets must fall strictly within their designated time windows."""
    train_cut = dataset.train_cutoff
    val_cut = dataset.val_cutoff

    val_meta = dataset.meta_val
    test_meta = dataset.meta_test

    assert (val_meta["occurred_at"] >= train_cut).all()
    assert (val_meta["occurred_at"] < val_cut).all()
    assert (test_meta["occurred_at"] >= val_cut).all()


# ------------------------------------------------------------------ 2. Training & Calibration
def test_pipeline_predictions_in_range(trained_artifacts, dataset):
    pipeline, _ = trained_artifacts
    probs = pipeline.predict_proba(dataset.X_val)

    assert len(probs) == len(dataset.X_val)
    assert np.all((probs >= 0.0) & (probs <= 1.0))
    assert not np.isnan(probs).any()


def test_anomaly_blend_for_cold_start(trained_artifacts):
    pipeline, _ = trained_artifacts

    # Normal row with history vs cold start row with 0 history
    row_cold = pd.DataFrame([{
        "history_length": 0.0,
        "amount_zscore": 0.0,
        "amount_ratio_mean": 1.0,
        "hour_deviation": 0.0,
        "time_since_last_txn_sec": 2592000.0,
        "velocity_1h_count": 0.0,
        "velocity_1h_amount": 0.0,
        "velocity_24h_count": 0.0,
        "velocity_24h_amount": 0.0,
        "speed_kmh": 0.0,
        "is_new_device": 1.0,
        "is_new_channel": 1.0,
        "device_shared_cust_count": 0.0,
    }])[list(FEATURE_NAMES)]

    p = pipeline.predict_proba(row_cold)[0]
    assert 0.0 <= p <= 1.0


# ------------------------------------------------------------------ 3. Thresholds & Risk Bands
def test_threshold_optimization_output():
    y_val = pd.Series([0, 0, 0, 1, 0, 1, 0, 0, 1, 0])
    p_val = np.array([0.05, 0.1, 0.2, 0.8, 0.15, 0.9, 0.02, 0.3, 0.75, 0.1])
    th = optimize_thresholds(y_val, p_val, c_fp=50.0)

    assert "threshold_optimal" in th
    assert "threshold_low" in th
    assert "threshold_high" in th
    assert 0.0 < th["threshold_low"] < th["threshold_high"] < 1.0
    assert set(th["risk_bands"].keys()) == {"low", "medium", "high"}


def test_risk_band_assignment(trained_artifacts):
    pipeline, _ = trained_artifacts
    band_low = pipeline.predict_band(0.01)
    band_high = pipeline.predict_band(0.99)

    assert band_low == "low"
    assert band_high == "high"


# ------------------------------------------------------------------ 4. TreeSHAP & Reason Codes
def test_explainer_produces_plain_english_reasons(trained_artifacts):
    pipeline, _ = trained_artifacts
    explainer = FraudExplainer(pipeline.supervised_model, feature_names=FEATURE_NAMES)

    # Impossible travel transaction
    txn_travel = {
        "history_length": 5.0,
        "amount_zscore": 0.5,
        "amount_ratio_mean": 1.2,
        "hour_deviation": 0.5,
        "time_since_last_txn_sec": 600.0,
        "velocity_1h_count": 1.0,
        "velocity_1h_amount": 1000.0,
        "velocity_24h_count": 3.0,
        "velocity_24h_amount": 3000.0,
        "speed_kmh": 1200.0,  # Impossible travel
        "is_new_device": 0.0,
        "is_new_channel": 0.0,
        "device_shared_cust_count": 0.0,
    }
    exp = explainer.explain_transaction(txn_travel, top_k=2)

    assert "shap_values" in exp
    assert "reason_codes" in exp
    assert len(exp["reason_codes"]) > 0
    assert any("travel" in r.lower() or "speed" in r.lower() for r in exp["reason_codes"])
    assert "counterfactual_hint" in exp


def test_explainer_shared_device_ring(trained_artifacts):
    pipeline, _ = trained_artifacts
    explainer = FraudExplainer(pipeline.supervised_model, feature_names=FEATURE_NAMES)

    txn_ring = {
        "history_length": 2.0,
        "amount_zscore": 1.0,
        "amount_ratio_mean": 1.5,
        "hour_deviation": 1.0,
        "time_since_last_txn_sec": 3600.0,
        "velocity_1h_count": 1.0,
        "velocity_1h_amount": 500.0,
        "velocity_24h_count": 2.0,
        "velocity_24h_amount": 1000.0,
        "speed_kmh": 0.0,
        "is_new_device": 1.0,
        "is_new_channel": 0.0,
        "device_shared_cust_count": 4.0,  # Shared ring
    }
    exp = explainer.explain_transaction(txn_ring, top_k=3)
    assert len(exp["reason_codes"]) > 0


# ------------------------------------------------------------------ 5. Evaluation Suite
def test_evaluation_metrics_and_pattern_recall(trained_artifacts, dataset, tmp_path):
    pipeline, _ = trained_artifacts
    metrics = evaluate_model_on_test(pipeline, dataset, n_bootstrap=50, out_dir=tmp_path)

    assert "primary_metrics" in metrics
    pm = metrics["primary_metrics"]
    for m in ["precision", "recall", "f1_score", "pr_auc", "roc_auc"]:
        assert 0.0 <= pm[m] <= 1.0

    assert "pattern_recall" in metrics
    assert len(metrics["pattern_recall"]) > 0
    for pat, stats in metrics["pattern_recall"].items():
        assert "recall" in stats
        assert 0.0 <= stats["recall"] <= 1.0

    assert "cost_analysis" in metrics
    assert "bootstrap_95ci" in metrics
    assert "ablation_comparison" in metrics
    assert (tmp_path / "metrics.json").exists()


# ------------------------------------------------------------------ 6. Serialization
def test_pipeline_serialization_parity(trained_artifacts, dataset, tmp_path):
    pipeline, _ = trained_artifacts
    save_path = tmp_path / "model.joblib"
    joblib.dump(pipeline, save_path)

    reloaded = joblib.load(save_path)
    p_orig = pipeline.predict_proba(dataset.X_test.iloc[:20])
    p_reload = reloaded.predict_proba(dataset.X_test.iloc[:20])

    np.testing.assert_allclose(p_orig, p_reload, atol=1e-6)
