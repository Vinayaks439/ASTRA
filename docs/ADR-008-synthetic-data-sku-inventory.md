# ADR-008: Synthetic Data — SKU Inventory

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

ASTRA requires realistic seed data for development, testing, and demo purposes. The data must cover a meaningful product catalog, competitive landscape, and time-series pricing/stock/velocity data across multiple granularities.

## Decision

Generate synthetic data for **10 VoltEdge Electronics SKUs** with **10 competitors** (5 Amazon + 5 Shopify), covering **6 months** of daily, weekly, and monthly pricing, stock, and velocity snapshots. All prices in INR.

### SKUs (10 products)

| Part No | Part Name | Selling Price | Cost Price | Margin % |
|---|---|---|---|---|
| ELE-0001 | VoltEdge Wireless Earbuds Pro | 2,499 | 1,450 | 41.98% |
| ELE-0002 | VoltEdge USB-C Hub 7-in-1 | 1,899 | 980 | 48.39% |
| ELE-0003 | VoltEdge Power Bank 20000mAh | 1,599 | 920 | 42.46% |
| ELE-0004 | VoltEdge Smart LED Desk Lamp | 2,199 | 1,150 | 47.70% |
| ELE-0005 | VoltEdge ANC Headphones | 4,999 | 2,800 | 43.99% |
| ELE-0006 | VoltEdge Mechanical Keyboard RGB | 3,499 | 1,950 | 44.27% |
| ELE-0007 | VoltEdge 1080p Webcam | 2,799 | 1,520 | 45.69% |
| ELE-0008 | VoltEdge Wireless Charger Pad | 999 | 480 | 51.95% |
| ELE-0009 | VoltEdge Bluetooth Speaker 20W | 3,299 | 1,780 | 46.04% |
| ELE-0010 | VoltEdge Laptop Stand Aluminium | 1,999 | 1,050 | 47.47% |

### Competitors (10 sellers)

| ID | Name | Platform | Store |
|---|---|---|---|
| 1 | TechNova India | Amazon | amazon.in/stores/technova |
| 2 | GadgetBazaar | Amazon | amazon.in/stores/gadgetbazaar |
| 3 | ElectroPrime | Amazon | amazon.in/stores/electroprime |
| 4 | CircuitHub Official | Amazon | amazon.in/stores/circuithub |
| 5 | DigitalDukaan | Amazon | amazon.in/stores/digitaldukaan |
| 6 | ZapStore | Shopify | zapstore.myshopify.com |
| 7 | PixelCart | Shopify | pixelcart.myshopify.com |
| 8 | ByteShop India | Shopify | byteshopindia.myshopify.com |
| 9 | NeonTech Store | Shopify | neontech.myshopify.com |
| 10 | OhmKart | Shopify | ohmkart.myshopify.com |

### Snapshot Coverage

| Granularity | Own Snapshots | Competitor Snapshots | Period |
|---|---|---|---|
| Daily | 1,820 docs (10 SKUs x 182 days) | 18,200 docs (10 SKUs x 10 comps x 182 days) | Oct 2025 – Mar 2026 |
| Weekly | 280 docs (10 SKUs x 28 weeks) | 2,800 docs (10 SKUs x 10 comps x 28 weeks) | W39 2025 – W13 2026 |
| Monthly | 60 docs (10 SKUs x 6 months) | 600 docs (10 SKUs x 10 comps x 6 months) | Oct 2025 – Mar 2026 |

### Seeding Cosmos DB

```bash
# 1. Run the setup script (creates database + containers + seeds data)
chmod +x setup-cosmosdb.sh
./setup-cosmosdb.sh

# Or seed directly with Node.js (requires COSMOS_ENDPOINT and COSMOS_KEY env vars)
node seed-cosmosdb.js
```

The seed script uses the `@azure/cosmos` SDK to upsert all ~23,780 documents from the JSON files in `data/`.

## Consequences

- 10 SKUs with 10 competitors provides a realistic but manageable dataset for development and demos.
- 6 months of daily data (182 days) generates meaningful time-series trends for risk assessment and insight generation.
- Pre-aggregated weekly and monthly snapshots reduce agent compute time for trend analysis.
- INR currency and Indian e-commerce context (Amazon.in, Shopify) align with the VoltEdge Electronics seller persona.
- The seed script is idempotent (upsert-based), allowing safe re-runs during development.
