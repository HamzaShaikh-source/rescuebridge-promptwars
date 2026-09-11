/**
 * API client — typed HTTP calls to the RescueBridge backend.
 * All keys stay server-side; the browser sends zero API keys.
 */

import type {
  HealthResponse,
  IncidentRecord,
  LifecycleState,
  TriageInput,
  TriageResponse,
} from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`API ${resp.status}: ${body || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export async function runTriage(input: TriageInput): Promise<TriageResponse> {
  return request<TriageResponse>("/api/triage", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getHistory(limit = 20): Promise<IncidentRecord[]> {
  return request<IncidentRecord[]>(`/api/history?limit=${limit}`);
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function advanceLifecycle(
  incidentId: string,
  toState: LifecycleState,
  actor: string = "demo",
  evidence: string = "",
): Promise<{
  success: boolean;
  incident_id: string;
  previous_state: LifecycleState;
  new_state: LifecycleState;
  ledger: unknown[];
}> {
  return request(`/api/triage/${incidentId}/advance`, {
    method: "POST",
    body: JSON.stringify({ to_state: toState, actor, evidence }),
  });
}

export type PlaceCategory =
  | "hospital"
  | "blood_bank"
  | "pharmacy"
  | "police"
  | "fuel"
  | "ambulance";

export interface PlaceResult {
  name: string;
  category: PlaceCategory;
  address: string;
  distance_m: number;
  walk_min: number;
  drive_min: number;
  open_now_24h: boolean | null;
  phone: string | null;
  map_url: string | null;
  source: "google" | "mock";
}

export async function getPlaces(params: {
  lat: number;
  lng: number;
  category: PlaceCategory;
  limit?: number;
}): Promise<PlaceResult[]> {
  const qs = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    category: params.category,
    ...(params.limit ? { limit: String(params.limit) } : {}),
  });
  return request<PlaceResult[]>(`/api/places?${qs.toString()}`);
}

export async function getIncidentById(id: string): Promise<IncidentRecord> {
  return request<IncidentRecord>(`/api/history/${id}`);
}

export async function confirmContradiction(
  incidentId: string,
  correction: string,
): Promise<{ success: boolean; message: string }> {
  return request(`/api/triage/${incidentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ correction }),
  });
}
