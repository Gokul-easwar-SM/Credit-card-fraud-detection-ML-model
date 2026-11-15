from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import create_app


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_health_reports_503_when_database_down():
    class BrokenSession:
        def execute(self, *_a, **_k):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    app = create_app()
    app.dependency_overrides[get_db] = lambda: BrokenSession()
    with TestClient(app) as c:
        r = c.get("/health")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "degraded"
    assert "refused" not in str(body)  # internal error details must not leak
