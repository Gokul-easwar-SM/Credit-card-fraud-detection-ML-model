"""API routes for entity relationship graph and device-sharing fraud ring detection.

Phase 5: Advanced Relationship-Based Fraud Detection.
Enables visual investigation of cardholders, shared hardware devices, and transaction clusters.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter
from app.db.memory_store import memory_store

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("/graph")
def get_relationship_graph() -> dict[str, Any]:
    """Compile graph of Customers, Devices, and Transactions with suspicious cluster detection.
    
    Identifies mule networks, account takeover syndicates, and hardware sharing.
    """
    customers = memory_store.list_customers()
    transactions = memory_store.list_transactions()
    devices = list(memory_store.devices.values())

    # Build node maps
    customer_nodes: dict[str, dict[str, Any]] = {}
    device_nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    # Map devices to customers who have transacted on them
    device_to_cust_ids: dict[int, set[int]] = {}
    device_to_txns: dict[int, list[int]] = {}
    device_high_risk_counts: dict[int, int] = {}

    for t in transactions:
        if t.device_id:
            if t.device_id not in device_to_cust_ids:
                device_to_cust_ids[t.device_id] = set()
                device_to_txns[t.device_id] = []
                device_high_risk_counts[t.device_id] = 0

            device_to_cust_ids[t.device_id].add(t.customer_id)
            device_to_txns[t.device_id].append(t.id)

            pred = memory_store.get_prediction_by_txn_id(t.id)
            if pred and (pred.risk_band in ("high", "medium") or pred.decision in ("review", "decline")):
                device_high_risk_counts[t.device_id] += 1

    # Populate Customer Nodes
    for c in customers:
        # Check customer highest risk band
        c_txns = [t for t in transactions if t.customer_id == c.id]
        c_preds = [memory_store.get_prediction_by_txn_id(t.id) for t in c_txns]
        bands = [p.risk_band for p in c_preds if p]

        risk_level = "low"
        if "high" in bands:
            risk_level = "high"
        elif "medium" in bands:
            risk_level = "medium"

        card = memory_store.get_card_by_customer_id(c.id)

        node_id = f"cust_{c.id}"
        customer_nodes[node_id] = {
            "id": node_id,
            "entity_id": c.id,
            "label": c.external_customer_id,
            "type": "customer",
            "name": f"Customer {c.external_customer_id}" if c.external_customer_id != "DEMO001" else "Demo Customer",
            "city": c.home_city or "Coimbatore",
            "risk_level": risk_level,
            "card_status": card.status if card else "active",
            "total_transactions": len(c_txns),
        }

    # Populate Device Nodes
    for d in devices:
        shared_count = len(device_to_cust_ids.get(d.id, set()))
        flagged_count = device_high_risk_counts.get(d.id, 0)
        is_suspicious = shared_count >= 2 or flagged_count >= 1

        node_id = f"dev_{d.id}"
        device_nodes[node_id] = {
            "id": node_id,
            "entity_id": d.id,
            "label": d.device_key,
            "type": "device",
            "device_type": getattr(d, "device_type", "mobile_browser"),
            "os": getattr(d, "os", "Android"),
            "shared_customer_count": shared_count,
            "flagged_transactions": flagged_count,
            "is_suspicious": is_suspicious,
            "risk_level": "critical" if shared_count >= 2 and flagged_count >= 1 else ("high" if flagged_count >= 1 else ("medium" if shared_count >= 2 else "low")),
        }

    # Populate Edges (Customer <-> Device via Transaction)
    seen_edges = set()
    for t in transactions:
        if not t.device_id:
            continue
        c_node = f"cust_{t.customer_id}"
        d_node = f"dev_{t.device_id}"
        edge_key = f"{c_node}_{d_node}"

        pred = memory_store.get_prediction_by_txn_id(t.id)
        risk_band = pred.risk_band if pred else "low"
        decision = getattr(pred, "decision", "approve") if pred else "approve"

        edges.append({
            "id": f"e_{t.id}",
            "source": c_node,
            "target": d_node,
            "transaction_id": t.id,
            "external_txn_id": t.external_txn_id,
            "amount": float(t.amount),
            "currency": t.currency,
            "channel": t.channel,
            "risk_band": risk_band,
            "decision": decision,
            "occurred_at": t.occurred_at.isoformat(),
        })

    # Compile Suspicious Clusters
    suspicious_clusters = []
    cluster_idx = 1
    for dev_id, cust_set in device_to_cust_ids.items():
        dev = memory_store.get_device(dev_id)
        if not dev:
            continue

        flagged_txns = device_high_risk_counts.get(dev_id, 0)
        is_multi_cust = len(cust_set) >= 2
        is_high_risk = flagged_txns >= 1

        if is_multi_cust or is_high_risk:
            cust_ext_ids = [
                memory_store.get_customer(cid).external_customer_id
                for cid in cust_set
                if memory_store.get_customer(cid)
            ]
            txn_ids = device_to_txns.get(dev_id, [])
            total_exposure = sum(
                float(memory_store.get_transaction(tid).amount)
                for tid in txn_ids
                if memory_store.get_transaction(tid)
            )

            severity = "CRITICAL" if is_multi_cust and flagged_txns >= 2 else ("HIGH" if is_multi_cust else "ELEVATED")
            reason = (
                f"Shared hardware device across {len(cust_set)} distinct cardholders with {flagged_txns} flagged alerts"
                if is_multi_cust
                else f"Single-device burst with {flagged_txns} high-risk anomalies"
            )

            suspicious_clusters.append({
                "cluster_id": f"CLUST-{cluster_idx:03d}",
                "device_id": dev.id,
                "device_key": dev.device_key,
                "device_type": dev.device_type,
                "connected_customers": cust_ext_ids,
                "transaction_count": len(txn_ids),
                "total_exposure_inr": round(total_exposure, 2),
                "flagged_transactions": flagged_txns,
                "severity": severity,
                "reason": reason,
            })
            cluster_idx += 1

    return {
        "nodes": list(customer_nodes.values()) + list(device_nodes.values()),
        "edges": edges,
        "suspicious_clusters": suspicious_clusters,
        "summary": {
            "total_customers": len(customer_nodes),
            "total_devices": len(device_nodes),
            "total_relationships": len(edges),
            "suspicious_clusters_detected": len(suspicious_clusters),
            "multi_customer_devices": sum(1 for d in device_nodes.values() if d["shared_customer_count"] >= 2),
        },
    }
