"""Kaggle ULB Credit Card Fraud Detection offline benchmark pipeline.

Dataset characteristics:
  - 284,807 transactions, 492 fraud cases (~0.172% fraud rate).
  - Features: Time (elapsed seconds from first txn), Amount, and V1..V28 (PCA-transformed components).
  - Target: Class (0 = genuine, 1 = fraud).

CRITICAL ARCHITECTURAL BOUNDARY:
  - This dataset contains purely anonymised PCA vectors without device keys, merchant details,
    or geographic coordinates.
  - It is strictly an OFFLINE ML BENCHMARK to validate model architectures against historical academic literature.
  - It is NEVER merged into the live simulation database or fed into the live FastAPI scoring engine.

Pipeline:
  1. Download and cache (or load existing creditcard.csv / creditcard.csv.gz).
  2. Deduplicate records (~1,081 duplicate rows identified in literature).
  3. Stratified split (80% train, 20% test).
  4. Feature scaling (StandardScaler on Time and Amount; V1..V28 already zero-centered).
  5. Models:
     - Logistic Regression (balanced baseline)
     - Random Forest (balanced)
     - LightGBM (primary champion with class weighting)
  6. Evaluation: Precision, Recall, F1, PR-AUC, ROC-AUC, FPR, Confusion Matrix.
  7. Export metrics to ml_training/results/kaggle_metrics.json and docs/kaggle_benchmark.md.
"""
from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

KAGGLE_MIRROR_URL = "https://huggingface.co/datasets/David-Egea/Creditcard-fraud-detection/resolve/main/creditcard.csv"
KAGGLE_FEATURE_COLS = ["Time", *[f"V{i}" for i in range(1, 29)], "Amount"]


