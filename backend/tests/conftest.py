import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "t" * 40)

import pytest
from fastapi.testclient import TestClient

from app.db.memory_store import memory_store
from app.db.session import build_engine, get_db
from app.main import create_app


@pytest.fixture
def engine(tmp_path):
    eng = build_engine()
    yield eng


@pytest.fixture
def session():
    memory_store.seed_defaults()
    yield memory_store


@pytest.fixture
def client(session):
    app = create_app()
    with TestClient(app) as c:
        yield c
