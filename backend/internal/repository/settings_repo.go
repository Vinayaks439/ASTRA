package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const settingsContainer = "settings"

type SettingsDoc struct {
	ID                       string       `json:"id"`
	UserID                   string       `json:"userId"`
	Thresholds               ThresholdsDoc `json:"thresholds"`
	PORecommendationsEnabled bool         `json:"poRecommendationsEnabled"`
	WhatsAppEnabled          bool         `json:"whatsappEnabled"`
	WhatsAppNumber           string       `json:"whatsappNumber"`
	Theme                    string       `json:"theme"`
}

type ThresholdsDoc struct {
	PriceGap        float64 `json:"priceGap"`
	StockCoverage   float64 `json:"stockCoverage"`
	DemandTrend     float64 `json:"demandTrend"`
	MarginProximity float64 `json:"marginProximity"`
}

var DefaultThresholds = ThresholdsDoc{
	PriceGap:        24,
	StockCoverage:   24,
	DemandTrend:     16,
	MarginProximity: 16,
}

func DefaultSettings(userID string) *SettingsDoc {
	return &SettingsDoc{
		ID:                       userID,
		UserID:                   userID,
		Thresholds:               DefaultThresholds,
		PORecommendationsEnabled: true,
		WhatsAppEnabled:          false,
		WhatsAppNumber:           "",
		Theme:                    "dark",
	}
}

func (r *Repository) GetSettings(ctx context.Context, userID string) (*SettingsDoc, error) {
	pk := azcosmos.NewPartitionKeyString(userID)
	raw, err := r.readItem(ctx, settingsContainer, userID, pk)
	if err != nil {
		return DefaultSettings(userID), nil
	}

	var doc SettingsDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("unmarshal settings: %w", err)
	}
	return &doc, nil
}

func (r *Repository) SaveSettings(ctx context.Context, doc *SettingsDoc) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}
	pk := azcosmos.NewPartitionKeyString(doc.UserID)
	return r.upsertItem(ctx, settingsContainer, pk, data)
}
