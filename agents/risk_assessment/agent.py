"""Risk Assessment Agent — computes composite risk scores for SKUs.

Deterministic formulas per ADR-004:
  price_gap       = clamp(((own - comp) / own) * (1/0.2), 0, 1) * 30
  stock_coverage  = (1 - clamp(days_of_cover / 60, 0, 1)) * 30
  demand_trend    = (clamp((v7 - v14) / v14, -0.5, 0.5) + 0.5) * 20
  margin_proximity= (1 - clamp((margin - floor) / floor / 0.5, 0, 1)) * 20
  composite       = pg + sc + dt + mp
  band            = CRITICAL >= 75 | WARNING >= 40 | HEALTHY
"""
from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any

from shared.a2a.client import A2ATaskClient
from shared.a2a.models import Message, Task
from shared.a2a.server import A2AServer, make_completed_task
from shared.config import (
    AGENT_URLS,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
)
from shared.mcp.cosmos_client import (
    query_comp_snapshots,
    query_own_snapshots,
    query_settings,
    query_skus,
    write_risk_scores,
)
from shared.a2a.models import AgentCard, Capabilities, Skill

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="risk-assessment-agent",
    description="Computes composite risk scores for SKUs",
    url=AGENT_URLS["risk-assessment"],
    skills=[
        Skill(
            id="assess-risk",
            name="Assess SKU Risk",
            description="Compute risk scores for one or more SKUs",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(v, hi))


def compute_risk(
    sku: dict,
    own_snaps: list[dict],
    comp_snaps: list[dict],
    settings: dict | None,
) -> dict:
    """Pure deterministic risk computation."""
    own_price = sku.get("sellingPrice", 0)
    cost_price = sku.get("costPrice", 0)

    # Price Gap (0-30)
    # Daily comp snapshots use "competitorPrice"; weekly use "avgCompPrice"
    comp_prices = []
    for s in (comp_snaps or []):
        p = s.get("competitorPrice") or s.get("avgCompPrice") or 0
        if p > 0:
            comp_prices.append(p)
    best_comp = min(comp_prices) if comp_prices else 0
    pg = 0.0
    if best_comp > 0 and own_price > 0:
        gap = max(0, (own_price - best_comp) / own_price)
        pg = round(_clamp(gap / 0.2, 0, 1) * 30)

    # Stock Coverage (0-30)
    # Daily own snapshots use "onHandUnits"/"inboundUnits"/"dailyVelocity"; weekly use "avgStock"/"avgVelocity"
    sc = 10.0
    if own_snaps:
        latest = own_snaps[0]
        stock = latest.get("onHandUnits") or latest.get("avgStock") or 0
        inbound = latest.get("inboundUnits", 0)
        vel = latest.get("dailyVelocity") or latest.get("avgVelocity") or 0
        if vel > 0:
            doc = (stock + inbound) / vel
            sc = round((1 - _clamp(doc / 60, 0, 1)) * 30)
        elif stock == 0:
            sc = 30
        else:
            sc = 3

    # Demand Trend (0-20)
    # Daily own snapshots have "velocity7d"/"velocity14d" on each row
    dt = 10.0
    if own_snaps:
        latest = own_snaps[0]
        v7 = latest.get("velocity7d", 0)
        v14 = latest.get("velocity14d", 0)
        if v7 and v14 and v14 > 0:
            chg = (v7 - v14) / v14
            dt = round((_clamp(chg, -0.5, 0.5) + 0.5) * 20)
        elif len(own_snaps) >= 14:
            v7_avg = sum(s.get("dailyVelocity") or s.get("avgVelocity") or 0 for s in own_snaps[:7]) / 7
            v14_avg = sum(s.get("dailyVelocity") or s.get("avgVelocity") or 0 for s in own_snaps[7:14]) / 7
            if v14_avg > 0:
                chg = (v7_avg - v14_avg) / v14_avg
                dt = round((_clamp(chg, -0.5, 0.5) + 0.5) * 20)

    # Margin Proximity (0-20)
    mp = 10.0
    thresholds = settings.get("thresholds", {}) if settings else {}
    margin_floor = thresholds.get("marginFloorPct", 10.0)
    margin = sku.get("profitMarginPct", 0)
    buf = margin - margin_floor
    if buf <= 0:
        mp = 20
    else:
        ratio = buf / max(margin_floor, 1)
        mp = round((1 - _clamp(ratio / 0.5, 0, 1)) * 20)

    composite = pg + sc + dt + mp
    band = "CRITICAL" if composite >= 75 else "WARNING" if composite >= 40 else "HEALTHY"

    drivers = [
        ("Stock Coverage", sc, 30),
        ("Price Gap", pg, 30),
        ("Margin Proximity", mp, 20),
        ("Demand Trend", dt, 20),
    ]
    top_driver = max(drivers, key=lambda d: d[1] / d[2] if d[2] > 0 else 0)[0]

    # Agent mode
    agent_mode = "auto"
    th = thresholds if thresholds else {"priceGap": 24, "stockCoverage": 24, "demandTrend": 16, "marginProximity": 16}
    if pg > th.get("priceGap", 24) or sc > th.get("stockCoverage", 24) or \
       dt > th.get("demandTrend", 16) or mp > th.get("marginProximity", 16):
        agent_mode = "breaches"

    return {
        "id": f"risk-{sku['id']}",
        "skuId": sku["id"],
        "priceGap": pg,
        "stockCoverage": sc,
        "demandTrend": dt,
        "marginProximity": mp,
        "composite": composite,
        "band": band,
        "topDriver": top_driver,
        "confidence": 0.85,
        "agentMode": agent_mode,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — assess risk for requested SKUs."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    sku_ids = data.get("sku_ids", [])
    settings = query_settings()

    if not sku_ids:
        skus = query_skus()
        sku_ids = [s["id"] for s in skus]
    else:
        skus = query_skus()
        skus = [s for s in skus if s["id"] in sku_ids]

    results = []
    for sku in skus:
        sid = sku["id"]
        own_snaps = query_own_snapshots(sid, "daily", 30)
        comp_snaps = query_comp_snapshots(sid, "daily", 30)
        risk = compute_risk(sku, own_snaps, comp_snaps, settings)
        write_risk_scores(risk)
        results.append(risk)

    # Trigger Recommendation Agent via A2A for all assessed SKUs
    try:
        a2a = A2ATaskClient()
        rec_url = AGENT_URLS.get("recommendation", "http://localhost:7072")
        await a2a.send_task(
            rec_url,
            task_id=f"rec-{task_id}",
            data={"sku_ids": sku_ids, "risk_scores": results},
        )
        await a2a.close()
    except Exception as e:
        logger.warning("Failed to trigger recommendation agent: %s", e)

    return make_completed_task(task_id, "risk-scores", results)


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
