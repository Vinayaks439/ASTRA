#!/bin/bash
# =============================================================================
# VoltEdge — Cosmos DB Setup & Seed Script
# Creates database, 8 containers, and populates ~23,770 documents
# =============================================================================
# Usage:
#   chmod +x setup-cosmosdb.sh
#   ./setup-cosmosdb.sh
#
# Prerequisites:
#   - az cli installed and logged in (az login)
#   - jq installed (sudo apt install jq / brew install jq)
#   - Cosmos DB account already created (NoSQL API)
#   - JSON seed files in ./seed-data/ directory
# =============================================================================

set -euo pipefail

# ── CONFIGURATION (edit these) ──────────────────────────────────────────────
RG="astra"
ACCOUNT="astra-db"
DB="voltedge-pricing-db"
SEED_DIR="./data"
# ────────────────────────────────────────────────────────────────────────────


echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  VoltEdge — Cosmos DB Setup                                  ║"
echo "║  Account:  $ACCOUNT"
echo "║  Database: $DB"
echo "╚═══════════════════════════════════════════════════════════════╝"

# ── Step 1: Create Database ─────────────────────────────────────────────────
echo ""
echo "━━━ [1/3] Creating database ━━━"
az cosmosdb sql database create \
  --account-name "$ACCOUNT" \
  --resource-group "$RG" \
  --name "$DB" \
  --output none 2>&1 || echo "  (database already exists or failed — see error above)"
echo "  ✓ Database '$DB' ready"

# ── Step 2: Create Containers ───────────────────────────────────────────────
echo ""
echo "━━━ [2/3] Creating 8 containers ━━━"

create_container() {
  local name="$1"
  local pk="$2"

  echo "  Creating: $name (partition: $pk, serverless)..."

  az cosmosdb sql container create \
    --account-name "$ACCOUNT" \
    --resource-group "$RG" \
    --database-name "$DB" \
    --name "$name" \
    --partition-key-path "$pk" \
    --output none 2>&1 || echo "    (already exists or failed — see error above)"
}

create_container "skus"                   "/category"
create_container "competitors"            "/platform"
create_container "daily-own-snapshots"    "/skuId"
create_container "daily-comp-snapshots"   "/skuId"
create_container "weekly-own-snapshots"   "/skuId"
create_container "weekly-comp-snapshots"  "/skuId"
create_container "monthly-own-snapshots"  "/skuId"
create_container "monthly-comp-snapshots" "/skuId"

echo "  ✓ All 8 containers created"

# ── Step 3: Populate Seed Data ──────────────────────────────────────────────
# NOTE: Azure CLI has no command to insert items into Cosmos DB containers.
#       We use the @azure/cosmos Node.js SDK via seed-cosmosdb.js instead.
echo ""
echo "━━━ [3/3] Populating seed data (via Node.js SDK) ━━━"

# Pass credentials to the Node.js script so it doesn't have to re-fetch them
export COSMOS_ENDPOINT
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name "$ACCOUNT" \
  --resource-group "$RG" \
  --query documentEndpoint -o tsv 2>/dev/null || true)

export COSMOS_KEY
COSMOS_KEY=$(az cosmosdb keys list \
  --name "$ACCOUNT" \
  --resource-group "$RG" \
  --query primaryMasterKey -o tsv 2>/dev/null || true)

node "$(dirname "$0")/seed-cosmosdb.js"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✓ Setup Complete!                                           ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Database: $DB"
echo "║                                                              ║"
echo "║  Collections:                                                ║"
echo "║    skus                   10 docs    (PK: /category)         ║"
echo "║    competitors            10 docs    (PK: /platform)         ║"
echo "║    daily-own-snapshots    1,820 docs (PK: /skuId)            ║"
echo "║    daily-comp-snapshots   18,200 docs(PK: /skuId)            ║"
echo "║    weekly-own-snapshots   280 docs   (PK: /skuId)            ║"
echo "║    weekly-comp-snapshots  2,800 docs (PK: /skuId)            ║"
echo "║    monthly-own-snapshots  60 docs    (PK: /skuId)            ║"
echo "║    monthly-comp-snapshots 600 docs   (PK: /skuId)            ║"
echo "║                                                              ║"
echo "║  Total: ~23,780 documents                                    ║"
echo "║  Currency: INR                                               ║"
echo "║  Period: Oct 2025 - Mar 2026 (6 months)                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "TIP: For 18K+ daily-comp docs, consider the Cosmos DB bulk"
echo "executor SDK for faster inserts instead of az cli one-by-one:"
echo "  https://learn.microsoft.com/azure/cosmos-db/bulk-executor-overview"
