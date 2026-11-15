"""Tests for model metrics, drift monitoring, and live simulator controls."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import build_engine, get_engine, get_sessionmaker
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db_path = tmp_path / "test_metrics.db"
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


def test_get_model_metrics(client: TestClient):
    resp = client.get("/metrics/model")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == "lgbm_v1_champion"
    assert "thresholds" in data
    assert "threshold_high" in data["thresholds"]
    assert "feature_names" in data


def test_get_drift_metrics_empty_and_populated(client: TestClient):
    # Empty window
    resp_empty = client.get("/metrics/drift")
    assert resp_empty.status_code == 200
    assert resp_empty.json()["status"] == "healthy"

    # Add a transaction
    client.post("/transactions", json={
        "external_txn_id": "DRIFT_TXN_001",
        "external_customer_id": "CUST_DRIFT_001",
        "occurred_at": "2026-05-01T10:00:00Z",
        "amount": 500.0,
        "channel": "pos",
        "lat": 13.0827,
        "lon": 80.2707,
        "source": "manual",
        "is_simulated": True,
    })

    resp = client.get("/metrics/drift?window_hours=48000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sample_count"] >= 1
    assert "metrics" in data


def test_simulator_status_and_pattern_injection(client: TestClient):
    # Check initial status
    status_resp = client.get("/simulator/status")
    assert status_resp.status_code == 200
    assert "is_running" in status_resp.json()

    # Inject an amount_spike pattern
    inj_resp = client.post("/simulator/inject", json={"pattern": "amount_spike"})
    assert inj_resp.status_code == 200
    results = inj_resp.json()
    assert len(results) >= 1
    assert results[-1]["prediction"]["risk_band"] in ("medium", "high")

    # Inject impossible_travel pattern
    travel_resp = client.post("/simulator/inject", json={"pattern": "impossible_travel"})
    assert travel_resp.status_code == 200
    travel_results = travel_resp.json()
    assert len(travel_results) == 2  # first local, second far
