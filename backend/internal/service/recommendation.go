package service

import (
	"context"
	"fmt"
	"math"
	"time"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type RecommendationService struct {
	pb.UnimplementedRecommendationServiceServer
	repo *repository.Repository
}

func NewRecommendationService(repo *repository.Repository) *RecommendationService {
	return &RecommendationService{repo: repo}
}

func (s *RecommendationService) GetRecommendation(ctx context.Context, req *pb.GetRecommendationRequest) (*pb.Recommendation, error) {
	doc, err := s.repo.GetRecommendation(ctx, req.SkuId)
	if err != nil {
		return nil, fmt.Errorf("get recommendation: %w", err)
	}
	return recDocToProto(doc), nil
}

func (s *RecommendationService) ListRecommendations(ctx context.Context, req *pb.ListRecommendationsRequest) (*pb.ListRecommendationsResponse, error) {
	docs, err := s.repo.ListRecommendations(ctx)
	if err != nil {
		return nil, fmt.Errorf("list recommendations: %w", err)
	}

	recs := make([]*pb.Recommendation, len(docs))
	for i, doc := range docs {
		recs[i] = recDocToProto(&doc)
	}

	return &pb.ListRecommendationsResponse{
		Recommendations: recs,
		Total:           int32(len(recs)),
	}, nil
}

func (s *RecommendationService) ExecuteAction(ctx context.Context, req *pb.ExecuteActionRequest) (*pb.ExecuteActionResponse, error) {
	sku, err := s.repo.GetSKUByID(ctx, req.SkuId)
	if err != nil {
		return nil, fmt.Errorf("get sku: %w", err)
	}

	if req.NewPrice > 0 {
		sku.SellingPrice = req.NewPrice
		if sku.SellingPrice > 0 {
			sku.ProfitMarginPct = math.Round(((sku.SellingPrice-sku.CostPrice)/sku.SellingPrice)*10000) / 100
		}
		if err := s.repo.UpdateSKU(ctx, sku); err != nil {
			return nil, fmt.Errorf("update sku price: %w", err)
		}
	}

	auditID := fmt.Sprintf("AUD-%d", time.Now().UnixMilli())
	s.repo.CreateAuditEntry(ctx, &repository.AuditDoc{
		ID:             auditID,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
		SKUId:          sku.ID,
		SKUName:        sku.PartName,
		Action:         req.Action,
		Type:           "AUTONOMOUS",
		WhatsAppStatus: "none",
		Actor:          req.ExecutedBy,
	})

	return &pb.ExecuteActionResponse{
		Success:      true,
		AuditEntryId: auditID,
		Message:      fmt.Sprintf("Action %s executed for %s", req.Action, sku.PartNo),
	}, nil
}

func (s *RecommendationService) GeneratePO(ctx context.Context, req *pb.GeneratePORequest) (*pb.PurchaseOrder, error) {
	sku, err := s.repo.GetSKUByID(ctx, req.SkuId)
	if err != nil {
		return nil, fmt.Errorf("get sku: %w", err)
	}

	snap, _ := s.repo.GetLatestOwnSnapshot(ctx, req.SkuId)

	qty := int32(100) // default
	if req.QuantityOverride > 0 {
		qty = req.QuantityOverride
	} else if snap != nil && snap.AvgVelocity > 0 {
		qty = int32(math.Ceil(snap.AvgVelocity * 30))
	}

	return &pb.PurchaseOrder{
		Id:            fmt.Sprintf("PO-%d", time.Now().UnixMilli()),
		SkuId:         sku.ID,
		Vendor:        "VoltEdge Supply",
		Quantity:      qty,
		EstimatedCost: float64(qty) * sku.CostPrice,
		Rationale:     fmt.Sprintf("Reorder %d units of %s based on 30-day velocity projection", qty, sku.PartName),
	}, nil
}

func recDocToProto(doc *repository.RecommendationDoc) *pb.Recommendation {
	return &pb.Recommendation{
		Id:             doc.ID,
		SkuId:          doc.SKUId,
		Action:         doc.Action,
		SuggestedPrice: doc.SuggestedPrice,
		Rationale:      doc.Rationale,
		Confidence:     doc.Confidence,
		AgentMode:      doc.AgentMode,
	}
}
