# ADR-003: Backend Services — Go + gRPC

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

The backend must serve the React frontend with low-latency structured data, delegate AI-intensive work to Python agents asynchronously, and interact with Cosmos DB for persistence. A strongly-typed, high-performance RPC framework is needed.

## Decision

Use **Go 1.22+** with **gRPC** and **protobuf** for service definitions. Use **gRPC-Gateway** to expose REST/JSON endpoints for frontend compatibility.

### Service Map

```
┌─────────────────────────────────────────────────────────────┐
│                    GO gRPC BACKEND                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ SKU Service  │  │ Risk Service│  │ Recommendation Svc  │ │
│  │              │  │             │  │                     │ │
│  │ ListSKUs     │  │ GetScores   │  │ GetRecommendation   │ │
│  │ GetSKU       │  │ Recalculate │  │ ListRecommendations │ │
│  │ CreateSKU    │  │ StreamScores│  │ ExecuteAction       │ │
│  │ UpdateSKU    │  │             │  │ GeneratePO          │ │
│  │ DeleteSKU    │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Ticket Svc  │  │ Audit Svc   │  │ Settings Svc        │ │
│  │              │  │             │  │                     │ │
│  │ ListTickets  │  │ ListEntries │  │ GetSettings         │ │
│  │ GetTicket    │  │ GetEntry    │  │ UpdateSettings      │ │
│  │ ApproveTicket│  │ CreateEntry │  │ GetThresholds       │ │
│  │ RejectTicket │  │             │  │ UpdateThresholds    │ │
│  │ CreateTicket │  │             │  │ ResetDefaults       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │ Insights Svc│  │Notification │                           │
│  │              │  │ Svc         │                           │
│  │ GetSummary   │  │             │                           │
│  │ StreamAlerts │  │ SendWhatsApp│                           │
│  │              │  │ GetStatus   │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Proto Definitions

```protobuf
// proto/astra/v1/sku.proto
syntax = "proto3";
package astra.v1;

service SKUService {
  rpc ListSKUs(ListSKUsRequest) returns (ListSKUsResponse);
  rpc GetSKU(GetSKURequest) returns (SKU);
  rpc CreateSKU(CreateSKURequest) returns (SKU);
  rpc UpdateSKU(UpdateSKURequest) returns (SKU);
  rpc DeleteSKU(DeleteSKURequest) returns (google.protobuf.Empty);
}

message SKU {
  string id = 1;
  string part_no = 2;
  string part_name = 3;
  double selling_price = 4;
  double cost_price = 5;
  double profit_margin_pct = 6;
  string category = 7;
  string currency = 8;          // INR
  RiskScores risk_scores = 9;
  string band = 10;             // CRITICAL | WARNING | HEALTHY
  string agent_mode = 11;       // auto | breaches
  string top_driver = 12;
  double composite_score = 13;
  double confidence = 14;
}

message RiskScores {
  double price_gap = 1;        // 0-30
  double stock_coverage = 2;   // 0-30
  double demand_trend = 3;     // 0-20
  double margin_proximity = 4; // 0-20
}

message ListSKUsRequest {
  string search = 1;
  string band_filter = 2;      // ALL | CRITICAL | WARNING | HEALTHY
  string sort_by = 3;
  string sort_order = 4;       // asc | desc
  int32  page = 5;
  int32  page_size = 6;
}

message ListSKUsResponse {
  repeated SKU skus = 1;
  int32 total = 2;
  AggregatedCounts counts = 3;
}

message AggregatedCounts {
  int32 critical = 1;
  int32 warning = 2;
  int32 healthy = 3;
  int32 open_tickets = 4;
  int32 auto_actions = 5;
}
```

```protobuf
// proto/astra/v1/competitor.proto
syntax = "proto3";
package astra.v1;

service CompetitorService {
  rpc ListCompetitors(ListCompetitorsRequest) returns (ListCompetitorsResponse);
  rpc GetCompetitor(GetCompetitorRequest) returns (Competitor);
}

message Competitor {
  string id = 1;
  string comp_name = 2;
  string platform = 3;         // Amazon | Shopify
  string store_url = 4;
}
```

```protobuf
// proto/astra/v1/snapshot.proto
syntax = "proto3";
package astra.v1;

service SnapshotService {
  rpc GetOwnSnapshots(GetOwnSnapshotsRequest) returns (OwnSnapshotResponse);
  rpc GetCompSnapshots(GetCompSnapshotsRequest) returns (CompSnapshotResponse);
}

message OwnSnapshot {
  string id = 1;
  string sku_id = 2;
  string part_no = 3;
  string period = 4;            // date | week (2025-W39) | month (2025-10)
  double avg_price = 5;
  double min_price = 6;
  double max_price = 7;
  double avg_margin_pct = 8;
  int32  avg_stock = 9;
  double avg_velocity = 10;
  int32  total_units_sold = 11; // monthly only
  double est_revenue = 12;     // monthly only
}

message CompSnapshot {
  string id = 1;
  string competitor_id = 2;
  string comp_name = 3;
  string sku_id = 4;
  string part_no = 5;
  string platform = 6;         // Amazon | Shopify
  string period = 7;            // date | week | month
  double avg_comp_price = 8;
  double min_comp_price = 9;
  double max_comp_price = 10;
  double avg_price_gap_pct = 11;
}
```

```protobuf
// proto/astra/v1/ticket.proto
syntax = "proto3";
package astra.v1;

