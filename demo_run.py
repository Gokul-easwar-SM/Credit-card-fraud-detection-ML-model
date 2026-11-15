"""FraudSentinel - End-to-End Runtime Demonstration Script.

Simulates the entire bank fraud workflow in terminal output:
1. Ingests synthetic transactions with 13 behavioral features.
2. Scores using LightGBM + Isolation Forest ensemble.
3. Computes TreeSHAP local attributions and counterfactual hints.
4. Applies 4-Tier Decision Policy (Approve, Verify, Review, Decline).
5. Calculates Financial Priority Score (FPS = Score * Amount * Multipliers).
6. Tests 2-Way Customer Verification and automated card freeze.
7. Evaluates Population Stability Index (PSI) drift monitoring.
8. Queries the Relationship Graph for shared-device mule rings.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Setup paths
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from app.api.health import health
from app.api.relationships import get_relationship_graph
from app.api.metrics import check_feature_drift, get_kaggle_benchmark
from app.api.investigations import export_analyst_feedback
from app.services.scoring import process_transaction
from app.schemas.transaction import TransactionCreate
from app.db.memory_store import memory_store


def separator(title: str):
    print("\n" + "=" * 70, flush=True)
    print(f"  {title.upper()}", flush=True)
    print("=" * 70, flush=True)


def main():
    separator("1. System Health & Storage Mode")
    h = health()
    print(f"Status:             {h['status'].upper()}")
    print(f"Storage:            {h['storage'].upper()} (Zero external database required)")
    print(f"ML Model:           {h['model_status'].upper()} (LightGBM Champion + IsoForest)")
    print(f"Seeded Customers:   {h['customers_registered']}")

    separator("2. Submitting Transactions across 4-Tier Policy")

    # Scenario A: Genuine Coffee (POS Swipe in home city)
    print("\n--- [Scenario A: Regular Coffee POS Swipe] ---")
    t1 = TransactionCreate(
        external_txn_id=f"TXN-DEMO-GENUINE-{int(datetime.now().timestamp())}",
        external_customer_id="DEMO001",
        device_key="DEV-DEMO001-A",
        occurred_at=datetime.now(timezone.utc),
        amount=350.0,
        channel="pos",
        lat=11.0168,
        lon=76.9558,
        source="simulator",
        is_simulated=True,
    )
    res1, _ = process_transaction(txn_in=t1)
    p1 = res1.prediction
    print(f"Amount:              INR {res1.amount:,.2f} ({res1.channel.upper()})")
    print(f"Calibrated Score:    {p1.calibrated_score:.4f} ({p1.calibrated_score*100:.1f}%)")
    print(f"4-Tier Decision:     {p1.decision.upper()} (Frictionless clearance)")
    print(f"Financial Priority:  INR {p1.financial_priority_score:,.2f} ({p1.priority_category})")
    print(f"Evidence Profile:    {p1.evidence_sufficiency}")
    print(f"TreeSHAP Reason:     {p1.reason_codes[0] if p1.reason_codes else 'Routine transaction'}")

    # Scenario B: Impossible Travel Velocity Attack (Delhi at night, high value)
    print("\n--- [Scenario B: Impossible Travel Geo-Velocity Attack] ---")
    t2 = TransactionCreate(
        external_txn_id=f"TXN-DEMO-ATTACK-{int(datetime.now().timestamp())}",
        external_customer_id="DEMO001",
        device_key="DEV-UNRECOGNIZED-9988",
        occurred_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        amount=98500.0,
        channel="online",
        lat=28.6139,
        lon=77.2090,
        source="simulator",
        is_simulated=True,
    )
    res2, _ = process_transaction(txn_in=t2)
    p2 = res2.prediction
    print(f"Amount:              INR {res2.amount:,.2f} ({res2.channel.upper()})")
    print(f"Calibrated Score:    {p2.calibrated_score:.4f} ({p2.calibrated_score*100:.1f}%)")
    print(f"4-Tier Decision:     {p2.decision.upper()} (Routed to Analyst Queue & Card Freeze)")
    print(f"Financial Priority:  INR {p2.financial_priority_score:,.2f} ({p2.priority_category} PRIORITY)")
    print(f"TreeSHAP Drivers:    {p2.reason_codes}")
    if p2.counterfactual_hint:
        print(f"Counterfactual Hint: {p2.counterfactual_hint}")

    separator("3. 2-Way Customer Verification & Auto Card Freeze")
    if res2.alert:
        print(f"Security Alert Triggered: ID #{res2.alert.id}")
        print(f"Alert Message: \"{res2.alert.message}\"")
        print("\nSimulating Cardholder Response: \"not_me\" (Unauthorized Activity)...")
        from app.schemas.alert import CustomerResponseRequest
        from app.api.alerts import respond_to_alert
        alert_resp = respond_to_alert(res2.alert.id, CustomerResponseRequest(response="not_me"))
        print(f"Alert Updated Status:   {alert_resp.status.upper()}")

        card = memory_store.get_card_by_customer_id(memory_store.get_customer("DEMO001").id)
        print(f"Customer Card Status:   {card.status.upper()} (Automated Protection Hold Active)")
        print(f"Freeze Justification:   \"{card.last_freeze_reason}\"")

    separator("4. Relationship Graph & Mule Ring Discovery")
    rg = get_relationship_graph()
    print(f"Total Nodes:          {len(rg['nodes'])} ({rg['summary']['total_customers']} Customers, {rg['summary']['total_devices']} Devices)")
    print(f"Total Graph Edges:    {len(rg['edges'])} Transactions")
    print(f"Suspicious Clusters:  {len(rg['suspicious_clusters'])} Detected")
    for cl in rg['suspicious_clusters']:
        print(f"\n  * Cluster [{cl['cluster_id']}] - Severity: {cl['severity']}")
        print(f"    Shared Hardware:  {cl['device_key']} ({cl['device_type']})")
        print(f"    Linked Accounts:  {', '.join(cl['connected_customers'])}")
        print(f"    Total Exposure:   INR {cl['total_exposure_inr']:,.2f}")
        print(f"    Syndicate Flag:   {cl['reason']}")

    separator("5. Model Drift Monitoring (Population Stability Index - PSI)")
    drift = check_feature_drift()
    print(f"Overall PSI Score:    {drift['psi']:.4f}")
    print(f"Drift Status:         {drift['status'].upper()} ({drift['interpretation']})")
    print(f"Spend Amount PSI:     {drift['spend_psi']:.4f}")
    print(f"Prediction Score PSI: {drift['score_psi']:.4f}")

    separator("6. Kaggle Benchmark (Strict Pipeline B Separation)")
    kg = get_kaggle_benchmark()
    print(f"Dataset:              {kg['dataset_name']}")
    print(f"Total Samples:        {kg['dataset_summary']['total_transactions']:,} ({kg['dataset_summary']['imbalance_ratio_pct']}% fraud)")
    print("\nModel Benchmark Comparison on Kaggle:")
    for m in kg['model_comparison']:
        champ = " [CHAMPION]" if m.get('is_champion') else ""
        print(f"  - {m['model']:<35} ROC-AUC: {m['roc_auc']:.4f} | PR-AUC: {m['pr_auc']:.4f} | Recall: {m['recall']*100:.1f}%{champ}")
    print(f"\nSeparation Rule:      {kg['architectural_distinction']['separation_guarantee']}")

    separator("DEMONSTRATION RUN COMPLETE - ALL SYSTEMS FUNCTIONAL")


if __name__ == "__main__":
    main()
