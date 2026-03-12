import {
  calculatePriceGapRisk,
  calculateStockCoverageRisk,
  calculateDemandTrendRisk,
  calculateMarginProximityRisk,
  calculateCompositeRiskScore,
} from './risk-calculator'
import type { Sku } from './types'

const mockSkuInputs = [
  // 1. Critical Risk: High Stock Coverage Risk
  {
    id: 'SKU-001',
    name: 'Pro-Grade Camera Drone',
    imageUrl: 'https://picsum.photos/seed/drones/200/200',
    imageHint: 'camera drone',
    inputs: {
      ownPrice: 1199.99,
      competitorPriceMin: 1189.99,
      onHandUnits: 20,
      inboundUnits: 0,
      dailySalesVelocity: 15,
      velocity7d: 105,
      velocity14d: 98,
      currentMarginPct: 0.25,
      marginFloorPct: 0.18,
    },
  },
  // 2. Critical Risk: High Price Gap & Margin Proximity
  {
    id: 'SKU-002',
    name: 'Smart Fitness Watch SE',
    imageUrl: 'https://picsum.photos/seed/smartwatch/200/200',
    imageHint: 'smart watch',
    inputs: {
      ownPrice: 249.99,
      competitorPriceMin: 199.99,
      onHandUnits: 300,
      inboundUnits: 50,
      dailySalesVelocity: 25,
      velocity7d: 175,
      velocity14d: 180,
      currentMarginPct: 0.16,
      marginFloorPct: 0.15,
    },
  },
  // 3. Warning Risk: High Demand Trend
  {
    id: 'SKU-003',
    name: 'Organic Matcha Green Tea Powder',
    imageUrl: 'https://picsum.photos/seed/tea/200/200',
    imageHint: 'matcha powder',
    inputs: {
      ownPrice: 29.99,
      competitorPriceMin: 29.5,
      onHandUnits: 150,
      inboundUnits: 200,
      dailySalesVelocity: 10,
      velocity7d: 90,
      velocity14d: 60,
      currentMarginPct: 0.4,
      marginFloorPct: 0.3,
    },
  },
  // 4. Healthy: Low Risk Across Board
  {
    id: 'SKU-004',
    name: 'Noise-Cancelling Headphones',
    imageUrl: 'https://picsum.photos/seed/headphones/200/200',
    imageHint: 'headphones',
    inputs: {
      ownPrice: 349.0,
      competitorPriceMin: 345.0,
      onHandUnits: 500,
      inboundUnits: 250,
      dailySalesVelocity: 12,
      velocity7d: 84,
      velocity14d: 80,
      currentMarginPct: 0.35,
      marginFloorPct: 0.2,
    },
  },
  // 5. Warning: Moderate Stock & Demand Risk
  {
    id: 'SKU-005',
    name: 'Ergonomic Office Chair',
    imageUrl: 'https://picsum.photos/seed/chair/200/200',
    imageHint: 'office chair',
    inputs: {
      ownPrice: 450.0,
      competitorPriceMin: 449.0,
      onHandUnits: 80,
      inboundUnits: 20,
      dailySalesVelocity: 5,
      velocity7d: 38,
      velocity14d: 30,
      currentMarginPct: 0.28,
      marginFloorPct: 0.22,
    },
  },
  // 6. Healthy: Missing Competitor Price
  {
    id: 'SKU-006',
    name: 'Hand-blown Glass Vase',
    imageUrl: 'https://picsum.photos/seed/vase/200/200',
    imageHint: 'glass vase',
    inputs: {
      ownPrice: 75.0,
      competitorPriceMin: null,
      onHandUnits: 120,
      inboundUnits: 0,
      dailySalesVelocity: 3,
      velocity7d: 21,
      velocity14d: 22,
      currentMarginPct: 0.5,
      marginFloorPct: 0.4,
    },
  },
  // 7. Critical: Margin below floor
  {
    id: 'SKU-007',
    name: 'Artisan Sourdough Bread',
    imageUrl: 'https://picsum.photos/seed/bread/200/200',
    imageHint: 'sourdough bread',
    inputs: {
      ownPrice: 8.99,
      competitorPriceMin: 8.5,
      onHandUnits: 40,
      inboundUnits: 50,
      dailySalesVelocity: 30,
      velocity7d: 210,
      velocity14d: 200,
      currentMarginPct: 0.14,
      marginFloorPct: 0.15,
    },
  },
  // 8. Warning: Balanced moderate risks
  {
    id: 'SKU-008',
    name: 'Yoga Mat Premium',
    imageUrl: 'https://picsum.photos/seed/yoga/200/200',
    imageHint: 'yoga mat',
    inputs: {
      ownPrice: 89.99,
      competitorPriceMin: 80.99,
      onHandUnits: 100,
      inboundUnits: 0,
      dailySalesVelocity: 8,
      velocity7d: 56,
      velocity14d: 50,
      currentMarginPct: 0.22,
      marginFloorPct: 0.18,
    },
  },
  // 9. Healthy: High stock, no other risks
  {
    id: 'SKU-009',
    name: 'Stainless Steel Water Bottle',
    imageUrl: 'https://picsum.photos/seed/bottle/200/200',
    imageHint: 'water bottle',
    inputs: {
      ownPrice: 24.95,
      competitorPriceMin: 24.95,
      onHandUnits: 1000,
      inboundUnits: 500,
      dailySalesVelocity: 15,
      velocity7d: 105,
      velocity14d: 105,
      currentMarginPct: 0.45,
      marginFloorPct: 0.3,
    },
  },
  // 10. Critical: Out of stock
  {
    id: 'SKU-010',
    name: 'Limited Edition Graphic Tee',
    imageUrl: 'https://picsum.photos/seed/tshirt/200/200',
    imageHint: 'graphic t-shirt',
    inputs: {
      ownPrice: 35.0,
      competitorPriceMin: 34.0,
      onHandUnits: 0,
      inboundUnits: 0,
      dailySalesVelocity: 20,
      velocity7d: 140,
      velocity14d: 150,
      currentMarginPct: 0.3,
      marginFloorPct: 0.2,
    },
  },
]

export const skus: Sku[] = mockSkuInputs.map((d) => {
  const priceGapRisk = calculatePriceGapRisk(d.inputs.ownPrice, d.inputs.competitorPriceMin)
  const stockCoverageRisk = calculateStockCoverageRisk(
    d.inputs.onHandUnits,
    d.inputs.inboundUnits,
    d.inputs.dailySalesVelocity
  )
  const demandTrendRisk = calculateDemandTrendRisk(d.inputs.velocity7d, d.inputs.velocity14d)
  const marginProximityRisk = calculateMarginProximityRisk(
    d.inputs.currentMarginPct,
    d.inputs.marginFloorPct
  )
  const compositeRiskScore = calculateCompositeRiskScore(
    priceGapRisk,
    stockCoverageRisk,
    demandTrendRisk,
    marginProximityRisk
  )

  return {
    ...d,
    priceGapRisk,
    stockCoverageRisk,
    demandTrendRisk,
    marginProximityRisk,
    compositeRiskScore,
  }
})

export async function getSkus(): Promise<Sku[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  return skus
}

export async function getSkuById(id: string): Promise<Sku | undefined> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))
  return skus.find((sku) => sku.id === id)
}
