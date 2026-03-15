"""MCP client for ASTRA agents — calls Cosmos DB tools via the MCP protocol.

Each convenience function mirrors the signature of the old direct-import
functions in cosmos_client.py, but routes through the MCP server over SSE.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from fastmcp import Client

logger = logging.getLogger(__name__)

_MCP_URL = os.getenv("MCP_SERVER_URL", "http://localhost:6060/sse")


async def _call(tool_name: str, args: dict[str, Any] | None = None) -> Any:
    """Connect to the MCP server, call a tool, and return parsed JSON data."""
    async with Client(_MCP_URL) as client:
        result = await client.call_tool(tool_name, args or {})
        raw = result.data if hasattr(result, "data") else str(result)
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                return raw
        return raw


# ── Read Tools ────────────────────────────────────────────────────────────────


async def query_skus(category: str | None = None) -> list[dict]:
    """Read SKUs, optionally filtered by category."""
    return await _call("query_skus", {"category": category})


async def query_competitors(platform: str | None = None) -> list[dict]:
    """Read competitor profiles, optionally filtered by platform."""
    return await _call("query_competitors", {"platform": platform})


async def query_own_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> list[dict]:
    """Read own price/stock/velocity snapshots for a SKU."""
    return await _call("query_own_snapshots", {"sku_id": sku_id, "granularity": granularity, "limit": limit})


async def query_comp_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> list[dict]:
    """Read competitor price snapshots for a SKU."""
    return await _call("query_comp_snapshots", {"sku_id": sku_id, "granularity": granularity, "limit": limit})


async def query_risk_scores(sku_id: str | None = None) -> list[dict]:
    """Read computed risk scores, optionally for a specific SKU."""
    return await _call("query_risk_scores", {"sku_id": sku_id})


async def query_tickets(status: str | None = None) -> list[dict]:
    """Read exception tickets, optionally filtered by status."""
    return await _call("query_tickets", {"status": status})


async def query_settings(user_id: str = "default") -> dict | None:
    """Read seller settings and thresholds."""
    return await _call("query_settings", {"user_id": user_id})


async def query_recommendations(sku_id: str | None = None) -> list[dict]:
    """Read generated recommendations."""
    return await _call("query_recommendations", {"sku_id": sku_id})


async def query_audit(type_filter: str | None = None, limit: int = 50) -> list[dict]:
    """Read audit log entries."""
    return await _call("query_audit", {"type_filter": type_filter, "limit": limit})


# ── Write Tools ───────────────────────────────────────────────────────────────


async def write_risk_scores(scores: dict) -> dict:
    """Upsert a risk score document via MCP."""
    return await _call("write_risk_scores", {"scores": json.dumps(scores)})


async def write_recommendation(rec: dict) -> dict:
    """Upsert a recommendation document via MCP."""
    return await _call("write_recommendation", {"rec": json.dumps(rec)})


async def write_ticket(ticket: dict) -> dict:
    """Create or update a ticket via MCP."""
    return await _call("write_ticket", {"ticket": json.dumps(ticket)})


async def write_audit(entry: dict) -> dict:
    """Create an audit log entry via MCP."""
    return await _call("write_audit", {"entry": json.dumps(entry)})


async def write_agent_decision(decision: dict) -> dict:
    """Log an agent decision and rationale via MCP."""
    return await _call("write_agent_decision", {"decision": json.dumps(decision)})


async def write_comp_snapshot(snapshot: dict, granularity: str = "daily") -> dict:
    """Upsert a competitor price snapshot via MCP."""
    return await _call("write_comp_snapshot", {"snapshot": json.dumps(snapshot), "granularity": granularity})


async def write_competitor(competitor: dict) -> dict:
    """Upsert a competitor profile via MCP."""
    return await _call("write_competitor", {"competitor": json.dumps(competitor)})
