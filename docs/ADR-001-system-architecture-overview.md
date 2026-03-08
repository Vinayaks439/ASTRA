# ADR-001: System Architecture Overview

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA requires a full-stack intelligent supply-chain command center combining a React frontend, Go gRPC backend, Python AI agents (Microsoft Agent Framework + A2A), Azure Cosmos DB, deployed on AKS and Azure Functions.

This ADR captures the top-level technology choices and layer boundaries.

## Decision

### Technology Stack by Layer

| Layer | Technology | Hosting |
|---|---|---|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind, shadcn/ui | Azure AKS (nginx container) |
| **Backend** | Go 1.22+, gRPC, protobuf, gRPC-Gateway (REST) | Azure AKS (Go container) |
| **AI Agents** | Python 3.12, Microsoft Agent Framework, A2A protocol | Azure Functions (Durable) |
| **MCP Tools** | Cosmos DB MCP Server, Azure MCP Server | Sidecar / Azure Functions |
| **Database** | Azure Cosmos DB (NoSQL API) | Azure Cosmos DB (Serverless) |
| **Messaging** | Azure Service Bus | Azure PaaS |
| **Observability** | OpenTelemetry, Azure Monitor, Application Insights | Azure PaaS |
| **Auth** | Microsoft Entra ID (Azure AD), RBAC | Azure PaaS |

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AZURE AKS CLUSTER                              │
│                                                                             │
│  ┌──────────────────────┐        ┌────────────────────────────────────────┐ │
│  │   FRONTEND (React)   │        │       GO gRPC BACKEND                  │ │
│  │                       │  gRPC  │                                        │ │
│  │  Dashboard            │◄──────►│  ┌──────────┐  ┌──────────────────┐   │ │
│  │  SKU Table            │  +REST │  │ SKU Svc   │  │ Recommendation   │   │ │
│  │  AI Summary Panel     │        │  │           │  │ Svc              │   │ │
│  │  Tickets              │        │  ├──────────┤  ├──────────────────┤   │ │
│  │  Audit Log            │        │  │ Risk Svc  │  │ Notification Svc │   │ │
│  │  Settings             │        │  │           │  │ (WhatsApp)       │   │ │
│  │  SKU Action Drawer    │        │  ├──────────┤  ├──────────────────┤   │ │
│  │                       │        │  │Ticket Svc │  │ Auth Svc         │   │ │
│  │                       │        │  │           │  │                  │   │ │
│  │                       │        │  ├──────────┤  ├──────────────────┤   │ │
│  │                       │        │  │ Audit Svc │  │ Settings Svc     │   │ │
│  └──────────────────────┘        │  └──────┬───┘  └────────┬─────────┘   │ │
│                                   │         │               │             │ │
│                                   └─────────┼───────────────┼─────────────┘ │
└─────────────────────────────────────────────┼───────────────┼───────────────┘
                                              │               │
                    ┌─────────────────────────┼───────────────┼─────────┐
                    │    AZURE SERVICE BUS    │               │         │
                    │  (async agent triggers) │               │         │
                    └─────────┬───────────────┼───────────────┘         │
                              │               │                         │
┌─────────────────────────────┼───────────────┼─────────────────────────┼─────┐
│                     AZURE FUNCTIONS (Durable)                               │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Risk Assessment   │  │ AI Insights      │  │ Exception Triage         │  │
│  │ Agent             │  │ Agent            │  │ Agent                    │  │
│  │                   │  │                  │  │                          │  │
│  │ - Composite score │  │ - NL summaries   │  │ - Auto vs. manual        │  │
│  │ - Band assignment │  │ - Dashboard KPIs │  │ - Ticket creation        │  │
│  │ - Driver analysis │  │ - Trend alerts   │  │ - Guardrail enforcement  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────────┘  │
│           │    A2A               │    A2A                │    A2A           │
│  ┌────────▼─────────┐  ┌────────▼─────────┐  ┌──────────▼───────────────┐  │
│  │ Recommendation    │  │ Notification     │  │ Rationale                │  │
│  │ Agent             │  │ Agent            │  │ Agent                    │  │
│  │                   │  │                  │  │                          │  │
│  │ - Price actions   │  │ - WhatsApp msgs  │  │ - Agent reasoning        │  │
│  │ - PO generation   │  │ - Digest compose │  │ - Exception explanation  │  │
│  │ - Hold decisions  │  │ - Delivery track │  │ - Confidence scoring     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────────┘  │
│           │                      │                        │                 │
│           └──────────────────────┼────────────────────────┘                 │
│                                  │ MCP                                      │
│                        ┌─────────▼──────────┐                               │
│                        │  Cosmos DB MCP     │                               │
│                        │  Server            │                               │
│                        └─────────┬──────────┘                               │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │ AZURE COSMOS DB │
                          │ (NoSQL API)     │
                          │                 │
                          │  skus           │
                          │  competitors    │
                          │  daily-own-     │
                          │   snapshots     │
                          │  daily-comp-    │
                          │   snapshots     │
                          │  weekly-own-    │
                          │   snapshots     │
                          │  weekly-comp-   │
                          │   snapshots     │
                          │  monthly-own-   │
                          │   snapshots     │
                          │  monthly-comp-  │
                          │   snapshots     │
                          └─────────────────┘
```

## Consequences

- Clear separation of concerns across four runtime layers (frontend, backend, agents, database).
- Go backend handles synchronous request/response; agents handle async AI workloads.
- Azure Service Bus decouples the backend from agent processing latency.
- Cosmos DB Serverless minimizes cost for bursty read/write patterns.
- Microsoft Entra ID provides centralized identity and RBAC across all layers.
