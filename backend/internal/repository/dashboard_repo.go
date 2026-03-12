package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

type DailyOwnSnapshot struct {
	ID            string  `json:"id"`
	SKUId         string  `json:"skuId"`
	PartNo        string  `json:"partNo"`
	Date          string  `json:"date"`
	OwnPrice      float64 `json:"ownPrice"`
	CostPrice     float64 `json:"costPrice"`
	MarginPct     float64 `json:"marginPct"`
	OnHandUnits   int     `json:"onHandUnits"`
	InboundUnits  int     `json:"inboundUnits"`
	DailyVelocity float64 `json:"dailyVelocity"`
	Velocity7d    float64 `json:"velocity7d"`
	Velocity14d   float64 `json:"velocity14d"`
}

type DailyCompSnapshot struct {
	ID              string  `json:"id"`
	CompetitorID    string  `json:"competitorId"`
	CompName        string  `json:"compName"`
	SKUId           string  `json:"skuId"`
	PartNo          string  `json:"partNo"`
	Platform        string  `json:"platform"`
	Date            string  `json:"date"`
	CompetitorPrice float64 `json:"competitorPrice"`
	OurPrice        float64 `json:"ourPrice"`
	PriceGapPct     float64 `json:"priceGapPct"`
}

func (r *Repository) GetLatestDailyOwnSnapshot(ctx context.Context, skuID string) (*DailyOwnSnapshot, error) {
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
		return nil, nil
	}

	var doc DailyOwnSnapshot
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal daily own snapshot: %w", err)
	}
	return &doc, nil
}

func (r *Repository) GetLatestDailyCompSnapshots(ctx context.Context, skuID string) ([]DailyCompSnapshot, error) {
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
	var latest []DailyCompSnapshot
	for _, raw := range items {
		var doc DailyCompSnapshot
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal daily comp snapshot: %w", err)
		}
		if !seen[doc.CompetitorID] {
			seen[doc.CompetitorID] = true
			latest = append(latest, doc)
		}
	}
	return latest, nil
}
