package service

import (
	"context"
	"fmt"
	"time"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type NotificationService struct {
	pb.UnimplementedNotificationServiceServer
	repo *repository.Repository
}

func NewNotificationService(repo *repository.Repository) *NotificationService {
	return &NotificationService{repo: repo}
}

func (s *NotificationService) SendWhatsApp(ctx context.Context, req *pb.SendWhatsAppRequest) (*pb.SendWhatsAppResponse, error) {
	_ = repo(s)

	msgID := fmt.Sprintf("WA-%d", time.Now().UnixMilli())

	return &pb.SendWhatsAppResponse{
		MessageId: msgID,
		Status:    "queued",
	}, nil
}

func (s *NotificationService) GetDeliveryStatus(ctx context.Context, req *pb.GetDeliveryStatusRequest) (*pb.DeliveryStatus, error) {
	return &pb.DeliveryStatus{
		MessageId:   req.MessageId,
		Status:      "pending",
		DeliveredAt: "",
	}, nil
}

func repo(s *NotificationService) *repository.Repository {
	return s.repo
}
