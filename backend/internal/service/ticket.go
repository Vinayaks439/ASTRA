package service

import (
	"context"
	"fmt"
	"time"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/repository"
)

type TicketService struct {
	pb.UnimplementedTicketServiceServer
	repo *repository.Repository
}

func NewTicketService(repo *repository.Repository) *TicketService {
	return &TicketService{repo: repo}
}

func (s *TicketService) ListTickets(ctx context.Context, req *pb.ListTicketsRequest) (*pb.ListTicketsResponse, error) {
	docs, err := s.repo.ListTickets(ctx, req.StatusFilter)
	if err != nil {
		return nil, fmt.Errorf("list tickets: %w", err)
	}

	tickets := make([]*pb.Ticket, len(docs))
	for i, doc := range docs {
		tickets[i] = ticketDocToProto(&doc)
	}

	return &pb.ListTicketsResponse{
		Tickets: tickets,
		Total:   int32(len(tickets)),
	}, nil
}

func (s *TicketService) GetTicket(ctx context.Context, req *pb.GetTicketRequest) (*pb.Ticket, error) {
	doc, err := s.repo.GetTicket(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get ticket: %w", err)
	}
	return ticketDocToProto(doc), nil
}

func (s *TicketService) CreateTicket(ctx context.Context, req *pb.CreateTicketRequest) (*pb.Ticket, error) {
	doc := &repository.TicketDoc{
		ID:             fmt.Sprintf("TKT-%d", time.Now().UnixMilli()),
		SKUId:          req.SkuId,
		SKUName:        req.SkuName,
		Action:         req.Action,
		Breaches:       req.Breaches,
		CompositeScore: req.CompositeScore,
		Band:           req.Band,
		Status:         "OPEN",
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		WhatsAppStatus: "none",
	}

	if err := s.repo.CreateTicket(ctx, doc); err != nil {
		return nil, fmt.Errorf("create ticket: %w", err)
	}

	return ticketDocToProto(doc), nil
}

func (s *TicketService) ApproveTicket(ctx context.Context, req *pb.ApproveTicketRequest) (*pb.Ticket, error) {
	doc, err := s.repo.GetTicket(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get ticket: %w", err)
	}

	doc.Status = "APPROVED"
	if err := s.repo.UpdateTicket(ctx, doc); err != nil {
		return nil, fmt.Errorf("approve ticket: %w", err)
	}

	s.repo.CreateAuditEntry(ctx, &repository.AuditDoc{
		ID:             fmt.Sprintf("AUD-%d", time.Now().UnixMilli()),
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
		SKUId:          doc.SKUId,
		SKUName:        doc.SKUName,
		Action:         doc.Action,
		Type:           "TICKET",
		WhatsAppStatus: "none",
		Actor:          req.ApprovedBy,
	})

	return ticketDocToProto(doc), nil
}

func (s *TicketService) RejectTicket(ctx context.Context, req *pb.RejectTicketRequest) (*pb.Ticket, error) {
	doc, err := s.repo.GetTicket(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("get ticket: %w", err)
	}

	doc.Status = "REJECTED"
	if err := s.repo.UpdateTicket(ctx, doc); err != nil {
		return nil, fmt.Errorf("reject ticket: %w", err)
	}

	return ticketDocToProto(doc), nil
}

func ticketDocToProto(doc *repository.TicketDoc) *pb.Ticket {
	return &pb.Ticket{
		Id:             doc.ID,
		SkuId:          doc.SKUId,
		SkuName:        doc.SKUName,
		Action:         doc.Action,
		Breaches:       doc.Breaches,
		CompositeScore: doc.CompositeScore,
		Band:           doc.Band,
		Status:         doc.Status,
		CreatedAt:      doc.CreatedAt,
		WhatsappStatus: doc.WhatsAppStatus,
	}
}
