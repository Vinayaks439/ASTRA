# ADR-009: API & Data Flow

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA's multi-layer architecture (frontend, Go backend, Python agents, Cosmos DB) requires well-defined data flows for key user scenarios. Understanding the sequence of calls across layers is critical for debugging, performance optimization, and ensuring correctness.

## Decision

Define three primary data flows that cover the core user scenarios: dashboard load, action execution, and exception ticket handling.

### Dashboard Load Sequence

```
┌──────────┐     ┌────────────┐     ┌───────────┐     ┌──────────┐
│ Frontend  │     │ Go Backend │     │ Cosmos DB  │     │ AI Agents│
└────┬─────┘     └─────┬──────┘     └─────┬─────┘     └────┬─────┘
     │                  │                   │                │
     │ ListSKUs(gRPC)   │                   │                │
     │─────────────────►│                   │                │
     │                  │  Query skus +     │                │
     │                  │  snapshot         │                │
     │                  │  containers       │                │
     │                  │─────────────────► │                │
     │                  │◄─────────────────│                │
     │◄─────────────────│                   │                │
     │                  │                   │                │
     │ GetSummary(gRPC) │                   │                │
     │─────────────────►│                   │                │
     │                  │  Check cache      │                │
     │                  │─────────────────► │                │
     │                  │◄─────────────────│                │
     │                  │  Cache miss?      │                │
     │                  │  A2A: tasks/send  │                │
     │                  │──────────────────────────────────►│
     │                  │                   │  MCP: query    │
     │                  │                   │◄───────────────│
     │                  │                   │───────────────►│
     │                  │◄──────────────────────────────────│
     │◄─────────────────│  A2A: result      │                │
     │                  │                   │                │
```

### Approve & Execute Flow

```
┌──────────┐     ┌────────────┐     ┌───────────┐     ┌──────────┐
│ Frontend  │     │ Go Backend │     │ Cosmos DB  │     │ Agents   │
└────┬─────┘     └─────┬──────┘     └─────┬─────┘     └────┬─────┘
     │                  │                   │                │
     │ ExecuteAction    │                   │                │
     │─────────────────►│                   │                │
     │                  │  Validate action  │                │
     │                  │─────────────────► │                │
     │                  │◄─────────────────│                │
     │                  │                   │                │
     │                  │  Execute pricing  │                │
     │                  │  update           │                │
     │                  │─────────────────► │                │
     │                  │                   │                │
     │                  │  Write audit_log  │                │
     │                  │─────────────────► │                │
     │                  │                   │                │
     │                  │  Service Bus ─────────────────────►│
     │                  │  (recalculate risk)│               │
     │                  │                   │                │
     │                  │  If WhatsApp on:  │                │
     │                  │  A2A → Notification Agent ────────►│
     │                  │                   │                │
     │◄─────────────────│  Response         │                │
     │                  │                   │                │
```

### Exception Ticket Flow

```
┌──────────┐     ┌────────────┐     ┌───────────────┐     ┌────────────┐
│ Risk      │     │ Recommend  │     │ Exception     │     │ Notification│
│ Agent     │     │ Agent      │     │ Triage Agent  │     │ Agent       │
└────┬─────┘     └─────┬──────┘     └──────┬────────┘     └─────┬──────┘
     │                  │                    │                    │
     │  A2A: risk done  │                    │                    │
     │─────────────────►│                    │                    │
     │                  │  A2A: recommend    │                    │
     │                  │───────────────────►│                    │
     │                  │                    │                    │
     │                  │                    │ Check thresholds   │
     │                  │                    │ via MCP → Cosmos   │
     │                  │                    │                    │
     │                  │                    │ Breach detected!   │
     │                  │                    │ Create ticket      │
     │                  │                    │ via MCP → Cosmos   │
     │                  │                    │                    │
     │                  │                    │ A2A: notify        │
     │                  │                    │───────────────────►│
     │                  │                    │                    │
     │                  │                    │                    │ Compose WhatsApp
     │                  │                    │                    │ via LLM + send
     │                  │                    │                    │
     │                  │                    │◄───────────────────│
     │                  │                    │  delivery status   │
```

## Consequences

- **Dashboard Load**: Two parallel gRPC calls (ListSKUs + GetSummary) enable fast initial render; AI insights are cached and refreshed asynchronously.
- **Approve & Execute**: Synchronous pricing update + audit log write, with async risk recalculation via Service Bus — user gets immediate feedback.
- **Exception Ticket**: Fully async agent-to-agent pipeline — no user-facing latency since this runs in the background after risk assessment triggers.
- Service Bus decouples backend response times from agent processing times in the execute flow.
- A2A enables the agent chain (Risk -> Recommendation -> Triage -> Notification) to execute as a pipeline without backend orchestration.
