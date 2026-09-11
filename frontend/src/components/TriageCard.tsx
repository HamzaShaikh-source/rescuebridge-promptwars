/**
 * TriageCard — the main result display after triage.
 * Four tabs: Raw Input · Verification Pipeline · Action Card · Dispatcher Packet.
 */

import { useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Eye,
  FileJson,
  Phone,
  MapPin,
  Volume2,
  CheckCircle2,
} from "lucide-react";
import type { TriageResponse } from "../types";
import VerifyBadge from "./VerifyBadge";
import { VerifyDetails } from "./VerifyBadge";

interface TriageCardProps {
  result: TriageResponse;
}

type Tab = "actions" | "verification" | "raw" | "handoff";

const SEVERITY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  P1_CRITICAL: { label: "P1 — CRITICAL", badgeClass: "badge-p1" },
  P2_SERIOUS: { label: "P2 — SERIOUS", badgeClass: "badge-p2" },
  P3_MODERATE: { label: "P3 — MODERATE", badgeClass: "badge-p3" },
  P4_LOW: { label: "P4 — LOW", badgeClass: "badge-p4" },
};

const ESCALATION_LABELS: Record<string, string> = {
  CALL_112_IMMEDIATELY: "Call 112 Immediately",
  VISIT_ER: "Visit Emergency Room",
  URGENT_CARE: "Visit Urgent Care",
  POISON_CONTROL: "Contact Poison Control",
  SELF_CARE: "Self-Care Recommended",
};

