"""SMS Notification Service with official MSG91 integration and demo simulation fallback."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timezone
from typing import Any
import httpx

from app.core.config import get_settings
from app.db.memory_store import Alert, Card, Customer, Transaction, memory_store
from app.services.stream_service import stream_broker

logger = logging.getLogger(__name__)


class SMSService:
    """Service to handle customer SMS notifications via MSG91 with seamless demo fallback."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def _mask_phone(self, phone: str) -> str:
        cleaned = phone.strip()
        if len(cleaned) >= 10:
            return f"{cleaned[:3]} ••••• ••{cleaned[-3:]}"
        return f"••••••{cleaned[-3:]}" if len(cleaned) >= 3 else "••••"

    def send_sms(
        self,
        to_phone: str,
        message: str,
        template_id: str | None = None,
    ) -> tuple[bool, str, str, str, str | None]:
        """Dispatch an SMS message.
        
        Returns:
            (success: bool, db_status: 'sent' | 'failed' | 'delivered', channel: 'sms' | 'simulated',
             provider_message_id: str, error: str | None)
        """
        auth_key = self.settings.msg91_auth_key
        # Clean phone for MSG91 (E.164 numeric string without '+')
        cleaned_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        if len(cleaned_phone) == 10:
            cleaned_phone = "91" + cleaned_phone

        # 1. Real MSG91 API Dispatch if configured
        if auth_key and auth_key.strip() and not auth_key.strip().lower().startswith("demo"):
            try:
                payload = {
                    "template_id": template_id or self.settings.msg91_template_id or "default_fraud_alert",
                    "sender": self.settings.msg91_sender_id,
                    "short_url": "0",
                    "mobiles": cleaned_phone,
                    "message": message,
                }
                headers = {
                    "authkey": auth_key.strip(),
                    "content-type": "application/json",
                }
                with httpx.Client(timeout=6.0) as client:
                    resp = client.post(
                        "https://control.msg91.com/api/v5/flow/",
                        json=payload,
                        headers=headers,
                    )
                    if resp.status_code in (200, 201, 202):
                        data = resp.json()
                        provider_id = str(data.get("message") or data.get("request_id") or f"msg91_{datetime.now(timezone.utc).timestamp()}")
                        logger.info("MSG91 SMS accepted by gateway for %s: %s", self._mask_phone(to_phone), provider_id)
                        return True, "sent", "sms", provider_id, None
                    else:
                        err_msg = f"MSG91 HTTP {resp.status_code}: {resp.text}"
                        logger.warning("MSG91 SMS dispatch returned error: %s", err_msg)
                        return False, "failed", "sms", f"msg91_err_{resp.status_code}", err_msg
            except Exception as e:
                err_msg = f"MSG91 request exception: {str(e)}"
                logger.error("Exception sending MSG91 SMS: %s", err_msg)
                return False, "failed", "sms", "msg91_net_err", err_msg

        # 2. Demo Simulation Fallback Mode
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        demo_id = f"demo_msg91_{timestamp_str}_{random.randint(1000, 9999)}"
        logger.info(
            "[DEMO MSG91 SMS SIMULATED] To: %s | Message: %s | Provider ID: %s",
            self._mask_phone(to_phone),
            message,
            demo_id,
        )
        return True, "sent", "simulated", demo_id, None

    def trigger_fraud_alert(
        self,
        transaction: Transaction,
        customer: Customer,
        card: Card | None,
        analyst_username: str,
        db: Any = None,
        custom_message: str | None = None,
    ) -> Alert:
        """Trigger an automated customer SMS alert when fraud is confirmed, and record delivery in memory store."""
        # Prevent duplicate alert triggers for the exact same transaction
        existing_alerts = memory_store.get_alerts_by_txn_id(transaction.id)
        for ea in existing_alerts:
            if ea.channel in ("sms", "simulated") and ea.status in ("sent", "delivered"):
                logger.info("Alert already dispatched for transaction %d (Alert ID: %d)", transaction.id, ea.id)
                return ea

        card_label = card.card_number_masked if card else "•••• •••• •••• 9901"
        phone = customer.phone_e164 or "+919876542019"

        if custom_message:
            message_body = custom_message
        else:
            message_body = (
                f"[BANK FRAUD ALERT] Transaction of INR {float(transaction.amount):,.2f} on card {card_label} "
                f"was CONFIRMED AS FRAUD by Bank Risk Operations. Your card has been temporarily FROZEN to protect your funds. "
                f"Ref: {transaction.external_txn_id}. If you have questions, call 1800-FRAUD-HELP."
            )

        success, db_status, channel, provider_id, error_detail = self.send_sms(
            to_phone=phone,
            message=message_body,
        )

        alert = memory_store.create_alert(
            transaction_id=transaction.id,
            prediction_id=None,
            channel=channel,
            message=message_body,
            status=db_status,
            provider_message_id=provider_id,
            error=error_detail,
            attempts=1,
        )

        delivery_meta = resolve_alert_delivery_meta(alert, phone)

        # Audit Log
        memory_store.log_audit(
            action="fraud_sms_dispatched",
            entity_type="alert",
            entity_id=str(alert.id),
            details={
                "transaction_id": transaction.id,
                "customer_id": customer.external_customer_id,
                "phone_masked": self._mask_phone(phone),
                "delivery_state": delivery_meta["delivery_state"],
                "provider": delivery_meta["provider"],
                "provider_id": provider_id,
                "analyst": analyst_username,
            },
        )

        # Publish SSE Event to Analyst / Monitoring Dashboards
        try:
            stream_broker.publish_sync(
                {
                    "event_type": "alert_dispatched",
                    "data": {
                        "id": alert.id,
                        "transaction_id": transaction.id,
                        "customer_id": customer.external_customer_id,
                        "phone_masked": self._mask_phone(phone),
                        "message": message_body,
                        "channel": channel,
                        "status": db_status,
                        "delivery_state": delivery_meta["delivery_state"],
                        "provider": delivery_meta["provider"],
                        "provider_message_id": provider_id,
                        "dispatched_at": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )
        except Exception:
            pass

        return alert


def resolve_alert_delivery_meta(alert: Alert, customer_phone: str | None = None) -> dict[str, Any]:
    """Helper to distinguish the 4 requested delivery states and provider identity."""
    is_demo = alert.channel == "simulated" or (
        alert.provider_message_id and alert.provider_message_id.startswith("demo_")
    )

    if is_demo:
        delivery_state = "simulated"
        provider = "MSG91 (Simulation Fallback)"
    elif alert.status == "failed" or alert.error:
        delivery_state = "failed"
        provider = "MSG91 (Live API)"
    elif alert.status == "delivered":
        delivery_state = "delivered"
        provider = "MSG91 (Live API)"
    else:
        delivery_state = "accepted"
        provider = "MSG91 (Live API)"

    phone_masked = None
    if customer_phone:
        cleaned = customer_phone.strip()
        if len(cleaned) >= 10:
            phone_masked = f"{cleaned[:3]} ••••• ••{cleaned[-3:]}"
        else:
            phone_masked = "••••"

    return {
        "delivery_state": delivery_state,
        "provider": provider,
        "provider_message_id": alert.provider_message_id,
        "phone_masked": phone_masked,
        "error": alert.error,
    }


sms_service = SMSService()
