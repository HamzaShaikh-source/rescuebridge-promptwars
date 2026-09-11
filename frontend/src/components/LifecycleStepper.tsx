/**
 * LifecycleStepper — visual stepper showing the incident's journey through the state machine.
 * Shows: DRAFT → VERIFIED → SENT → ACKNOWLEDGED → ASSIGNED → ARRIVING → CLOSED
 * Plus failure states: NO_ACK, REJECTED, STALE_LOCATION
 */

import { useState } from "react";
import { Play, Pause } from "lucide-react";
import type { LifecycleEntry, LifecycleState } from "../types";

interface LifecycleStepperProps {
  currentState: LifecycleState;
  ledger: LifecycleEntry[];
  incidentId: string;
  onAdvance?: (toState: LifecycleState) => void;
}

const SUCCESS_STATES: LifecycleState[] = [
  "DRAFT",
  "VERIFIED",
  "SENT",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "ARRIVING",
  "CLOSED",
];

const STATE_LABELS: Record<LifecycleState, string> = {
  DRAFT: "Draft",
  VERIFIED: "Verified",
  SENT: "Sent",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  ARRIVING: "Arriving",
  CLOSED: "Closed",
  NO_ACK: "No ACK",
  REJECTED: "Rejected",
  STALE_LOCATION: "Stale Location",
};

const STATE_COLORS: Record<LifecycleState, string> = {
  DRAFT: "bg-emergency-muted",
  VERIFIED: "bg-emergency-blue",
  SENT: "bg-emergency-yellow",
  ACKNOWLEDGED: "bg-emergency-green",
  ASSIGNED: "bg-emergency-orange",
  ARRIVING: "bg-emergency-red",
  CLOSED: "bg-emergency-green",
  NO_ACK: "bg-emergency-red",
  REJECTED: "bg-emergency-red",
  STALE_LOCATION: "bg-emergency-yellow",
};

export default function LifecycleStepper({
  currentState,
  ledger,
  onAdvance,
}: LifecycleStepperProps) {
  const [simulating, setSimulating] = useState(false);

  const currentIdx = SUCCESS_STATES.indexOf(currentState);

  const startDemo = async () => {
    setSimulating(true);
    // Advance through remaining states with delays
    let idx = currentIdx;
    while (idx < SUCCESS_STATES.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
      idx++;
      onAdvance?.(SUCCESS_STATES[idx]);
    }
    setSimulating(false);
  };

  return (
    <div className="space-y-3" aria-label="Incident lifecycle">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-emergency-muted">
          Incident Lifecycle
        </h4>
        <div className="flex items-center gap-2">
          {onAdvance && currentIdx < SUCCESS_STATES.length - 1 && !simulating && (
            <button
              onClick={startDemo}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emergency-blue/20
                         text-emergency-blue text-xs font-bold min-h-touch"
              aria-label="Start demo simulation"
            >
              <Play className="w-3 h-3" />
              DEMO SIMULATION
            </button>
          )}
          {simulating && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emergency-yellow/20
                            text-emergency-yellow text-xs font-bold animate-pulse">
              <Pause className="w-3 h-3" />
              SIMULATING
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2" role="progressbar">
        {SUCCESS_STATES.map((state, i) => {
          const isPast = i < currentIdx;
          const isCurrent = state === currentState;
          const isFuture = i > currentIdx;

          return (
            <div key={state} className="flex items-center">
              <div
                className={`flex flex-col items-center min-w-[60px] ${
                  isFuture ? "opacity-30" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                              ${isCurrent ? `${STATE_COLORS[state]} text-white ring-2 ring-white/30` : ""}
                              ${isPast ? `${STATE_COLORS[state]} text-white` : ""}
                              ${isFuture ? "bg-emergency-surface2 text-emergency-muted" : ""}
                              transition-all duration-300`}
                  aria-label={`${STATE_LABELS[state]}${isCurrent ? " (current)" : ""}`}
                >
                  {isPast ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 text-center ${
                    isCurrent ? "font-bold text-white" : "text-emergency-muted"
                  }`}
                >
                  {STATE_LABELS[state]}
                </span>
              </div>
              {i < SUCCESS_STATES.length - 1 && (
                <div
                  className={`w-6 h-0.5 mx-0.5 ${
                    isPast ? "bg-emergency-green" : "bg-emergency-surface2"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Failure states shown if current */}
      {["NO_ACK", "REJECTED", "STALE_LOCATION"].includes(currentState) && (
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${STATE_COLORS[currentState]} text-white`}
          >
            {STATE_LABELS[currentState]}
          </div>
          <span className="text-xs text-emergency-muted">
            Terminal failure state
          </span>
        </div>
      )}

      {/* Ledger preview */}
      {ledger.length > 0 && (
        <details className="text-xs text-emergency-muted">
          <summary className="cursor-pointer hover:text-white min-h-touch flex items-center gap-1">
            Audit Trail ({ledger.length} entries)
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {ledger.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 py-1 border-t border-white/5">
                <span className={`${STATE_COLORS[entry.state]} text-white px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                  {entry.state}
                </span>
                <span className="text-emergency-muted/70">
                  {entry.actor} · {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.evidence && ` · ${entry.evidence}`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
