# ADR-012: Getting Started — Local Development & Deployment

**Status:** Accepted (updated 2026-03-15)
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

Developers need a clear, repeatable process for setting up ASTRA locally and deploying to Azure. The multi-language, multi-runtime nature of the project requires documenting prerequisites and startup order.

## Decision

Provide standardized local development and Azure deployment procedures with explicit prerequisites and step-by-step instructions.

### Prerequisites

- Go 1.22+
- Python 3.12+
- Node.js 22+
- Azure CLI (`az`)
- Docker
- Terraform 1.5+
- `protoc` + `protoc-gen-go` + `protoc-gen-go-grpc`
- Azure Cosmos DB account (NoSQL API)
- Azure OpenAI resource with a `gpt-4o-mini` deployment
- SearchAPI key (searchapi.io) — for competitor puller

### Local Development

```bash
# 1. Frontend
cd frontend && npm install && npx vite --port 9002

# 2. Backend
cd backend && go run cmd/server/main.go
# → gRPC on :50051, REST on :8080

# 3. Agents + MCP server (single command, starts all 7 agents)
cd agents
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Create .env with credentials (see README Quick Start)
python run_local.py
# → MCP server :6060, agents :7071-7077

# 4. Seed database
export COSMOS_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_KEY="your-primary-key"
node seed-cosmosdb.js
```

### Deploy to Azure

```bash
# 1. Provision all infrastructure (Container Apps, Cosmos DB, ACR, Key Vault)
cd infra
terraform init
terraform apply \
  -var="serp_api_key=YOUR_SEARCHAPI_KEY" \
  -var="openai_key=YOUR_OPENAI_KEY" \
  -var="cosmos_key=YOUR_COSMOS_KEY"

# 2. Build and push all container images to ACR
ACR="acrastradev.azurecr.io"

# Frontend
az acr build --registry acrastradev --image astra-frontend:latest frontend/

# Backend
az acr build --registry acrastradev --image astra-backend:latest backend/

# Agents (single Dockerfile, AGENT_MODULE selects which agent)
az acr build --registry acrastradev --image astra-agent-risk-assessment:latest \
  --build-arg AGENT_MODULE=risk_assessment.agent agents/
# ... repeat for each agent or use the GitHub Actions workflow

# 3. Container Apps automatically pull the new images on next revision
# Force an immediate update:
az containerapp update --name ca-astra-backend-dev \
  --resource-group rg-astra-dev \
  --image ${ACR}/astra-backend:latest
```

### Targeting a Single Container App with Terraform

```bash
# Example: update only the competitor-puller agent
terraform apply \
  -target='module.container_apps.azurerm_container_app.agents["competitor-puller"]' \
  -var="serp_api_key=YOUR_SEARCHAPI_KEY"

# Example: create a new Cosmos DB container
terraform apply \
  -target='module.cosmos_db.azurerm_cosmosdb_sql_container.containers["hourly-comp-snapshots"]'
```

## Consequences

- All services run as Container Apps — no `kubectl`, no AKS cluster management required.
- `python run_local.py` starts the full agent stack locally with a single command, matching the production container layout.
- Terraform is the single deployment tool for all Azure resources — no Bicep, no ARM templates.
- The single `agents/Dockerfile` with `AGENT_MODULE` env var means one CI workflow builds all 7 agent images.
- Environment variables (`COSMOS_ENDPOINT`, `COSMOS_KEY`, `SERP_API_KEY`) must be set before local runs and are passed as Terraform variables for production — never committed to source control.
- Proto stub generation (`go generate`) is a prerequisite for backend compilation — run before `go run`.
