/**
 * TriageContext — shared triage/history/profile state across all routes.
 */

import { createContext, useContext } from "react";
import type {
  IncidentRecord,
  LifecycleEntry,
  LifecycleState,
  TriageInput,
  TriageResponse,
} from "../types";
import type { useProfile } from "../hooks/useProfile";

export interface TriageContextValue {
  loading: boolean;
  error: string | null;
  result: TriageResponse | null;
  history: IncidentRecord[];
  lifecycle: LifecycleState;
  ledger: LifecycleEntry[];
  submit: (input: TriageInput) => Promise<void>;
  advance: (toState: LifecycleState) => Promise<void>;
  confirm: (correction: string) => Promise<void>;
  clear: () => void;
  refreshHistory: () => Promise<void>;
  profile: ReturnType<typeof useProfile>;
}

export const TriageContext = createContext<TriageContextValue | null>(null);

export function useTriageContext(): TriageContextValue {
  const ctx = useContext(TriageContext);
  if (!ctx) throw new Error("useTriageContext must be used inside <TriageProvider>");
  return ctx;
}