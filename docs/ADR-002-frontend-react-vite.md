# ADR-002: Frontend — React / Vite

**Status:** Accepted
**Date:** 2026-03-08
**Context:** ASTRA — Autonomous Seller Trading & Risk Analytics

---

## Context

The ASTRA frontend needs to present a supply-chain command center dashboard with real-time risk scores, AI-generated insights, exception tickets, and seller configuration. The frontend is already built and defines the data contracts the backend must satisfy.

## Decision

Use **React 19** with **Vite 7**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** for the component library. The app is served from an nginx-based Container App on Azure Container Apps.

### Pages and Data Contracts

| Page / Panel | Data Consumed | Actions Emitted |
|---|---|---|
| **AI Summary Panel** | Critical/Warning/Healthy counts, open tickets, auto actions, 3 AI insight strings | Refresh insights |
| **Dashboard (SKU Table)** | List of SKUs with risk scores, pricing, stock, velocity, margin, band, agent mode | Search, filter by band, sort by score |
| **SKU Action Drawer** | Single SKU detail, recommendation, agent rationale text, confidence | Approve & Execute, Skip, Submit Ticket, Send PO |
| **Tickets Page** | Tickets list (id, skuId, action, breaches, composite, band, status, timestamp) | Approve, Reject, filter by status |
| **Audit Log** | Audit entries (id, timestamp, skuId, action, type, WhatsApp status) | Paginate, filter |
| **Settings** | Thresholds (pg, sc, dt, mp), PO toggle, WhatsApp toggle, WhatsApp number | Save, Reset |

## Consequences

- The frontend communicates with the Go backend exclusively via gRPC-Web (proxied through Envoy) and REST (via gRPC-Gateway).
- The data contracts listed above define the minimum API surface the backend must expose.
- shadcn/ui provides accessible, composable primitives without heavy runtime cost.
- Vite enables fast HMR for local development and optimized production builds.
