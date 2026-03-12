package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

type A2AClient struct {
	httpClient *http.Client
	mu         sync.RWMutex
	agentURLs  map[string]string
}

type AgentCard struct {
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	URL          string       `json:"url"`
	Version      string       `json:"version"`
	Capabilities Capabilities `json:"capabilities"`
	Skills       []Skill      `json:"skills"`
}

type Capabilities struct {
	Streaming         bool `json:"streaming"`
	PushNotifications bool `json:"pushNotifications"`
}

type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	InputModes  []string `json:"inputModes"`
	OutputModes []string `json:"outputModes"`
}

type A2ATask struct {
	JSONRPC string     `json:"jsonrpc"`
	Method  string     `json:"method"`
	ID      string     `json:"id"`
	Params  TaskParams `json:"params"`
}

type TaskParams struct {
	ID      string     `json:"id"`
	Message A2AMessage `json:"message"`
}

type A2AMessage struct {
	Role  string     `json:"role"`
	Parts []TaskPart `json:"parts"`
}

type TaskPart struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
	Text string          `json:"text,omitempty"`
}

type A2AResponse struct {
	JSONRPC string     `json:"jsonrpc"`
	ID      string     `json:"id"`
	Result  TaskResult `json:"result"`
}

type TaskResult struct {
	ID        string        `json:"id"`
	Status    TaskStatus    `json:"status"`
	Artifacts []A2AArtifact `json:"artifacts,omitempty"`
}

type TaskStatus struct {
	State   string `json:"state"`
	Message string `json:"message,omitempty"`
}

type A2AArtifact struct {
	Name  string     `json:"name"`
	Parts []TaskPart `json:"parts"`
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func NewA2AClient() *A2AClient {
	return &A2AClient{
		httpClient: &http.Client{Timeout: 90 * time.Second},
		agentURLs: map[string]string{
			"risk-assessment":  envOrDefault("RISK_AGENT_URL", "http://localhost:7071"),
			"recommendation":   envOrDefault("RECOMMENDATION_AGENT_URL", "http://localhost:7072"),
			"exception-triage": envOrDefault("TRIAGE_AGENT_URL", "http://localhost:7073"),
			"rationale":        envOrDefault("RATIONALE_AGENT_URL", "http://localhost:7074"),
			"insights":         envOrDefault("INSIGHTS_AGENT_URL", "http://localhost:7075"),
			"notification":     envOrDefault("NOTIFICATION_AGENT_URL", "http://localhost:7076"),
		},
	}
}

func (c *A2AClient) RegisterAgent(name, url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.agentURLs[name] = url
}

func (c *A2AClient) DiscoverAgent(ctx context.Context, baseURL string) (*AgentCard, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/.well-known/agent.json", nil)
	if err != nil {
		return nil, fmt.Errorf("create discover request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("discover agent: %w", err)
	}
	defer resp.Body.Close()

	var card AgentCard
	if err := json.NewDecoder(resp.Body).Decode(&card); err != nil {
		return nil, fmt.Errorf("decode agent card: %w", err)
	}
	return &card, nil
}

func (c *A2AClient) SendTask(ctx context.Context, agentName string, taskID string, data interface{}) (*TaskResult, error) {
	c.mu.RLock()
	baseURL, ok := c.agentURLs[agentName]
	c.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown agent: %s", agentName)
	}

	dataJSON, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal task data: %w", err)
	}

	task := A2ATask{
		JSONRPC: "2.0",
		Method:  "tasks/send",
		ID:      taskID,
		Params: TaskParams{
			ID: taskID,
			Message: A2AMessage{
				Role: "user",
				Parts: []TaskPart{
					{Type: "data", Data: dataJSON},
				},
			},
		},
	}

	body, err := json.Marshal(task)
	if err != nil {
		return nil, fmt.Errorf("marshal task: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/a2a", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send task to %s: %w", agentName, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent %s returned %d: %s", agentName, resp.StatusCode, string(respBody))
	}

	var a2aResp A2AResponse
	if err := json.Unmarshal(respBody, &a2aResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &a2aResp.Result, nil
}
