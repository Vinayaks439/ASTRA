# ADR-011: Repository Structure

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA is a multi-language, multi-runtime project (React/TypeScript frontend, Go backend, Python agents, Bicep/Terraform infrastructure). The repository structure must support independent development and deployment of each layer while sharing common configuration and seed data.

## Decision

Use a **monorepo** with top-level directories per layer. Each layer has its own build tooling, Dockerfile, and CI/CD workflow.

### Directory Layout

```
ASTRA/
├── frontend/                    # React/Vite app (existing)
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── backend/                     # Go gRPC backend
│   ├── cmd/
│   │   └── server/main.go
│   ├── internal/
│   │   ├── service/             # gRPC service implementations
│   │   │   ├── sku.go
│   │   │   ├── risk.go
│   │   │   ├── ticket.go
│   │   │   ├── audit.go
│   │   │   ├── insights.go
│   │   │   ├── recommendation.go
│   │   │   ├── notification.go
│   │   │   └── settings.go
│   │   ├── repository/          # Cosmos DB data access (@azure/cosmos)
│   │   ├── agent/               # A2A client for calling Python agents
│   │   └── messaging/           # Azure Service Bus publisher
│   ├── proto/
│   │   └── astra/v1/            # Protobuf definitions
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
│
├── agents/                      # Python AI agents
│   ├── shared/
│   │   ├── a2a/                 # A2A protocol helpers
│   │   │   ├── server.py        # A2A JSON-RPC server base
│   │   │   ├── client.py        # A2A task client
│   │   │   └── models.py        # AgentCard, Task, Artifact
│   │   ├── mcp/                 # MCP tool wrappers
│   │   │   ├── cosmos_client.py # Cosmos DB MCP client
│   │   │   └── azure_client.py  # Azure MCP client
│   │   └── config.py
│   ├── risk_assessment/
│   │   ├── agent.py             # MS Agent Framework agent definition
│   │   ├── function_app.py      # Azure Function entry point
│   │   └── host.json
│   ├── recommendation/
│   │   ├── agent.py
│   │   ├── function_app.py
│   │   └── host.json
│   ├── exception_triage/
│   │   ├── agent.py
│   │   ├── function_app.py
│   │   └── host.json
│   ├── rationale/
│   │   ├── agent.py
│   │   ├── function_app.py
│   │   └── host.json
│   ├── insights/
│   │   ├── agent.py
│   │   ├── function_app.py
│   │   └── host.json
│   ├── notification/
│   │   ├── agent.py
│   │   ├── function_app.py
│   │   └── host.json
│   └── requirements.txt
│
├── infra/                       # Infrastructure as Code
│   ├── main.bicep               # Azure Bicep (or Terraform)
│   ├── modules/
│   │   ├── aks.bicep
│   │   ├── cosmosdb.bicep
│   │   ├── functions.bicep
│   │   ├── servicebus.bicep
│   │   ├── keyvault.bicep
│   │   └── monitoring.bicep
│   └── parameters/
│       ├── dev.json
│       └── prod.json
│
├── data/                        # Seed data (JSON files)
│   ├── skus.json                # 10 VoltEdge SKUs
│   ├── competitors.json         # 10 competitor profiles
│   ├── daily-own-snapshots.json # Daily own price/stock/velocity
│   ├── daily-comp-snapshots.json# Daily competitor pricing
│   ├── weekly-own-snapshots.json# Weekly own aggregates
│   ├── weekly-comp-snapshots.json# Weekly competitor aggregates
│   ├── monthly-own-snapshots.json# Monthly own with revenue
│   └── monthly-comp-snapshots.json# Monthly competitor aggregates
│
├── docs/                        # Architecture Decision Records
│
├── setup-cosmosdb.sh            # Cosmos DB setup script (az cli)
├── seed-cosmosdb.js             # Node.js seed script (@azure/cosmos)
│
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       ├── backend.yml
│       ├── agents.yml
│       └── infra.yml
│
└── README.md
```

## Consequences

- Monorepo enables atomic changes across layers (e.g., proto change + backend + frontend in one PR).
- Separate CI/CD workflows per directory allow independent build/deploy pipelines with path-based triggers.
- Shared `agents/shared/` avoids code duplication across the six Python agents for A2A and MCP client code.
- `data/` directory provides a single source of truth for seed data, referenced by both `setup-cosmosdb.sh` and `seed-cosmosdb.js`.
- Infrastructure code in `infra/` with environment-specific parameters supports dev/prod parity.
- Proto definitions under `backend/proto/` serve as the canonical API contract.
