"""In-memory event broadcaster for Server-Sent Events (SSE)."""
from __future__ import annotations

import asyncio
from typing import Any


class StreamBroker:
    """Manages active SSE subscriber queues and broadcasts events."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        """Register a new listener queue."""
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        """Unregister a listener queue."""
        self._subscribers.discard(q)

    def publish_sync(self, event: dict[str, Any]) -> None:
        """Synchronously enqueue event for all subscribers (thread-safe)."""
        dead = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
            except Exception:
                dead.append(q)
        for d in dead:
            self._subscribers.discard(d)


# Global singleton broker
stream_broker = StreamBroker()
