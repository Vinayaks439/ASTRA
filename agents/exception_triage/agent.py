"""Exception Triage Agent — enforces guardrails and creates exception tickets.

Per ADR-004: If any individual risk score exceeds the seller's configured threshold,
the action is blocked from autonomous execution and an exception ticket is created.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from shared.a2a.client import A2ATaskClient
from shared.a2a.models import AgentCard, Message, Skill, Task
from shared.a2a.server import A2AServer, make_completed_task
from shared.config import AGENT_URLS
from shared.mcp.client import query_settings, query_skus, write_audit, write_ticket

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="exception-triage-agent",
    description="Enforces guardrails and creates exception tickets for threshold breaches",
    url=AGENT_URLS["exception-triage"],
    skills=[
        Skill(
            id="triage",
            name="Exception Triage",
            description="Determine auto vs manual for each recommendation and create tickets",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def triage_recommendation(rec: dict, risk: dict, settings: dict | None) -> dict:
    """Check thresholds and decide auto vs breaches."""
    th = (settings or {}).get("thresholds", {})
    pg_th = th.get("priceGap", 24)
    sc_th = th.get("stockCoverage", 24)
    dt_th = th.get("demandTrend", 16)
    mp_th = th.get("marginProximity", 16)

    breaches = []
    if risk.get("priceGap", 0) > pg_th:
        breaches.append(f"Price Gap ({risk['priceGap']}>{pg_th}/30)")
    if risk.get("stockCoverage", 0) > sc_th:
        breaches.append(f"Stock Coverage ({risk['stockCoverage']}>{sc_th}/30)")
    if risk.get("demandTrend", 0) > dt_th:
        breaches.append(f"Demand Trend ({risk['demandTrend']}>{dt_th}/20)")
    if risk.get("marginProximity", 0) > mp_th:
        breaches.append(f"Margin Proximity ({risk['marginProximity']}>{mp_th}/20)")

    agent_mode = "auto" if not breaches else "breaches"
    ticket = None

    if breaches:
        ticket = {
            "id": f"TKT-{rec['skuId']}-{int(datetime.now(timezone.utc).timestamp()*1000)}",
            "skuId": rec["skuId"],
            "skuName": rec.get("skuName", rec["skuId"]),
            "action": rec["action"],
            "breaches": breaches,
            "compositeScore": risk.get("composite", 0),
            "band": risk.get("band", "WARNING"),
            "status": "OPEN",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "whatsappStatus": "none",
        }

    return {
        "skuId": rec["skuId"],
        "agentMode": agent_mode,
        "breaches": breaches,
        "ticket": ticket,
        "recommendation": rec,
    }


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — triage recommendations."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    recommendations = data.get("recommendations", [])
    risk_scores = data.get("risk_scores", [])
    risk_map = {r["skuId"]: r for r in risk_scores}
    settings = await query_settings()
    skus_map = {s["id"]: s for s in await query_skus()}

    results = []
    tickets_created = []

    for rec in recommendations:
        sid = rec.get("skuId", "")
        risk = risk_map.get(sid, {})
        triage = triage_recommendation(rec, risk, settings)

        if triage["ticket"]:
            sku = skus_map.get(sid, {})
            triage["ticket"]["skuName"] = sku.get("partName", sid)
            await write_ticket(triage["ticket"])
            tickets_created.append(triage["ticket"])

            await write_audit({
                "id": f"AUD-{sid}-{int(datetime.now(timezone.utc).timestamp()*1000)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "skuId": sid,
                "skuName": sku.get("partName", sid),
                "action": rec["action"],
                "type": "TICKET",
                "whatsappStatus": "pending",
                "actor": "exception-triage-agent",
            })
        else:
            sku = skus_map.get(sid, {})
            await write_audit({
                "id": f"AUD-{sid}-{int(datetime.now(timezone.utc).timestamp()*1000)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "skuId": sid,
                "skuName": sku.get("partName", sid),
                "action": rec["action"],
                "type": "AUTONOMOUS",
                "whatsappStatus": "none",
                "actor": "recommendation-agent",
            })

        results.append(triage)

    # Trigger Notification Agent for created tickets
    if tickets_created:
        try:
            a2a = A2ATaskClient()
            notify_url = AGENT_URLS.get("notification", "http://localhost:7076")
            await a2a.send_task(
                notify_url,
                task_id=f"notify-{task_id}",
                data={"tickets": tickets_created},
            )
            await a2a.close()
        except Exception as e:
            logger.warning("Failed to trigger notification agent: %s", e)

    return make_completed_task(task_id, "triage-results", results)


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
