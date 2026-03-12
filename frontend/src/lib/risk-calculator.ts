import type { RiskScore, CompositeRiskScore } from './types'

// Helper to clamp a value between a min and max
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

// 1. Price Gap Risk (0-30)
export function calculatePriceGapRisk(ownPrice: number, competitorPriceMin: number | null): RiskScore {
  if (competitorPriceMin === null || ownPrice <= 0) {
    return { score: 0, confidence: 'low', reason: 'Missing competitor price or own price.' }
  }
  const undercutPct = Math.max(0, (ownPrice - competitorPriceMin) / ownPrice)
  const priceGapNorm = clamp(undercutPct / 0.2, 0, 1)
  const score = Math.round(priceGapNorm * 30)
  return { score, confidence: 'high' }
}

// 2. Stock Coverage Risk (0-30)
export function calculateStockCoverageRisk(
  onHandUnits: number,
  inboundUnits: number,
  dailySalesVelocity: number
): RiskScore {
  if (dailySalesVelocity <= 0) {
    if (onHandUnits > 0) {
      return { score: 5, confidence: 'low', reason: 'Zero sales velocity.' }
    }
    return { score: 30, confidence: 'high', reason: 'Out of stock with zero sales velocity.' }
  }
  const daysOfCover = (onHandUnits + inboundUnits) / dailySalesVelocity
  const docNorm = clamp(daysOfCover / 60, 0, 1)
  const stockRiskInverseNorm = 1 - docNorm
  const score = Math.round(stockRiskInverseNorm * 30)
  return { score, confidence: 'high' }
}

// 3. Demand Trend Risk (0-20)
export function calculateDemandTrendRisk(velocity7d: number, velocity14d: number): RiskScore {
  if (velocity14d <= 0) {
    if (velocity7d > 0) {
      return { score: 14, confidence: 'low', reason: 'New demand spike with no baseline.' }
    }
    return { score: 0, confidence: 'low', reason: 'No sales velocity baseline.' }
  }
  const demandChangePct = (velocity7d - velocity14d) / velocity14d
  const demandChangeClamped = clamp(demandChangePct, -0.5, 0.5)
  const demandTrendNorm = (demandChangeClamped + 0.5) / 1.0
  const score = Math.round(demandTrendNorm * 20)
  return { score, confidence: 'high' }
}

// 4. Margin Proximity Risk (0-20)
export function calculateMarginProximityRisk(currentMarginPct: number, marginFloorPct: number): RiskScore {
  const marginBufferPct = currentMarginPct - marginFloorPct
  if (marginBufferPct <= 0) {
    return { score: 20, confidence: 'high', reason: 'Margin at or below floor.' }
  }
  if (marginFloorPct <= 0) {
    return { score: 0, confidence: 'high', reason: 'No margin floor set.' }
  }
  const marginBufferRatio = marginBufferPct / marginFloorPct
  const marginBufferNorm = clamp(marginBufferRatio / 0.5, 0, 1)
  const marginRiskInverseNorm = 1 - marginBufferNorm
  const score = Math.round(marginRiskInverseNorm * 20)
  return { score, confidence: 'high' }
}

// Composite Risk Score
export function calculateCompositeRiskScore(
  priceGapRisk: RiskScore,
  stockCoverageRisk: RiskScore,
  demandTrendRisk: RiskScore,
  marginProximityRisk: RiskScore
): CompositeRiskScore {
  const totalScore =
    priceGapRisk.score + stockCoverageRisk.score + demandTrendRisk.score + marginProximityRisk.score
  const score = Math.round(totalScore)

  const confidences = [
    priceGapRisk.confidence,
    stockCoverageRisk.confidence,
    demandTrendRisk.confidence,
    marginProximityRisk.confidence,
  ]
  const confidence = confidences.includes('low')
    ? 'low'
    : confidences.includes('medium')
    ? 'medium'
    : 'high'

  const scores = {
    'Price Gap': priceGapRisk.score,
    'Stock Coverage': stockCoverageRisk.score,
    'Demand Trend': demandTrendRisk.score,
    'Margin Proximity': marginProximityRisk.score,
  }

  const topDriver = (Object.keys(scores) as Array<keyof typeof scores>).reduce(
    (a, b) => (scores[a] > scores[b] ? a : b)
  , 'None');

  return {
    score,
    confidence,
    topDriver: scores[topDriver] > 0 ? topDriver : 'None',
  }
}
