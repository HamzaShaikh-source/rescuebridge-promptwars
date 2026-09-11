/**
 * VerdictCard — full-screen post-triage verdict. Giant CALL-112, top-3 steps,
 * verification status, speechSynthesis read-aloud with repeat/stop.
 */

import { useMemo } from "react";
import { Phone, Volume2, Square, Share2 } from "lucide-react";
import type { TriageResponse } from "../types";
import { useSpeech } from "../hooks/useSpeech";

const SEV_LABEL: Record<string, { label: string; color: string }> = {
  P1_CRITICAL: { label: "P1 CRITICAL", color: "#FF1F0F" },
  P2_SERIOUS: { label: "P2 SERIOUS", color: "#FFB000" },
  P3_MODERATE: { label: "P3 MODERATE", color: "#0057FF" },
  P4_LOW: { label: "P4 LOW", color: "#00C853" },
};

const VERIFY_COLOR: Record<string, string> = {
  VERIFIED: "#00C853",
  PARTIAL: "#FFB000",
  CONFLICT: "#FF1F0F",
};

export default function VerdictCard({ result }: { result: TriageResponse }) {
  const { speak, stop, speaking, supported } = useSpeech();
  const t = result.triage;
  const sev = SEV_LABEL[t.severity] ?? SEV_LABEL.P4_LOW;

  const speechText = useMemo(() => {
    const steps = t.immediate_actions.slice(0, 3).join(". Next: ");
    return `Emergency triage. Severity ${sev.label.replace("P", "P")}. ${t.headline}. Your three steps: ${steps}. If anything is unclear, call emergency services now.`;
  }, [t, sev]);

  const readAloud = () => {
    if (speaking) stop();
    else speak(speechText, t.language_detected);
  };

  const shareSituation = async () => {
    const loc = t.handoff_packet.geotag;
    const line = `I triggered RescueBridge. ${t.headline} (${sev.label}). First: ${t.immediate_actions[0] ?? "call 112"}.${loc ? ` My location: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : " (location unavailable)"}`;
    const base = "https://wa.me/?text=" + encodeURIComponent(line);
    try {
      if (navigator.share) {
        await navigator.share({ text: line });
      } else {
        window.open(base, "_blank", "noopener");
      }
    } catch {
      window.open(base, "_blank", "noopener");
    }
  };

  return (
    <div className="space-y-3">
      {/* Severity banner */}
      <div className="panel-dark text-center py-6">
        <div className="label-block sig-red">TRIAGE VERDICT</div>
        <div
          className="display text-[3rem] leading-none mt-2"
          style={{ color: sev.color }}
        >
          {sev.label}
        </div>
        <div className="mono mt-2 text-sm text-[#9A9A8F]">
          VERIFICATION:{" "}
          <span style={{ color: VERIFY_COLOR[t.verification.status] ?? "#FFB000" }}>
            {t.verification.status}
          </span>
        </div>
        <div className="mt-1 text-[#F5F5F0]">{t.headline}</div>
      </div>

      {/* Giant CALL 112 */}
      <a
        href="tel:112"
        className="btn-brutal btn-brutal-red display text-[1.6rem] tracking-wide"
        data-round
      >
        <Phone className="w-8 h-8" aria-hidden="true" /> CALL 112
      </a>

      {/* Top 3 steps */}
      <div className="panel">
        <div className="label-block text-[#0A0A0A]">DO THIS, IN ORDER</div>
        <ol className="mt-2 space-y-2">
          {t.immediate_actions.slice(0, 3).map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="display mono text-[1.4rem] leading-none sig-red shrink-0">
                {i + 1}
              </span>
              <span className="font-bold text-[#0A0A0A]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Read / share / nurture controls */}
      <div className="grid grid-cols-3 gap-2">
        {supported && (
          <button
            type="button"
            onClick={readAloud}
            className={`btn-brutal ${speaking ? "btn-brutal-amber" : "btn-brutal-blue"}`}
          >
            {speaking ? <Square className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            <span className="text-xs">{speaking ? "STOP" : "READ IT TO ME"}</span>
          </button>
        )}
        <button type="button" onClick={shareSituation} className="btn-brutal btn-brutal-paper">
          <Share2 className="w-5 h-5" />
          <span className="text-xs">SHARE SITUATION</span>
        </button>
        <a href="/panic" className="btn-brutal btn-brutal-dark text-xs">
          START OVER
        </a>
      </div>

      {speaking && (
        <div className="panel-dark mono text-sm sig-amber">
          ▸ SPEAKING PLAN LOUDLY FOR PEOPLE AROUND YOU — TAP STOP TO HUSH
        </div>
      )}
    </div>
  );
}