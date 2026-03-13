package service

import (
	"context"
	"fmt"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type SettingsService struct {
	pb.UnimplementedSettingsServiceServer
	repo *repository.Repository
}

func NewSettingsService(repo *repository.Repository) *SettingsService {
	return &SettingsService{repo: repo}
}

func (s *SettingsService) GetSettings(ctx context.Context, req *pb.GetSettingsRequest) (*pb.Settings, error) {
	uid := req.UserId
	if uid == "" {
		uid = "default"
	}

	doc, err := s.repo.GetSettings(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}

	return settingsDocToProto(doc), nil
}

func (s *SettingsService) UpdateSettings(ctx context.Context, req *pb.UpdateSettingsRequest) (*pb.Settings, error) {
	uid := req.UserId
	if uid == "" {
		uid = "default"
	}

	doc, _ := s.repo.GetSettings(ctx, uid)
	doc.PORecommendationsEnabled = req.PoRecommendationsEnabled
	doc.WhatsAppEnabled = req.WhatsappEnabled
	doc.WhatsAppNumber = req.WhatsappNumber
	if req.Theme != "" {
		doc.Theme = req.Theme
	}

	if err := s.repo.SaveSettings(ctx, doc); err != nil {
		return nil, fmt.Errorf("save settings: %w", err)
	}

	return settingsDocToProto(doc), nil
}

func (s *SettingsService) GetThresholds(ctx context.Context, req *pb.GetThresholdsRequest) (*pb.Thresholds, error) {
	uid := req.UserId
	if uid == "" {
		uid = "default"
	}

	doc, err := s.repo.GetSettings(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("get thresholds: %w", err)
	}

	return &pb.Thresholds{
		PriceGap:        doc.Thresholds.PriceGap,
		StockCoverage:   doc.Thresholds.StockCoverage,
		DemandTrend:     doc.Thresholds.DemandTrend,
		MarginProximity: doc.Thresholds.MarginProximity,
	}, nil
}

func (s *SettingsService) UpdateThresholds(ctx context.Context, req *pb.UpdateThresholdsRequest) (*pb.Thresholds, error) {
	uid := req.UserId
	if uid == "" {
		uid = "default"
	}

	doc, _ := s.repo.GetSettings(ctx, uid)
	if req.Thresholds != nil {
		doc.Thresholds = repository.ThresholdsDoc{
			PriceGap:        req.Thresholds.PriceGap,
			StockCoverage:   req.Thresholds.StockCoverage,
			DemandTrend:     req.Thresholds.DemandTrend,
			MarginProximity: req.Thresholds.MarginProximity,
		}
	}

	if err := s.repo.SaveSettings(ctx, doc); err != nil {
		return nil, fmt.Errorf("save thresholds: %w", err)
	}

	return &pb.Thresholds{
		PriceGap:        doc.Thresholds.PriceGap,
		StockCoverage:   doc.Thresholds.StockCoverage,
		DemandTrend:     doc.Thresholds.DemandTrend,
		MarginProximity: doc.Thresholds.MarginProximity,
	}, nil
}

func (s *SettingsService) ResetDefaults(ctx context.Context, req *pb.ResetDefaultsRequest) (*pb.Settings, error) {
	uid := req.UserId
	if uid == "" {
		uid = "default"
	}

	doc := repository.DefaultSettings(uid)
	if err := s.repo.SaveSettings(ctx, doc); err != nil {
		return nil, fmt.Errorf("save default settings: %w", err)
	}

	return settingsDocToProto(doc), nil
}

func settingsDocToProto(doc *repository.SettingsDoc) *pb.Settings {
	return &pb.Settings{
		UserId: doc.UserID,
		Thresholds: &pb.Thresholds{
			PriceGap:        doc.Thresholds.PriceGap,
			StockCoverage:   doc.Thresholds.StockCoverage,
			DemandTrend:     doc.Thresholds.DemandTrend,
			MarginProximity: doc.Thresholds.MarginProximity,
		},
		PoRecommendationsEnabled: doc.PORecommendationsEnabled,
		WhatsappEnabled:          doc.WhatsAppEnabled,
		WhatsappNumber:           doc.WhatsAppNumber,
		Theme:                    doc.Theme,
	}
}
