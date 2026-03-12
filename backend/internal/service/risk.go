package service

import (
	"context"
	"fmt"
	"math"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

func clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(v, hi))
}

func ComputeRiskScores(sku *repository.SKUDoc, ownSnap *repository.OwnSnapshotDoc, bestCompPrice float64, thresholds *repository.ThresholdsDoc) *repository.RiskScoreDoc {
	var pg, sc, dt, mp float64

	if bestCompPrice > 0 {
		gap := math.Max(0, (sku.SellingPrice-bestCompPrice)/sku.SellingPrice)
		pg = math.Round(clamp(gap/0.2, 0, 1) * 30)
	}

	if ownSnap != nil {
		vel := ownSnap.AvgVelocity
		stock := float64(ownSnap.AvgStock)
		if vel > 0 {
			doc := stock / vel
			sc = math.Round((1 - clamp(doc/60, 0, 1)) * 30)
		} else if stock == 0 {
			sc = 30
		} else {
			sc = 3
		}

		margin := ownSnap.AvgMarginPct
		floor := 10.0
		buf := margin - floor
		if buf <= 0 {
			mp = 20
		} else {
			ratio := buf / floor
			mp = math.Round((1 - clamp(ratio/0.5, 0, 1)) * 20)
		}
	}

	dt = 10 // baseline when no velocity trend data available

	composite := pg + sc + dt + mp
	band := "HEALTHY"
	if composite >= 75 {
		band = "CRITICAL"
	} else if composite >= 40 {
		band = "WARNING"
	}

	drivers := []struct {
		name  string
		score float64
		max   float64
	}{
		{"Stock Coverage", sc, 30},
		{"Price Gap", pg, 30},
		{"Margin Proximity", mp, 20},
		{"Demand Trend", dt, 20},
	}
	topDriver := "Stock Coverage"
	topRatio := 0.0
	for _, d := range drivers {
		if d.max > 0 {
			ratio := d.score / d.max
			if ratio > topRatio {
				topRatio = ratio
				topDriver = d.name
			}
		}
	}

	agentMode := "auto"
	if thresholds != nil {
		if pg > thresholds.PriceGap || sc > thresholds.StockCoverage ||
			dt > thresholds.DemandTrend || mp > thresholds.MarginProximity {
			agentMode = "breaches"
		}
	}

	return &repository.RiskScoreDoc{
		SKUId:           sku.ID,
		PriceGap:        pg,
		StockCoverage:   sc,
		DemandTrend:     dt,
		MarginProximity: mp,
		Composite:       composite,
		Band:            band,
		TopDriver:       topDriver,
		Confidence:      0.85,
		AgentMode:       agentMode,
	}
}

type RiskHelper struct {
	repo *repository.Repository
}

func NewRiskHelper(repo *repository.Repository) *RiskHelper {
	return &RiskHelper{repo: repo}
}

func (h *RiskHelper) RecalculateForSKU(ctx context.Context, skuID string) (*repository.RiskScoreDoc, error) {
	sku, err := h.repo.GetSKUByID(ctx, skuID)
	if err != nil {
		return nil, fmt.Errorf("get sku: %w", err)
	}

	snap, _ := h.repo.GetLatestOwnSnapshot(ctx, skuID)

	compSnaps, _ := h.repo.GetLatestCompSnapshots(ctx, skuID)
	bestCompPrice := 0.0
	for _, cs := range compSnaps {
		if bestCompPrice == 0 || cs.AvgCompPrice < bestCompPrice {
			bestCompPrice = cs.AvgCompPrice
		}
	}

	settings, _ := h.repo.GetSettings(ctx, "default")
	thresholds := &settings.Thresholds

	risk := ComputeRiskScores(sku, snap, bestCompPrice, thresholds)
	risk.ID = fmt.Sprintf("risk-%s", skuID)

	if err := h.repo.SaveRiskScore(ctx, risk); err != nil {
		return nil, fmt.Errorf("save risk: %w", err)
	}

	return risk, nil
}

func (h *RiskHelper) RecalculateAll(ctx context.Context) ([]*pb.SKU, error) {
	skus, err := h.repo.ListSKUs(ctx)
	if err != nil {
		return nil, err
	}

	var results []*pb.SKU
	for _, s := range skus {
		risk, _ := h.RecalculateForSKU(ctx, s.ID)
		results = append(results, docToSKU(&s, risk))
	}
	return results, nil
}
