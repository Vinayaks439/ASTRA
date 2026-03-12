package service

import (
	"context"
	"fmt"
	"time"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type InsightsService struct {
	pb.UnimplementedInsightsServiceServer
	repo *repository.Repository
}

func NewInsightsService(repo *repository.Repository) *InsightsService {
	return &InsightsService{repo: repo}
}

func (s *InsightsService) GetSummary(ctx context.Context, req *pb.GetSummaryRequest) (*pb.AISummary, error) {
	if !req.ForceRefresh {
		doc, err := s.repo.GetLatestInsights(ctx)
		if err == nil {
			skus, _ := s.repo.ListSKUs(ctx)
			counts := s.computeCounts(ctx, skus)
			return &pb.AISummary{
				Counts:      counts,
				Insights:    doc.Insights,
				GeneratedAt: doc.GeneratedAt,
			}, nil
		}
	}

	skus, err := s.repo.ListSKUs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list skus for insights: %w", err)
	}

	counts := s.computeCounts(ctx, skus)
	insights := s.generateInsights(counts)

	doc := &repository.InsightsDoc{
		ID:          fmt.Sprintf("insights-%d", time.Now().Unix()),
		Insights:    insights,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.repo.SaveInsights(ctx, doc)

	return &pb.AISummary{
		Counts:      counts,
		Insights:    insights,
		GeneratedAt: doc.GeneratedAt,
	}, nil
}

func (s *InsightsService) StreamAlerts(_ *pb.StreamAlertsRequest, stream pb.InsightsService_StreamAlertsServer) error {
	return fmt.Errorf("streaming not yet implemented")
}

func (s *InsightsService) computeCounts(ctx context.Context, skus []repository.SKUDoc) *pb.AggregatedCounts {
	counts := &pb.AggregatedCounts{}
	for _, sku := range skus {
		risk, _ := s.repo.GetRiskScore(ctx, sku.ID)
		if risk == nil {
			counts.Healthy++
			continue
		}
		switch risk.Band {
		case "CRITICAL":
			counts.Critical++
		case "WARNING":
			counts.Warning++
		default:
			counts.Healthy++
		}
		if risk.AgentMode == "auto" {
			counts.AutoActions++
		}
	}
	open, _ := s.repo.CountOpenTickets(ctx)
	counts.OpenTickets = int32(open)
	return counts
}

func (s *InsightsService) generateInsights(counts *pb.AggregatedCounts) []string {
	insights := make([]string, 0, 3)
	total := counts.Critical + counts.Warning + counts.Healthy

	if counts.Critical > 0 {
		insights = append(insights, fmt.Sprintf(
			"%d of %d SKUs are in CRITICAL risk band — immediate pricing review recommended.",
			counts.Critical, total))
	}

	if counts.OpenTickets > 0 {
		insights = append(insights, fmt.Sprintf(
			"%d exception tickets require human approval before agent actions can proceed.",
			counts.OpenTickets))
	}

	if counts.AutoActions > 0 {
		insights = append(insights, fmt.Sprintf(
			"%d SKUs are operating autonomously within configured guardrails.",
			counts.AutoActions))
	}

	for len(insights) < 3 {
		insights = append(insights, fmt.Sprintf(
			"Monitoring %d SKUs across all risk bands. System operating normally.",
			total))
	}

	return insights[:3]
}
