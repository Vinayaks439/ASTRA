# ADR-007: Database Schema — Azure Cosmos DB

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA needs a scalable, low-latency database to store SKU catalogs, competitor profiles, and time-series pricing/stock/velocity snapshots at daily, weekly, and monthly granularity. The data model must support efficient partition-based queries from both the Go backend and Python agents via MCP.

## Decision

Use **Azure Cosmos DB** (NoSQL API, Serverless tier) with the database name `voltedge-pricing-db` and eight containers partitioned for optimal query performance.

### Container Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    AZURE COSMOS DB — voltedge-pricing-db                  │
│                                                                          │
│  ┌──────────────────────┐       ┌──────────────────────────────────────┐ │
│  │  skus                 │       │  competitors                        │ │
│  │  PK: /category        │       │  PK: /platform                     │ │
│  │  10 docs              │       │  10 docs                           │ │
│  │                       │       │                                    │ │
│  │  id, partNo,          │       │  id, compName, platform, storeUrl  │ │
│  │  partName,            │       └──────────────────────────────────────┘ │
│  │  sellingPrice,        │                                               │
│  │  costPrice,           │       ┌──────────────────────────────────────┐ │
│  │  profitMarginPct,     │       │  daily-own-snapshots                │ │
│  │  category, currency   │       │  PK: /skuId       1,820 docs       │ │
│  └──────────────────────┘       │                                    │ │
│                                  │  id, skuId, partNo, date,          │ │
│  ┌──────────────────────┐       │  avgPrice, minPrice, maxPrice,     │ │
│  │  daily-comp-snapshots │       │  avgMarginPct, avgStock,           │ │
│  │  PK: /skuId           │       │  avgVelocity                      │ │
│  │  18,200 docs          │       └──────────────────────────────────────┘ │
│  │                       │                                               │
│  │  id, competitorId,    │       ┌──────────────────────────────────────┐ │
│  │  compName, skuId,     │       │  weekly-own-snapshots               │ │
│  │  partNo, platform,    │       │  PK: /skuId       280 docs         │ │
│  │  date, avgCompPrice,  │       │                                    │ │
│  │  minCompPrice,        │       │  id, skuId, partNo, week,          │ │
│  │  maxCompPrice,        │       │  avgPrice, minPrice, maxPrice,     │ │
│  │  avgPriceGapPct       │       │  avgMarginPct, avgStock,           │ │
│  └──────────────────────┘       │  avgVelocity                      │ │
│                                  └──────────────────────────────────────┘ │
│  ┌──────────────────────┐                                                │
│  │  weekly-comp-snapshots│       ┌──────────────────────────────────────┐ │
│  │  PK: /skuId           │       │  monthly-own-snapshots              │ │
│  │  2,800 docs           │       │  PK: /skuId       60 docs          │ │
│  │                       │       │                                    │ │
│  │  id, competitorId,    │       │  id, skuId, partNo, month,         │ │
│  │  compName, skuId,     │       │  avgPrice, minPrice, maxPrice,     │ │
│  │  partNo, platform,    │       │  avgMarginPct, avgStock,           │ │
│  │  week, avgCompPrice,  │       │  avgVelocity, totalUnitsSold,      │ │
│  │  minCompPrice,        │       │  estRevenue                        │ │
│  │  maxCompPrice,        │       └──────────────────────────────────────┘ │
│  │  avgPriceGapPct       │                                               │
│  └──────────────────────┘       ┌──────────────────────────────────────┐ │
│                                  │  monthly-comp-snapshots             │ │
│                                  │  PK: /skuId       600 docs         │ │
│                                  │                                    │ │
│                                  │  id, competitorId, compName,       │ │
│                                  │  skuId, partNo, platform, month,   │ │
│                                  │  avgCompPrice, minCompPrice,       │ │
│                                  │  maxCompPrice, avgPriceGapPct      │ │
│                                  └──────────────────────────────────────┘ │
│                                                                          │
│  Total: ~23,780 documents          Period: Oct 2025 – Mar 2026           │
│  Currency: INR                     SKUs: 10 (VoltEdge Electronics)       │
│  Competitors: 10 (5 Amazon + 5 Shopify)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Container Definitions

| Container | Partition Key | Documents | Description |
|---|---|---|---|
| `skus` | `/category` | 10 | Product catalog — VoltEdge Electronics SKUs |
| `competitors` | `/platform` | 10 | Competitor profiles (Amazon & Shopify sellers) |
| `daily-own-snapshots` | `/skuId` | 1,820 | Daily own pricing, stock, velocity snapshots |
| `daily-comp-snapshots` | `/skuId` | 18,200 | Daily competitor price observations |
| `weekly-own-snapshots` | `/skuId` | 280 | Weekly aggregated own performance |
| `weekly-comp-snapshots` | `/skuId` | 2,800 | Weekly aggregated competitor pricing |
| `monthly-own-snapshots` | `/skuId` | 60 | Monthly own performance with revenue |
| `monthly-comp-snapshots` | `/skuId` | 600 | Monthly competitor price aggregates |

### Sample Documents

**SKU document:**
```json
{
  "id": "1",
  "partNo": "ELE-0001",
  "partName": "VoltEdge Wireless Earbuds Pro",
  "sellingPrice": 2499.0,
  "costPrice": 1450.0,
  "profitMarginPct": 41.98,
  "category": "Electronics",
  "currency": "INR"
}
```

**Competitor document:**
```json
{
  "id": "1",
  "compName": "TechNova India",
  "platform": "Amazon",
  "storeUrl": "amazon.in/stores/technova"
}
```

**Monthly own snapshot document:**
```json
{
  "id": "1",
  "skuId": "1",
  "partNo": "ELE-0001",
  "month": "2025-10",
  "avgPrice": 2437.51,
  "minPrice": 2319.83,
  "maxPrice": 2518.69,
  "avgMarginPct": 40.48,
  "avgStock": 7,
  "avgVelocity": 37.97,
  "totalUnitsSold": 1177,
  "estRevenue": 2868949.27
}
```

**Monthly competitor snapshot document:**
```json
{
  "id": "1",
  "competitorId": "1",
  "compName": "TechNova India",
  "skuId": "1",
  "partNo": "ELE-0001",
  "platform": "Amazon",
  "month": "2025-10",
  "avgCompPrice": 2168.01,
  "minCompPrice": 1950.68,
  "maxCompPrice": 2415.85,
  "avgPriceGapPct": 11.07
}
```

## Consequences

- Partitioning by `/skuId` on snapshot containers ensures all time-series data for a given SKU is co-located, enabling efficient single-partition queries.
- Partitioning `skus` by `/category` and `competitors` by `/platform` aligns with the most frequent filter patterns.
- Serverless tier eliminates provisioned throughput costs — ideal for bursty agent-triggered read/write patterns.
- Separate containers per granularity (daily/weekly/monthly) and ownership (own/competitor) avoids complex cross-partition queries.
- Document count (~23,780) is manageable for Serverless with continuous backup (7-day retention).
