/**
 * useTriage — manages triage submission state and history.
 */

import { useCallback, useEffect, useState } from "react";
import { getHistory, runTriage } from "../services/api";
import type { IncidentRecord, TriageInput, TriageResponse } from "../types";

interface TriageState {
  loading: boolean;
  error: string | null;
  result: TriageResponse | null;
  history: IncidentRecord[];
}

export function useTriage() {
  const [state, setState] = useState<TriageState>({
    loading: false,
    error: null,
    result: null,
    history: [],
  });

  // Load history on mount
  useEffect(() => {
    getHistory(20)
      .then((history) => setState((s) => ({ ...s, history })))
      .catch(() => {}); // Silently fail — history is non-critical
  }, []);

  const submit = useCallback(async (input: TriageInput) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await runTriage(input);
      setState((s) => ({
        ...s,
        loading: false,
        result,
      }));
      // Refresh history
      getHistory(20)
        .then((history) => setState((s) => ({ ...s, history })))
        .catch(() => {});
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Triage failed",
      }));
    }
  }, []);

  const clear = useCallback(() => {
    setState((s) => ({ ...s, result: null, error: null }));
  }, []);

  return { ...state, submit, clear };
}
