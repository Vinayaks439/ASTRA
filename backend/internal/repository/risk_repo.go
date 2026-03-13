package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const riskContainer = "risk-scores"

type RiskScoreDoc struct {
	ID              string  `json:"id"`
	SKUId           string  `json:"skuId"`
	PriceGap        float64 `json:"priceGap"`
	StockCoverage   float64 `json:"stockCoverage"`
	DemandTrend     float64 `json:"demandTrend"`
	MarginProximity float64 `json:"marginProximity"`
	Composite       float64 `json:"composite"`
	Band            string  `json:"band"`
	TopDriver       string  `json:"topDriver"`
	Confidence      float64 `json:"confidence"`
	AgentMode       string  `json:"agentMode"`
	ComputedAt      string  `json:"computedAt"`
}

func (r *Repository) SaveRiskScore(ctx context.Context, doc interface{}) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal risk score: %w", err)
	}
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	skuID, _ := m["skuId"].(string)
	if skuID == "" {
		skuID = "unknown"
	}
	pk := azcosmos.NewPartitionKeyString(skuID)
	return r.upsertItem(ctx, riskContainer, pk, data)
}

func (r *Repository) GetRiskScore(ctx context.Context, skuID string) (*RiskScoreDoc, error) {
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, riskContainer,
		"SELECT * FROM c WHERE c.skuId = @sid",
		&pk,
		[]azcosmos.QueryParameter{{Name: "@sid", Value: skuID}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	var doc RiskScoreDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal risk score: %w", err)
	}
	return &doc, nil
}
