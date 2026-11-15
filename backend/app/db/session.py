"""In-memory session provider for FraudSentinel.

Provides backward-compatible `get_db` dependency returning the in-memory
`MemoryStore` singleton. Eliminates SQLite engine, connection pools, and database locking.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Iterator
from app.db.memory_store import MemoryStore, memory_store


def get_db() -> Iterator[MemoryStore]:
    """FastAPI dependency yielding the in-memory data store."""
    yield memory_store


@lru_cache
def get_sessionmaker():
    """Compatibility stub returning a callable that returns memory_store."""
    class _SessionContext:
        def __enter__(self):
            return memory_store
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
        def __call__(self):
            return self
    return _SessionContext()


@lru_cache
def get_engine():
    """Compatibility stub returning dummy engine."""
    class _FakeEngine:
        def dispose(self):
            pass
    return _FakeEngine()


def build_engine(url: str | None = None):
    """Compatibility stub returning dummy engine."""
    return get_engine()
