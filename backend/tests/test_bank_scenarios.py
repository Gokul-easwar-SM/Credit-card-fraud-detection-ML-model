"""Verification test for the 7 bank-side fraud & genuine transaction scenarios."""
import os
import pytest

from app.db.memory_store import memory_store
from app.services.simulator_service import simulator_service


@pytest.fixture(autouse=True)
def setup_store():
    memory_store.reset()


def test_scenario_normal_usual_location():
    res = simulator_service.inject_scenario("normal_usual_location", "DEMO001")
    assert len(res) == 1
    txn = res[0]
    p = txn["prediction"]
    assert txn["amount"] == 450.0
    assert txn["city"] == "Coimbatore"
    assert p["calibrated_score"] < 0.20
    assert p["decision"] == "approve"


def test_scenario_high_value_unusual_location():
    res = simulator_service.inject_scenario("high_value_unusual_location", "DEMO001")
    assert len(res) == 1
    txn = res[0]
    p = txn["prediction"]
    assert txn["amount"] == 88500.0
    assert txn["city"] == "Mumbai"
    assert txn["is_unusual_location"] is True
    assert p["calibrated_score"] >= 0.70
    assert p["risk_band"] == "high"


def test_scenario_stolen_card_another_city():
    res = simulator_service.inject_scenario("stolen_card_another_city", "DEMO001")
    assert len(res) == 1
    txn = res[0]
    p = txn["prediction"]
    assert txn["amount"] == 25000.0
    assert txn["channel"] == "atm"
    assert txn["city"] == "Kolkata"
    assert txn["is_unusual_location"] is True
    assert p["calibrated_score"] >= 0.60


def test_scenario_impossible_travel():
    res = simulator_service.inject_scenario("impossible_travel", "DEMO001")
    assert len(res) == 2
    t1, t2 = res[0], res[1]
    assert t1["city"] == "Chennai"
    assert t2["city"] == "Delhi"
    assert t2["speed_kmh"] > 1000.0
    assert t2["prediction"]["calibrated_score"] >= 0.85
    assert t2["prediction"]["decision"] in ("review", "decline")


def test_scenario_new_device_unusual_location():
    res = simulator_service.inject_scenario("new_device_unusual_location", "DEMO001")
    assert len(res) == 1
    txn = res[0]
    assert txn["channel"] == "online"
    assert "DEV-UNRECOGNIZED" in txn["device_key"]
    assert txn["location_source"] == "ip_geolocation"
    assert txn["prediction"]["calibrated_score"] >= 0.30


def test_scenario_high_velocity_burst():
    res = simulator_service.inject_scenario("high_velocity_burst", "DEMO001")
    assert len(res) == 4
    latest = res[-1]
    assert latest["amount"] == 41500.0
    assert latest["prediction"]["calibrated_score"] >= 0.35
    assert latest["prediction"]["risk_band"] == "high"
    assert latest["prediction"]["decision"] in ("review", "decline")


def test_scenario_normal_new_location():
    res = simulator_service.inject_scenario("normal_new_location", "DEMO001")
    assert len(res) == 1
    txn = res[0]
    p = txn["prediction"]
    assert txn["amount"] == 780.0
    assert txn["city"] == "Bengaluru"
    # Even though location is Bengaluru, because amount is modest and normal hours, score remains low/moderate!
    assert p["calibrated_score"] < 0.25
    assert p["decision"] in ("approve", "verify")
