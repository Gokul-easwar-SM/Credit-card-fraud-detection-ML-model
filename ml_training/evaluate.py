"""Comprehensive model evaluation on the held-out Test set.

Evaluates:
  1. Primary classification metrics: Precision, Recall, F1, PR-AUC, ROC-AUC, FPR, Confusion Matrix.
  2. Recall per fraud pattern (amount_spike, velocity_burst, impossible_travel, new_device_night,
     shared_device_ring, and the drift pattern low_and_slow).
  3. Recall at fixed alert budgets (flagging top 1%, top 2% highest-risk transactions).
  4. Precision@k (k=100, 500).
  5. Cost analysis with sensitivity analysis across cost ratios (C_fn / C_fp).
  6. Bootstrap 95% confidence intervals (F1, Recall, PR-AUC).
  7. Multi-model ablation comparison: Logistic Regression, Random Forest, LightGBM (raw vs calibrated vs blended).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.ml.features import FEATURE_NAMES
from ml_training.dataset import SplitDataset
from ml_training.train import TrainedPipeline


def evaluate_model_on_test(
    pipeline: TrainedPipeline,
    data: SplitDataset,
    n_bootstrap: int = 500,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    """Execute complete evaluation suite on the held-out Test set."""
    X_test = data.X_test[list(FEATURE_NAMES)]
    y_test = np.asarray(data.y_test, dtype=int)
    meta = data.meta_test
    amounts = meta["amount"].values if "amount" in meta.columns else np.full_like(y_test, 1500.0, dtype=float)
    patterns = meta["fraud_pattern"].values if "fraud_pattern" in meta.columns else np.full_like(y_test, None)

    # 1. Predictions from all pipeline stages
    p_raw_lgbm = pipeline.supervised_model.predict_proba(X_test)[:, 1]
    p_calibrated = pipeline.calibrated_model.predict(p_raw_lgbm)
    p_blended = pipeline.predict_proba(X_test)
    p_rf = pipeline.baseline_rf.predict_proba(X_test)[:, 1]
    p_lr = pipeline.baseline_lr.predict_proba(X_test)[:, 1]

    # Primary decision threshold
    th_opt = pipeline.thresholds.get("threshold_optimal", 0.5)
    y_pred = (p_blended >= th_opt).astype(int)

    # 2. Confusion matrix & primary metrics
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
    fpr = float(fp / max(fp + tn, 1))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    pr_auc = float(average_precision_score(y_test, p_blended))
    roc_auc = float(roc_auc_score(y_test, p_blended))

    # 3. Recall per fraud pattern
    pattern_recall: dict[str, dict[str, Any]] = {}
    is_fraud_mask = (y_test == 1)
    unique_patterns = [p for p in pd.Series(patterns[is_fraud_mask]).dropna().unique()]

    for pat in sorted(unique_patterns):
        pat_mask = is_fraud_mask & (patterns == pat)
        n_pat = int(pat_mask.sum())
        n_caught = int((pat_mask & (y_pred == 1)).sum())
        pat_rec = float(n_caught / n_pat) if n_pat > 0 else 0.0
        pattern_recall[pat] = {
            "total_incidents": n_pat,
            "flagged": n_caught,
            "recall": round(pat_rec, 4),
        }

    # 4. Recall at fixed alert budget (e.g. top 1%, top 2% flagged)
    n_total = len(y_test)
    n_fraud_total = int(is_fraud_mask.sum())
    alert_budgets: dict[str, float] = {}

    order_desc = np.argsort(-p_blended)
    for pct in [0.01, 0.02, 0.05]:
        top_k_count = max(1, int(round(pct * n_total)))
        top_indices = order_desc[:top_k_count]
        caught = int(y_test[top_indices].sum())
        alert_budgets[f"recall_at_{int(pct*100)}pct_budget"] = (
            round(float(caught / n_fraud_total), 4) if n_fraud_total > 0 else 0.0
        )

    # 5. Precision @ K
    precision_at_k: dict[str, float] = {}
    for k in [50, 100, 200, 500]:
        if k <= n_total:
            top_k_idx = order_desc[:k]
            precision_at_k[f"precision_at_{k}"] = round(float(y_test[top_k_idx].mean()), 4)

    # 6. Cost analysis & Sensitivity analysis
    c_fp_base = pipeline.thresholds.get("cost_assumptions", {}).get("c_fp_inr", 50.0)
    fn_amount_loss = float(amounts[(y_test == 1) & (y_pred == 0)].sum())
    fp_review_cost = float(fp * c_fp_base)
    total_cost_base = fn_amount_loss + fp_review_cost

    # Sensitivity across cost ratios: what if false positive cost varies?
    cost_sensitivity: dict[str, float] = {}
    for c_fp_mult in [0.5, 1.0, 2.0, 5.0]:
        cost_val = fn_amount_loss + fp * (c_fp_base * c_fp_mult)
        cost_sensitivity[f"total_cost_at_c_fp_{int(c_fp_base * c_fp_mult)}inr"] = round(cost_val, 2)

    # 7. Model comparison ablation table
    def get_metrics_row(p_scores, thresh=0.5):
        pr = (p_scores >= thresh).astype(int)
        return {
            "precision": round(float(precision_score(y_test, pr, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, pr, zero_division=0)), 4),
            "f1": round(float(f1_score(y_test, pr, zero_division=0)), 4),
            "pr_auc": round(float(average_precision_score(y_test, p_scores)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, p_scores)), 4),
        }

    ablation_comparison = {
        "1_logistic_regression": get_metrics_row(p_lr, 0.5),
        "2_random_forest": get_metrics_row(p_rf, 0.5),
        "3_lightgbm_raw": get_metrics_row(p_raw_lgbm, 0.5),
        "4_lightgbm_calibrated": get_metrics_row(p_calibrated, th_opt),
        "5_champion_blended": get_metrics_row(p_blended, th_opt),
    }

    # 8. Bootstrap Confidence Intervals (95% CI)
    rng = np.random.default_rng(42)
    boot_f1: list[float] = []
    boot_rec: list[float] = []
    boot_prauc: list[float] = []

    for _ in range(n_bootstrap):
        b_idx = rng.choice(n_total, size=n_total, replace=True)
        b_y = y_test[b_idx]
        if b_y.sum() == 0 or b_y.sum() == len(b_y):
            continue
        b_p = p_blended[b_idx]
        b_pred = (b_p >= th_opt).astype(int)

        boot_f1.append(float(f1_score(b_y, b_pred, zero_division=0)))
        boot_rec.append(float(recall_score(b_y, b_pred, zero_division=0)))
        boot_prauc.append(float(average_precision_score(b_y, b_p)))

    ci_f1 = (
        round(float(np.percentile(boot_f1, 2.5)), 4),
        round(float(np.percentile(boot_f1, 97.5)), 4),
    )
    ci_rec = (
        round(float(np.percentile(boot_rec, 2.5)), 4),
        round(float(np.percentile(boot_rec, 97.5)), 4),
    )
    ci_prauc = (
        round(float(np.percentile(boot_prauc, 2.5)), 4),
        round(float(np.percentile(boot_prauc, 97.5)), 4),
    )

    results: dict[str, Any] = {
        "dataset_summary": {
            "n_test": n_total,
            "n_fraud": n_fraud_total,
            "fraud_rate": round(float(is_fraud_mask.mean()), 5),
            "test_window": [
                str(meta["occurred_at"].min()) if "occurred_at" in meta else "",
                str(meta["occurred_at"].max()) if "occurred_at" in meta else "",
            ],
        },
        "threshold_used": th_opt,
        "confusion_matrix": {
            "true_positive": int(tp),
            "false_positive": int(fp),
            "true_negative": int(tn),
            "false_negative": int(fn),
        },
        "primary_metrics": {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "false_positive_rate": round(fpr, 5),
            "pr_auc": round(pr_auc, 4),
            "roc_auc": round(roc_auc, 4),
        },
        "bootstrap_95ci": {
            "f1_score": list(ci_f1),
            "recall": list(ci_rec),
            "pr_auc": list(ci_prauc),
        },
        "pattern_recall": pattern_recall,
        "alert_budget_recall": alert_budgets,
        "precision_at_k": precision_at_k,
        "cost_analysis": {
            "fn_fraud_loss_inr": round(fn_amount_loss, 2),
            "fp_review_cost_inr": round(fp_review_cost, 2),
            "total_cost_inr": round(total_cost_base, 2),
            "sensitivity": cost_sensitivity,
        },
        "ablation_comparison": ablation_comparison,
        "disclaimer": "Fraud is rule-injected; results on synthetic data are optimistic vs real production banking data.",
    }

    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "metrics.json").write_text(json.dumps(results, indent=2))

    return results
