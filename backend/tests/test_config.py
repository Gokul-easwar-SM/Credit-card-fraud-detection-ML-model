import pytest
from pydantic import ValidationError

from app.core.config import Settings

GOOD = {"database_url": "sqlite://", "secret_key": "s" * 40}


def make(**overrides):
    # _env_file=None: ignore any local .env so the test only sees explicit values
    return Settings(_env_file=None, **{**GOOD, **overrides})


def test_valid_settings_load(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)  # conftest sets APP_ENV=test
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    s = make()
    assert s.app_env == "dev"
    assert s.log_level == "INFO"


def test_missing_secret_key_rejected(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="sqlite://")


def test_missing_database_url_rejected(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, secret_key="s" * 40)


def test_short_secret_rejected():
    with pytest.raises(ValidationError):
        make(secret_key="short")


def test_placeholder_secret_rejected_in_prod():
    with pytest.raises(ValidationError):
        make(app_env="prod", secret_key="change-me" + "x" * 30)


def test_invalid_log_level_rejected():
    with pytest.raises(ValidationError):
        make(log_level="LOUD")


def test_log_level_normalised():
    assert make(log_level="debug").log_level == "DEBUG"
