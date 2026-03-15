# ADR-011: Repository Structure

**Status:** Accepted (updated 2026-03-15)
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA is a multi-language, multi-runtime project (React/TypeScript frontend, Go backend, Python agents, Terraform infrastructure). The repository structure must support independent development and deployment of each layer while sharing common configuration and seed data.

## Decision

Use a **monorepo** with top-level directories per layer. Each layer has its own build tooling, Dockerfile, and CI/CD workflow.

### Directory Layout

```
ASTRA/
├── frontend/                    # React/Vite app
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
│   │   ├── repository/          # Cosmos DB data access (azure-cosmos SDK)
│   │   ├── agent/               # A2A client for calling Python agents
│   │   └── messaging/           # Azure Service Bus publisher
│   ├── proto/
│   │   └── astra/v1/            # Protobuf definitions
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
│
├── agents/                      # Python AI agents (7)
│   ├── shared/
│   │   ├── a2a/                 # A2A protocol helpers
│   │   │   ├── server.py        # A2A JSON-RPC server base
│   │   │   ├── client.py        # A2A task client
│   │   │   └── models.py        # AgentCard, Task, Artifact
│   │   ├── mcp/                 # MCP tool wrappers
│   │   │   ├── server.py        # FastMCP SSE server (14 tools, port 6060)
│   │   │   ├── client.py        # Async MCP client wrappers
│   │   │   └── cosmos_client.py # azure-cosmos SDK implementation
│   │   └── config.py            # Env vars (Cosmos, OpenAI, SERP_API_KEY, agent URLs)
│   ├── risk_assessment/
│   │   └── agent.py
│   ├── recommendation/
│   │   └── agent.py
│   ├── exception_triage/
│   │   └── agent.py
│   ├── rationale/
│   │   └── agent.py
│   ├── insights/
│   │   └── agent.py
│   ├── notification/
│   │   └── agent.py
│   ├── competitor_puller/
│   │   └── agent.py             # SearchAPI Google Shopping, writes hourly-comp-snapshots
│   ├── Dockerfile               # Single image, AGENT_MODULE env selects which agent runs
│   ├── run_local.py             # Starts MCP server + all 7 agents via multiprocessing
│   ├── requirements.txt         # Local dev dependencies
│   └── requirements-container.txt  # Production container dependencies
│
├── infra/                       # Terraform infrastructure
│   ├── main.tf                  # Root module
│   ├── variables.tf
│   ├── backend.tf               # Remote state (Azure Blob)
│   └── modules/
│       ├── container_apps/      # All Azure Container Apps + environment
│       ├── cosmos_db/           # Cosmos DB account + 15 containers
│       ├── acr/                 # Azure Container Registry
│       ├── key_vault/
│       └── resource_group/
│
├── data/                        # Seed data (JSON files)
│   ├── skus.json
│   ├── competitors.json
│   ├── daily-own-snapshots.json
│   ├── daily-comp-snapshots.json
│   ├── weekly-own-snapshots.json
│   ├── weekly-comp-snapshots.json
│   ├── monthly-own-snapshots.json
│   └── monthly-comp-snapshots.json
│
├── docs/                        # Architecture Decision Records (12 ADRs)
│
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       ├── backend.yml
│       ├── agents.yml
│       └── infra.yml
│
├── setup-cosmosdb.sh            # Cosmos DB provisioning script
├── seed-cosmosdb.js             # Node.js seed script
└── README.md
```

## Consequences

- Monorepo enables atomic changes across layers (e.g., proto change + backend + frontend in one PR).
- Separate CI/CD workflows per directory allow independent build/deploy pipelines with path-based triggers.
- Shared `agents/shared/` avoids code duplication across all seven Python agents for A2A and MCP client code.
- A single `agents/Dockerfile` with `AGENT_MODULE` env var selects which agent runs — one image build pipeline covers all 7 agents.
- `data/` directory provides a single source of truth for seed data, referenced by both `setup-cosmosdb.sh` and `seed-cosmosdb.js`.
- Infrastructure code in `infra/` with Terraform modules supports adding new Container Apps by editing a single map.
- Proto definitions under `backend/proto/` serve as the canonical API contract.
