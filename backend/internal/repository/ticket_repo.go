package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

const ticketContainer = "tickets"

type TicketDoc struct {
	ID             string   `json:"id"`
	SKUId          string   `json:"skuId"`
	SKUName        string   `json:"skuName"`
	Action         string   `json:"action"`
	Breaches       []string `json:"breaches"`
	CompositeScore float64  `json:"compositeScore"`
	Band           string   `json:"band"`
	Status         string   `json:"status"`
	CreatedAt      string   `json:"createdAt"`
	WhatsAppStatus string   `json:"whatsappStatus"`
}

func (r *Repository) ListTickets(ctx context.Context, statusFilter string) ([]TicketDoc, error) {
	query := "SELECT * FROM c"
	var params []azcosmos.QueryParameter
	if statusFilter != "" {
		query = "SELECT * FROM c WHERE c.status = @status"
		params = []azcosmos.QueryParameter{{Name: "@status", Value: statusFilter}}
	}

	items, err := r.queryItems(ctx, ticketContainer, query, nil, params)
	if err != nil {
		return nil, err
	}

	docs := make([]TicketDoc, 0, len(items))
	for _, raw := range items {
		var doc TicketDoc
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, fmt.Errorf("unmarshal ticket: %w", err)
		}
		docs = append(docs, doc)
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].CreatedAt > docs[j].CreatedAt })
	return docs, nil
}

func (r *Repository) GetTicket(ctx context.Context, id string) (*TicketDoc, error) {
	items, err := r.queryItems(ctx, ticketContainer,
		"SELECT * FROM c WHERE c.id = @id",
		nil,
		[]azcosmos.QueryParameter{{Name: "@id", Value: id}},
	)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("ticket %s not found", id)
	}

	var doc TicketDoc
	if err := json.Unmarshal(items[0], &doc); err != nil {
		return nil, fmt.Errorf("unmarshal ticket: %w", err)
	}
	return &doc, nil
}

func (r *Repository) CreateTicket(ctx context.Context, doc *TicketDoc) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal ticket: %w", err)
	}
	pk := azcosmos.NewPartitionKeyString(doc.SKUId)
	return r.upsertItem(ctx, ticketContainer, pk, data)
}

func (r *Repository) UpdateTicket(ctx context.Context, doc *TicketDoc) error {
	return r.CreateTicket(ctx, doc)
}

func (r *Repository) CountOpenTickets(ctx context.Context) (int, error) {
	tickets, err := r.ListTickets(ctx, "OPEN")
	if err != nil {
		return 0, err
	}
	return len(tickets), nil
}
