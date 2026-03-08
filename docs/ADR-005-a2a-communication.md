# ADR-005: Agent-to-Agent (A2A) Communication

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA's six AI agents need to communicate with each other for task delegation (e.g., Risk Agent triggers Recommendation Agent). A standardized, discoverable protocol is needed for peer-to-peer agent communication, distinct from tool access (MCP) and client-server calls (gRPC).

## Decision

Adopt the **Google A2A protocol** for all agent-to-agent communication. Each agent publishes a discoverable card and accepts task requests via JSON-RPC over HTTP.

### A2A Agent Card (example)

Each agent publishes a card at `/.well-known/agent.json`:

```json
{
  "name": "risk-assessment-agent",
  "description": "Computes composite risk scores for SKUs",
  "url": "https://astra-risk-agent.azurewebsites.net",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "skills": [
    {
      "id": "assess-risk",
      "name": "Assess SKU Risk",
      "description": "Compute risk scores for one or more SKUs",
      "inputModes": ["application/json"],
      "outputModes": ["application/json"]
    }
  ],
  "authentication": {
    "schemes": ["bearer"],
    "credentials": "azure-entra-token"
  }
}
```

### A2A Task Flow

```
Risk Agent                    Recommendation Agent           Triage Agent
    │                                │                           │
    │──── A2A: tasks/send ──────────►│                           │
    │     {sku_id, risk_scores}      │                           │
    │                                │                           │
    │     ◄── A2A: tasks/result ─────│                           │
    │     {recommendation}           │                           │
    │                                │──── A2A: tasks/send ─────►│
    │                                │     {recommendation,      │
    │                                │      thresholds}          │
    │                                │                           │
    │                                │     ◄── A2A: result ──────│
    │                                │     {agent_mode, ticket?} │
```

### Protocol Responsibilities in ASTRA

| Protocol | Used For | Direction |
|---|---|---|
| **A2A** | Agent <-> Agent communication | Peer-to-peer |
| **MCP** | Agent -> Cosmos DB / Azure services | Agent -> Tool |
| **gRPC** | Frontend -> Backend, Backend -> Backend | Client -> Server |
| **Service Bus** | Backend -> Agent (async triggers) | Publisher -> Subscriber |

## Consequences

- A2A provides a standard discovery mechanism (agent cards) allowing agents to find and invoke each other without hardcoded URLs.
- The protocol supports streaming for long-running agent tasks (e.g., risk recalculation across all SKUs).
- Bearer token authentication via Azure Entra ID ensures secure inter-agent communication.
- Clear separation between A2A (agent-to-agent), MCP (agent-to-tool), and gRPC (client-to-server) prevents protocol confusion.
- Agent cards enable future extensibility — new agents can be added without modifying existing agents.
