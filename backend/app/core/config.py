"""Application configuration. All secrets and environment-specific values come from
environment variables (or a local .env file). Nothing here is hardcoded for production."""
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_PREFIXES = ("change-me", "changeme", "secret")

# Resolve directories to reliably locate .env and anchor relative SQLite paths
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_DEFAULT_DB_PATH = (_PROJECT_ROOT / "fraud_sentinel.db").resolve()

_ENV_FILES = [
    str(_BACKEND_DIR / ".env"),
    str(_PROJECT_ROOT / ".env"),
    ".env",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str | None = None
    secret_key: str = Field(min_length=32, description="JWT signing key (>=32 chars)")
    log_level: str = "INFO"

    # MSG91 SMS Provider Configuration
    msg91_auth_key: str | None = Field(default=None, description="MSG91 AuthKey from environment")
    msg91_sender_id: str = Field(default="FRDSNT", description="MSG91 Approved 6-char Sender ID")
    msg91_template_id: str | None = Field(default=None, description="MSG91 Flow / DLT Template ID")
    msg91_route: str = Field(default="4", description="MSG91 SMS Route (4 = Transactional)")
    demo_customer_phone: str | None = Field(default=None, description="Registered phone for DEMO001 customer")

    @field_validator("database_url")
    @classmethod
    def _normalize_sqlite_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v.startswith("sqlite:///") and not v.startswith("sqlite:////"):
            sub = v[len("sqlite:///"):]
            if not (len(sub) > 1 and sub[1] == ":"):
                if sub.startswith("./"):
                    sub = sub[2:]
                target_path = (_PROJECT_ROOT / sub).resolve()
                return f"sqlite:///{target_path.as_posix()}"
        return v

    @field_validator("log_level")
    @classmethod
    def _valid_log_level(cls, v: str) -> str:
        v = v.upper()
        if v not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError(f"invalid log level: {v}")
        return v

    @model_validator(mode="after")
    def _no_placeholder_secret_in_prod(self) -> "Settings":
        if self.app_env == "prod" and self.secret_key.lower().startswith(_PLACEHOLDER_PREFIXES):
            raise ValueError("SECRET_KEY must not be a placeholder in prod")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
