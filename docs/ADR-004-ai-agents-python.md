# ADR-004: AI Agents — Python 3 / Microsoft Agent Framework

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA requires intelligent, autonomous processing for risk assessment, recommendation generation, exception triage, rationale explanation, dashboard insights, and notifications. These workloads are AI-intensive, involve LLM calls, and benefit from Python's ML/AI ecosystem.

## Decision

Deploy **six specialized agents**, each as an **Azure Durable Function**, built with the **Microsoft Agent Framework** (successor to AutoGen + Semantic Kernel). Each agent uses **Azure OpenAI GPT-4o** for LLM capabilities and **Cosmos DB MCP Server** for data access.

### Agent Ecosystem

```
┌────────────────────────────────────────────────────────────────────┐
│                      AGENT ECOSYSTEM                               │
│                                                                    │
│  ┌────────────────────┐       ┌────────────────────────────────┐  │
│  │ 1. RISK ASSESSMENT │──A2A─►│ 2. RECOMMENDATION AGENT        │  │
│  │    AGENT            │       │                                │  │
│  │                     │       │  Consumes risk scores,         │  │
│  │  Computes:          │       │  produces:                     │  │
│  │  - Price Gap (0-30) │       │  - PRICE_DECREASE / INCREASE   │  │
│  │  - Stock Cov (0-30) │       │  - HOLD / HOLD_REORDER         │  │
│  │  - Demand Tr (0-20) │       │  - Suggested price delta       │  │
│  │  - Margin Pr (0-20) │       │  - PO recommendation           │  │
│  │  - Composite (0-100)│       │  - Confidence score            │  │
│  │  - Band assignment  │       │                                │  │
│  └────────┬───────────┘       └──────────┬─────────────────────┘  │
│           │ A2A                           │ A2A                    │
│           ▼                               ▼                        │
│  ┌────────────────────┐       ┌────────────────────────────────┐  │
│  │ 3. EXCEPTION TRIAGE│       │ 4. RATIONALE AGENT             │  │
│  │    AGENT            │       │                                │  │
│  │                     │       │  Generates natural language:   │  │
│  │  Determines:        │       │  - Why agent chose auto/manual │  │
│  │  - auto vs breaches │       │  - Which thresholds breached   │  │
│  │  - Threshold checks │       │  - Evidence & data points      │  │
│  │  - Ticket creation  │       │  - Confidence justification    │  │
│  │  - Guardrail enforce│       │                                │  │
│  └────────────────────┘       └────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────┐       ┌────────────────────────────────┐  │
│  │ 5. AI INSIGHTS     │       │ 6. NOTIFICATION AGENT          │  │
│  │    AGENT            │       │                                │  │
│  │                     │       │  Composes:                     │  │
│  │  Produces:          │       │  - WhatsApp action summaries   │  │
│  │  - 3 insight strings│       │  - Daily digest messages       │  │
│  │  - KPI narratives   │       │  - Urgent alert notifications  │  │
│  │  - Trend warnings   │       │  - Delivery tracking           │  │
│  │  - Action urgency   │       │                                │  │
│  └────────────────────┘       └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Agent 1: Risk Assessment Agent

| Property | Value |
|---|---|
| **Trigger** | Service Bus: `risk.assess` queue / HTTP (A2A) |
| **Input** | SKU pricing, stock, velocity, margin data from snapshots |
| **LLM** | Azure OpenAI GPT-4o (for anomaly detection, optional) |
| **MCP Tools** | Cosmos DB MCP — read `skus`, `daily-own-snapshots`, `daily-comp-snapshots` |
| **Output** | `RiskScores` + composite + band + top driver |
| **Logic** | Deterministic formulas augmented by LLM for edge-case anomaly flagging |

**Formulas (deterministic core):**
- `price_gap = clamp(((comp - own) / own) * 100, 0, 30)`
- `stock_coverage = clamp(30 - (on_hand / velocity), 0, 30)`
- `demand_trend = clamp(((v7 - v14) / v14) * 100, 0, 20)`
- `margin_proximity = clamp(20 - ((margin - floor) / floor) * 100, 0, 20)`
- `composite = price_gap + stock_coverage + demand_trend + margin_proximity`
- Band: `CRITICAL >= 75`, `WARNING >= 40`, else `HEALTHY`

### Agent 2: Recommendation Agent

| Property | Value |
|---|---|
| **Trigger** | A2A task from Risk Assessment Agent / Service Bus |
| **Input** | SKU + `RiskScores` + seller thresholds |
| **LLM** | Azure OpenAI GPT-4o |
| **MCP Tools** | Cosmos DB MCP — read `skus`, `monthly-own-snapshots` |
| **Output** | `Recommendation` (action, suggested price, rationale, confidence) |

**Decision matrix:**
- `price_gap > threshold.pg` -> PRICE_DECREASE
- `stock_coverage > threshold.sc && margin > floor + 5%` -> PRICE_INCREASE
- `stock_coverage > threshold.sc` -> HOLD_REORDER (+ PO if enabled)
- else -> HOLD

### Agent 3: Exception Triage Agent

| Property | Value |
|---|---|
| **Trigger** | A2A task from Recommendation Agent |
| **Input** | `Recommendation` + `Thresholds` |
| **LLM** | Azure OpenAI GPT-4o (for nuanced edge cases) |
| **MCP Tools** | Cosmos DB MCP — read/write `tickets`, read thresholds config |
| **Output** | `agent_mode` (auto / breaches) + optional `Ticket` |

**Guardrail logic:** If any individual risk score exceeds the seller's configured threshold, the action is blocked from autonomous execution and an exception ticket is created.

### Agent 4: Rationale Agent

| Property | Value |
|---|---|
| **Trigger** | A2A task (on-demand from Go backend when drawer opens) |
| **Input** | SKU + `RiskScores` + `Recommendation` + `Thresholds` |
| **LLM** | Azure OpenAI GPT-4o |
| **MCP Tools** | Cosmos DB MCP — read `skus`, `weekly-own-snapshots`, `monthly-comp-snapshots` |
| **Output** | Natural language explanation string |

Generates human-readable rationale: why the agent chose autonomous vs. exception, which data points drove the decision, and confidence justification.

### Agent 5: AI Insights Agent

| Property | Value |
|---|---|
| **Trigger** | Scheduled (every 5 min) + on-demand via A2A |
| **Input** | Aggregated metrics from all SKUs |
| **LLM** | Azure OpenAI GPT-4o |
| **MCP Tools** | Cosmos DB MCP — read aggregated snapshot containers |
| **Output** | 3 short insight strings + KPI narrative |

Produces the natural language insights shown in the AI Summary Panel at the top of the dashboard.

### Agent 6: Notification Agent

| Property | Value |
|---|---|
| **Trigger** | A2A task from Exception Triage Agent / Service Bus |
| **Input** | Ticket or action details + WhatsApp number |
| **LLM** | Azure OpenAI GPT-4o (message composition) |
| **MCP Tools** | Cosmos DB MCP — read `tickets`, update `whatsapp_status` |
| **External** | WhatsApp Business API (via Azure Communication Services) |
| **Output** | WhatsApp message sent + delivery status |

## Consequences

- Each agent is independently deployable and scalable as an Azure Durable Function.
- The Microsoft Agent Framework provides built-in orchestration, state management, and LLM integration.
- Deterministic formulas in the Risk Assessment Agent ensure reproducibility; LLM augmentation is optional for edge cases.
- Agent specialization enables clear ownership and focused testing per domain.
- All agents share the Cosmos DB MCP Server for data access, ensuring consistent data views.
