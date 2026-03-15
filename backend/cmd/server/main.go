package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/joho/godotenv"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"

	pb "github.com/astra/backend/gen/astra/v1"
	"github.com/astra/backend/internal/agent"
	"github.com/astra/backend/internal/repository"
	"github.com/astra/backend/internal/service"
)

func main() {
	_ = godotenv.Load()
	grpcPort := envOrDefault("GRPC_PORT", "50051")
	httpPort := envOrDefault("HTTP_PORT", "8080")
	cosmosEndpoint := os.Getenv("COSMOS_ENDPOINT")
	cosmosKey := os.Getenv("COSMOS_KEY")
	cosmosDB := envOrDefault("COSMOS_DATABASE", "voltedge-pricing-db")

	repo, err := repository.New(cosmosEndpoint, cosmosKey, cosmosDB)
	if err != nil {
		log.Fatalf("failed to init repository: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterSKUServiceServer(grpcServer, service.NewSKUService(repo))
	pb.RegisterCompetitorServiceServer(grpcServer, service.NewCompetitorService(repo))
	pb.RegisterSnapshotServiceServer(grpcServer, service.NewSnapshotService(repo))
	pb.RegisterTicketServiceServer(grpcServer, service.NewTicketService(repo))
	pb.RegisterAuditServiceServer(grpcServer, service.NewAuditService(repo))
	pb.RegisterInsightsServiceServer(grpcServer, service.NewInsightsService(repo))
	pb.RegisterRecommendationServiceServer(grpcServer, service.NewRecommendationService(repo))
	pb.RegisterSettingsServiceServer(grpcServer, service.NewSettingsService(repo))
	pb.RegisterNotificationServiceServer(grpcServer, service.NewNotificationService(repo))
	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen on :%s: %v", grpcPort, err)
	}

	go func() {
		log.Printf("gRPC server listening on :%s", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC serve: %v", err)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	target := fmt.Sprintf("localhost:%s", grpcPort)

	for _, reg := range []func(context.Context, *runtime.ServeMux, string, []grpc.DialOption) error{
		pb.RegisterSKUServiceHandlerFromEndpoint,
		pb.RegisterCompetitorServiceHandlerFromEndpoint,
		pb.RegisterSnapshotServiceHandlerFromEndpoint,
		pb.RegisterTicketServiceHandlerFromEndpoint,
		pb.RegisterAuditServiceHandlerFromEndpoint,
		pb.RegisterInsightsServiceHandlerFromEndpoint,
		pb.RegisterRecommendationServiceHandlerFromEndpoint,
		pb.RegisterSettingsServiceHandlerFromEndpoint,
		pb.RegisterNotificationServiceHandlerFromEndpoint,
	} {
		if err := reg(ctx, mux, target, opts); err != nil {
			log.Fatalf("failed to register gateway: %v", err)
		}
	}

	a2aClient := agent.NewA2AClient()

	topMux := http.NewServeMux()
	topMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	topMux.Handle("/api/v1/dashboard", dashboardHandler(repo))
	topMux.HandleFunc("POST /api/v1/agents/run", agentRunHandler(repo, a2aClient))
	topMux.HandleFunc("GET /api/v1/agents/status/{id}", agentStatusHandler())
	topMux.HandleFunc("GET /api/v1/notifications", notificationsHandler(repo))
	topMux.HandleFunc("GET /api/v1/agent-rationale/{skuId}", agentRationaleHandler(repo))
	topMux.HandleFunc("GET /api/v1/insights", insightsHandler(repo))
	topMux.Handle("/", mux)

	httpServer := &http.Server{
		Addr:    ":" + httpPort,
		Handler: withCORS(topMux),
	}

	go func() {
		log.Printf("HTTP/REST gateway listening on :%s", httpPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP serve: %v", err)
		}
	}()

	// Competitor data puller — runs every hour to scan the web for competitor prices.
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		log.Println("[competitor-cron] started; interval=1h")
		runCompetitorPuller(ctx, a2aClient)
		for {
			select {
			case <-ticker.C:
				runCompetitorPuller(ctx, a2aClient)
			case <-ctx.Done():
				log.Println("[competitor-cron] stopped")
				return
			}
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	grpcServer.GracefulStop()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("HTTP shutdown: %v", err)
	}
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type enrichedSKU struct {
	ID              string  `json:"id"`
	PartNo          string  `json:"partNo"`
	PartName        string  `json:"partName"`
	SellingPrice    float64 `json:"sellingPrice"`
	CostPrice       float64 `json:"costPrice"`
	ProfitMarginPct float64 `json:"profitMarginPct"`
	Category        string  `json:"category"`
	Currency        string  `json:"currency"`
	OnHandUnits     int     `json:"onHandUnits"`
	InboundUnits    int     `json:"inboundUnits"`
	DailyVelocity   float64 `json:"dailyVelocity"`
	Velocity7d      float64 `json:"velocity7d"`
	Velocity14d     float64 `json:"velocity14d"`
	CompPrice       float64 `json:"compPrice"`
	CompName        string  `json:"compName"`
	SnapshotDate    string  `json:"snapshotDate"`
	RiskPG          int     `json:"riskPG"`
	RiskSC          int     `json:"riskSC"`
	RiskDT          int     `json:"riskDT"`
	RiskMP          int     `json:"riskMP"`
	Composite       int     `json:"composite"`
	Band            string  `json:"band"`
	TopDriver       string  `json:"topDriver"`
	DaysCover       float64 `json:"daysCover"`
	AgentMode       string  `json:"agentMode"`
	Confidence      float64 `json:"confidence"`
	RiskComputedAt  string  `json:"riskComputedAt,omitempty"`
	RecAction       string  `json:"recAction,omitempty"`
	RecPrice        float64 `json:"recSuggestedPrice,omitempty"`
	RecRationale    string  `json:"recRationale,omitempty"`
	RecConfidence   float64 `json:"recConfidence,omitempty"`
	RecCreatedAt    string  `json:"recCreatedAt,omitempty"`
}

func dashboardHandler(repo *repository.Repository) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		period := r.URL.Query().Get("period")
		if period != "weekly" && period != "monthly" {
			period = "daily"
		}

		skus, err := repo.ListSKUs(ctx)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		result := make([]enrichedSKU, 0, len(skus))
		for _, sku := range skus {
			e := enrichedSKU{
				ID:              sku.ID,
				PartNo:          sku.PartNo,
				PartName:        sku.PartName,
				SellingPrice:    sku.SellingPrice,
				CostPrice:       sku.CostPrice,
				ProfitMarginPct: sku.ProfitMarginPct,
				Category:        sku.Category,
				Currency:        sku.Currency,
			}

			own, err := repo.GetLatestOwnSnapshotForPeriod(ctx, sku.ID, period)
			if err == nil && own != nil {
				e.OnHandUnits = own.OnHandUnits
				e.InboundUnits = own.InboundUnits
				e.DailyVelocity = own.DailyVelocity
				e.Velocity7d = own.Velocity7d
				e.Velocity14d = own.Velocity14d
				e.SnapshotDate = own.Date
			}

			comps, err := repo.GetLatestCompSnapshotsForPeriod(ctx, sku.ID, period)
			if err == nil && len(comps) > 0 {
				lowest := comps[0].CompetitorPrice
				name := comps[0].CompName
				for _, c := range comps[1:] {
					if c.CompetitorPrice < lowest {
						lowest = c.CompetitorPrice
						name = c.CompName
					}
				}
				e.CompPrice = lowest
				e.CompName = name
			}

			// Prefer real agent risk scores from Cosmos DB; fall back to in-Go computation
			agentRisk, _ := repo.GetRiskScore(ctx, sku.ID)
			if agentRisk != nil {
				e.RiskPG = int(agentRisk.PriceGap)
				e.RiskSC = int(agentRisk.StockCoverage)
				e.RiskDT = int(agentRisk.DemandTrend)
				e.RiskMP = int(agentRisk.MarginProximity)
				e.Composite = int(agentRisk.Composite)
				e.Band = agentRisk.Band
				e.TopDriver = agentRisk.TopDriver
				e.AgentMode = agentRisk.AgentMode
				e.Confidence = agentRisk.Confidence
				e.RiskComputedAt = agentRisk.ComputedAt
				// Compute DaysCover from snapshot data
				if e.DailyVelocity > 0 {
					e.DaysCover = math.Round(float64(e.OnHandUnits+e.InboundUnits)/e.DailyVelocity*10) / 10
				}
			} else {
				computeRisk(&e)
			}

			// Attach real recommendation from agent
			agentRec, _ := repo.GetRecommendation(ctx, sku.ID)
			if agentRec != nil {
				e.RecAction = agentRec.Action
				e.RecPrice = agentRec.SuggestedPrice
				e.RecRationale = agentRec.Rationale
				e.RecConfidence = agentRec.Confidence
				e.RecCreatedAt = agentRec.CreatedAt
			}

			result = append(result, e)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"skus": result})
	})
}

