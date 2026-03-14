"""AI Insights Agent — produces natural language insights for the dashboard summary panel.

Scheduled every 5 min + on-demand via A2A. Uses GPT-4o to generate 3 insight strings
and KPI narratives from aggregated SKU metrics.
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
from shared.mcp.client import query_risk_scores, query_skus, query_tickets, write_agent_decision

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="insights-agent",
    description="Produces natural language insights for the AI Summary Panel",
    url=AGENT_URLS["insights"],
    skills=[
        Skill(
            id="generate-insights",
            name="Generate Dashboard Insights",
            description="Produce 3 NL insight strings from aggregated SKU metrics",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)


def _build_template_insights(skus: list, risks: list, tickets: list) -> list[str]:
    """Deterministic template when LLM is unavailable."""
    risk_map = {}
    for r in risks:
        sid = r.get("skuId")
        if sid and sid not in risk_map:
            risk_map[sid] = r

    critical = sum(1 for r in risk_map.values() if r.get("band") == "CRITICAL")
    warning = sum(1 for r in risk_map.values() if r.get("band") == "WARNING")
    healthy = len(skus) - critical - warning
    open_tickets = sum(1 for t in tickets if t.get("status") == "OPEN")
    auto = sum(1 for r in risk_map.values() if r.get("agentMode") == "auto")

    insights = []
    if critical > 0:
        insights.append(f"{critical} of {len(skus)} SKUs are in CRITICAL risk band — immediate pricing review recommended.")
    if open_tickets > 0:
        insights.append(f"{open_tickets} exception tickets require human approval before agent actions can proceed.")
    if auto > 0:
        insights.append(f"{auto} SKUs are operating autonomously within configured guardrails.")

    while len(insights) < 3:
        insights.append(f"Monitoring {len(skus)} SKUs across all risk bands. System operating normally.")

    return insights[:3]


async def _generate_llm_insights(skus: list, risks: list, tickets: list, period: str = "daily") -> list[str]:
    """Use GPT-4o to generate rich insights."""
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY:
        return _build_template_insights(skus, risks, tickets)

    try:
        from openai import AsyncAzureOpenAI

        risk_map = {}
        for r in risks:
            sid = r.get("skuId")
            if sid and sid not in risk_map:
                risk_map[sid] = r

        critical = sum(1 for r in risk_map.values() if r.get("band") == "CRITICAL")
        warning = sum(1 for r in risk_map.values() if r.get("band") == "WARNING")
        open_tickets = sum(1 for t in tickets if t.get("status") == "OPEN")
        auto = sum(1 for r in risk_map.values() if r.get("agentMode") == "auto")

        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
        )

        prompt = f"""You are the AI Summary Panel for VoltEdge Electronics supply chain dashboard.
Generate exactly 3 concise insight sentences based on these metrics.
Data granularity: {period} (tailor insights to this time horizon — e.g. weekly trends, monthly patterns).

Total SKUs: {len(skus)}
Critical: {critical}, Warning: {warning}, Healthy: {len(skus) - critical - warning}
Open Tickets: {open_tickets}
Autonomous Actions: {auto}
Top risk drivers across all SKUs: Price Gap, Stock Coverage

Each insight should be 1 sentence, actionable, and specific. Format as a JSON array of 3 strings."""

        resp = await client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.4,
        )

        import json, re
        text = resp.choices[0].message.content.strip()
        # Strip markdown code fence if present
        m = re.search(r'\[.*\]', text, re.DOTALL)
        if m:
            return json.loads(m.group())[:3]
        return _build_template_insights(skus, risks, tickets)

    except Exception as e:
        logger.warning("LLM insights failed, using template: %s", e)
        return _build_template_insights(skus, risks, tickets)


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — generate dashboard insights."""
    data = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    period = data.get("period", "daily")
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"

    skus = await query_skus()
    risks = await query_risk_scores()
    tickets = await query_tickets()

    insights = await _generate_llm_insights(skus, risks, tickets, period)

    decision_doc = {
        "id": "insights-latest",
        "skuId": "global",
        "type": "insights",
        "content": insights,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "period": period,
        "counts": {
            "total": len(skus),
            "openTickets": sum(1 for t in tickets if t.get("status") == "OPEN"),
        },
    }
    try:
        await write_agent_decision(decision_doc)
    except Exception as e:
        logger.warning("Failed to persist insights: %s", e)

    return make_completed_task(task_id, "insights", {
        "insights": insights,
        "generatedAt": decision_doc["generatedAt"],
        "counts": decision_doc["counts"],
    })


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
