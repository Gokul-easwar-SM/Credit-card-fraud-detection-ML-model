"""End-to-end training and evaluation script for the primary behavioral fraud model.

Saves:
  - models/model.joblib & backend/app/ml/artifacts/model.joblib
  - models/thresholds.json & backend/app/ml/artifacts/thresholds.json
  - models/features.json
  - models/metrics.json
  - docs/model_card.md
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from ml_training.dataset import prepare_dataset
from ml_training.evaluate import evaluate_model_on_test
from ml_training.simulation import SimConfig
from ml_training.train import train_pipeline


def run_full_pipeline(
    customers: int = 1500,
    days: int = 120,
    seed: int = 42,
    out_dir: Path = Path("models"),
    artifacts_dir: Path = Path("backend/app/ml/artifacts"),
) -> None:
    print(f"1. Preparing dataset ({customers} customers, {days} days, seed={seed})...")
    cfg = SimConfig(n_customers=customers, days=days, seed=seed, fraud_rate=0.01, drift_day=90)
    data = prepare_dataset(cfg, train_days=60, val_days=80)

    print(f"   Train samples: {len(data.X_train):,} ({data.y_train.sum():,} fraud)")
    print(f"   Val samples:   {len(data.X_val):,} ({data.y_val.sum():,} fraud)")
    print(f"   Test samples:  {len(data.X_test):,} ({data.y_test.sum():,} fraud)")

    print("2. Training models, calibrating probabilities, and tuning thresholds...")
    out_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    pipeline, train_summary = train_pipeline(data, c_fp=50.0, out_dir=out_dir)

    # Sync to backend artifacts directory for live scoring
    shutil.copy(out_dir / "model.joblib", artifacts_dir / "model.joblib")
    shutil.copy(out_dir / "thresholds.json", artifacts_dir / "thresholds.json")
    shutil.copy(out_dir / "features.json", artifacts_dir / "features.json")

    print("3. Evaluating on held-out Test set (with bootstrap CIs and pattern recall)...")
    eval_metrics = evaluate_model_on_test(pipeline, data, n_bootstrap=500, out_dir=out_dir)

    print("\n================ EVALUATION SUMMARY ================")
    pm = eval_metrics["primary_metrics"]
    print(f"PR-AUC:    {pm['pr_auc']:.4f}")
    print(f"ROC-AUC:   {pm['roc_auc']:.4f}")
    print(f"Precision: {pm['precision']:.4f}")
    print(f"Recall:    {pm['recall']:.4f}")
    print(f"F1 Score:  {pm['f1_score']:.4f}")
    print(f"FPR:       {pm['false_positive_rate']:.5f}")

    print("\n--- RECALL PER FRAUD PATTERN ---")
    for pat, stats in eval_metrics["pattern_recall"].items():
        print(f"  {pat:20s}: {stats['recall']*100:.1f}% ({stats['flagged']}/{stats['total_incidents']})")

    print("\n--- ABLATION COMPARISON ---")
    for model_name, m_res in eval_metrics["ablation_comparison"].items():
        print(f"  {model_name:24s} -> PR-AUC: {m_res['pr_auc']:.4f}, F1: {m_res['f1']:.4f}, Rec: {m_res['recall']:.4f}")

    # Generate Model Card
    card_text = generate_model_card(eval_metrics, train_summary)
    docs_dir = Path("docs")
    docs_dir.mkdir(parents=True, exist_ok=True)
    (docs_dir / "model_card.md").write_text(card_text, encoding="utf-8")
    print(f"\nModel Card saved to docs/model_card.md")
    print(f"Metrics saved to {out_dir / 'metrics.json'}")


def generate_model_card(metrics: dict, train_summary: dict) -> str:
    pm = metrics["primary_metrics"]
    ci = metrics["bootstrap_95ci"]
    cm = metrics["confusion_matrix"]
    pats = metrics["pattern_recall"]
    ablation = metrics["ablation_comparison"]

    lines = [
        "# Model Card: Behavioural Credit Card Fraud Detection Champion",
        "",
        "## Model Details",
        "- **Architecture**: LightGBM (150 trees, max depth 6) blended with Isolation Forest (cold start/novelty).",
        "- **Calibration**: Platt Scaling (Sigmoid) on strictly post-training validation set.",
        "- **Input Features**: 13 engineered behavioural signals (Z-scores, circular hour deviation, velocity, travel speed, device sharing).",
        "- **Decision Thresholds** (optimized on validation expected loss):",
        f"  - Low Risk (< {train_summary['thresholds']['threshold_low']}): Monitor",
        f"  - Medium Risk ({train_summary['thresholds']['threshold_low']} – {train_summary['thresholds']['threshold_high']}): Verify (SMS trigger)",
        f"  - High Risk (>= {train_summary['thresholds']['threshold_high']}): Investigate (Analyst routing)",
        "",
        "## Intended Use",
        "- Academic prototype of an intelligent banking fraud monitoring department.",
        "- Evaluates risk in real-time as transactions occur.",
        "- **Disclaimer**: Not intended for real banking production. Uses simulated transactions where fraud is rule-generated.",
        "",
        "## Quantitative Performance (Held-Out Test Set)",
        f"- **PR-AUC**: {pm['pr_auc']:.4f} (95% CI: [{ci['pr_auc'][0]:.4f}, {ci['pr_auc'][1]:.4f}])",
        f"- **ROC-AUC**: {pm['roc_auc']:.4f}",
        f"- **Precision**: {pm['precision']:.4f}",
        f"- **Recall**: {pm['recall']:.4f} (95% CI: [{ci['recall'][0]:.4f}, {ci['recall'][1]:.4f}])",
        f"- **F1 Score**: {pm['f1_score']:.4f} (95% CI: [{ci['f1_score'][0]:.4f}, {ci['f1_score'][1]:.4f}])",
        f"- **False Positive Rate**: {pm['false_positive_rate']:.5f}",
        "",
        "### Confusion Matrix",
        f"| | Predicted Genuine | Predicted Fraud |",
        f"|---|---|---|",
        f"| **Actual Genuine** | {cm['true_negative']:,} (TN) | {cm['false_positive']:,} (FP) |",
        f"| **Actual Fraud** | {cm['false_negative']:,} (FN) | {cm['true_positive']:,} (TP) |",
        "",
        "### Recall per Fraud Pattern",
        "| Fraud Pattern | Incidents | Flagged | Recall |",
        "|---|---|---|---|",
    ]

    for pat, st in pats.items():
        lines.append(f"| `{pat}` | {st['total_incidents']} | {st['flagged']} | {st['recall']*100:.1f}% |")

    lines.extend([
        "",
        "### Ablation Study",
        "| Model Pipeline | PR-AUC | F1 | Recall | Precision |",
        "|---|---|---|---|---|",
    ])

    for m_name, res in ablation.items():
        lines.append(f"| {m_name} | {res['pr_auc']:.4f} | {res['f1']:.4f} | {res['recall']:.4f} | {res['precision']:.4f} |")

    lines.extend([
        "",
        "## Ethical Considerations & Limitations",
        "- **Synthetic Data Bias**: Since fraud patterns were generated with synthetic rules, model accuracy is optimistic compared to real bank streams.",
        "- **Cost Assumption**: Cost optimization assumes ₹50 review cost per false positive and actual transaction amount for false negatives.",
        "- **Privacy**: No PII, passwords, CVV, or real account numbers are present or stored.",
    ])

    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--customers", type=int, default=1500)
    parser.add_argument("--days", type=int, default=120)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    run_full_pipeline(args.customers, args.days, args.seed)
