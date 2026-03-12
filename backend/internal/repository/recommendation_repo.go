package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const recContainer = "recommendations"

type RecommendationDoc struct {
	ID             string  `json:"id"`
	SKUId          string  `json:"skuId"`
	Action         string  `json:"action"`
	SuggestedPrice float64 `json:"suggestedPrice"`
	Rationale      string  `json:"rationale"`
	Confidence     float64 `json:"confidence"`
	AgentMode      string  `json:"agentMode"`
	CreatedAt      string  `json:"createdAt"`
}

func (r *Repository) GetRecommendation(ctx context.Context, skuID string) (*RecommendationDoc, error) {
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, recContainer,
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
	var doc RecommendationDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal recommendation: %w", err)
	}
	return &doc, nil
}

func (r *Repository) ListRecommendations(ctx context.Context) ([]RecommendationDoc, error) {
	items, err := r.queryItems(ctx, recContainer, "SELECT * FROM c", nil, nil)
	if err != nil {
		return nil, err
	}
	docs := make([]RecommendationDoc, 0, len(items))
	for _, raw := range items {
		var doc RecommendationDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal recommendation: %w", err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}
