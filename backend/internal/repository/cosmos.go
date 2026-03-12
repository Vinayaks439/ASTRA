package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
)

type Repository struct {
	client *azcosmos.Client
	db     string
}

func New(endpoint, key, database string) (*Repository, error) {
	if endpoint == "" || key == "" {
		return &Repository{db: database}, nil
	}

	cred, err := azcosmos.NewKeyCredential(key)
	if err != nil {
		return nil, fmt.Errorf("cosmos key credential: %w", err)
	}

	client, err := azcosmos.NewClientWithKey(endpoint, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("cosmos client: %w", err)
	}

	return &Repository{client: client, db: database}, nil
}

func (r *Repository) container(name string) (*azcosmos.ContainerClient, error) {
	if r.client == nil {
		return nil, fmt.Errorf("cosmos client not initialized (set COSMOS_ENDPOINT and COSMOS_KEY)")
	}
	cont, err := r.client.NewContainer(r.db, name)
	if err != nil {
		return nil, fmt.Errorf("container %s: %w", name, err)
	}
	return cont, nil
}

func (r *Repository) queryItems(ctx context.Context, containerName, query string, pk *azcosmos.PartitionKey, params []azcosmos.QueryParameter) ([]json.RawMessage, error) {
	cont, err := r.container(containerName)
	if err != nil {
		return nil, err
	}

	opts := &azcosmos.QueryOptions{QueryParameters: params}

	var results []json.RawMessage

	if pk != nil {
		pager := cont.NewQueryItemsPager(query, *pk, opts)
		for pager.More() {
			resp, err := pager.NextPage(ctx)
			if err != nil {
				return nil, fmt.Errorf("query %s: %w", containerName, err)
			}
			for _, item := range resp.Items {
				results = append(results, item)
			}
		}
	} else {
		pager := cont.NewQueryItemsPager(query, azcosmos.PartitionKey{}, opts)
		for pager.More() {
			resp, err := pager.NextPage(ctx)
			if err != nil {
				return nil, fmt.Errorf("query %s: %w", containerName, err)
			}
			for _, item := range resp.Items {
				results = append(results, item)
			}
		}
	}

	return results, nil
}

func (r *Repository) readItem(ctx context.Context, containerName, id string, pk azcosmos.PartitionKey) (json.RawMessage, error) {
	cont, err := r.container(containerName)
	if err != nil {
		return nil, err
	}

	resp, err := cont.ReadItem(ctx, pk, id, nil)
	if err != nil {
		return nil, fmt.Errorf("read %s/%s: %w", containerName, id, err)
	}

	return resp.Value, nil
}

func (r *Repository) upsertItem(ctx context.Context, containerName string, pk azcosmos.PartitionKey, item []byte) error {
	cont, err := r.container(containerName)
	if err != nil {
		return err
	}

	_, err = cont.UpsertItem(ctx, pk, item, nil)
	if err != nil {
		return fmt.Errorf("upsert %s: %w", containerName, err)
	}
	return nil
}

func (r *Repository) deleteItem(ctx context.Context, containerName, id string, pk azcosmos.PartitionKey) error {
	cont, err := r.container(containerName)
	if err != nil {
		return err
	}

	_, err = cont.DeleteItem(ctx, pk, id, nil)
	if err != nil {
		return fmt.Errorf("delete %s/%s: %w", containerName, id, err)
	}
	return nil
}
