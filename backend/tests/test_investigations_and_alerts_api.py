"""Tests for investigations queue, analyst decisions, and customer verification alerts."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import build_engine, get_engine, get_sessionmaker
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db_path = tmp_path / "test_inv.db"
    db_url = f"sqlite:///{test_db_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("SECRET_KEY", "super-secret-test-key-of-sufficient-length-1234567890")
    monkeypatch.setenv("ENV", "test")

    from app.core.config import get_settings
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()

    engine = build_engine(db_url)
    Base.metadata.create_all(bind=engine)

    app = create_app()
    with TestClient(app) as c:
        yield c

    get_engine.cache_clear()
    get_sessionmaker.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def analyst_token(client: TestClient) -> str:
    resp = client.post("/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_investigation_lifecycle_and_human_decision_preserves_prediction(client: TestClient, analyst_token: str):
    """Verify investigation creation, analyst status update, and that ML prediction remains strictly unaltered."""
    # 1. Establish normal baseline spend for customer in Chennai
    client.post("/transactions", json={
        "external_txn_id": "INV_BASE_001",
        "external_customer_id": "CUST_INV_001",
        "device_key": "DEV_INV_001",
        "occurred_at": "2026-05-01T10:00:00Z",
        "amount": 500.0,
        "channel": "pos",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
    })

    # High-risk attack: Night-time (2:00 AM IST / 20:30 UTC) 500x spike on new device in Delhi
    resp = client.post("/transactions", json={
        "external_txn_id": "INV_TEST_TXN_001",
        "external_customer_id": "CUST_INV_001",
        "device_key": "DEV_FRAUDSTER_99",
        "occurred_at": "2026-05-01T20:30:00Z",
        "amount": 250000.0,
        "channel": "online",
        "lat": 28.6139,
        "lon": 77.2090,
        "source": "manual",
        "is_simulated": True,
    })
    assert resp.status_code == 201
    txn_data = resp.json()
    assert txn_data["prediction"]["risk_band"] == "high"
    original_pred_label = txn_data["prediction"]["predicted_label"]
    original_raw_score = txn_data["prediction"]["raw_score"]

    # 2. Query investigation queue
    q_resp = client.get("/investigations?status=pending_review")
    assert q_resp.status_code == 200
    queue = q_resp.json()
    assert queue["total"] >= 1
    inv_item = [it for it in queue["items"] if it["external_txn_id"] == "INV_TEST_TXN_001"][0]
    inv_id = inv_item["id"]

    # 3. Retrieve investigation detail
    detail_resp = client.get(f"/investigations/{inv_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["transaction"]["external_txn_id"] == "INV_TEST_TXN_001"
    assert len(detail["transaction"]["top_drivers"]) > 0

    # 4. Analyst reviews and marks as confirmed_fraud
    patch_resp = client.patch(
        f"/investigations/{inv_id}",
        headers={"Authorization": f"Bearer {analyst_token}"},
        json={"status": "confirmed_fraud", "notes": "Confirmed card takeover after analyst review."},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["status"] == "confirmed_fraud"
    assert updated["analyst_username"] == "analyst"
    assert "Confirmed card takeover" in updated["notes"]

    # 5. CRITICAL CHECK: Verify that ML predicted label and score in predictions table did NOT change
    txn_after = client.get(f"/transactions/{txn_data['id']}").json()
    assert txn_after["prediction"]["predicted_label"] == original_pred_label
    assert txn_after["prediction"]["raw_score"] == original_raw_score
    assert txn_after["investigation"]["status"] == "confirmed_fraud"


def test_customer_verification_alert_response_auto_escalation(client: TestClient):
    """Verify that a customer replying 'confirmed_fraud' automatically updates the investigation."""
    resp = client.post("/transactions", json={
        "external_txn_id": "ALERT_TEST_TXN_001",
        "external_customer_id": "CUST_ALERT_001",
        "device_key": "DEV_ALERT_001",
        "occurred_at": "2026-05-01T15:00:00Z",
        "amount": 55000.0,
        "channel": "online",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
    })
    assert resp.status_code == 201
    txn_id = resp.json()["id"]

    # Retrieve created alert
    alerts = client.get("/alerts").json()
    matching_alerts = [a for a in alerts if a["transaction_id"] == txn_id]
    assert len(matching_alerts) >= 1
    alert_id = matching_alerts[0]["id"]

    # Customer responds: 'not_me' (unauthorized fraud)
    resp_alert = client.post(f"/alerts/{alert_id}/respond", json={"response": "not_me"})
    assert resp_alert.status_code == 200
    assert resp_alert.json()["customer_response"] == "not_me"

    # Verify investigation was automatically escalated
    inv_resp = client.get(f"/transactions/{txn_id}").json()
    assert inv_resp["investigation"]["status"] == "confirmed_fraud"
    assert "Customer confirmed unauthorized" in inv_resp["investigation"]["notes"]
