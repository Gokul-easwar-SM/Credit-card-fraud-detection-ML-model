"""Base declarative stub for backward compatibility without SQLAlchemy."""
from __future__ import annotations


class _FakeMetadata:
    def create_all(self, bind=None):
        pass


class Base:
    metadata = _FakeMetadata()