def download_kaggle_dataset(out_path: Path, url: str = KAGGLE_MIRROR_URL) -> Path:
    """Download the ULB creditcard.csv dataset if not already present."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        return out_path

    raw_csv = out_path.parent / "creditcard.csv"
    if raw_csv.exists():
        return raw_csv

    print(f"Downloading Kaggle dataset from {url}...")
    temp_gz = out_path.with_suffix(".tmp.gz")
    with httpx.Client(follow_redirects=True, timeout=120.0) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with gzip.open(temp_gz, "wb") as gz_out:
                for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                    gz_out.write(chunk)

    temp_gz.rename(out_path)
    print(f"Dataset downloaded and saved to {out_path} ({out_path.stat().st_size / 1e6:.1f} MB)")
    return out_path


def load_and_preprocess_kaggle(file_path: Path) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """Load, deduplicate, and validate the Kaggle dataset."""
    df = pd.read_csv(file_path)

    # Validation
    expected_cols = set(KAGGLE_FEATURE_COLS + ["Class"])
    if not expected_cols.issubset(df.columns):
        raise ValueError(f"Dataset missing expected columns: {expected_cols - set(df.columns)}")

    raw_count = len(df)
    raw_frauds = int(df["Class"].sum())

    # Deduplicate
    df = df.drop_duplicates().reset_index(drop=True)
    dedup_count = len(df)
    dedup_frauds = int(df["Class"].sum())
    duplicates_removed = raw_count - dedup_count

    stats = {
        "raw_rows": raw_count,
        "raw_fraud_cases": raw_frauds,
        "raw_fraud_rate": round(raw_frauds / raw_count, 6),
        "deduplicated_rows": dedup_count,
        "deduplicated_fraud_cases": dedup_frauds,
        "deduplicated_fraud_rate": round(dedup_frauds / dedup_count, 6),
        "duplicates_removed": duplicates_removed,
    }

    X = df[KAGGLE_FEATURE_COLS]
    y = df["Class"].astype(int)
    return X, y, stats


def train_and_evaluate_kaggle(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float = 0.20,
    random_state: int = 42,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    """Train baseline, Random Forest, and LightGBM models on Kaggle dataset and compute metrics."""
    # Stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=random_state
    )

    # Scale Time and Amount (V1..V28 are PCA components already centered)
    scaler = StandardScaler()
    scale_cols = ["Time", "Amount"]

    X_train_s = X_train.copy()
    X_test_s = X_test.copy()
    X_train_s[scale_cols] = scaler.fit_transform(X_train[scale_cols])
    X_test_s[scale_cols] = scaler.transform(X_test[scale_cols])

    # 1. Baseline Logistic Regression (balanced)
    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=random_state)
    lr.fit(X_train_s, y_train)
    p_lr = lr.predict_proba(X_test_s)[:, 1]

    # 2. Random Forest (balanced)
    rf = RandomForestClassifier(
        n_estimators=100, max_depth=12, class_weight="balanced", random_state=random_state, n_jobs=-1
    )
    rf.fit(X_train_s, y_train)
    p_rf = rf.predict_proba(X_test_s)[:, 1]

    # 3. Champion LightGBM (balanced)
    lgbm = LGBMClassifier(
        n_estimators=200,
        learning_rate=0.03,
        max_depth=6,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1,
        verbose=-1,
    )
    lgbm.fit(X_train_s, y_train)
    p_lgbm = lgbm.predict_proba(X_test_s)[:, 1]

    # Model evaluation helper
    def evaluate_preds(p_scores: np.ndarray, thresh: float = 0.5) -> dict[str, Any]:
        pred = (p_scores >= thresh).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_test, pred, labels=[0, 1]).ravel()
        return {
            "threshold": thresh,
            "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, pred, zero_division=0)), 4),
            "pr_auc": round(float(average_precision_score(y_test, p_scores)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, p_scores)), 4),
            "false_positive_rate": round(float(fp / max(fp + tn, 1)), 6),
            "confusion_matrix": {
                "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)
            },
        }

    # Alert budget recall for LightGBM
    order_desc = np.argsort(-p_lgbm)
    n_test = len(y_test)
    n_fraud = int(y_test.sum())
    alert_budgets: dict[str, float] = {}
    for pct in [0.001, 0.005, 0.01]:
        k = max(1, int(round(pct * n_test)))
        top_k = order_desc[:k]
        caught = int(y_test.iloc[top_k].sum())
        alert_budgets[f"recall_at_{pct*100:.1f}pct_budget"] = round(caught / n_fraud, 4)

    results = {
        "benchmark_dataset": "ULB Credit Card Fraud Detection (Kaggle mlg-ulb/creditcardfraud)",
        "split_summary": {
            "n_train": len(X_train),
            "n_train_fraud": int(y_train.sum()),
            "n_test": len(X_test),
            "n_test_fraud": int(y_test.sum()),
        },
        "models": {
            "logistic_regression_baseline": evaluate_preds(p_lr, 0.5),
            "random_forest": evaluate_preds(p_rf, 0.5),
            "lightgbm_champion": evaluate_preds(p_lgbm, 0.5),
        },
        "lightgbm_alert_budget_recall": alert_budgets,
        "disclaimer": (
            "Kaggle ULB benchmark uses anonymised PCA vectors without merchant or behavioral "
            "attributes and is maintained strictly as an offline reference. Live inference uses "
            "the behavioural pipeline."
        ),
    }

    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "kaggle_metrics.json").write_text(json.dumps(results, indent=2))

    return results


def run_kaggle_benchmark(
    data_dir: Path = Path("data/kaggle"),
    results_dir: Path = Path("ml_training/results"),
) -> dict[str, Any]:
    """Execute end-to-end Kaggle benchmark download, training, and evaluation."""
    gz_path = data_dir / "creditcard.csv.gz"
    download_kaggle_dataset(gz_path)
    X, y, stats = load_and_preprocess_kaggle(gz_path)
    print(f"Dataset loaded: {stats['deduplicated_rows']:,} rows, {stats['deduplicated_fraud_cases']} frauds.")

    results = train_and_evaluate_kaggle(X, y, out_dir=results_dir)
    results["preprocessing_stats"] = stats
    (results_dir / "kaggle_metrics.json").write_text(json.dumps(results, indent=2))
    print(f"Kaggle benchmark complete! Metrics saved to {results_dir / 'kaggle_metrics.json'}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run ULB Kaggle Fraud Detection Benchmark")
    parser.add_argument("--data-dir", type=Path, default=Path("data/kaggle"))
    parser.add_argument("--results-dir", type=Path, default=Path("ml_training/results"))
    args = parser.parse_args()
    run_kaggle_benchmark(args.data_dir, args.results_dir)
