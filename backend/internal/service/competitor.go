package service

import (
	"context"
	"fmt"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type CompetitorService struct {
	pb.UnimplementedCompetitorServiceServer
	repo *repository.Repository
}

func NewCompetitorService(repo *repository.Repository) *CompetitorService {
	return &CompetitorService{repo: repo}
}

func (s *CompetitorService) ListCompetitors(ctx context.Context, req *pb.ListCompetitorsRequest) (*pb.ListCompetitorsResponse, error) {
	docs, err := s.repo.ListCompetitors(ctx, req.PlatformFilter)
	if err != nil {
		return nil, fmt.Errorf("list competitors: %w", err)
	}

	comps := make([]*pb.Competitor, len(docs))
	for i, doc := range docs {
		comps[i] = &pb.Competitor{
			Id:       doc.ID,
			CompName: doc.CompName,
			Platform: doc.Platform,
			StoreUrl: doc.StoreURL,
		}
	}

	return &pb.ListCompetitorsResponse{
		Competitors: comps,
		Total:       int32(len(comps)),
	}, nil
}

func (s *CompetitorService) GetCompetitor(ctx context.Context, req *pb.GetCompetitorRequest) (*pb.Competitor, error) {
	items, err := s.repo.ListCompetitors(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("list competitors: %w", err)
	}

	for _, doc := range items {
		if doc.ID == req.Id {
			return &pb.Competitor{
				Id:       doc.ID,
				CompName: doc.CompName,
				Platform: doc.Platform,
				StoreUrl: doc.StoreURL,
			}, nil
		}
	}

	return nil, fmt.Errorf("competitor %s not found", req.Id)
}
