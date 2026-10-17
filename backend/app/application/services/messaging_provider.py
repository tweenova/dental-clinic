from abc import ABC, abstractmethod
from dataclasses import dataclass
import os
from typing import Any, Dict, Optional
import httpx


@dataclass
class MessageDeliveryResult:
    success: bool
    status: str  # "simulated" | "queued" | "sent" | "delivered" | "failed" | "opted_out" | "quiet_hours_held"
    channel: str  # "sms" | "whatsapp"
    provider: str
    recipient: str
    details: Optional[str] = None
    error: Optional[str] = None
    provider_message_id: Optional[str] = None

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


class MessagingProvider(ABC):
    @abstractmethod
    async def send_message(
        self,
        recipient: str,
        message: str,
        channel: str = "sms",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageDeliveryResult:
        """Sends a patient communication through this provider."""
        pass


class SimulatedMessagingProvider(MessagingProvider):
    """
    Simulated local provider.
    Fulfills delivery simulation requirements without making outside network calls
    or asserting fabricated external carrier delivery.
    """

    async def send_message(
        self,
        recipient: str,
        message: str,
        channel: str = "sms",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageDeliveryResult:
        return MessageDeliveryResult(
            success=True,
            status="simulated",
            channel=channel,
            provider="simulated",
            recipient=recipient,
            details="Simulated dispatch: message delivery simulated locally with honest 'simulated' status.",
            provider_message_id=None,
        )


class DisabledMessagingProvider(MessagingProvider):
    """Fallback provider when messaging is switched off."""

    async def send_message(
        self,
        recipient: str,
        message: str,
        channel: str = "sms",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageDeliveryResult:
        return MessageDeliveryResult(
            success=False,
            status="disabled",
            channel=channel,
            provider="disabled",
            recipient=recipient,
            details="Messaging is disabled in clinic configuration.",
        )


class TwilioSmsProvider(MessagingProvider):
    """
    Adapter for Twilio Programmable SMS API.
    Remains OFF unless environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
    are present. Fails closed when misconfigured or unauthenticated.
    """

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        from_number: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self.account_sid = account_sid or os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = auth_token or os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = from_number or os.getenv("TWILIO_FROM_NUMBER")
        self._http_client = http_client

    @property
    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.from_number)

    async def send_message(
        self,
        recipient: str,
        message: str,
        channel: str = "sms",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageDeliveryResult:
        if not self.is_configured:
            return MessageDeliveryResult(
                success=False,
                status="failed",
                channel="sms",
                provider="twilio",
                recipient=recipient,
                error="Twilio SMS adapter is unconfigured: missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER.",
            )

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "From": self.from_number,
            "To": recipient,
            "Body": message,
        }

        try:
            if self._http_client:
                resp = await self._http_client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                )
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        url,
                        data=data,
                        auth=(self.account_sid, self.auth_token),
                    )

            if resp.status_code in (200, 201):
                payload = resp.json()
                sid = payload.get("sid")
                return MessageDeliveryResult(
                    success=True,
                    status="sent",
                    channel="sms",
                    provider="twilio",
                    recipient=recipient,
                    details=f"Twilio message queued/sent. SID: {sid}",
                    provider_message_id=sid,
                )
            else:
                error_msg = f"Twilio API error {resp.status_code}: {resp.text}"
                return MessageDeliveryResult(
                    success=False,
                    status="failed",
                    channel="sms",
                    provider="twilio",
                    recipient=recipient,
                    error=error_msg,
                )
        except Exception as ex:
            return MessageDeliveryResult(
                success=False,
                status="failed",
                channel="sms",
                provider="twilio",
                recipient=recipient,
                error=f"Twilio dispatch exception: {str(ex)}",
            )


class WhatsAppCloudProvider(MessagingProvider):
    """
    Adapter for Meta WhatsApp Cloud API.
    Remains OFF unless environment variables (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
    are present. Fails closed when misconfigured.

    NOTE: Production WhatsApp Cloud messaging requires a verified Meta Business Account
    and Meta-approved WhatsApp Message Templates for business-initiated conversations
    outside the 24-hour customer service window.
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self.access_token = access_token or os.getenv("WHATSAPP_ACCESS_TOKEN")
        self.phone_number_id = phone_number_id or os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self._http_client = http_client

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    async def send_message(
        self,
        recipient: str,
        message: str,
        channel: str = "whatsapp",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageDeliveryResult:
        if not self.is_configured:
            return MessageDeliveryResult(
                success=False,
                status="failed",
                channel="whatsapp",
                provider="whatsapp",
                recipient=recipient,
                error="WhatsApp Cloud API adapter is unconfigured: missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. (Requires Meta Business Account & approved templates).",
            )

        # Normalize recipient for WhatsApp (strip + and non-digits)
        clean_to = "".join(filter(str.isdigit, recipient))
        url = f"https://graph.facebook.com/v20.0/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        json_payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_to,
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }

        try:
            if self._http_client:
                resp = await self._http_client.post(url, headers=headers, json=json_payload)
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, headers=headers, json=json_payload)

            if resp.status_code in (200, 201):
                payload = resp.json()
                msg_id = None
                messages_list = payload.get("messages", [])
                if messages_list and isinstance(messages_list, list):
                    msg_id = messages_list[0].get("id")
                return MessageDeliveryResult(
                    success=True,
                    status="sent",
                    channel="whatsapp",
                    provider="whatsapp",
                    recipient=recipient,
                    details=f"WhatsApp Cloud message sent. ID: {msg_id}",
                    provider_message_id=msg_id,
                )
            else:
                error_msg = f"WhatsApp Cloud API error {resp.status_code}: {resp.text}"
                return MessageDeliveryResult(
                    success=False,
                    status="failed",
                    channel="whatsapp",
                    provider="whatsapp",
                    recipient=recipient,
                    error=error_msg,
                )
        except Exception as ex:
            return MessageDeliveryResult(
                success=False,
                status="failed",
                channel="whatsapp",
                provider="whatsapp",
                recipient=recipient,
                error=f"WhatsApp Cloud dispatch exception: {str(ex)}",
            )


def get_messaging_provider(mode: str = "simulated") -> MessagingProvider:
    normalized = (mode or "simulated").strip().lower()
    if normalized == "disabled":
        return DisabledMessagingProvider()
    elif normalized == "twilio":
        return TwilioSmsProvider()
    elif normalized == "whatsapp":
        return WhatsAppCloudProvider()
    return SimulatedMessagingProvider()

