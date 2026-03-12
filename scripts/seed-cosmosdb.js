#!/usr/bin/env node
// =============================================================================
// VoltEdge — Cosmos DB Seed Script (Node.js + @azure/cosmos)
// Inserts documents from JSON files into Cosmos DB containers
// =============================================================================
// Usage:
//   node seed-cosmosdb.js
//
// Environment variables (or edit CONFIGURATION below):
//   COSMOS_ENDPOINT  – Cosmos DB account endpoint
//   COSMOS_KEY       – Primary or secondary key
// =============================================================================

const { CosmosClient } = require("@azure/cosmos");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── CONFIGURATION ──────────────────────────────────────────────────────────
const RG = "astra";
const ACCOUNT = "astra-db";
const DB = "voltedge-pricing-db";
const SEED_DIR = path.resolve(__dirname, "data");
// ────────────────────────────────────────────────────────────────────────────

// Container → { file, partitionKey }
const CONTAINERS = [
  { name: "skus",                   file: "skus.json",                   pk: "/category" },
  { name: "competitors",            file: "competitors.json",            pk: "/platform" },
  { name: "daily-own-snapshots",    file: "daily-own-snapshots.json",    pk: "/skuId" },
  { name: "daily-comp-snapshots",   file: "daily-comp-snapshots.json",   pk: "/skuId" },
  { name: "weekly-own-snapshots",   file: "weekly-own-snapshots.json",   pk: "/skuId" },
  { name: "weekly-comp-snapshots",  file: "weekly-comp-snapshots.json",  pk: "/skuId" },
  { name: "monthly-own-snapshots",  file: "monthly-own-snapshots.json",  pk: "/skuId" },
  { name: "monthly-comp-snapshots", file: "monthly-comp-snapshots.json", pk: "/skuId" },
];

async function getCosmosCredentials() {
  // Try environment variables first
  let endpoint = process.env.COSMOS_ENDPOINT;
  let key = process.env.COSMOS_KEY;

  if (endpoint && key) {
    return { endpoint, key };
  }

  // Fall back to Azure CLI
  console.log("  (fetching credentials via Azure CLI...)");
  try {
    const endpointJson = execSync(
      `az cosmosdb show --name "${ACCOUNT}" --resource-group "${RG}" --query documentEndpoint -o tsv`,
      { encoding: "utf-8" }
    ).trim();

    const keyJson = execSync(
      `az cosmosdb keys list --name "${ACCOUNT}" --resource-group "${RG}" --query primaryMasterKey -o tsv`,
      { encoding: "utf-8" }
    ).trim();

    return { endpoint: endpointJson, key: keyJson };
  } catch (err) {
    console.error("ERROR: Could not retrieve Cosmos DB credentials.");
    console.error("  Either set COSMOS_ENDPOINT and COSMOS_KEY env vars,");
    console.error("  or ensure 'az login' has been run and the account exists.");
    process.exit(1);
  }
}

async function insertItems(database, containerName, filePath, partitionKeyPath) {
  const fullPath = path.join(SEED_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠ File not found: ${fullPath} (skipping)`);
    return;
  }

  const items = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  const count = items.length;
  console.log(`\n  ┌─ ${containerName} ← ${filePath} (${count} docs)`);

  const container = database.container(containerName);
  let errors = 0;
  let created = 0;

  for (let i = 0; i < count; i++) {
    try {
      await container.items.upsert(items[i]);
      created++;
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.error(`  │  Error on doc ${i}: ${err.message}`);
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  │  ... ${i + 1}/${count}`);
    }
  }

  if (errors > 0) {
    console.log(`  └─ ✓ Done (${created} created, ${errors} errors)`);
  } else {
    console.log(`  └─ ✓ Done (${count} docs)`);
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log(`║  VoltEdge — Cosmos DB Seed (Node.js)                         ║`);
  console.log(`║  Account:  ${ACCOUNT}`);
  console.log(`║  Database: ${DB}`);
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");

  // ── Get credentials ──
  const { endpoint, key } = await getCosmosCredentials();
  const client = new CosmosClient({ endpoint, key });

  // ── Ensure database exists ──
  console.log("━━━ [1/3] Creating database ━━━");
  const { database } = await client.databases.createIfNotExists({ id: DB });
  console.log(`  ✓ Database '${DB}' ready`);

  // ── Create containers ──
  console.log("\n━━━ [2/3] Creating containers ━━━");
  for (const c of CONTAINERS) {
    try {
      await database.containers.createIfNotExists({
        id: c.name,
        partitionKey: { paths: [c.pk] },
      });
      console.log(`  ✓ ${c.name} (partition: ${c.pk})`);
    } catch (err) {
      console.error(`  ✗ ${c.name}: ${err.message}`);
    }
  }

  // ── Insert seed data ──
  console.log("\n━━━ [3/3] Populating seed data ━━━");
  for (const c of CONTAINERS) {
    await insertItems(database, c.name, c.file, c.pk);
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  ✓ Seed Complete!                                            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