function formatDuration(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function TriageCard({ result }: TriageCardProps) {
  const { triage, nearby_places } = result;
  const [tab, setTab] = useState<Tab>("actions");
  const [speaking, setSpeaking] = useState(false);

  const sev = SEVERITY_CONFIG[triage.severity] ?? SEVERITY_CONFIG.P3_MODERATE;
  const ver = triage.verification;
  const hp = triage.handoff_packet;

  const speakInstructions = async () => {
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }

    const text = triage.immediate_actions.join(". ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.lang =
      triage.language_detected === "hi"
        ? "hi-IN"
        : triage.language_detected === "kn"
          ? "kn-IN"
          : "en-IN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis?.speak(utterance);
    setSpeaking(true);
  };

  const copyHandoff = async () => {
    const packet = {
      incident_id: hp.incident_id,
      severity: hp.severity,
      geotag: hp.geotag,
      timestamp: hp.timestamp,
      timeline: hp.timeline,
      verified_facts: hp.verified_facts,
      unverified: hp.unverified,
      recommended_escalation: hp.recommended_escalation,
      input_types_used: hp.input_types_used,
    };
    await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
  };

  const tabs: { id: Tab; label: string; icon: typeof Eye }[] = [
    { id: "actions", label: "Action Card", icon: AlertTriangle },
    { id: "verification", label: "Verification", icon: Eye },
    { id: "raw", label: "Raw Input", icon: ClipboardList },
    { id: "handoff", label: "Dispatcher Packet", icon: FileJson },
  ];

  return (
    <article className="card space-y-5" aria-label="Triage result">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`px-3 py-1 rounded-full text-sm font-bold ${sev.badgeClass}`}
        >
          {sev.label}
        </span>
        <VerifyBadge
          status={ver.status}
          checksDone={ver.checks_done.length}
          contradictions={ver.contradictions.length}
        />
        <span className="text-emergency-muted text-sm">
          🌐 {triage.language_detected}
        </span>
      </div>

      {/* Headline */}
      <h2 className="text-panic-xl font-bold">{triage.headline}</h2>

      {/* Tab bar */}
      <div
        className="flex overflow-x-auto gap-1 bg-emergency-bg rounded-xl p-1"
        role="tablist"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                          transition-colors whitespace-nowrap min-h-touch ${
                            tab === t.id
                              ? "bg-emergency-surface2 text-white"
                              : "text-emergency-muted hover:text-white"
                          }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {/* ── ACTION CARD ─────────────────────────────── */}
        {tab === "actions" && (
          <div className="space-y-5">
            {/* Immediate actions */}
            <div>
              <h3 className="text-lg font-bold mb-3">
                🩺 Immediate Life-Saving Actions
              </h3>
              <ol className="space-y-3">
                {triage.immediate_actions.map((action, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 bg-emergency-bg rounded-xl px-4 py-3"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emergency-red
                                     text-white flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-panic-lg leading-relaxed">{action}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Speak button */}
            <button
              onClick={speakInstructions}
              className="btn-secondary w-full"
              aria-label={speaking ? "Stop speaking" : "Speak instructions aloud"}
            >
              <Volume2 className="w-5 h-5" />
              {speaking ? "Stop Speaking" : "Speak Instructions Aloud"}
            </button>

            {/* Escalation */}
            <div className="bg-emergency-bg rounded-xl px-4 py-3">
              <p className="text-emergency-muted text-sm mb-1">Recommended Escalation</p>
              <p className="font-bold text-lg">
                {ESCALATION_LABELS[triage.escalation] ?? triage.escalation}
              </p>
            </div>

            {/* Medical context */}
            {(triage.medical_context.symptoms.length > 0 ||
              triage.medical_context.drug_flags.length > 0) && (
              <div className="bg-emergency-bg rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-emergency-muted">
                  Medical Context
                </p>
                {triage.medical_context.symptoms.length > 0 && (
                  <p>
                    <strong>Symptoms:</strong>{" "}
                    {triage.medical_context.symptoms.join(", ")}
                  </p>
                )}
                {triage.medical_context.drug_flags.length > 0 && (
                  <p>
                    <strong>Drugs/Conditions:</strong>{" "}
                    {triage.medical_context.drug_flags.join(", ")}
                  </p>
                )}
                {triage.medical_context.allergy_flags.length > 0 && (
                  <p>
                    <strong>Allergies:</strong>{" "}
                    {triage.medical_context.allergy_flags.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Call 112 + Copy Packet — side by side */}
            <div className="flex gap-3">
              <a
                href="tel:112"
                className="btn-red flex-1"
                role="button"
                aria-label="Call 112 emergency services"
              >
                <Phone className="w-6 h-6" />
                <span>Call 112</span>
              </a>
              <button onClick={copyHandoff} className="btn-secondary flex-1">
                <FileJson className="w-5 h-5" />
                <span>Copy Dispatcher Packet</span>
              </button>
            </div>

            {/* Nearest hospitals */}
            {nearby_places.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">
                  🏥 Nearest Emergency Services
                </h3>
                <div className="space-y-2">
                  {nearby_places.map((place, i) => (
                    <a
                      key={i}
                      href={place.map_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-emergency-bg rounded-xl px-4 py-3
                                 hover:bg-emergency-surface2 transition-colors"
                    >
                      <MapPin className="w-5 h-5 text-emergency-red flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{place.name}</p>
                        <p className="text-sm text-emergency-muted truncate">
                          {place.address} · {formatDuration(place.distance_m)}
                        </p>
                      </div>
                      {place.open_now !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            place.open_now
                              ? "bg-emergency-green/20 text-emergency-green"
                              : "bg-emergency-red/20 text-emergency-red"
                          }`}
                        >
                          {place.open_now ? "Open" : "Closed"}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VERIFICATION PIPELINE ────────────────────── */}
        {tab === "verification" && (
          <div className="space-y-5">
            <VerifyDetails
              checksDone={ver.checks_done}
              contradictions={ver.contradictions}
              uncertainties={ver.uncertainties}
            />
            {triage.noise_filtered.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-emergency-muted mb-2">
                  Noise Filtered — Key Facts Preserved
                </h4>
                <ul className="space-y-1">
                  {triage.noise_filtered.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emergency-green mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {triage.environmental_hazards.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-emergency-yellow mb-2">
                  ⚠ Environmental Hazards
                </h4>
                <ul className="space-y-1">
                  {triage.environmental_hazards.map((h, i) => (
                    <li key={i} className="text-sm">
                      <strong>{h.hazard_type}:</strong> {h.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── RAW INPUT ─────────────────────────────── */}
        {tab === "raw" && (
          <div className="space-y-4">
            <div className="bg-emergency-bg rounded-xl p-4">
              <h4 className="text-sm font-bold text-emergency-muted mb-2">
                Input Types Used
              </h4>
              <div className="flex gap-2">
                {hp.input_types_used.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full bg-emergency-surface2 text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-emergency-bg rounded-xl p-4">
              <h4 className="text-sm font-bold text-emergency-muted mb-2">
                Language Detected
              </h4>
              <p>{triage.language_detected}</p>
            </div>
          </div>
        )}

        {/* ── DISPATCHER PACKET ──────────────────────── */}
        {tab === "handoff" && (
          <div className="space-y-4">
            <div className="bg-emergency-bg rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold">Dispatch-Ready Packet</h4>
                <button
                  onClick={copyHandoff}
                  className="text-sm text-emergency-red underline min-h-touch"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="text-xs text-emergency-muted overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
                {JSON.stringify(
                  {
                    incident_id: hp.incident_id,
                    severity: hp.severity,
                    geotag: hp.geotag,
                    timestamp: hp.timestamp,
                    timeline: hp.timeline,
                    verified_facts: hp.verified_facts,
                    unverified: hp.unverified,
                    recommended_escalation: hp.recommended_escalation,
                    input_types_used: hp.input_types_used,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
