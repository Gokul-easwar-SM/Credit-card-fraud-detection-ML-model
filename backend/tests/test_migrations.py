"""The Alembic migration must create exactly the tables the models define, and be reversible."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.db.base import Base
from app.db.session import build_engine

BACKEND = Path(__file__).resolve().parent.parent


def _cfg(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def test_upgrade_creates_all_model_tables_and_downgrade_removes_them(tmp_path):
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    cfg = _cfg(url)

    command.upgrade(cfg, "head")
    engine = build_engine(url)
    tables = set(inspect(engine).get_table_names()) - {"alembic_version"}
    assert tables == set(Base.metadata.tables)

    command.downgrade(cfg, "base")
    assert set(inspect(engine).get_table_names()) - {"alembic_version"} == set()
    engine.dispose()
