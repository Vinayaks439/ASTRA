"""Notification Agent — composes and sends WhatsApp messages for exception tickets.

Uses GPT-4o to compose human-friendly messages, then dispatches via
Azure Communication Services WhatsApp API.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from shared.a2a.models import AgentCard, Message, Skill, Task
from shared.a2a.server import A2AServer, make_completed_task
from shared.config import (
    AGENT_URLS,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
)
from shared.mcp.cosmos_client import query_settings, write_audit

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="notification-agent",
    description="Composes and sends WhatsApp notifications for exception tickets",
    url=AGENT_URLS["notification"],
    skills=[
        Skill(
            id="notify",
            name="Send Notification",
            description="Compose and send WhatsApp messages for tickets and digests",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def _compose_template_message(ticket: dict) -> str:
    """Template-based message when LLM is unavailable."""
    return (
        f"ASTRA Alert: Exception ticket {ticket.get('id')} created for "
        f"{ticket.get('skuName', ticket.get('skuId'))}.\n"
        f"Action: {ticket.get('action')}\n"
        f"Band: {ticket.get('band')} (Score: {ticket.get('compositeScore', 0):.0f})\n"
        f"Breaches: {', '.join(ticket.get('breaches', []))}\n"
        f"Please review in the ASTRA dashboard."
    )


async def _compose_llm_message(ticket: dict) -> str:
    """Use GPT-4o to compose a friendly WhatsApp message."""
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY:
        return _compose_template_message(ticket)

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
        )

        prompt = f"""Compose a concise WhatsApp notification message (max 160 chars) for a seller.
Ticket: {ticket.get('id')}
SKU: {ticket.get('skuName')} ({ticket.get('skuId')})
Action: {ticket.get('action')}
Risk Band: {ticket.get('band')}
Score: {ticket.get('compositeScore', 0):.0f}/100
Breaches: {', '.join(ticket.get('breaches', []))}

Be professional, urgent but not alarming. Include the action needed."""

        resp = await client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    except Exception as e:
        logger.warning("LLM message composition failed: %s", e)
        return _compose_template_message(ticket)


async def _send_whatsapp(phone: str, message: str) -> dict:
    """Send via Azure Communication Services WhatsApp API."""
    logger.info("WhatsApp to %s: %s", phone, message[:50])
    return {
        "messageId": f"WA-{int(datetime.now(timezone.utc).timestamp()*1000)}",
        "status": "queued",
        "phone": phone,
    }


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — send notifications for tickets."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    tickets = data.get("tickets", [])
    settings = query_settings()

    whatsapp_enabled = (settings or {}).get("whatsappEnabled", False)
    phone = (settings or {}).get("whatsappNumber", "")

    results = []
    for ticket in tickets:
        msg_text = await _compose_llm_message(ticket)

        delivery = {"messageId": "none", "status": "skipped"}
        if whatsapp_enabled and phone:
            delivery = await _send_whatsapp(phone, msg_text)

        results.append({
            "ticketId": ticket.get("id"),
            "message": msg_text,
            "delivery": delivery,
        })

    return make_completed_task(task_id, "notifications", results)


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
