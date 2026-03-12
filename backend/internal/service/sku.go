package service

import (
	"context"
	"fmt"
	"math"
	"strings"

	"google.golang.org/protobuf/types/known/emptypb"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type SKUService struct {
	pb.UnimplementedSKUServiceServer
	repo *repository.Repository
}

func NewSKUService(repo *repository.Repository) *SKUService {
	return &SKUService{repo: repo}
}

func (s *SKUService) ListSKUs(ctx context.Context, req *pb.ListSKUsRequest) (*pb.ListSKUsResponse, error) {
	skus, err := s.repo.ListSKUs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list skus: %w", err)
	}

	counts := &pb.AggregatedCounts{}
	var results []*pb.SKU

	for _, doc := range skus {
		risk, _ := s.repo.GetRiskScore(ctx, doc.ID)

		sku := docToSKU(&doc, risk)

		if req.Search != "" {
			q := strings.ToLower(req.Search)
			if !strings.Contains(strings.ToLower(sku.PartNo), q) &&
				!strings.Contains(strings.ToLower(sku.PartName), q) {
				continue
			}
		}

		if req.BandFilter != "" && req.BandFilter != "ALL" {
			if sku.Band != req.BandFilter {
				continue
			}
		}

		switch sku.Band {
		case "CRITICAL":
			counts.Critical++
		case "WARNING":
			counts.Warning++
		case "HEALTHY":
			counts.Healthy++
		}

		if sku.AgentMode == "auto" {
			counts.AutoActions++
		}

		results = append(results, sku)
	}

	openTickets, _ := s.repo.CountOpenTickets(ctx)
	counts.OpenTickets = int32(openTickets)

	return &pb.ListSKUsResponse{
		Skus:   results,
		Total:  int32(len(results)),
		Counts: counts,
	}, nil
}

func (s *SKUService) GetSKU(ctx context.Context, req *pb.GetSKURequest) (*pb.SKU, error) {
	doc, err := s.repo.GetSKUByID(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get sku: %w", err)
	}

	risk, _ := s.repo.GetRiskScore(ctx, doc.ID)
	return docToSKU(doc, risk), nil
}

func (s *SKUService) CreateSKU(ctx context.Context, req *pb.CreateSKURequest) (*pb.SKU, error) {
	margin := 0.0
	if req.SellingPrice > 0 {
		margin = math.Round(((req.SellingPrice-req.CostPrice)/req.SellingPrice)*10000) / 100
	}

	doc := &repository.SKUDoc{
		ID:              req.PartNo,
		PartNo:          req.PartNo,
		PartName:        req.PartName,
		SellingPrice:    req.SellingPrice,
		CostPrice:       req.CostPrice,
		ProfitMarginPct: margin,
		Category:        req.Category,
		Currency:        req.Currency,
	}

	if err := s.repo.CreateSKU(ctx, doc); err != nil {
		return nil, fmt.Errorf("create sku: %w", err)
	}

	return docToSKU(doc, nil), nil
}

func (s *SKUService) UpdateSKU(ctx context.Context, req *pb.UpdateSKURequest) (*pb.SKU, error) {
	doc, err := s.repo.GetSKUByID(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get sku for update: %w", err)
	}

	if req.PartName != "" {
		doc.PartName = req.PartName
	}
	if req.SellingPrice > 0 {
		doc.SellingPrice = req.SellingPrice
	}
	if req.CostPrice > 0 {
		doc.CostPrice = req.CostPrice
	}
	if req.Category != "" {
		doc.Category = req.Category
	}
	if doc.SellingPrice > 0 {
		doc.ProfitMarginPct = math.Round(((doc.SellingPrice-doc.CostPrice)/doc.SellingPrice)*10000) / 100
	}

	if err := s.repo.UpdateSKU(ctx, doc); err != nil {
		return nil, fmt.Errorf("update sku: %w", err)
	}

	risk, _ := s.repo.GetRiskScore(ctx, doc.ID)
	return docToSKU(doc, risk), nil
}

func (s *SKUService) DeleteSKU(ctx context.Context, req *pb.DeleteSKURequest) (*emptypb.Empty, error) {
	doc, err := s.repo.GetSKUByID(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get sku for delete: %w", err)
	}

	if err := s.repo.DeleteSKU(ctx, doc.ID, doc.Category); err != nil {
		return nil, fmt.Errorf("delete sku: %w", err)
	}
	return &emptypb.Empty{}, nil
}

func docToSKU(doc *repository.SKUDoc, risk *repository.RiskScoreDoc) *pb.SKU {
	sku := &pb.SKU{
		Id:              doc.ID,
		PartNo:          doc.PartNo,
		PartName:        doc.PartName,
		SellingPrice:    doc.SellingPrice,
		CostPrice:       doc.CostPrice,
		ProfitMarginPct: doc.ProfitMarginPct,
		Category:        doc.Category,
		Currency:        doc.Currency,
		Band:            "HEALTHY",
		AgentMode:       "auto",
	}

	if risk != nil {
		sku.RiskScores = &pb.RiskScores{
			PriceGap:        risk.PriceGap,
			StockCoverage:   risk.StockCoverage,
			DemandTrend:     risk.DemandTrend,
			MarginProximity: risk.MarginProximity,
		}
		sku.CompositeScore = risk.Composite
		sku.Band = risk.Band
		sku.TopDriver = risk.TopDriver
		sku.Confidence = risk.Confidence
		sku.AgentMode = risk.AgentMode
	}

	return sku
}
