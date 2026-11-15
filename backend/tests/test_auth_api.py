"""Tests for authentication and analyst access control."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.models import User
from app.db.session import get_db
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db_path = tmp_path / "test_auth.db"
    db_url = f"sqlite:///{test_db_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("SECRET_KEY", "super-secret-test-key-of-sufficient-length-1234567890")
    monkeypatch.setenv("ENV", "test")

    from app.core.config import get_settings
    get_settings.cache_clear()

    from app.db.session import build_engine, get_engine, get_sessionmaker
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()

    from app.db.base import Base
    engine = build_engine(db_url)
    Base.metadata.create_all(bind=engine)

    app = create_app()
    with TestClient(app) as c:
        yield c

    get_engine.cache_clear()
    get_sessionmaker.cache_clear()
    get_settings.cache_clear()


def test_default_users_seeded_on_startup(client: TestClient):
    """Verify that default analyst accounts are created at boot."""
    resp = client.post("/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["role"] == "analyst"


def test_login_invalid_password(client: TestClient):
    resp = client.post("/auth/login", json={"username": "analyst", "password": "wrongpassword"})
    assert resp.status_code == 401
    assert "Invalid username or password" in resp.json()["detail"]


def test_get_current_user_profile(client: TestClient):
    login_resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


def test_unauthenticated_request_rejected(client: TestClient):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
