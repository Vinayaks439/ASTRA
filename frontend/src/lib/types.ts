export interface RiskScore {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

export interface CompositeRiskScore extends RiskScore {
  topDriver: 'Price Gap' | 'Stock Coverage' | 'Demand Trend' | 'Margin Proximity' | 'None';
}

export interface Sku {
  id: string;
  name: string;
  imageUrl: string;
  imageHint: string;
  inputs: {
    ownPrice: number;
    competitorPriceMin: number;
    onHandUnits: number;
    inboundUnits: number;
    dailySalesVelocity: number;
    velocity7d: number;
    velocity14d: number;
    currentMarginPct: number;
    marginFloorPct: number;
  };
  priceGapRisk: RiskScore;
  stockCoverageRisk: RiskScore;
  demandTrendRisk: RiskScore;
  marginProximityRisk: RiskScore;
  compositeRiskScore: CompositeRiskScore;
}

export interface SellerSettings {
  riskThresholds: {
    priceGap: number;
    stockCoverage: number;
    demandTrend: number;
    marginProximity: number;
  };
  riskBands: {
    healthy: number;
    warning: number;
    critical: number;
  };
  features: {
    poRecommendations: boolean;
    whatsappNotifications: boolean;
  };
  agentControls: {
    maxAutonomousPoValue: number;
  };
  whatsappNumber: string;
}
