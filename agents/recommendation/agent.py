"""Recommendation Agent — generates pricing/reorder actions from risk scores.

Decision matrix per ADR-004:
  price_gap > threshold.pg                          -> PRICE_DECREASE
  stock_coverage > threshold.sc && margin > floor+5 -> PRICE_INCREASE
  stock_coverage > threshold.sc                     -> HOLD_REORDER (+ PO if enabled)
  else                                              -> HOLD
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from shared.a2a.client import A2ATaskClient
from shared.a2a.models import AgentCard, Capabilities, Message, Skill, Task
from shared.a2a.server import A2AServer, make_completed_task
from shared.config import AGENT_URLS
from shared.mcp.cosmos_client import (
    query_own_snapshots,
    query_settings,
    query_skus,
    write_recommendation,
)

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="recommendation-agent",
    description="Generates pricing and reorder recommendations from risk scores",
    url=AGENT_URLS["recommendation"],
    skills=[
        Skill(
            id="recommend",
            name="Generate Recommendation",
            description="Produce PRICE_DECREASE / PRICE_INCREASE / HOLD / HOLD_REORDER actions",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def generate_recommendation(sku: dict, risk: dict, settings: dict | None) -> dict:
    """Deterministic recommendation logic."""
    thresholds = (settings or {}).get("thresholds", {})
    pg_th = thresholds.get("priceGap", 24)
    sc_th = thresholds.get("stockCoverage", 24)
    margin_floor = thresholds.get("marginFloorPct", 10.0)

    pg = risk.get("priceGap", 0)
    sc = risk.get("stockCoverage", 0)
    margin = sku.get("profitMarginPct", 0)
    price = sku.get("sellingPrice", 0)
    cost = sku.get("costPrice", 0)

    action = "HOLD"
    suggested_price = price
    rationale = "No action needed — risk scores within acceptable bounds."

    if pg > pg_th:
        delta = min(price * 0.05, price - cost * 1.1)
        suggested_price = round(price - max(delta, 0), 2)
        action = "PRICE_DECREASE"
        rationale = f"Price gap score ({pg}/30) exceeds threshold ({pg_th}). Suggest reducing to INR {suggested_price:.0f} to close competitive gap."
    elif sc > sc_th and margin > margin_floor + 5:
        delta = price * 0.03
        suggested_price = round(price + delta, 2)
        action = "PRICE_INCREASE"
        rationale = f"Low stock coverage ({sc}/30) with healthy margin ({margin:.1f}%). Increase price to INR {suggested_price:.0f} to improve margin while stock is limited."
    elif sc > sc_th:
        action = "HOLD_REORDER"
        rationale = f"Stock coverage critical ({sc}/30). Hold current price and generate purchase order."

    confidence = 0.9 if risk.get("confidence", 0) > 0.7 else 0.7

    return {
        "id": f"rec-{sku['id']}",
        "skuId": sku["id"],
        "action": action,
        "suggestedPrice": suggested_price,
        "rationale": rationale,
        "confidence": confidence,
        "agentMode": risk.get("agentMode", "auto"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — generate recommendations."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    risk_scores = data.get("risk_scores", [])
    sku_ids = data.get("sku_ids", [])
    settings = query_settings()

    skus_map = {s["id"]: s for s in query_skus()}

    results = []
    for risk in risk_scores:
        sid = risk.get("skuId", "")
        sku = skus_map.get(sid)
        if not sku:
            continue
        rec = generate_recommendation(sku, risk, settings)
        write_recommendation(rec)
        results.append(rec)

    # Trigger Exception Triage Agent
    try:
        a2a = A2ATaskClient()
        triage_url = AGENT_URLS.get("exception-triage", "http://localhost:7073")
        await a2a.send_task(
            triage_url,
            task_id=f"triage-{task_id}",
            data={"recommendations": results, "risk_scores": risk_scores},
        )
        await a2a.close()
    except Exception as e:
        logger.warning("Failed to trigger triage agent: %s", e)

    return make_completed_task(task_id, "recommendations", results)


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
