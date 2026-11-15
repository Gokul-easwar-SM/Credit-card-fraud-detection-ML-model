"""Tests for the offline ULB Kaggle fraud detection benchmark pipeline."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.ml.features import FEATURE_NAMES
from ml_training.kaggle_benchmark import (
    KAGGLE_FEATURE_COLS,
    load_and_preprocess_kaggle,
    train_and_evaluate_kaggle,
)


@pytest.fixture
def mock_kaggle_csv(tmp_path):
    """Create a synthetic Kaggle-format CSV for fast unit testing."""
    n_rows = 500
    rng = np.random.default_rng(42)

    data = {
        "Time": np.sort(rng.uniform(0, 172800, n_rows)),
        "Amount": rng.exponential(88.0, n_rows),
        "Class": np.zeros(n_rows, dtype=int),
    }
    # 20 fraud cases
    fraud_idx = rng.choice(n_rows, size=20, replace=False)
    data["Class"][fraud_idx] = 1

    for i in range(1, 29):
        data[f"V{i}"] = rng.normal(0, 1, n_rows)

    df = pd.DataFrame(data)
    # Add 5 duplicates to test deduplication
    df = pd.concat([df, df.iloc[:5]], ignore_index=True)

    csv_path = tmp_path / "creditcard_mock.csv"
    df.to_csv(csv_path, index=False)
    return csv_path


def test_kaggle_features_strictly_different_from_live_pipeline():
    """Ensure Kaggle PCA feature set never collides with behavioural FEATURE_NAMES."""
    kaggle_set = set(KAGGLE_FEATURE_COLS)
    live_set = set(FEATURE_NAMES)
    overlap = kaggle_set.intersection(live_set)

    # Only 'Amount' or nothing should overlap, but behavioural pipeline uses amount_zscore / amount_ratio
    assert live_set.isdisjoint(kaggle_set), f"Found illegal overlap between Kaggle and live features: {overlap}"


def test_kaggle_preprocessing_and_deduplication(mock_kaggle_csv):
    X, y, stats = load_and_preprocess_kaggle(mock_kaggle_csv)

    assert stats["raw_rows"] == 505
    assert stats["duplicates_removed"] == 5
    assert stats["deduplicated_rows"] == 500
    assert len(X) == 500
    assert len(y) == 500
    assert list(X.columns) == KAGGLE_FEATURE_COLS


def test_kaggle_missing_columns_validation(tmp_path):
    bad_df = pd.DataFrame({"Time": [1.0], "Amount": [10.0], "Class": [0]})
    bad_csv = tmp_path / "bad.csv"
    bad_df.to_csv(bad_csv, index=False)

    with pytest.raises(ValueError, match="missing expected columns"):
        load_and_preprocess_kaggle(bad_csv)


def test_kaggle_model_training_and_evaluation(mock_kaggle_csv, tmp_path):
    X, y, _ = load_and_preprocess_kaggle(mock_kaggle_csv)
    results = train_and_evaluate_kaggle(X, y, test_size=0.25, random_state=42, out_dir=tmp_path)

    assert "models" in results
    models = results["models"]
    assert "logistic_regression_baseline" in models
    assert "random_forest" in models
    assert "lightgbm_champion" in models

    for m_name, m_stats in models.items():
        assert "pr_auc" in m_stats
        assert "f1_score" in m_stats
        assert 0.0 <= m_stats["pr_auc"] <= 1.0
        assert 0.0 <= m_stats["roc_auc"] <= 1.0

    assert (tmp_path / "kaggle_metrics.json").exists()
