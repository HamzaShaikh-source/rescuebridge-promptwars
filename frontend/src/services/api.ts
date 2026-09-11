/**
 * API client — typed HTTP calls to the RescueBridge backend.
 * All keys stay server-side; the browser sends zero API keys.
 */

import type {
  HealthResponse,
  IncidentRecord,
  TriageInput,
  TriageResponse,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
