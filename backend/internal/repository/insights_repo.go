package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const insightsContainer = "ai-insights"

type InsightsDoc struct {
	ID          string   `json:"id"`
	Insights    []string `json:"insights"`
	GeneratedAt string   `json:"generatedAt"`
}

func (r *Repository) GetLatestInsights(ctx context.Context) (*InsightsDoc, error) {
	items, err := r.queryItems(ctx, insightsContainer,
		"SELECT TOP 1 * FROM c ORDER BY c.generatedAt DESC",
		nil, nil,
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no insights available")
	}

	var doc InsightsDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal insights: %w", err)
	}
	return &doc, nil
}

func (r *Repository) SaveInsights(ctx context.Context, doc *InsightsDoc) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal insights: %w", err)
	}
	pk := azcosmos.NewPartitionKeyString("insights")
	return r.upsertItem(ctx, insightsContainer, pk, data)
}
