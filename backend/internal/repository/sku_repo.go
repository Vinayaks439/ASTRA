package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

type SKUDoc struct {
	ID              string  `json:"id"`
	PartNo          string  `json:"partNo"`
	PartName        string  `json:"partName"`
	SellingPrice    float64 `json:"sellingPrice"`
	CostPrice       float64 `json:"costPrice"`
	ProfitMarginPct float64 `json:"profitMarginPct"`
	Category        string  `json:"category"`
	Currency        string  `json:"currency"`
}

func (r *Repository) ListSKUs(ctx context.Context) ([]SKUDoc, error) {
	items, err := r.queryItems(ctx, "skus", "SELECT * FROM c", nil, nil)
	if err != nil {
		return nil, err
	}

	docs := make([]SKUDoc, 0, len(items))
	for _, raw := range items {
		var doc SKUDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal sku: %w", err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (r *Repository) GetSKU(ctx context.Context, id, category string) (*SKUDoc, error) {
	pk := azcosmos.NewPartitionKeyString(category)
	raw, err := r.readItem(ctx, "skus", id, pk)
	if err != nil {
		return nil, err
	}

	var doc SKUDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("unmarshal sku: %w", err)
	}
	return &doc, nil
}

func (r *Repository) GetSKUByID(ctx context.Context, id string) (*SKUDoc, error) {
	items, err := r.queryItems(ctx, "skus",
		"SELECT * FROM c WHERE c.id = @id",
		nil,
		[]azcosmos.QueryParameter{{Name: "@id", Value: id}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("sku %s not found", id)
	}

	var doc SKUDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal sku: %w", err)
	}
	return &doc, nil
}

func (r *Repository) CreateSKU(ctx context.Context, doc *SKUDoc) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal sku: %w", err)
	}
	pk := azcosmos.NewPartitionKeyString(doc.Category)
	return r.upsertItem(ctx, "skus", pk, data)
}

func (r *Repository) UpdateSKU(ctx context.Context, doc *SKUDoc) error {
	return r.CreateSKU(ctx, doc)
}

func (r *Repository) DeleteSKU(ctx context.Context, id, category string) error {
	pk := azcosmos.NewPartitionKeyString(category)
	return r.deleteItem(ctx, "skus", id, pk)
}

type CompetitorDoc struct {
	ID       string `json:"id"`
	CompName string `json:"compName"`
	Platform string `json:"platform"`
	StoreURL string `json:"storeUrl"`
}

func (r *Repository) ListCompetitors(ctx context.Context, platformFilter string) ([]CompetitorDoc, error) {
	query := "SELECT * FROM c"
	var params []azcosmos.QueryParameter
	if platformFilter != "" {
		query = "SELECT * FROM c WHERE c.platform = @platform"
		params = []azcosmos.QueryParameter{{Name: "@platform", Value: platformFilter}}
	}

	items, err := r.queryItems(ctx, "competitors", query, nil, params)
	if err != nil {
		return nil, err
	}

	docs := make([]CompetitorDoc, 0, len(items))
	for _, raw := range items {
		var doc CompetitorDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal competitor: %w", err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (r *Repository) GetCompetitor(ctx context.Context, id, platform string) (*CompetitorDoc, error) {
	pk := azcosmos.NewPartitionKeyString(platform)
	raw, err := r.readItem(ctx, "competitors", id, pk)
	if err != nil {
		return nil, err
	}

	var doc CompetitorDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("unmarshal competitor: %w", err)
	}
	return &doc, nil
}
