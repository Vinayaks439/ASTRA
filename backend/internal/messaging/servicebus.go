package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus"
)

type Publisher struct {
	client *azservicebus.Client
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

func NewPublisher(connectionString string) (*Publisher, error) {
	if connectionString == "" {
		log.Println("WARNING: Service Bus connection string not set, messages will be logged only")
		return &Publisher{}, nil
	}

	client, err := azservicebus.NewClientFromConnectionString(connectionString, nil)
	if err != nil {
		return nil, fmt.Errorf("service bus client: %w", err)
	}

	return &Publisher{client: client}, nil
}

func (p *Publisher) Publish(ctx context.Context, queue string, msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	if p.client == nil {
		log.Printf("[ServiceBus-DryRun] queue=%s type=%s payload_bytes=%d", queue, msg.Type, len(data))
		return nil
	}

	sender, err := p.client.NewSender(queue, nil)
	if err != nil {
		return fmt.Errorf("create sender for %s: %w", queue, err)
	}
	defer sender.Close(ctx)

	sbMsg := &azservicebus.Message{
		Body: data,
	}

	if err := sender.SendMessage(ctx, sbMsg, nil); err != nil {
		return fmt.Errorf("send to %s: %w", queue, err)
	}

	return nil
}

func (p *Publisher) Close(ctx context.Context) error {
	if p.client != nil {
		return p.client.Close(ctx)
	}
	return nil
}
