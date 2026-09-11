/**
 * HistoryPage — past incidents list from GET /api/history. Each row links to a
 * detail view: verdict, packet JSON, timeline, CALL-112 recall.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Phone, Clock } from "lucide-react";
import { getIncidentById } from "../services/api";
import type { IncidentRecord } from "../types";
import { useTriageContext } from "../context/TriageContext";

const SEV_COLOR: Record<string, string> = {
  P1_CRITICAL: "#FF1F0F",
  P2_SERIOUS: "#FFB000",
  P3_MODERATE: "#0057FF",
  P4_LOW: "#00C853",
};

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { history, refreshHistory } = useTriageContext();
  const [detail, setDetail] = useState<IncidentRecord | null>(null);

  useEffect(() => {
    if (id && history.length) {
      const found = history.find((r) => r.id === id);
      setDetail(found ?? null);
      if (!found) {
        getIncidentById(id).then(setDetail).catch(() => setDetail(null));
      }
    }
  }, [id, history]);

  const refresh = useCallback(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-3">
      <header className="panel-dark py-4">
        <h1 className="display text-[1.6rem] text-[#F5F5F0]">INCIDENT HISTORY</h1>
        <p className="mono text-xs text-[#9A9A8F]">
          {history.length ? `${history.length} INCIDENT(S)` : "NO RECORDS YET"}
        </p>
      </header>

      {id && detail && <HistoryDetail record={detail} />}
      {id && !detail && (
        <div className="panel-dark mono text-sm text-[#9A9A8F]">LOADING INCIDENT…</div>
      )}

      <div className="space-y-2">
        {history.map((record) => (
          <Link
            key={record.id}
            to={`/history/${record.id}`}
            className="panel hover:bg-[#E4E4DD] block"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="mono text-xs font-bold"
                style={{ color: SEV_COLOR[record.severity] ?? "#FFB000" }}
              >
                {record.severity}
              </span>
              <span className="label-block text-[#6E6E64]">
                {record.verification_status}
              </span>
            </div>
            <p className="font-bold text-[#0A0A0A] mt-1">{record.headline}</p>
            <div className="flex items-center gap-2 mt-2 text-xs mono text-[#6E6E64]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {new Date(record.created_at).toLocaleString()}
              <ChevronRight className="w-4 h-4 ml-auto" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HistoryDetail({ record }: { record: IncidentRecord }) {
  const t = record.triage;
  return (
    <div className="space-y-3">
      <a href="tel:112" className="btn-brutal btn-brutal-red" data-round>
        <Phone className="w-6 h-6" aria-hidden="true" /> CALL 112
      </a>

      <div className="panel">
        <div className="label-block text-[#0A0A0A]">VERDICT</div>
        <div className="display text-[2rem]" style={{ color: SEV_COLOR[record.severity] ?? "#FFB000" }}>
          {record.severity}
        </div>
        <p className="font-bold text-[#0A0A0A]">{t.headline}</p>
      </div>

      <div className="panel-dark">
        <div className="label-block text-[#9A9A8F]">TIMELINE</div>
        {record.ledger.length ? (
          <div className="mt-2 space-y-2">
            {record.ledger.map((entry, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="mono text-[#FFB000] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-[#F5F5F0]">
                  <b>{entry.state}</b> · {entry.actor}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mono text-xs text-[#9A9A8F] mt-2">NO LIFECYCLE ENTRIES</p>
        )}
      </div>

      <div className="panel">
        <div className="label-block text-[#0A0A0A]">DISPATCHER PACKET (RAW JSON)</div>
        <pre className="mono text-[0.68rem] text-[#0A0A0A] overflow-x-auto mt-2 bg-[#E4E4DD] p-2">
          {JSON.stringify(t.handoff_packet, null, 2)}
        </pre>
      </div>
    </div>
  );
}