service TicketService {
  rpc ListTickets(ListTicketsRequest) returns (ListTicketsResponse);
  rpc GetTicket(GetTicketRequest) returns (Ticket);
  rpc CreateTicket(CreateTicketRequest) returns (Ticket);
  rpc ApproveTicket(ApproveTicketRequest) returns (Ticket);
  rpc RejectTicket(RejectTicketRequest) returns (Ticket);
}

message Ticket {
  string id = 1;
  string sku_id = 2;
  string sku_name = 3;
  string action = 4;           // PRICE_DECREASE | PRICE_INCREASE | HOLD | HOLD_REORDER
  repeated string breaches = 5;
  double composite_score = 6;
  string band = 7;
  string status = 8;           // OPEN | APPROVED | REJECTED
  string created_at = 9;
  string whatsapp_status = 10; // pending | sent | none
}
```

```protobuf
// proto/astra/v1/insights.proto
syntax = "proto3";
package astra.v1;

service InsightsService {
  rpc GetSummary(GetSummaryRequest) returns (AISummary);
  rpc StreamAlerts(StreamAlertsRequest) returns (stream Alert);
}

message AISummary {
  AggregatedCounts counts = 1;
  repeated string insights = 2;  // 3 NL insight strings from AI agent
  string generated_at = 3;
}

message Alert {
  string id = 1;
  string severity = 2;
  string message = 3;
  string sku_id = 4;
  string timestamp = 5;
}
```

```protobuf
// proto/astra/v1/recommendation.proto
syntax = "proto3";
package astra.v1;

service RecommendationService {
  rpc GetRecommendation(GetRecommendationRequest) returns (Recommendation);
  rpc ListRecommendations(ListRecommendationsRequest) returns (ListRecommendationsResponse);
  rpc ExecuteAction(ExecuteActionRequest) returns (ExecuteActionResponse);
  rpc GeneratePO(GeneratePORequest) returns (PurchaseOrder);
}

message Recommendation {
  string id = 1;
  string sku_id = 2;
  string action = 3;           // PRICE_DECREASE | PRICE_INCREASE | HOLD | HOLD_REORDER
  double suggested_price = 4;
  string rationale = 5;        // AI-generated explanation
  double confidence = 6;
  string agent_mode = 7;       // auto | breaches
}

message PurchaseOrder {
  string id = 1;
  string sku_id = 2;
  string vendor = 3;
  int32  quantity = 4;
  double estimated_cost = 5;
  string rationale = 6;
}
```

```protobuf
// proto/astra/v1/audit.proto
syntax = "proto3";
package astra.v1;

service AuditService {
  rpc ListEntries(ListEntriesRequest) returns (ListEntriesResponse);
  rpc GetEntry(GetEntryRequest) returns (AuditEntry);
}

message AuditEntry {
  string id = 1;
  string timestamp = 2;
  string sku_id = 3;
  string sku_name = 4;
  string action = 5;
  string type = 6;             // AUTONOMOUS | TICKET
  string whatsapp_status = 7;  // pending | sent | none
  string actor = 8;            // agent | user email
}
```

```protobuf
// proto/astra/v1/settings.proto
syntax = "proto3";
package astra.v1;

service SettingsService {
  rpc GetSettings(GetSettingsRequest) returns (Settings);
  rpc UpdateSettings(UpdateSettingsRequest) returns (Settings);
  rpc GetThresholds(GetThresholdsRequest) returns (Thresholds);
  rpc UpdateThresholds(UpdateThresholdsRequest) returns (Thresholds);
  rpc ResetDefaults(ResetDefaultsRequest) returns (Settings);
}

message Settings {
  string user_id = 1;
  Thresholds thresholds = 2;
  bool po_recommendations_enabled = 3;
  bool whatsapp_enabled = 4;
  string whatsapp_number = 5;
  string theme = 6;            // light | dark
}

message Thresholds {
  double price_gap = 1;        // default 24
  double stock_coverage = 2;   // default 24
  double demand_trend = 3;     // default 16
  double margin_proximity = 4; // default 16
}
```

```protobuf
// proto/astra/v1/notification.proto
syntax = "proto3";
package astra.v1;

service NotificationService {
  rpc SendWhatsApp(SendWhatsAppRequest) returns (SendWhatsAppResponse);
  rpc GetDeliveryStatus(GetDeliveryStatusRequest) returns (DeliveryStatus);
}

message SendWhatsAppRequest {
  string ticket_id = 1;
  string phone_number = 2;
  string message_body = 3;
}
```

### Backend Interaction with Agents

The Go backend delegates AI-intensive work to Python agents via **async messaging** (Azure Service Bus) and collects results:

```
Frontend ──gRPC──► Go Backend ──Service Bus──► Python Agent
                        │                          │
                        │◄─── callback / poll ─────┘
                        │
                        ▼
                   Cosmos DB
```

For low-latency paths (e.g., getting a cached AI summary), the Go backend can also call agents synchronously via their **A2A HTTP endpoints**.

## Consequences

- gRPC provides strongly-typed contracts and efficient binary serialization between frontend and backend.
- gRPC-Gateway allows REST/JSON fallback for debugging and external integrations.
- Each service maps to a bounded domain, enabling independent scaling and development.
- Async delegation to agents via Service Bus prevents backend request timeouts during AI processing.
- Proto definitions serve as the single source of truth for API contracts across teams.
