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

// periodFieldFor returns the Cosmos DB field name used for ordering by granularity.
func periodFieldFor(period string) string {
	switch period {
	case "weekly":
		return "week"
	case "monthly":
		return "month"
	default:
		return "date"
	}
}

// GetLatestOwnSnapshotForPeriod returns the latest own snapshot for the given granularity.
// "daily" delegates to GetLatestDailyOwnSnapshot.
// "weekly"/"monthly" queries aggregate containers and maps fields to DailyOwnSnapshot.
func (r *Repository) GetLatestOwnSnapshotForPeriod(ctx context.Context, skuID, period string) (*DailyOwnSnapshot, error) {
	if period != "weekly" && period != "monthly" {
		return r.GetLatestDailyOwnSnapshot(ctx, skuID)
	}
	container := containerForGranularity(period, "own")
	field := periodFieldFor(period)
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, container,
		fmt.Sprintf("SELECT TOP 1 * FROM c WHERE c.skuId = @skuId ORDER BY c.%s DESC", field),
		&pk,
		[]azcosmos.QueryParameter{{Name: "@skuId", Value: skuID}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	var doc OwnSnapshotDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal %s own snapshot: %w", period, err)
	}
	return &DailyOwnSnapshot{
		ID:            doc.ID,
		SKUId:         doc.SKUId,
		PartNo:        doc.PartNo,
		Date:          doc.GetPeriod(),
		OnHandUnits:   doc.AvgStock,
		DailyVelocity: doc.AvgVelocity,
		Velocity7d:    doc.AvgVelocity,
		Velocity14d:   doc.AvgVelocity,
	}, nil
}

// GetLatestCompSnapshotsForPeriod returns the latest competitor snapshots for the given granularity.
// "daily" delegates to GetLatestDailyCompSnapshots.
// "weekly"/"monthly" queries aggregate containers and maps fields to DailyCompSnapshot.
func (r *Repository) GetLatestCompSnapshotsForPeriod(ctx context.Context, skuID, period string) ([]DailyCompSnapshot, error) {
	if period != "weekly" && period != "monthly" {
		return r.GetLatestDailyCompSnapshots(ctx, skuID)
	}
	container := containerForGranularity(period, "comp")
	field := periodFieldFor(period)
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, container,
		fmt.Sprintf("SELECT * FROM c WHERE c.skuId = @skuId ORDER BY c.%s DESC", field),
		&pk,
		[]azcosmos.QueryParameter{{Name: "@skuId", Value: skuID}},
	)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool)
	var latest []DailyCompSnapshot
	for _, raw := range items {
		var doc CompSnapshotDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal %s comp snapshot: %w", period, err)
		}
		if !seen[doc.CompetitorID] {
			seen[doc.CompetitorID] = true
			latest = append(latest, DailyCompSnapshot{
				ID:              doc.ID,
				CompetitorID:    doc.CompetitorID,
				CompName:        doc.CompName,
				SKUId:           doc.SKUId,
				PartNo:          doc.PartNo,
				Platform:        doc.Platform,
				Date:            doc.GetPeriod(),
				CompetitorPrice: doc.AvgCompPrice,
				PriceGapPct:     doc.AvgPriceGapPct,
			})
		}
	}
	return latest, nil
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
