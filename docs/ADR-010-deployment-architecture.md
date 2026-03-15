# ADR-010: Deployment Architecture — Azure Container Apps

**Status:** Accepted (updated 2026-03-15)
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA's runtime components span a React frontend, Go gRPC backend, seven Python AI agents, an MCP server, and supporting Azure PaaS services. The deployment architecture must balance simplicity, auto-scaling, and cost efficiency, while keeping all services within the same Azure network.

## Decision

Deploy **all services** (frontend, backend, agents, MCP server) on **Azure Container Apps** within a shared Container App Environment. Use Azure PaaS for supporting services (Key Vault, Monitor, OpenAI, ACR).

### Deployment Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AZURE SUBSCRIPTION                                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │           AZURE CONTAINER APP ENVIRONMENT (cae-astra-dev)             │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │  │ ca-astra-        │  │ ca-astra-        │  │ ca-astra-mcp-server  │  │  │
│  │  │ frontend-dev     │  │ backend-dev      │  │ -dev                 │  │  │
│  │  │                 │  │                 │  │                      │  │  │
│  │  │ nginx:alpine    │  │ Go 1.25         │  │ Python 3.12          │  │  │
│  │  │ Port: 80        │  │ Port: 8080      │  │ FastMCP SSE :6060    │  │  │
│  │  │ External: yes   │  │ External: yes   │  │ External: NO         │  │  │
│  │  │ min=1 max=3     │  │ min=1 max=3     │  │ min=1 max=1          │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    AGENT CONTAINER APPS (7)                      │ │  │
│  │  │                                                                  │ │  │
│  │  │  risk-assessment :7071  │  recommendation :7072                  │ │  │
│  │  │  exception-triage :7073 │  rationale :7074                      │ │  │
│  │  │  insights :7075         │  notification :7076                   │ │  │
│  │  │  competitor-puller :7077 (hourly cron, SearchAPI)               │ │  │
│  │  │                                                                  │ │  │
│  │  │  All: Python 3.12 | External: yes | min=0 max=3                 │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────┐  ┌──────────────────────────────────────────┐   │
│  │ AZURE COSMOS DB       │  │ SUPPORTING SERVICES                      │   │
│  │                       │  │                                          │   │
│  │ API: NoSQL            │  │ ┌────────────────┐ ┌──────────────────┐ │   │
│  │ Tier: Serverless      │  │ │ Azure Container│ │ Azure Key Vault  │ │   │
│  │                       │  │ │ Registry (ACR) │ │                  │ │   │
│  │ Containers: 15        │  │ │                │ │ Cosmos key       │ │   │
│  │                       │  │ │ Images: 10     │ │ OpenAI key       │ │   │
│  │                       │  │ │ (per service)  │ │ SERP API key     │ │   │
│  │                       │  │ └────────────────┘ └──────────────────┘ │   │
│  └───────────────────────┘  │                                          │   │
│                              │ ┌────────────────┐ ┌──────────────────┐ │   │
│  ┌───────────────────────┐  │ │ Azure Monitor  │ │ App Insights     │ │   │
│  │ AZURE OPENAI          │  │ │ + Log Analytics│ │ (OpenTelemetry)  │ │   │
│  │                       │  │ └────────────────┘ └──────────────────┘ │   │
│  │ Model: GPT-4o-mini    │  └──────────────────────────────────────────┘   │
│  │ Deployment: astra-gpt │                                                  │
│  └───────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Container Images

| Service | Base Image | Port | External | Replicas |
|---|---|---|---|---|
| Frontend | `node:22-alpine` (build) → `nginx:alpine` (serve) | 80 | Yes | 1–3 |
| Backend | `golang:1.22-alpine` (build) → final | 8080 | Yes | 1–3 |
| MCP Server | `python:3.12-slim` | 6060 | **No** (internal only) | 1 |
| Each Agent (×7) | `python:3.12-slim` | 7071–7077 | Yes | 0–3 |

### MCP Server — Internal Routing

The MCP server has `external_enabled = false`. Its FQDN uses the `.internal.` subdomain and is only reachable from within the Container App Environment:

```
https://ca-astra-mcp-server-dev.internal.<env-domain>/sse
```

All agents and the backend receive `MCP_SERVER_URL` pointing to this internal address via environment variables set in Terraform.

### Container App Configuration

| Setting | Agents | Backend | Frontend | MCP Server |
|---|---|---|---|---|
| Revision mode | Single | Single | Single | Single |
| Identity | UserAssigned (ACR pull) | UserAssigned (ACR pull) | UserAssigned (ACR pull) | UserAssigned (ACR pull) |
| Liveness probe | `GET /health` | `GET /health` | — | — |
| Readiness probe | `GET /health` | `GET /health` | — | — |
| CPU | 0.5 | 0.5 | 0.25 | 0.5 |
| Memory | 1Gi | 1Gi | 0.5Gi | 1Gi |

### CI/CD Pipeline

```
GitHub Actions
    │
    ├── frontend/    → docker build → ACR push → Container App update
    ├── backend/     → docker build → ACR push → Container App update
    ├── agents/      → docker build → ACR push → Container App update (per agent)
    └── infra/       → Terraform plan/apply → Azure Resource Manager
```

### Infrastructure as Code

All resources are managed via Terraform in `infra/`:

```
infra/
├── main.tf                          # Root module, wires all modules
├── variables.tf                     # serp_api_key, openai_key, cosmos_key, etc.
├── backend.tf                       # Remote state (Azure Blob)
└── modules/
    ├── container_apps/main.tf       # All Container Apps + environment
    ├── cosmos_db/main.tf            # Cosmos DB account + 15 containers
    ├── acr/main.tf                  # Azure Container Registry
    ├── key_vault/main.tf            # Key Vault
    └── resource_group/main.tf       # Resource group
```

## Consequences

- Azure Container Apps provides auto-scaling (scale-to-zero for agents), health checks, and rolling updates without managing Kubernetes clusters.
- All services in a single Container App Environment share a private network — agents call the MCP server over the internal FQDN without public egress.
- Scale-to-zero for agents eliminates idle compute cost between agent runs.
- Terraform manages all infrastructure declaratively; new containers are added by extending the `agents` map in `container_apps/main.tf`.
- Secrets (Cosmos key, OpenAI key, SERP API key) are stored as Container App secrets and injected as environment variables, never in code.
- The competitor puller runs as a persistent container (min=0) triggered hourly by the Go backend cron, keeping deployment uniform with other agents.
