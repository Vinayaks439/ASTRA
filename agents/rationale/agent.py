"""Rationale Agent — generates natural language explanations for agent decisions.

Called on-demand when a user opens the SKU Action Drawer. Uses GPT-4o to produce
human-readable explanations of why the agent chose autonomous vs. exception,
which data points drove the decision, and confidence justification.
"""
from __future__ import annotations

import logging
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
from shared.mcp.cosmos_client import (
    query_own_snapshots,
    query_comp_snapshots,
    query_recommendations,
    query_risk_scores,
    query_skus,
    write_agent_decision,
)

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="rationale-agent",
    description="Generates natural language rationale for agent decisions",
    url=AGENT_URLS["rationale"],
    skills=[
        Skill(
            id="explain",
            name="Generate Rationale",
            description="Produce human-readable explanation for an agent's action on a SKU",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def _build_template_rationale(sku: dict, risk: dict, rec: dict) -> str:
    """Deterministic template fallback when LLM is unavailable."""
    band = risk.get("band", "UNKNOWN")
    composite = risk.get("composite", 0)
    action = rec.get("action", "HOLD")
    mode = rec.get("agentMode", "auto")
    driver = risk.get("topDriver", "N/A")

    parts = [
        f"**{sku.get('partName', sku.get('partNo', 'SKU'))}** is in the **{band}** risk band "
        f"with a composite score of **{composite:.0f}/100**.",
        f"The top risk driver is **{driver}**.",
    ]

    if action == "PRICE_DECREASE":
        parts.append(
            f"Recommended action: **Price Decrease** to INR {rec.get('suggestedPrice', 0):.0f}. "
            f"The price gap with competitors is significant."
        )
    elif action == "PRICE_INCREASE":
        parts.append("Recommended action: **Price Increase** — stock is limited but margin is healthy.")
    elif action == "HOLD_REORDER":
        parts.append("Recommended action: **Hold + Reorder** — stock coverage is critically low.")
    else:
        parts.append("Recommended action: **Hold** — risk scores are within acceptable bounds.")

    if mode == "breaches":
        parts.append("This action requires **human approval** because one or more thresholds are breached.")
    else:
        parts.append("This action was executed **autonomously** within configured guardrails.")

    parts.append(f"Confidence: **{rec.get('confidence', 0):.0%}**")

    return "\n\n".join(parts)


async def _generate_llm_rationale(sku: dict, risk: dict, rec: dict, weekly_own: list, monthly_comp: list) -> str:
    """Use Azure OpenAI GPT-4o to generate rich rationale."""
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY:
        return _build_template_rationale(sku, risk, rec)

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
        )

        prompt = f"""You are an AI analyst for VoltEdge Electronics supply chain.
Explain why the following action was recommended for the SKU.

SKU: {sku.get('partName')} ({sku.get('partNo')})
Selling Price: INR {sku.get('sellingPrice', 0):.0f}
Cost Price: INR {sku.get('costPrice', 0):.0f}
Margin: {sku.get('profitMarginPct', 0):.1f}%

Risk Scores:
- Price Gap: {risk.get('priceGap', 0)}/30
- Stock Coverage: {risk.get('stockCoverage', 0)}/30
- Demand Trend: {risk.get('demandTrend', 0)}/20
- Margin Proximity: {risk.get('marginProximity', 0)}/20
- Composite: {risk.get('composite', 0)}/100
- Band: {risk.get('band')}
- Top Driver: {risk.get('topDriver')}

Recommended Action: {rec.get('action')}
Suggested Price: INR {rec.get('suggestedPrice', 0):.0f}
Agent Mode: {rec.get('agentMode')}
Confidence: {rec.get('confidence', 0):.0%}

Provide a concise 3-4 sentence explanation suitable for a seller reviewing this in a dashboard."""

        resp = await client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    except Exception as e:
        logger.warning("LLM rationale failed, using template: %s", e)
        return _build_template_rationale(sku, risk, rec)


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — generate rationale for a SKU."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    sku_id = data.get("sku_id", "")
    if not sku_id:
        return make_completed_task(task_id, "rationale", {"error": "sku_id required"})

    skus = query_skus()
    sku = next((s for s in skus if s["id"] == sku_id), None)
    if not sku:
        return make_completed_task(task_id, "rationale", {"error": f"SKU {sku_id} not found"})

    risks = query_risk_scores(sku_id)
    risk = risks[0] if risks else {}

    recs = query_recommendations(sku_id)
    rec = recs[0] if recs else {}

    weekly_own = query_own_snapshots(sku_id, "weekly", 8)
    monthly_comp = query_comp_snapshots(sku_id, "monthly", 6)

    rationale = await _generate_llm_rationale(sku, risk, rec, weekly_own, monthly_comp)

    try:
        write_agent_decision({
            "id": f"rationale-{sku_id}",
            "skuId": sku_id,
            "type": "rationale",
            "content": rationale,
            "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning("Failed to persist rationale: %s", e)

    return make_completed_task(task_id, "rationale", {
        "skuId": sku_id,
        "rationale": rationale,
    })


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
