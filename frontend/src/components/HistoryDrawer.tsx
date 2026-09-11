/**
 * HistoryDrawer — slide-in panel showing recent incident history.
 * Uses the /api/history endpoint data.
 */

import { useState } from "react";
import { Clock, ChevronRight, X } from "lucide-react";
import type { IncidentRecord } from "../types";

interface HistoryDrawerProps {
  history: IncidentRecord[];
  onSelect: (record: IncidentRecord) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  P1_CRITICAL: "text-emergency-red",
  P2_SERIOUS: "text-emergency-orange",
  P3_MODERATE: "text-emergency-yellow",
  P4_LOW: "text-emergency-green",
};

const VERIFICATION_ICONS: Record<string, string> = {
  VERIFIED: "✓",
  PARTIAL: "~",
  CONFLICT: "!",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HistoryDrawer({ history, onSelect }: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-full"
        aria-label="Open incident history"
        aria-expanded={open}
      >
        <Clock className="w-5 h-5" />
        <span>Incident History ({history.length})</span>
        <ChevronRight className="w-5 h-5 ml-auto" />
      </button>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Incident history">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-emergency-surface h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-emergency-surface border-b border-white/10 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Incident History</h2>
              <button
                onClick={() => setOpen(false)}
                className="min-h-touch min-w-touch flex items-center justify-center
                           hover:bg-emergency-surface2 rounded-lg"
                aria-label="Close history"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {history.length === 0 && (
                <p className="text-emergency-muted text-center py-8">
                  No incidents recorded yet.
                </p>
              )}
              {history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => {
                    onSelect(record);
                    setOpen(false);
                  }}
                  className="w-full text-left bg-emergency-bg rounded-xl p-4
                             hover:bg-emergency-surface2 transition-colors min-h-touch"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-bold ${SEVERITY_COLORS[record.severity] ?? "text-emergency-muted"}`}
                    >
                      {record.severity}
                    </span>
                    <span className="text-xs text-emergency-muted">
                      {VERIFICATION_ICONS[record.verification_status] ?? "?"}{" "}
                      {record.verification_status}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{record.headline}</p>
                  <p className="text-xs text-emergency-muted mt-1">
                    {formatDate(record.created_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
