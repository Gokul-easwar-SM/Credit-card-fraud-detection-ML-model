"""Server-Sent Events (SSE) stream endpoint for live real-time transaction streaming."""
from __future__ import annotations

import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.services.stream_service import stream_broker

router = APIRouter(tags=["stream"])


@router.get("/stream")
@router.get("/stream/transactions")
async def stream_transactions(request: Request):
    """Stream live scored transactions to connected clients via Server-Sent Events (SSE)."""
    q = stream_broker.subscribe()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Send periodic SSE keep-alive comment so proxies/browsers don't close the connection
                    yield ": ping\n\n"
        finally:
            stream_broker.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
