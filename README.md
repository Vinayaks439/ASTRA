# ASTRA — Autonomous Seller Trading & Risk Analytics

A full-stack intelligent supply-chain command center that helps sellers monitor SKU pricing, assess competitive risk, and take AI-driven actions — automatically or via human-in-the-loop exception tickets.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Go 1.22+, gRPC, protobuf, gRPC-Gateway |
| AI Agents | Python 3.12, Microsoft Agent Framework, A2A protocol |
| Database | Azure Cosmos DB (NoSQL API, Serverless) |
| Messaging | Azure Service Bus |
| Infrastructure | AKS, Azure Functions, Bicep/Terraform |

## Quick Start

### Prerequisites

- Node.js 22+
- Azure Cosmos DB account (NoSQL API)

### Run the Frontend

```bash
npm install
npm run dev
```

The app starts at `http://localhost:9002`.

### Seed the Database

```bash
# Option A: Full setup (creates DB, containers, seeds data)
chmod +x setup-cosmosdb.sh
./setup-cosmosdb.sh

# Option B: Seed only (DB and containers must already exist)
export COSMOS_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_KEY="your-primary-key"
node seed-cosmosdb.js
```

## Project Structure

```
ASTRA/
├── src/                  # React frontend source
├── data/                 # Seed data (JSON files for Cosmos DB)
├── docs/                 # Architecture Decision Records (ADRs)
├── setup-cosmosdb.sh     # Cosmos DB provisioning script
├── seed-cosmosdb.js      # Node.js seed script
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

## Architecture Decision Records

Detailed architecture documentation is split into individual ADRs in the [`docs/`](docs/) folder:

| ADR | Topic |
|---|---|
| [ADR-001](docs/ADR-001-system-architecture-overview.md) | System Architecture Overview |
| [ADR-002](docs/ADR-002-frontend-react-vite.md) | Frontend — React / Vite |
| [ADR-003](docs/ADR-003-backend-services-go-grpc.md) | Backend Services — Go + gRPC |
| [ADR-004](docs/ADR-004-ai-agents-python.md) | AI Agents — Python / Microsoft Agent Framework |
| [ADR-005](docs/ADR-005-a2a-communication.md) | Agent-to-Agent (A2A) Communication |
| [ADR-006](docs/ADR-006-azure-mcp-tools.md) | Azure MCP Tools |
| [ADR-007](docs/ADR-007-database-schema-cosmosdb.md) | Database Schema — Cosmos DB |
| [ADR-008](docs/ADR-008-synthetic-data-sku-inventory.md) | Synthetic Data — SKU Inventory |
| [ADR-009](docs/ADR-009-api-data-flow.md) | API & Data Flow |
| [ADR-010](docs/ADR-010-deployment-architecture.md) | Deployment — AKS + Azure Functions |
| [ADR-011](docs/ADR-011-repository-structure.md) | Repository Structure |
| [ADR-012](docs/ADR-012-getting-started.md) | Getting Started & Deployment |

## License

See [LICENSE](LICENSE) for details.
