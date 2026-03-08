# ADR-006: Azure MCP Tools

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

AI agents need structured, secure access to Azure Cosmos DB and Azure infrastructure services. Direct SDK usage from each agent would couple agents tightly to data access patterns and require duplicated connection management. A standardized tool interface is needed.

## Decision

Use the **Model Context Protocol (MCP)** to expose data access and infrastructure operations as tools that agents can invoke via JSON-RPC.

### Cosmos DB MCP Server

```
┌──────────────┐     MCP (JSON-RPC)     ┌──────────────────┐
│  Python Agent │ ◄────────────────────► │ Cosmos DB MCP    │
│  (MS Agent    │                        │ Server           │
│   Framework)  │                        │                  │
└──────────────┘                        │  ┌────────────┐  │
                                         │  │ @azure/    │  │
                                         │  │ cosmos SDK │  │
                                         │  └─────┬──────┘  │
                                         └────────┼─────────┘
                                                  │ HTTPS
                                         ┌────────▼─────────┐
                                         │  Azure Cosmos DB │
                                         │  (NoSQL API)     │
                                         └──────────────────┘
```

### MCP Tools Exposed to Agents

| MCP Tool | Description |
|---|---|
| `query_skus` | Read SKUs with filters (category, partNo) |
| `query_competitors` | Read competitor profiles (platform, storeUrl) |
| `query_own_snapshots` | Read own price/stock/velocity snapshots (daily, weekly, monthly) |
| `query_comp_snapshots` | Read competitor price snapshots (daily, weekly, monthly) |
| `query_risk_scores` | Read computed risk scores |
| `write_risk_scores` | Upsert risk score computations |
| `query_tickets` | Read exception tickets |
| `write_ticket` | Create / update a ticket |
| `query_settings` | Read seller settings and thresholds |
| `query_audit` | Read audit log entries |
| `write_audit` | Create audit log entry |
| `query_recommendations` | Read generated recommendations |
| `write_recommendation` | Upsert a recommendation |
| `write_agent_decision` | Log an agent's decision and rationale |

### Azure MCP Server (Infrastructure)

Used for operational tasks (not primary data path):
- Resource health checks
- Log Analytics queries for monitoring
- App Configuration for feature flags

## Consequences

- MCP provides a uniform tool interface, decoupling agents from the Cosmos DB SDK and connection management.
- The Cosmos DB MCP Server runs as a shared sidecar, reducing resource overhead vs. per-agent SDK instances.
- MCP tools define clear read/write boundaries, enabling fine-grained access control per agent.
- The standardized JSON-RPC interface allows swapping the underlying data store without changing agent code.
- Infrastructure MCP tools provide operational visibility without exposing raw Azure management APIs to agents.
