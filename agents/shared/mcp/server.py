"""Real MCP server exposing Cosmos DB tools via the Model Context Protocol.

Uses FastMCP (the Microsoft-recommended Python MCP SDK) with SSE transport
so that all ASTRA agents can discover and call tools over the protocol.
"""
from __future__ import annotations

import json
import logging
import os

from fastmcp import FastMCP

from . import cosmos_client as _cosmos

logger = logging.getLogger(__name__)

mcp = FastMCP("ASTRA Cosmos DB Tools")


# ── Read Tools ────────────────────────────────────────────────────────────────


@mcp.tool()
def query_skus(category: str | None = None) -> str:
    """Read SKUs from Cosmos DB, optionally filtered by category."""
    return json.dumps(_cosmos.query_skus(category))


@mcp.tool()
def query_competitors(platform: str | None = None) -> str:
    """Read competitor profiles, optionally filtered by platform."""
    return json.dumps(_cosmos.query_competitors(platform))


@mcp.tool()
def query_own_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> str:
    """Read own price/stock/velocity snapshots for a SKU."""
    return json.dumps(_cosmos.query_own_snapshots(sku_id, granularity, limit))


@mcp.tool()
def query_comp_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> str:
    """Read competitor price snapshots for a SKU."""
    return json.dumps(_cosmos.query_comp_snapshots(sku_id, granularity, limit))


@mcp.tool()
def query_risk_scores(sku_id: str | None = None) -> str:
    """Read computed risk scores, optionally for a specific SKU."""
    return json.dumps(_cosmos.query_risk_scores(sku_id))


@mcp.tool()
def query_tickets(status: str | None = None) -> str:
    """Read exception tickets, optionally filtered by status."""
    return json.dumps(_cosmos.query_tickets(status))


@mcp.tool()
def query_settings(user_id: str = "default") -> str:
    """Read seller settings and thresholds."""
    return json.dumps(_cosmos.query_settings(user_id))


@mcp.tool()
def query_recommendations(sku_id: str | None = None) -> str:
    """Read generated recommendations."""
    return json.dumps(_cosmos.query_recommendations(sku_id))


@mcp.tool()
def query_audit(type_filter: str | None = None, limit: int = 50) -> str:
    """Read audit log entries."""
    return json.dumps(_cosmos.query_audit(type_filter, limit))


# ── Write Tools ───────────────────────────────────────────────────────────────


@mcp.tool()
def write_risk_scores(scores: str) -> str:
    """Upsert a risk score document. Pass the document as a JSON string."""
    doc = json.loads(scores) if isinstance(scores, str) else scores
    return json.dumps(_cosmos.write_risk_scores(doc))


@mcp.tool()
def write_recommendation(rec: str) -> str:
    """Upsert a recommendation document. Pass the document as a JSON string."""
    doc = json.loads(rec) if isinstance(rec, str) else rec
    return json.dumps(_cosmos.write_recommendation(doc))


@mcp.tool()
def write_ticket(ticket: str) -> str:
    """Create or update a ticket. Pass the document as a JSON string."""
    doc = json.loads(ticket) if isinstance(ticket, str) else ticket
    return json.dumps(_cosmos.write_ticket(doc))


@mcp.tool()
def write_audit(entry: str) -> str:
    """Create an audit log entry. Pass the document as a JSON string."""
    doc = json.loads(entry) if isinstance(entry, str) else entry
    return json.dumps(_cosmos.write_audit(doc))


@mcp.tool()
def write_agent_decision(decision: str) -> str:
    """Log an agent decision and rationale. Pass the document as a JSON string."""
    doc = json.loads(decision) if isinstance(decision, str) else decision
    return json.dumps(_cosmos.write_agent_decision(doc))


# ── Server entry point ────────────────────────────────────────────────────────


def run_server():
    """Start the MCP server with SSE transport (called from run_local.py)."""
    port = int(os.getenv("MCP_SERVER_PORT", "6060"))
    logger.info("Starting MCP Cosmos DB server on port %d", port)
    mcp.run(transport="sse", host="0.0.0.0", port=port)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_server()
