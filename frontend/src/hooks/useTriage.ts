/**
 * useTriage — manages triage submission state and history.
 */

import { useCallback, useEffect, useState } from "react";
import {
  advanceLifecycle as apiAdvance,
  confirmContradiction as apiConfirm,
  getHistory,
  runTriage,
} from "../services/api";
import type {
  IncidentRecord,
  LifecycleEntry,
  LifecycleState,
  TriageInput,
  TriageResponse,
} from "../types";

interface TriageState {
  loading: boolean;
  error: string | null;
  result: TriageResponse | null;
  history: IncidentRecord[];
  lifecycle: LifecycleState;
  ledger: LifecycleEntry[];
}

export function useTriage() {
  const [state, setState] = useState<TriageState>({
    loading: false,
    error: null,
    result: null,
    history: [],
    lifecycle: "DRAFT",
    ledger: [],
  });

  // Load history on mount
  useEffect(() => {
    getHistory(20)
      .then((history) => setState((s) => ({ ...s, history })))
      .catch(() => {});
  }, []);

  const submit = useCallback(async (input: TriageInput) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await runTriage(input);
      // Fetch the full record to get lifecycle + ledger
      const history = await getHistory(1);
      const record = history.find((r) => r.id === result.triage.handoff_packet.incident_id);
      setState((s) => ({
        ...s,
        loading: false,
        result,
        lifecycle: record?.lifecycle ?? "DRAFT",
        ledger: record?.ledger ?? [],
      }));
      getHistory(20)
        .then((h) => setState((s) => ({ ...s, history: h })))
        .catch(() => {});
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Triage failed",
      }));
    }
  }, []);

  const advance = useCallback(async (toState: LifecycleState) => {
    const incidentId = state.result?.triage.handoff_packet.incident_id;
    if (!incidentId) return;
    try {
      const resp = await apiAdvance(incidentId, toState, "demo", `Demo transition to ${toState}`);
      setState((s) => ({
        ...s,
        lifecycle: resp.new_state,
        ledger: resp.ledger as LifecycleEntry[],
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to advance lifecycle",
      }));
    }
  }, [state.result]);

  const confirm = useCallback(async (correction: string) => {
    const incidentId = state.result?.triage.handoff_packet.incident_id;
    if (!incidentId) return;
    try {
      await apiConfirm(incidentId, correction);
      // Refresh to get updated triage
      const updated = await getHistory(1);
      const record = updated.find((r) => r.id === incidentId);
      if (record) {
        setState((s) => ({
          ...s,
          result: { ...s.result!, triage: record.triage },
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to confirm",
      }));
    }
  }, [state.result]);

  const refreshHistory = useCallback(async () => {
    try {
      const h = await getHistory(20);
      setState((s) => ({ ...s, history: h }));
    } catch {
      /* silent — history is best-effort */
    }
  }, []);

  const clear = useCallback(() => {
    setState((s) => ({
      ...s,
      result: null,
      error: null,
      lifecycle: "DRAFT",
      ledger: [],
    }));
  }, []);

  return { ...state, submit, advance, confirm, clear, refreshHistory };
}
