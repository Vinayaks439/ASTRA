package service

import (
	"context"
	"fmt"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type SnapshotService struct {
	pb.UnimplementedSnapshotServiceServer
	repo *repository.Repository
}

func NewSnapshotService(repo *repository.Repository) *SnapshotService {
	return &SnapshotService{repo: repo}
}

func (s *SnapshotService) GetOwnSnapshots(ctx context.Context, req *pb.GetOwnSnapshotsRequest) (*pb.OwnSnapshotResponse, error) {
	gran := req.Granularity
	if gran == "" {
		gran = "daily"
	}

	docs, err := s.repo.GetOwnSnapshots(ctx, req.SkuId, gran, req.StartPeriod, req.EndPeriod)
	if err != nil {
		return nil, fmt.Errorf("get own snapshots: %w", err)
	}

	snaps := make([]*pb.OwnSnapshot, len(docs))
	for i, doc := range docs {
		snaps[i] = &pb.OwnSnapshot{
			Id:             doc.ID,
			SkuId:          doc.SKUId,
			PartNo:         doc.PartNo,
			Period:         doc.GetPeriod(),
			AvgPrice:       doc.AvgPrice,
			MinPrice:       doc.MinPrice,
			MaxPrice:       doc.MaxPrice,
			AvgMarginPct:   doc.AvgMarginPct,
			AvgStock:       int32(doc.AvgStock),
			AvgVelocity:    doc.AvgVelocity,
			TotalUnitsSold: int32(doc.TotalUnitsSold),
			EstRevenue:     doc.EstRevenue,
		}
	}

	return &pb.OwnSnapshotResponse{
		Snapshots: snaps,
		Total:     int32(len(snaps)),
	}, nil
}

func (s *SnapshotService) GetCompSnapshots(ctx context.Context, req *pb.GetCompSnapshotsRequest) (*pb.CompSnapshotResponse, error) {
	gran := req.Granularity
	if gran == "" {
		gran = "daily"
	}

	docs, err := s.repo.GetCompSnapshots(ctx, req.SkuId, req.CompetitorId, gran, req.StartPeriod, req.EndPeriod)
	if err != nil {
		return nil, fmt.Errorf("get comp snapshots: %w", err)
	}

	snaps := make([]*pb.CompSnapshot, len(docs))
	for i, doc := range docs {
		snaps[i] = &pb.CompSnapshot{
			Id:              doc.ID,
			CompetitorId:    doc.CompetitorID,
			CompName:        doc.CompName,
			SkuId:           doc.SKUId,
			PartNo:          doc.PartNo,
			Platform:        doc.Platform,
			Period:          doc.GetPeriod(),
			AvgCompPrice:    doc.AvgCompPrice,
			MinCompPrice:    doc.MinCompPrice,
			MaxCompPrice:    doc.MaxCompPrice,
			AvgPriceGapPct:  doc.AvgPriceGapPct,
		}
	}

	return &pb.CompSnapshotResponse{
		Snapshots: snaps,
		Total:     int32(len(snaps)),
	}, nil
}
