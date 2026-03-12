package service

import (
	"context"
	"fmt"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type AuditService struct {
	pb.UnimplementedAuditServiceServer
	repo *repository.Repository
}

func NewAuditService(repo *repository.Repository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) ListEntries(ctx context.Context, req *pb.ListEntriesRequest) (*pb.ListEntriesResponse, error) {
	page := int(req.Page)
	pageSize := int(req.PageSize)
	if pageSize <= 0 {
		pageSize = 50
	}

	docs, total, err := s.repo.ListAuditEntries(ctx, req.TypeFilter, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("list audit entries: %w", err)
	}

	entries := make([]*pb.AuditEntry, len(docs))
	for i, doc := range docs {
		entries[i] = &pb.AuditEntry{
			Id:             doc.ID,
			Timestamp:      doc.Timestamp,
			SkuId:          doc.SKUId,
			SkuName:        doc.SKUName,
			Action:         doc.Action,
			Type:           doc.Type,
			WhatsappStatus: doc.WhatsAppStatus,
			Actor:          doc.Actor,
		}
	}

	return &pb.ListEntriesResponse{
		Entries: entries,
		Total:   int32(total),
	}, nil
}

func (s *AuditService) GetEntry(ctx context.Context, req *pb.GetEntryRequest) (*pb.AuditEntry, error) {
	doc, err := s.repo.GetAuditEntry(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get audit entry: %w", err)
	}

	return &pb.AuditEntry{
		Id:             doc.ID,
		Timestamp:      doc.Timestamp,
		SkuId:          doc.SKUId,
		SkuName:        doc.SKUName,
		Action:         doc.Action,
		Type:           doc.Type,
		WhatsappStatus: doc.WhatsAppStatus,
		Actor:          doc.Actor,
	}, nil
}
