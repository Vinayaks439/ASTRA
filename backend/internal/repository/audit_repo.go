package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const auditContainer = "audit-log"

type AuditDoc struct {
	ID             string `json:"id"`
	Timestamp      string `json:"timestamp"`
	SKUId          string `json:"skuId"`
	SKUName        string `json:"skuName"`
	Action         string `json:"action"`
	Type           string `json:"type"`
	WhatsAppStatus string `json:"whatsappStatus"`
	Actor          string `json:"actor"`
}

func (r *Repository) ListAuditEntries(ctx context.Context, typeFilter string, page, pageSize int) ([]AuditDoc, int, error) {
	query := "SELECT * FROM c"
	var params []azcosmos.QueryParameter
	if typeFilter != "" {
		query = "SELECT * FROM c WHERE c.type = @type"
		params = []azcosmos.QueryParameter{{Name: "@type", Value: typeFilter}}
	}

	items, err := r.queryItems(ctx, auditContainer, query, nil, params)
	if err != nil {
		return nil, 0, err
	}

	docs := make([]AuditDoc, 0, len(items))
	for _, raw := range items {
		var doc AuditDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, 0, fmt.Errorf("unmarshal audit: %w", err)
		}
		docs = append(docs, doc)
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].Timestamp > docs[j].Timestamp })

	total := len(docs)

	if pageSize > 0 {
		offset := 0
		if page > 1 {
			offset = (page - 1) * pageSize
		}
		end := offset + pageSize
		if offset > total {
			offset = total
		}
		if end > total {
			end = total
		}
		docs = docs[offset:end]
	}
	return docs, total, nil
}

func (r *Repository) GetAuditEntry(ctx context.Context, id string) (*AuditDoc, error) {
	items, err := r.queryItems(ctx, auditContainer,
		"SELECT * FROM c WHERE c.id = @id",
		nil,
		[]azcosmos.QueryParameter{{Name: "@id", Value: id}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("audit entry %s not found", id)
	}

	var doc AuditDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal audit: %w", err)
	}
	return &doc, nil
}

func (r *Repository) CreateAuditEntry(ctx context.Context, doc *AuditDoc) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal audit: %w", err)
	}
	pk := azcosmos.NewPartitionKeyString(doc.SKUId)
	return r.upsertItem(ctx, auditContainer, pk, data)
}
