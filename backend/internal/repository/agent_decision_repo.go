package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const agentDecisionContainer = "agent-decisions"

type AgentDecisionDoc struct {
	ID          string          `json:"id"`
	SKUId       string          `json:"skuId"`
	Type        string          `json:"type"`
	Content     json.RawMessage `json:"content"`
	GeneratedAt string          `json:"generatedAt"`
}

func (r *Repository) GetAgentDecision(ctx context.Context, id string, skuID string) (*AgentDecisionDoc, error) {
	pk := azcosmos.NewPartitionKeyString(skuID)
	items, err := r.queryItems(ctx, agentDecisionContainer,
		"SELECT * FROM c WHERE c.id = @id",
		&pk,
		[]azcosmos.QueryParameter{{Name: "@id", Value: id}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	var doc AgentDecisionDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal agent decision: %w", err)
	}
	return &doc, nil
}
