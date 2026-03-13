"""Azure MCP infrastructure tool wrappers.

Used for operational tasks like health checks, log queries, and feature flags.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def check_resource_health(resource_id: str) -> dict:
    """Check Azure resource health status."""
    logger.info("Checking health for resource: %s", resource_id)
    return {"resource_id": resource_id, "status": "healthy", "message": "Stub — connect to Azure Resource Health API"}


def query_log_analytics(workspace_id: str, query: str) -> list[dict]:
    """Run a KQL query against Log Analytics workspace."""
    logger.info("Log Analytics query on workspace %s: %s", workspace_id, query[:100])
    return [{"message": "Stub — connect to Azure Monitor Log Analytics API"}]


def get_feature_flag(flag_name: str) -> bool:
    """Read a feature flag from Azure App Configuration."""
    logger.info("Reading feature flag: %s", flag_name)
    return True