// ── Agent job tracking ──

type agentJob struct {
	ID        string   `json:"id"`
	Status    string   `json:"status"`
	StartedAt string   `json:"startedAt"`
	Results   []string `json:"results,omitempty"`
	Error     string   `json:"error,omitempty"`
}

var (
	jobsMu sync.RWMutex
	jobs   = map[string]*agentJob{}
)

func agentRunHandler(repo *repository.Repository, a2a *agent.A2AClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SKUIDs []string `json:"sku_ids"`
			Period string   `json:"period"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		period := body.Period
		if period != "weekly" && period != "monthly" {
			period = "daily"
		}

		jobID := fmt.Sprintf("job-%d", time.Now().UnixNano())
		job := &agentJob{ID: jobID, Status: "running", StartedAt: time.Now().UTC().Format(time.RFC3339)}
		jobsMu.Lock()
		jobs[jobID] = job
		jobsMu.Unlock()

		log.Printf("[agent-run] job %s started period=%s sku_ids=%v", jobID, period, body.SKUIDs)

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
			defer cancel()

			skuIDs := body.SKUIDs
			if len(skuIDs) == 0 {
				skus, err := repo.ListSKUs(ctx)
				if err != nil {
					log.Printf("[agent-run] job %s: ListSKUs failed: %v", jobID, err)
					jobsMu.Lock()
					job.Status = "failed"
					job.Error = err.Error()
					jobsMu.Unlock()
					return
				}
				for _, s := range skus {
					skuIDs = append(skuIDs, s.ID)
				}
				log.Printf("[agent-run] job %s: resolved %d SKUs", jobID, len(skuIDs))
			}

			var results []string

			// Phase 1: Risk assessment cascade (risk → recommendation → triage → notify)
			log.Printf("[agent-run] job %s: phase 1 - risk assessment (%d SKUs, period=%s)", jobID, len(skuIDs), period)
			for _, skuID := range skuIDs {
				taskID := fmt.Sprintf("run-%s-%d", skuID, time.Now().UnixNano())
				payload := map[string]interface{}{"sku_ids": []string{skuID}, "period": period}
				res, err := a2a.SendTask(ctx, "risk-assessment", taskID, payload)
				if err != nil {
					log.Printf("[agent-run] job %s: risk-assessment %s error: %v", jobID, skuID, err)
					results = append(results, fmt.Sprintf("%s: risk error: %v", skuID, err))
				} else {
					log.Printf("[agent-run] job %s: risk-assessment %s => %s", jobID, skuID, res.Status.State)
					results = append(results, fmt.Sprintf("%s: risk %s", skuID, res.Status.State))
				}
			}

			// Phase 2: Generate rationale for each SKU via LLM
			log.Printf("[agent-run] job %s: phase 2 - rationale (%d SKUs, period=%s)", jobID, len(skuIDs), period)
			for _, skuID := range skuIDs {
				taskID := fmt.Sprintf("rationale-%s-%d", skuID, time.Now().UnixNano())
				payload := map[string]interface{}{"sku_id": skuID, "period": period}
				res, err := a2a.SendTask(ctx, "rationale", taskID, payload)
				if err != nil {
					log.Printf("[agent-run] job %s: rationale %s error: %v", jobID, skuID, err)
					results = append(results, fmt.Sprintf("%s: rationale error: %v", skuID, err))
				} else {
					log.Printf("[agent-run] job %s: rationale %s => %s", jobID, skuID, res.Status.State)
					results = append(results, fmt.Sprintf("%s: rationale %s", skuID, res.Status.State))
				}
			}

			// Phase 3: Generate portfolio insights via LLM
			log.Printf("[agent-run] job %s: phase 3 - insights (period=%s)", jobID, period)
			insightsTaskID := fmt.Sprintf("insights-%d", time.Now().UnixNano())
			res, err := a2a.SendTask(ctx, "insights", insightsTaskID, map[string]interface{}{"period": period})
			if err != nil {
				log.Printf("[agent-run] job %s: insights error: %v", jobID, err)
				results = append(results, fmt.Sprintf("insights: error: %v", err))
			} else {
				log.Printf("[agent-run] job %s: insights => %s", jobID, res.Status.State)
				results = append(results, fmt.Sprintf("insights: %s", res.Status.State))
			}

			jobsMu.Lock()
			job.Status = "completed"
			job.Results = results
			jobsMu.Unlock()
			log.Printf("[agent-run] job %s: completed with %d results", jobID, len(results))
		}()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{"jobId": jobID, "status": "running"})
	}
}

func agentStatusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) > 0 {
				id = parts[len(parts)-1]
			}
		}

		jobsMu.RLock()
		job, ok := jobs[id]
		jobsMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "job not found"})
			return
		}
		json.NewEncoder(w).Encode(job)
	}
}

type notification struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	SKUId     string `json:"skuId"`
	Band      string `json:"band"`
	Timestamp string `json:"timestamp"`
	Read      bool   `json:"read"`
}

func notificationsHandler(repo *repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var notifs []notification

		tickets, _ := repo.ListTickets(ctx, "")
		for _, tk := range tickets {
			ntype := "TICKET_CREATED"
			if tk.Status == "APPROVED" {
				ntype = "TICKET_APPROVED"
			} else if tk.Status == "REJECTED" {
				ntype = "TICKET_REJECTED"
			}
			notifs = append(notifs, notification{
				ID:        "n-tk-" + tk.ID,
				Type:      ntype,
				Title:     fmt.Sprintf("Exception ticket: %s", tk.SKUName),
				Message:   strings.Join(tk.Breaches, ", "),
				SKUId:     tk.SKUId,
				Band:      tk.Band,
				Timestamp: tk.CreatedAt,
				Read:      tk.Status != "OPEN",
			})
		}

		audits, _, _ := repo.ListAuditEntries(ctx, "", 0, 0)
		for _, a := range audits {
			ntype := "AUTO_ACTION"
			if a.Type == "TICKET" {
				ntype = "TICKET_ACTION"
			}
			notifs = append(notifs, notification{
				ID:        "n-au-" + a.ID,
				Type:      ntype,
				Title:     fmt.Sprintf("%s: %s", a.Type, a.SKUName),
				Message:   a.Action,
				SKUId:     a.SKUId,
				Timestamp: a.Timestamp,
				Read:      true,
			})
		}

		sort.Slice(notifs, func(i, j int) bool { return notifs[i].Timestamp > notifs[j].Timestamp })

		if len(notifs) > 50 {
			notifs = notifs[:50]
		}

		unread := 0
		for _, n := range notifs {
			if !n.Read {
				unread++
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"notifications": notifs,
			"unreadCount":   unread,
		})
	}
}

func agentRationaleHandler(repo *repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skuID := r.PathValue("skuId")
		if skuID == "" {
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) > 0 {
				skuID = parts[len(parts)-1]
			}
		}

		ctx := r.Context()
		doc, err := repo.GetAgentDecision(ctx, "rationale-"+skuID, skuID)

		w.Header().Set("Content-Type", "application/json")
		if err != nil || doc == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"skuId": skuID, "rationale": nil, "source": "none",
			})
			return
		}

		// Content is a raw string for rationale
		var rationale string
		if err := json.Unmarshal(doc.Content, &rationale); err != nil {
			rationale = string(doc.Content)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"skuId":       skuID,
			"rationale":   rationale,
			"generatedAt": doc.GeneratedAt,
			"source":      "agent-llm",
		})
	}
}

func insightsHandler(repo *repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		doc, err := repo.GetAgentDecision(ctx, "insights-latest", "global")

		w.Header().Set("Content-Type", "application/json")
		if err != nil || doc == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"insights": nil, "source": "none",
			})
			return
		}

		// Content is a JSON array of strings
		var insights []string
		if err := json.Unmarshal(doc.Content, &insights); err != nil {
			insights = []string{string(doc.Content)}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"insights":    insights,
			"generatedAt": doc.GeneratedAt,
			"source":      "agent-llm",
		})
	}
}

func runCompetitorPuller(ctx context.Context, a2a *agent.A2AClient) {
	taskID := fmt.Sprintf("comp-pull-%d", time.Now().UnixNano())
	log.Printf("[competitor-cron] triggering task %s", taskID)
	pullCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	res, err := a2a.SendTask(pullCtx, "competitor-puller", taskID, map[string]interface{}{})
	if err != nil {
		log.Printf("[competitor-cron] task %s failed: %v", taskID, err)
		return
	}
	log.Printf("[competitor-cron] task %s completed: state=%s", taskID, res.Status.State)
}

func computeRisk(e *enrichedSKU) {
	clamp := func(v, lo, hi float64) float64 { return math.Min(math.Max(v, lo), hi) }
	rnd := func(v float64) int { return int(math.Round(v)) }

	// Price Gap /30
	if e.CompPrice > 0 {
		u := math.Max(0, (e.SellingPrice-e.CompPrice)/e.SellingPrice)
		e.RiskPG = rnd(clamp(u/0.2, 0, 1) * 30)
	}

	// Stock Coverage /30
	vel := e.DailyVelocity
	if vel <= 0 {
		if e.OnHandUnits == 0 {
			e.RiskSC = 30
		} else {
			e.RiskSC = 3
		}
		e.DaysCover = 0
	} else {
		doc := float64(e.OnHandUnits+e.InboundUnits) / vel
		e.DaysCover = math.Round(doc*10) / 10
		e.RiskSC = rnd((1 - clamp(doc/60, 0, 1)) * 30)
	}

	// Demand Trend /20
	if e.Velocity14d > 0 {
		chg := (e.Velocity7d - e.Velocity14d) / e.Velocity14d
		e.RiskDT = rnd((clamp(chg, -0.5, 0.5) + 0.5) * 20)
	} else if e.Velocity7d > 0 {
		e.RiskDT = 14
	} else {
		e.RiskDT = 10
	}

	// Margin Proximity /20 (floor = 10%)
	mFloor := 0.10
	mPct := e.ProfitMarginPct / 100
	buf := mPct - mFloor
	if buf <= 0 {
		e.RiskMP = 20
	} else {
		ratio := buf / mFloor
		e.RiskMP = rnd((1 - clamp(ratio/0.5, 0, 1)) * 20)
	}

	e.Composite = e.RiskPG + e.RiskSC + e.RiskDT + e.RiskMP
	if e.Composite >= 75 {
		e.Band = "CRITICAL"
	} else if e.Composite >= 40 {
		e.Band = "WARNING"
	} else {
		e.Band = "HEALTHY"
	}

	type driver struct {
		name  string
		score int
		max   int
	}
	drivers := []driver{
		{"Stock Coverage", e.RiskSC, 30},
		{"Price Gap", e.RiskPG, 30},
		{"Margin Proximity", e.RiskMP, 20},
		{"Demand Trend", e.RiskDT, 20},
	}
	best := drivers[0]
	for _, d := range drivers[1:] {
		if float64(d.score)/float64(d.max) > float64(best.score)/float64(best.max) {
			best = d
		}
	}
	e.TopDriver = best.name

}
