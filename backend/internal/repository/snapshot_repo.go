package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

type OwnSnapshotDoc struct {
	ID            string  `json:"id"`
	SKUId         string  `json:"skuId"`
	PartNo        string  `json:"partNo"`
	Period        string  `json:"date,omitempty"`
	Week          string  `json:"week,omitempty"`
	Month         string  `json:"month,omitempty"`
	AvgPrice      float64 `json:"avgPrice"`
	MinPrice      float64 `json:"minPrice"`
	MaxPrice      float64 `json:"maxPrice"`
	AvgMarginPct  float64 `json:"avgMarginPct"`
	AvgStock      int     `json:"avgStock"`
	AvgVelocity   float64 `json:"avgVelocity"`
	TotalUnitsSold int    `json:"totalUnitsSold,omitempty"`
	EstRevenue    float64 `json:"estRevenue,omitempty"`
}

func (d *OwnSnapshotDoc) GetPeriod() string {
	if d.Period != "" {
		return d.Period
	}
	if d.Week != "" {
		return d.Week
	}
	return d.Month
}

type CompSnapshotDoc struct {
	ID             string  `json:"id"`
	CompetitorID   string  `json:"competitorId"`
	CompName       string  `json:"compName"`
	SKUId          string  `json:"skuId"`
	PartNo         string  `json:"partNo"`
	Platform       string  `json:"platform"`
	Period         string  `json:"date,omitempty"`
	Week           string  `json:"week,omitempty"`
	Month          string  `json:"month,omitempty"`
	AvgCompPrice   float64 `json:"avgCompPrice"`
	MinCompPrice   float64 `json:"minCompPrice"`
	MaxCompPrice   float64 `json:"maxCompPrice"`
	AvgPriceGapPct float64 `json:"avgPriceGapPct"`
}

func (d *CompSnapshotDoc) GetPeriod() string {
	if d.Period != "" {
		return d.Period
	}
	if d.Week != "" {
		return d.Week
	}
	return d.Month
}

func containerForGranularity(granularity, kind string) string {
	switch granularity {
	case "weekly":
		return fmt.Sprintf("weekly-%s-snapshots", kind)
	case "monthly":
		return fmt.Sprintf("monthly-%s-snapshots", kind)
	default:
		return fmt.Sprintf("daily-%s-snapshots", kind)
	}
}

func (r *Repository) GetOwnSnapshots(ctx context.Context, skuID, granularity, startPeriod, endPeriod string) ([]OwnSnapshotDoc, error) {
	container := containerForGranularity(granularity, "own")

	periodField := "date"
	switch granularity {
	case "weekly":
		periodField = "week"
	case "monthly":
		periodField = "month"
	}

	query := fmt.Sprintf("SELECT * FROM c WHERE c.skuId = @skuId AND c.%s >= @start AND c.%s <= @end ORDER BY c.%s",
		periodField, periodField, periodField)
	params := []azcosmos.QueryParameter{
		{Name: "@skuId", Value: skuID},
		{Name: "@start", Value: startPeriod},
		{Name: "@end", Value: endPeriod},
	}

	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, container, query, &pk, params)
	if err != nil {
		return nil, err
	}

	docs := make([]OwnSnapshotDoc, 0, len(items))
	for _, raw := range items {
		var doc OwnSnapshotDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal own snapshot: %w", err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (r *Repository) GetLatestOwnSnapshot(ctx context.Context, skuID string) (*OwnSnapshotDoc, error) {
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, "daily-own-snapshots",
		"SELECT TOP 1 * FROM c WHERE c.skuId = @skuId ORDER BY c.date DESC",
		&pk,
		[]azcosmos.QueryParameter{{Name: "@skuId", Value: skuID}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no snapshots for sku %s", skuID)
	}

	var doc OwnSnapshotDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal own snapshot: %w", err)
	}
	return &doc, nil
}

func (r *Repository) GetCompSnapshots(ctx context.Context, skuID, competitorID, granularity, startPeriod, endPeriod string) ([]CompSnapshotDoc, error) {
	container := containerForGranularity(granularity, "comp")

	periodField := "date"
	switch granularity {
	case "weekly":
		periodField = "week"
	case "monthly":
		periodField = "month"
	}

	query := fmt.Sprintf("SELECT * FROM c WHERE c.skuId = @skuId AND c.%s >= @start AND c.%s <= @end",
		periodField, periodField)
	params := []azcosmos.QueryParameter{
		{Name: "@skuId", Value: skuID},
		{Name: "@start", Value: startPeriod},
		{Name: "@end", Value: endPeriod},
	}

	if competitorID != "" {
		query += " AND c.competitorId = @compId"
		params = append(params, azcosmos.QueryParameter{Name: "@compId", Value: competitorID})
	}

	query += fmt.Sprintf(" ORDER BY c.%s", periodField)

	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, container, query, &pk, params)
	if err != nil {
		return nil, err
	}

	docs := make([]CompSnapshotDoc, 0, len(items))
	for _, raw := range items {
		var doc CompSnapshotDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal comp snapshot: %w", err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (r *Repository) GetLatestCompSnapshots(ctx context.Context, skuID string) ([]CompSnapshotDoc, error) {
	pk := azcosmos.NewPartitionKeyString(skuID)

	items, err := r.queryItems(ctx, "daily-comp-snapshots",
		"SELECT * FROM c WHERE c.skuId = @skuId ORDER BY c.date DESC",
		&pk,
		[]azcosmos.QueryParameter{{Name: "@skuId", Value: skuID}},
	)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	var latest []CompSnapshotDoc
	for _, raw := range items {
		var doc CompSnapshotDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal comp snapshot: %w", err)
		}
		if !seen[doc.CompetitorID] {
			seen[doc.CompetitorID] = true
			latest = append(latest, doc)
		}
	}
	return latest, nil
}
