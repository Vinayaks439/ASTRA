/**
 * ASTRA API client — fetches data from the Go gRPC-Gateway REST backend.
 * Falls back gracefully if the backend is unavailable.
 */

const BASE = '/api/v1';

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function put<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface SKUResponse {
  skus: any[];
  total: number;
  counts: { critical: number; warning: number; healthy: number; openTickets: number; autoActions: number };
}

export interface TicketResponse {
  tickets: any[];
  total: number;
}

export interface AuditResponse {
  entries: any[];
  total: number;
}

export interface InsightsSummary {
  counts: { critical: number; warning: number; healthy: number; openTickets: number; autoActions: number };
  insights: string[];
  generatedAt: string;
}

export const api = {
  listSKUs: (params?: { search?: string; bandFilter?: string }) =>
    get<SKUResponse>(`/skus?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getSKU: (id: string) => get<any>(`/skus/${id}`),

  listTickets: (statusFilter?: string) =>
    get<TicketResponse>(`/tickets${statusFilter ? `?statusFilter=${statusFilter}` : ''}`),

  approveTicket: (id: string, approvedBy = 'user') =>
    post<any>(`/tickets/${id}/approve`, { approvedBy }),

  rejectTicket: (id: string, rejectedBy = 'user', reason = '') =>
    post<any>(`/tickets/${id}/reject`, { rejectedBy, reason }),

  listAudit: (typeFilter?: string) =>
    get<AuditResponse>(`/audit${typeFilter ? `?typeFilter=${typeFilter}` : ''}`),

  getInsights: (forceRefresh = false) =>
    get<InsightsSummary>(`/insights/summary${forceRefresh ? '?forceRefresh=true' : ''}`),

  getSettings: (userId = 'default') =>
    get<any>(`/settings?userId=${userId}`),

  updateSettings: (settings: any) => put<any>('/settings', settings),

  getThresholds: (userId = 'default') =>
    get<any>(`/thresholds?userId=${userId}`),

  updateThresholds: (thresholds: any) =>
    put<any>('/thresholds', { userId: 'default', thresholds }),

  executeAction: (skuId: string, action: string, newPrice: number) =>
    post<any>(`/recommendations/${skuId}/execute`, { skuId, action, newPrice, executedBy: 'user' }),

  generatePO: (skuId: string) =>
    post<any>(`/recommendations/${skuId}/po`, { skuId }),

  listCompetitors: () => get<any>('/competitors'),

  getOwnSnapshots: (skuId: string, granularity = 'daily') =>
    get<any>(`/snapshots/own?skuId=${skuId}&granularity=${granularity}`),

  getCompSnapshots: (skuId: string, granularity = 'daily') =>
    get<any>(`/snapshots/comp?skuId=${skuId}&granularity=${granularity}`),
};
