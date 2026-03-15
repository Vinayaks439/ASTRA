"""MCP-style Cosmos DB tool wrappers for ASTRA agents.

Each function acts as a tool that agents can invoke via the Microsoft Agent Framework
@tool decorator. Internally they use the Azure Cosmos DB SDK.
"""
from __future__ import annotations

from typing import Any

from azure.cosmos import CosmosClient, PartitionKey

from ..config import COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE


_client: CosmosClient | None = None
_db = None


def _get_db():
    global _client, _db
    if _db is None:
        if not COSMOS_ENDPOINT or not COSMOS_KEY:
            raise RuntimeError("COSMOS_ENDPOINT and COSMOS_KEY must be set")
        _client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_KEY)
        _db = _client.get_database_client(COSMOS_DATABASE)
    return _db


def _query(container_name: str, query: str, params: list[dict] | None = None) -> list[dict]:
    db = _get_db()
    container = db.get_container_client(container_name)
    items = container.query_items(
        query=query,
        parameters=params or [],
        enable_cross_partition_query=True,
    )
    return list(items)


def _upsert(container_name: str, item: dict) -> dict:
    db = _get_db()
    container = db.get_container_client(container_name)
    return container.upsert_item(item)


# ── Read Tools ────────────────────────────────────────────────────────────────

def query_skus(category: str | None = None) -> list[dict]:
    """Read SKUs, optionally filtered by category."""
    if category:
        return _query("skus", "SELECT * FROM c WHERE c.category = @cat", [{"name": "@cat", "value": category}])
    return _query("skus", "SELECT * FROM c")


def query_competitors(platform: str | None = None) -> list[dict]:
    """Read competitor profiles, optionally filtered by platform."""
    if platform:
        return _query("competitors", "SELECT * FROM c WHERE c.platform = @p", [{"name": "@p", "value": platform}])
    return _query("competitors", "SELECT * FROM c")


def query_own_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> list[dict]:
    """Read own price/stock/velocity snapshots for a SKU."""
    container_map = {"daily": "daily-own-snapshots", "weekly": "weekly-own-snapshots", "monthly": "monthly-own-snapshots"}
    container = container_map.get(granularity, "daily-own-snapshots")
    period_field = {"daily": "date", "weekly": "week", "monthly": "month"}.get(granularity, "date")
    return _query(
        container,
        f"SELECT TOP @limit * FROM c WHERE c.skuId = @sid ORDER BY c.{period_field} DESC",
        [{"name": "@sid", "value": sku_id}, {"name": "@limit", "value": limit}],
    )


def query_comp_snapshots(sku_id: str, granularity: str = "daily", limit: int = 30) -> list[dict]:
    """Read competitor price snapshots for a SKU."""
    container_map = {"daily": "daily-comp-snapshots", "weekly": "weekly-comp-snapshots", "monthly": "monthly-comp-snapshots"}
    container = container_map.get(granularity, "daily-comp-snapshots")
    period_field = {"daily": "date", "weekly": "week", "monthly": "month"}.get(granularity, "date")
    return _query(
        container,
        f"SELECT TOP @limit * FROM c WHERE c.skuId = @sid ORDER BY c.{period_field} DESC",
        [{"name": "@sid", "value": sku_id}, {"name": "@limit", "value": limit}],
    )


def query_risk_scores(sku_id: str | None = None) -> list[dict]:
    """Read computed risk scores, optionally for a specific SKU."""
    if sku_id:
        return _query("risk-scores", "SELECT * FROM c WHERE c.skuId = @sid ORDER BY c.computedAt DESC",
                       [{"name": "@sid", "value": sku_id}])
    return _query("risk-scores", "SELECT * FROM c ORDER BY c.computedAt DESC")


def query_tickets(status: str | None = None) -> list[dict]:
    """Read exception tickets, optionally filtered by status."""
    if status:
        return _query("tickets", "SELECT * FROM c WHERE c.status = @s ORDER BY c.createdAt DESC",
                       [{"name": "@s", "value": status}])
    return _query("tickets", "SELECT * FROM c ORDER BY c.createdAt DESC")


def query_settings(user_id: str = "default") -> dict | None:
    """Read seller settings and thresholds."""
    results = _query("settings", "SELECT * FROM c WHERE c.userId = @uid", [{"name": "@uid", "value": user_id}])
    return results[0] if results else None


def query_recommendations(sku_id: str | None = None) -> list[dict]:
    """Read generated recommendations."""
    if sku_id:
        return _query("recommendations", "SELECT * FROM c WHERE c.skuId = @sid ORDER BY c.createdAt DESC",
                       [{"name": "@sid", "value": sku_id}])
    return _query("recommendations", "SELECT * FROM c ORDER BY c.createdAt DESC")


def query_audit(type_filter: str | None = None, limit: int = 50) -> list[dict]:
    """Read audit log entries."""
    if type_filter:
        return _query("audit-log", "SELECT TOP @limit * FROM c WHERE c.type = @t ORDER BY c.timestamp DESC",
                       [{"name": "@t", "value": type_filter}, {"name": "@limit", "value": limit}])
    return _query("audit-log", f"SELECT TOP {limit} * FROM c ORDER BY c.timestamp DESC")


# ── Write Tools ───────────────────────────────────────────────────────────────

def write_risk_scores(scores: dict) -> dict:
    """Upsert risk score computation."""
    return _upsert("risk-scores", scores)


def write_recommendation(rec: dict) -> dict:
    """Upsert a recommendation."""
    return _upsert("recommendations", rec)


def write_ticket(ticket: dict) -> dict:
    """Create or update a ticket."""
    return _upsert("tickets", ticket)


def write_audit(entry: dict) -> dict:
    """Create an audit log entry."""
    return _upsert("audit-log", entry)


def write_agent_decision(decision: dict) -> dict:
    """Log an agent's decision and rationale."""
    return _upsert("agent-decisions", decision)


def write_comp_snapshot(snapshot: dict, granularity: str = "daily") -> dict:
    """Upsert a competitor price snapshot into the appropriate granularity container."""
    container_map = {
        "daily": "daily-comp-snapshots",
        "weekly": "weekly-comp-snapshots",
        "monthly": "monthly-comp-snapshots",
    }
    container = container_map.get(granularity, "daily-comp-snapshots")
    return _upsert(container, snapshot)


def write_competitor(competitor: dict) -> dict:
    """Upsert a competitor profile into the competitors collection."""
    return _upsert("competitors", competitor)
