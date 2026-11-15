"""Integration tests for the Real-Time Scoring API (/transactions).

Verifies:
  1. Transaction ingestion, behavioural feature extraction, scoring, and DB persistence.
  2. Idempotency: Duplicate external_txn_id returns existing record with 200 OK & X-Idempotent header.
  3. Risk bands, automated Alert creation (Medium/High) and Investigation creation (High).
  4. Input schema and domain validation (422 for negative amount, bad coords, bad channels).
  5. Filtering, searching, sorting, and pagination on GET /transactions.
  6. Detailed explanation with TreeSHAP attributions on GET /transactions/{id}.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Alert, Investigation, Prediction, Transaction


def test_create_normal_transaction(client: TestClient, session: Session):
    payload = {
        "external_txn_id": "TXN_TEST_001",
        "external_customer_id": "CUST_TEST_001",
        "device_key": "DEV_TEST_001",
        "occurred_at": "2026-05-01T12:00:00Z",
        "amount": 450.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
        "currency": "INR",
    }
    resp = client.post("/transactions", json=payload)
    assert resp.status_code == 201

    data = resp.json()
    assert data["external_txn_id"] == "TXN_TEST_001"
    assert data["external_customer_id"] == "CUST_TEST_001"
    assert data["amount"] == 450.0
    assert data["prediction"] is not None
    assert 0.0 <= data["prediction"]["calibrated_score"] <= 1.0
    assert data["prediction"]["risk_band"] in ("low", "medium", "high")
    assert data["prediction"]["recommended_action"] in ("monitor", "verify", "investigate")
    assert isinstance(data["prediction"]["reason_codes"], list)


def test_idempotent_duplicate_transaction(client: TestClient, session: Session):
    payload = {
        "external_txn_id": "TXN_IDEMPOTENT_001",
        "external_customer_id": "CUST_IDEMPOTENT_001",
        "device_key": "DEV_IDEM_001",
        "occurred_at": "2026-05-01T13:00:00Z",
        "amount": 900.0,
        "channel": "online",
        "lat": 12.9716,
        "lon": 77.5946,
        "source": "manual",
        "is_simulated": True,
    }

    # First post -> 201 Created
    resp1 = client.post("/transactions", json=payload)
    assert resp1.status_code == 201
    data1 = resp1.json()

    # Second post -> 200 OK with X-Idempotent header
    resp2 = client.post("/transactions", json=payload)
    assert resp2.status_code == 200
    assert resp2.headers.get("x-idempotent") == "true"
    data2 = resp2.json()

    assert data1["id"] == data2["id"]
    assert data1["prediction"]["id"] == data2["prediction"]["id"]

    # Verify only 1 row exists in DB
    txns = session.execute(
        select(Transaction).where(Transaction.external_txn_id == "TXN_IDEMPOTENT_001")
    ).scalars().all()
    assert len(txns) == 1


def test_high_risk_triggers_alert_and_investigation(client: TestClient, session: Session):
    # Establish baseline spend for customer (INR 500)
    client.post("/transactions", json={
        "external_txn_id": "TXN_BASE_001",
        "external_customer_id": "CUST_HIGH_RISK",
        "device_key": "DEV_NORMAL",
        "occurred_at": "2026-05-01T10:00:00Z",
        "amount": 500.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
    })

    # Massive amount spike (20x) on new device at 2 AM
    resp = client.post("/transactions", json={
        "external_txn_id": "TXN_SPIKE_001",
        "external_customer_id": "CUST_HIGH_RISK",
        "device_key": "DEV_FRAUDSTER_99",
        "occurred_at": "2026-05-01T20:30:00Z",  # Night time
        "amount": 250000.0,                     # Massive amount spike
        "channel": "online",
        "lat": 28.6139,                         # Delhi (far away)
        "lon": 77.2090,
        "source": "manual",
        "is_simulated": True,
    })
    assert resp.status_code == 201
    data = resp.json()

    assert data["prediction"]["risk_band"] in ("medium", "high")
    assert data["alert"] is not None
    assert "SUSPICIOUS" in data["alert"]["message"].upper()

    if data["prediction"]["risk_band"] == "high":
        assert data["investigation"] is not None
        assert data["investigation"]["status"] == "pending_review"


@pytest.mark.parametrize("bad_field,bad_value", [
    ("amount", -500.0),
    ("amount", 0.0),
    ("channel", "wire"),
    ("lat", 120.0),
    ("lon", 200.0),
])
def test_transaction_validation_errors(client: TestClient, bad_field, bad_value):
    payload = {
        "external_txn_id": "TXN_INVALID",
        "external_customer_id": "CUST_INVALID",
        "occurred_at": "2026-05-01T12:00:00Z",
        "amount": 1000.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
    }
    payload[bad_field] = bad_value
    resp = client.post("/transactions", json=payload)
    assert resp.status_code == 422


def test_list_transactions_with_filter_and_search(client: TestClient):
    # Ingest multiple transactions
    for i in range(5):
        client.post("/transactions", json={
            "external_txn_id": f"TXN_LIST_{i:03d}",
            "external_customer_id": f"CUST_LIST_{i%2}",
            "device_key": f"DEV_LIST_{i}",
            "occurred_at": f"2026-05-01T{10+i:02d}:00:00Z",
            "amount": 100.0 * (i + 1),
            "channel": "pos" if i % 2 == 0 else "online",
            "lat": 13.0827,
            "lon": 80.2707,
            "source": "simulator",
            "is_simulated": True,
        })

    # 1. Basic pagination
    resp = client.get("/transactions?page=1&page_size=3")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 3
    assert data["total"] >= 5
    assert data["total_pages"] >= 2

    # 2. Filter by channel
    resp_pos = client.get("/transactions?channel=pos")
    assert resp_pos.status_code == 200
    for it in resp_pos.json()["items"]:
        assert it["channel"] == "pos"

    # 3. Search query
    resp_search = client.get("/transactions?search=CUST_LIST_1")
    assert resp_search.status_code == 200
    for it in resp_search.json()["items"]:
        assert it["external_customer_id"] == "CUST_LIST_1"


def test_get_transaction_detail_with_shap(client: TestClient):
    resp_create = client.post("/transactions", json={
        "external_txn_id": "TXN_DETAIL_001",
        "external_customer_id": "CUST_DETAIL_001",
        "device_key": "DEV_DETAIL_001",
        "occurred_at": "2026-05-01T14:00:00Z",
        "amount": 1500.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
    })
    assert resp_create.status_code == 201
    txn_id = resp_create.json()["id"]

    resp_detail = client.get(f"/transactions/{txn_id}")
    assert resp_detail.status_code == 200
    data = resp_detail.json()

    assert data["id"] == txn_id
    assert "shap_values" in data
    assert isinstance(data["shap_values"], dict)
    assert len(data["shap_values"]) == 13
    assert "top_drivers" in data
    assert len(data["top_drivers"]) > 0


def test_get_nonexistent_transaction(client: TestClient):
    resp = client.get("/transactions/999999")
    assert resp.status_code == 404
