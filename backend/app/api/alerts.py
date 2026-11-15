"""API routes for customer verification alerts and responses."""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.db.memory_store import memory_store
from app.schemas.alert import AlertResponse, CustomerResponseRequest
from app.services.sms_service import resolve_alert_delivery_meta, sms_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    status_filter: str | None = Query(None, alias="status", description="Filter by alert status: pending, delivered, failed"),
    limit: int = Query(50, ge=1, le=100),
) -> list[AlertResponse]:
    """List recent customer verification alerts from memory store."""
    all_alerts = memory_store.list_alerts()
    all_alerts.sort(key=lambda a: a.created_at, reverse=True)

    results: list[AlertResponse] = []
    for alert in all_alerts[:limit]:
        if status_filter and alert.status != status_filter:
            continue

        txn = memory_store.get_transaction(alert.transaction_id)
        cust = memory_store.get_customer(txn.customer_id) if txn else None
        cust_resp_rec = memory_store.get_customer_response_by_alert_id(alert.id)
        meta = resolve_alert_delivery_meta(alert, cust.phone_e164 if cust else None)

        results.append(
            AlertResponse(
                id=alert.id,
                transaction_id=txn.id if txn else 0,
                external_txn_id=txn.external_txn_id if txn else "",
                customer_id=cust.id if cust else 0,
                external_customer_id=cust.external_customer_id if cust else "",
                channel=alert.channel,
                message=alert.message,
                status=alert.status,
                delivery_state=meta["delivery_state"],
                provider=meta["provider"],
                provider_message_id=meta["provider_message_id"],
                phone_masked=meta["phone_masked"],
                error=meta["error"],
                attempts=alert.attempts,
                customer_response=cust_resp_rec.response if cust_resp_rec else None,
                created_at=alert.created_at,
                updated_at=alert.updated_at,
            )
        )
    return results


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int) -> AlertResponse:
    """Retrieve details for a single customer alert."""
    alert = memory_store.get_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    txn = memory_store.get_transaction(alert.transaction_id)
    cust = memory_store.get_customer(txn.customer_id) if txn else None
    cust_resp_rec = memory_store.get_customer_response_by_alert_id(alert.id)
    meta = resolve_alert_delivery_meta(alert, cust.phone_e164 if cust else None)

    return AlertResponse(
        id=alert.id,
        transaction_id=txn.id if txn else 0,
        external_txn_id=txn.external_txn_id if txn else "",
        customer_id=cust.id if cust else 0,
        external_customer_id=cust.external_customer_id if cust else "",
        channel=alert.channel,
        message=alert.message,
        status=alert.status,
        delivery_state=meta["delivery_state"],
        provider=meta["provider"],
        provider_message_id=meta["provider_message_id"],
        phone_masked=meta["phone_masked"],
        error=meta["error"],
        attempts=alert.attempts,
        customer_response=cust_resp_rec.response if cust_resp_rec else None,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


@router.post("/{alert_id}/respond", response_model=AlertResponse)
def respond_to_alert(
    alert_id: int,
    req: CustomerResponseRequest,
) -> AlertResponse:
    """Process customer's verification response ('not_me' or 'yes_me')."""
    alert = memory_store.get_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    existing_resp = memory_store.get_customer_response_by_alert_id(alert_id)
    if existing_resp is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer response has already been submitted for this alert",
        )

    memory_store.create_customer_response(alert_id=alert.id, response=req.response)
    alert.status = "delivered"
    alert.updated_at = datetime.now(timezone.utc)

    txn = memory_store.get_transaction(alert.transaction_id)
    cust = memory_store.get_customer(txn.customer_id) if txn else None

    # Cascade to Investigation in memory store
    inv = memory_store.get_investigation_by_txn_id(alert.transaction_id)
    if inv is None:
        inv = memory_store.create_investigation(
            transaction_id=alert.transaction_id,
            status="confirmed_fraud" if req.response == "not_me" else "marked_genuine",
            notes=(
                "[Auto] Customer confirmed unauthorized fraudulent transaction."
                if req.response == "not_me"
                else "[Auto] Customer confirmed transaction was authentic."
            ),
        )
    else:
        inv.status = "confirmed_fraud" if req.response == "not_me" else "marked_genuine"
        inv.notes = (
            f"{inv.notes}\n[Auto] Customer confirmed {'fraud' if req.response == 'not_me' else 'authentic'}."
            if inv.notes
            else f"[Auto] Customer confirmed {'fraud' if req.response == 'not_me' else 'authentic'}."
        )
        inv.updated_at = datetime.now(timezone.utc)

    # If customer reported unauthorized, auto-freeze the card
    if req.response == "not_me" and txn:
        card = memory_store.get_card_by_customer_id(txn.customer_id)
        if card and card.status != "frozen":
            card.status = "frozen"
            card.last_freeze_reason = f"Customer unauthorized alert response for transaction #{txn.id}"
            card.updated_at = datetime.now(timezone.utc)

    memory_store.log_audit(
        action="customer_verification_response",
        entity_type="alert",
        entity_id=str(alert.id),
        details={"response": req.response, "transaction_id": alert.transaction_id},
    )

    try:
        from app.services.stream_service import stream_broker
        stream_broker.publish_sync(
            {
                "event": "customer_verification_response",
                "data": {
                    "alert_id": alert.id,
                    "transaction_id": alert.transaction_id,
                    "customer_id": cust.external_customer_id if cust else "",
                    "response": req.response,
                    "status": "confirmed_fraud" if req.response == "not_me" else "marked_genuine",
                    "card_status": "frozen" if req.response == "not_me" else "active",
                },
            }
        )
    except Exception:
        pass

    return get_alert(alert_id=alert.id)


class SendSmsRequest(BaseModel):
    transaction_id: int
    phone: str | None = None
    custom_message: str | None = None


@router.post("/send-sms", response_model=AlertResponse)
def send_verification_sms(req: SendSmsRequest) -> AlertResponse:
    """Trigger real-time outbound SMS step-up verification to customer."""
    from app.services.stream_service import stream_broker

    txn = memory_store.get_transaction(req.transaction_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    cust = memory_store.get_customer(txn.customer_id)

    message_body = req.custom_message or (
        f"[BANK ALERT] Urgent: Transaction of INR {float(txn.amount):,.2f} on your card. "
        f"Reply YES if authorized, or NO to freeze card immediately."
    )

    phone_to_use = req.phone or (cust.phone_e164 if cust else None) or "+919876542019"
    success, db_status, channel, provider_id, error_detail = sms_service.send_sms(
        to_phone=phone_to_use,
        message=message_body,
    )

    alert = memory_store.create_alert(
        transaction_id=txn.id,
        prediction_id=None,
        channel=channel,
        message=message_body,
        status=db_status,
        provider_message_id=provider_id,
        error=error_detail,
        attempts=1,
    )

    try:
        stream_broker.publish_sync(
            {
                "event": "alert_dispatched",
                "data": {
                    "id": alert.id,
                    "transaction_id": txn.id,
                    "customer_id": cust.external_customer_id if cust else "",
                    "message": message_body,
                    "channel": "sms",
                    "phone": sms_service._mask_phone(phone_to_use),
                    "status": db_status,
                    "provider_message_id": provider_id,
                    "dispatched_at": datetime.now(timezone.utc).isoformat(),
                },
            }
        )
    except Exception:
        pass

    return get_alert(alert_id=alert.id)
