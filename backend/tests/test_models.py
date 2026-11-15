"""Database constraint tests. These verify the schema itself rejects bad or duplicate data."""
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Customer,
    Investigation,
    ModelVersion,
    PaymentEvent,
    Prediction,
    Transaction,
    User,
)

NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def make_customer(session, ext="CUST001"):
    c = Customer(external_customer_id=ext)
    session.add(c)
    session.commit()
    return c


def make_txn(session, customer, ext="T1", **kw):
    fields = dict(
        external_txn_id=ext, customer_id=customer.id, occurred_at=NOW,
        amount=Decimal("100.00"), channel="online", source="simulator", is_simulated=True,
    )
    fields.update(kw)
    t = Transaction(**fields)
    session.add(t)
    session.commit()
    return t


def expect_rejected(session, obj):
    session.add(obj)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_valid_transaction_saves(session):
    t = make_txn(session, make_customer(session))
    assert t.id is not None


def test_duplicate_external_txn_id_rejected(session):
    c = make_customer(session)
    make_txn(session, c, "DUP")
    expect_rejected(session, Transaction(
        external_txn_id="DUP", customer_id=c.id, occurred_at=NOW,
        amount=Decimal("5"), channel="pos", source="manual", is_simulated=False))


def test_transaction_requires_existing_customer(session):
    expect_rejected(session, Transaction(
        external_txn_id="X", customer_id=9999, occurred_at=NOW,
        amount=Decimal("5"), channel="pos", source="manual", is_simulated=False))


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-10")])
def test_non_positive_amount_rejected(session, amount):
    c = make_customer(session)
    expect_rejected(session, Transaction(
        external_txn_id="A", customer_id=c.id, occurred_at=NOW, amount=amount,
        channel="pos", source="manual", is_simulated=False))


def test_invalid_source_rejected(session):
    c = make_customer(session)
    expect_rejected(session, Transaction(
        external_txn_id="S", customer_id=c.id, occurred_at=NOW, amount=Decimal("5"),
        channel="pos", source="real_bank_feed", is_simulated=False))


def test_invalid_channel_rejected(session):
    c = make_customer(session)
    expect_rejected(session, Transaction(
        external_txn_id="C", customer_id=c.id, occurred_at=NOW, amount=Decimal("5"),
        channel="carrier_pigeon", source="manual", is_simulated=False))


def _model_version(session):
    mv = ModelVersion(version="v1", artifact_path="models/v1.joblib",
                      feature_names=["a"], thresholds={}, metrics={})
    session.add(mv)
    session.commit()
    return mv


def _prediction(txn_id, mv_id, **kw):
    fields = dict(transaction_id=txn_id, model_version_id=mv_id, raw_score=0.9,
                  predicted_label="potential_fraud", risk_band="high",
                  recommended_action="investigate")
    fields.update(kw)
    return Prediction(**fields)


def test_one_prediction_per_transaction_and_model(session):
    t = make_txn(session, make_customer(session))
    mv = _model_version(session)
    session.add(_prediction(t.id, mv.id))
    session.commit()
    expect_rejected(session, _prediction(t.id, mv.id))


def test_invalid_risk_band_rejected(session):
    t = make_txn(session, make_customer(session))
    mv = _model_version(session)
    expect_rejected(session, _prediction(t.id, mv.id, risk_band="extreme"))


def test_duplicate_gateway_event_rejected(session):
    session.add(PaymentEvent(gateway_event_id="evt_1", provider="x", signature_valid=True, payload={}))
    session.commit()
    expect_rejected(session, PaymentEvent(
        gateway_event_id="evt_1", provider="x", signature_valid=True, payload={}))


def test_invalid_payment_environment_rejected(session):
    expect_rejected(session, PaymentEvent(
        gateway_event_id="evt_2", provider="x", environment="staging",
        signature_valid=True, payload={}))


def test_one_investigation_per_transaction(session):
    t = make_txn(session, make_customer(session))
    session.add(Investigation(transaction_id=t.id))
    session.commit()
    expect_rejected(session, Investigation(transaction_id=t.id))


def test_investigation_defaults_to_pending_review(session):
    t = make_txn(session, make_customer(session))
    inv = Investigation(transaction_id=t.id)
    session.add(inv)
    session.commit()
    assert inv.status == "pending_review"


def test_invalid_investigation_status_rejected(session):
    t = make_txn(session, make_customer(session))
    expect_rejected(session, Investigation(transaction_id=t.id, status="definitely_fraud"))


def test_invalid_user_role_rejected(session):
    expect_rejected(session, User(username="u", password_hash="h", role="superuser"))


def test_duplicate_username_rejected(session):
    session.add(User(username="a", password_hash="h", role="analyst"))
    session.commit()
    expect_rejected(session, User(username="a", password_hash="h", role="admin"))
