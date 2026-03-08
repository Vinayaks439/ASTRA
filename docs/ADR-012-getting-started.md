# ADR-012: Getting Started — Local Development & Deployment

**Status:** Accepted
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
- Azure Functions Core Tools (`func`)
- Docker & kubectl
- `protoc` + `protoc-gen-go` + `protoc-gen-go-grpc`
- Azure Cosmos DB account (NoSQL API)

### Local Development

```bash
# 1. Frontend
cd frontend && npm install && npm run dev

# 2. Backend (after generating proto stubs)
cd backend && go generate ./... && go run cmd/server/main.go

# 3. Agents (each in its own terminal)
cd agents/risk_assessment && func start
cd agents/recommendation && func start
cd agents/insights && func start
# ... etc

# 4. Database (Cosmos DB setup + seed)
# Option A: Full setup via shell script (creates DB, containers, seeds data)
chmod +x setup-cosmosdb.sh
./setup-cosmosdb.sh

# Option B: Seed only via Node.js (DB and containers must already exist)
export COSMOS_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_KEY="your-primary-key"
npm install @azure/cosmos
node seed-cosmosdb.js
```

### Deploy to Azure

```bash
# 1. Provision infrastructure
az deployment sub create --location eastus --template-file infra/main.bicep

# 2. Build and push containers
az acr build --registry astraacr --image frontend:latest frontend/
az acr build --registry astraacr --image backend:latest backend/

# 3. Deploy to AKS
kubectl apply -f k8s/

# 4. Deploy agents to Azure Functions
cd agents/risk_assessment && func azure functionapp publish astra-risk-agent
# ... repeat for each agent
```

## Consequences

- Two database setup options (shell script vs. Node.js) cater to both first-time provisioning and data-only refresh scenarios.
- Each agent runs independently via `func start`, allowing developers to work on specific agents without starting the full stack.
- Proto stub generation (`go generate`) is a prerequisite for backend compilation — this must run before `go run`.
- Azure deployment uses Bicep for infrastructure and ACR + AKS for container workloads, matching the production architecture.
- Environment variables (`COSMOS_ENDPOINT`, `COSMOS_KEY`) must be set before seeding — these should never be committed to source control.
