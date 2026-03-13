#!/bin/bash
# Seeds Cosmos DB after infrastructure is provisioned.
# Reads credentials from Terraform outputs and runs the existing seed script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR/infra"

echo "==> Reading Cosmos DB credentials from Terraform..."
export COSMOS_ENDPOINT=$(terraform output -raw cosmos_endpoint)
export COSMOS_KEY=$(terraform output -raw cosmos_key)
export COSMOS_DATABASE=$(terraform output -raw cosmos_database_name)

echo "   Endpoint: $COSMOS_ENDPOINT"
echo "   Database: $COSMOS_DATABASE"

cd "$ROOT_DIR"

echo "==> Installing Node.js dependencies for seed script..."
npm install @azure/cosmos 2>/dev/null || true

echo "==> Seeding Cosmos DB..."
node seed-cosmosdb.js

echo "==> Seeding complete."
