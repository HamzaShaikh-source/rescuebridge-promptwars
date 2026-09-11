/**
 * PanicPage — the SOS decision-maker. Zero typing, three locked tap-through
 * questions, live decision tree, background voice + geolocation capture,
 * then hands the verdict to /triage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  HeartPulse,
  Flame,
  ShieldAlert,
  Phone,
  Activity,
  Wind,
  Users,
} from "lucide-react";
import { useTriageContext } from "../context/TriageContext";
import { useGeolocation } from "../hooks/useGeolocation";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import type { TriageInput } from "../types";

type Stage = "hold" | "category" | "questions" | "submitting";

type Tri = "YES" | "NO" | "UNSURE";
type Cat = "MEDICAL" | "ACCIDENT-FIRE" | "SECURITY-FEAR";

const CATEGORIES: { key: Cat; label: string; Icon: typeof Flame; hint: string }[] = [
  { key: "MEDICAL", label: "MEDICAL", Icon: HeartPulse, hint: "Injury · chest · breath · blood" },
  { key: "ACCIDENT-FIRE", label: "ACCIDENT / FIRE", Icon: Flame, hint: "Crash · fall · fire · debris" },
  { key: "SECURITY-FEAR", label: "SECURITY FEAR", Icon: ShieldAlert, hint: "Threat · crowd · trapped" },
];

const QA = [
  {
    key: "breathing",
    label: "ARE THEY BREATHING?",
    sub: "Look at the chest and stomach. Rising and falling?",
    Icon: Wind,
  },
  {
    key: "conscious",
    label: "ARE THEY CONSCIOUS?",
    sub: "Are their eyes open? Do they respond to your voice?",
    Icon: Activity,
  },
  {
    key: "people",
    label: "HOW MANY PEOPLE?",
    sub: "Anyone else hurt or trapped?",
    Icon: Users,
  },
];

const HOLDI_MS = 2000;

export default function PanicPage() {
  const navigate = useNavigate();
  const { submit, loading, error, clear, profile } = useTriageContext();

  const [stage, setStage] = useState<Stage>("hold");
  const [category, setCategory] = useState<Cat | null>(null);
  const [answers, setAnswers] = useState<Record<string, Tri>>({});
  const [held, setHeld] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTick = useRef(0);

  const { fix, getOnce } = useGeolocation();
  const {
    startRecording,
    stopRecording,
    isRecording,
    duration,
  } = useAudioRecorder();

  const qIndex = QA.findIndex((q) => answers[q.key] === undefined);
  const question = qIndex === -1 ? null : QA[qIndex];
  const allAnswered = qIndex === -1;

  /* ── Hold-to-SOS ─────────────────────────────────────────────── */
  const beginHold = useCallback(() => {
    if (stage !== "hold") return;
    holdTick.current = 0;
    holdTimer.current = setInterval(() => {
      holdTick.current += 50;
      const pct = Math.min((holdTick.current / HOLDI_MS) * 100, 100);
      setHeld(pct);
      if (pct >= 100 && holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        setStage("category");
      }
    }, 50);
  }, [stage]);

  const releaseHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    if (stage === "hold") setHeld(0);
  }, [stage]);

  const handleKeyHold = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.repeat) return;
        if (e.type === "keydown") beginHold();
        else releaseHold();
      }
    },
    [beginHold, releaseHold],
  );

  useEffect(() => () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
  }, []);

  /* ── Live decision tree ──────────────────────────────────────── */
  const breath = answers.breathing;
  const conscious = answers.conscious;
  const cprBranch = breath === "NO" && conscious === "NO";
  const callNow = breath === "UNSURE" || conscious === "UNSURE" || cprBranch;

  /* ── Fire submission ─────────────────────────────────────────── */
  const fireSubmission = useCallback(async () => {
    setStage("submitting");
    if ("geolocation" in navigator) {
      getOnce().catch(() => undefined);
    }
    try {
      await startRecording();
    } catch {
      /* mic denied — continue text-only */
    }

    const categoryLine =
      category === "MEDICAL"
        ? "medical emergency"
        : category === "ACCIDENT-FIRE"
          ? "accident, fire, or falling risk"
          : "security or safety fear";
    const answerLines = QA.map((q) => {
      const v = answers[q.key];
      return v ? ` - ${q.label.replace("?", "")}: ${v}` : "";
    }).filter(Boolean);
    const bleedingStep =
      category === "ACCIDENT-FIRE"
        ? " There is a possible crash, fire or fall site; check for heavy limb bleeding."
        : "";
    const cprStep = cprBranch
      ? " The person is NOT breathing and NOT conscious - suspected cardiac arrest. START CPR immediately, 100-120 compressions per minute."
      : callNow
        ? " I am unsure - needs an emergency operator on the line now."
        : "";

    const raw_text = `Panic-mode report: ${categoryLine}${bleedingStep}${cprStep} Details:${answerLines.join("")}`;

    const input: TriageInput = {
      raw_text,
      language_tag: "auto",
      ...(fix ? { geolocation: { lat: fix.lat, lng: fix.lng } } : {}),
    };

    const b64 = await stopRecording();
    if (b64) input.audio_base64 = b64;

    const hydrated = profile.hydrateInput(input.raw_text, "auto");
    input.raw_text = hydrated.raw_text;

    try {
      await submit(input);
      navigate("/triage");
    } catch {
      /* error surfaced on TriagePage; still nav there */
      navigate("/triage");
    }
  }, [category, answers, fix, submit, navigate, startRecording, stopRecording, getOnce, profile, cprBranch, callNow]);

  const reset = useCallback(() => {
    clear();
    setCategory(null);
    setAnswers({});
    setStage("hold");
    setHeld(0);
  }, [clear]);

  /* ═══════════════════════════════════════════════════════════════
     STAGE: HOLD
  ═══════════════════════════════════════════════════════════════ */
  if (stage === "hold") {
    return (
      <div className="min-h-[78vh] flex flex-col items-center justify-center gap-6 text-center">
        <div className="label-block sig-red tracking-[0.3em]">EMERGENCY MODE</div>
        <div className="panel-dark max-w-sm">
          <p className="display text-[1.4rem] leading-tight text-[#F5F5F0]">
            HOLD THE BUTTON 2 SECONDS TO START
          </p>
          <p className="mono text-xs text-[#9A9A8F] mt-2">
            NO TYPING. THREE TAPS. THEN A CLEAR PLAN.
          </p>
        </div>

        <button
          type="button"
          className="sos-pill w-[220px] h-[220px] justify-center"
          style={{ width: 220, height: 220 }}
          data-round
          aria-label="Hold for 2 seconds to start emergency triage"
          onPointerDown={beginHold}
          onPointerUp={releaseHold}
          onPointerLeave={releaseHold}
          onPointerCancel={releaseHold}
          onKeyDown={handleKeyHold}
          onKeyUp={handleKeyHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="text-[3.4rem]" style={{ letterSpacing: "0.08em" }}>
            SOS
          </span>
        </button>

        <div className="w-[200px] h-3 border-2 border-[#F5F5F0]">
          <div
            className="h-full bg-[#FF1F0F]"
            style={{ width: `${held}%`, transition: "width 50ms linear" }}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(held)}
            aria-label="Hold progress"
          />
        </div>
        <div className="mono text-xs text-[#9A9A8F]">
          {held >= 100 ? "RELEASED — STARTING…" : "HOLD…"}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STAGE: CATEGORY
  ═══════════════════════════════════════════════════════════════ */
  if (stage === "category") {
    return (
      <div className="space-y-3">
        <h1 className="display text-[1.8rem]">WHAT KIND OF EMERGENCY?</h1>
        <p className="mono text-xs text-[#9A9A8F]">TAP THE CLOSEST MATCH</p>

        {CATEGORIES.map(({ key, label, Icon, hint }) => (
          <button
            key={key}
            type="button"
            className="btn-brutal btn-brutal-paper flex-col items-start gap-1 py-5 text-left"
            onClick={() => {
              setCategory(key);
              setStage("questions");
            }}
          >
            <span className="flex items-center gap-3 w-full">
              <Icon className="w-7 h-7 sig-red" aria-hidden="true" />
              <span className="display text-[1.15rem] text-[#0A0A0A]">{label}</span>
            </span>
            <span className="mono text-xs text-[#6E6E64]">{hint}</span>
          </button>
        ))}

        <button type="button" onClick={reset} className="btn-brutal btn-brutal-dark text-xs">
          BACK
        </button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STAGE: QUESTIONS + LIVE DECISION TREE
  ═══════════════════════════════════════════════════════════════ */
  if (stage === "questions" && question) {
    const { label, sub, Icon } = question;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-block text-[#9A9A8F]">QUESTION {qIndex + 1} / 3</span>
          <span className="mono text-xs text-[#9A9A8F]">{category}</span>
        </div>

        <div className="panel flex items-center gap-3">
          <Icon className="w-8 h-8 sig-red shrink-0" aria-hidden="true" />
          <div>
            <h1 className="display text-[1.5rem] leading-tight text-[#0A0A0A]">{label}</h1>
            <p className="text-sm text-[#6E6E64]">{sub}</p>
          </div>
        </div>

        {(["YES", "NO", "UNSURE"] as Tri[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn-brutal ${t === "NO" ? "btn-brutal-red" : t === "UNSURE" ? "btn-brutal-amber" : "btn-brutal-blue"}`}
            onClick={() => setAnswers((a) => ({ ...a, [question.key]: t }))}
          >
            {t}
          </button>
        ))}

        {/* Live decision tree */}
        <div className="panel-dark mono text-sm space-y-2">
          <div className="label-block text-[#9A9A8F]">LIVE RULES</div>
          {cprBranch && (
            <p className="sig-red font-bold text-base">
              NO BREATH + NO CONSCIOUS = START CPR NOW · 100–120/MIN · HANDS CENTER CHEST
            </p>
          )}
          {callNow && !cprBranch && (
            <p className="sig-amber font-bold text-base">
              UNSURE = CALL 112 NOW · EMERGENCY OPERATOR CAN TALK YOU THROUGH IT
            </p>
          )}
          {category === "ACCIDENT-FIRE" && (
            <p className="text-[#F5F5F0]">▶ HEAVY LIMB BLEEDING → LIFT LIMB + FIRM PRESSURE</p>
          )}
          {breath === "YES" && (
            <p className="sig-green">
              ■ BREATHING: OK — {conscious === "YES" ? "CONSCIOUS: OK — KEEP TALKING TO THEM" : "watch airway"}
            </p>
          )}
          {allAnswered && (
            <button type="button" onClick={fireSubmission} className="btn-brutal btn-brutal-red w-auto mt-2">
              <Phone className="w-5 h-5" aria-hidden="true" /> BUILD MY PLAN →
            </button>
          )}
        </div>

        <button type="button" onClick={reset} className="btn-brutal btn-brutal-dark text-xs">
          RESTART
        </button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STAGE: SUBMITTING
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-[78vh] flex flex-col items-center justify-center gap-6 text-center">
      <div className="working-frame text-[#F5F5F0]">
        <span className="working-block" aria-hidden="true" />
        <span className="display text-[1.4rem]">WORKING…</span>
      </div>
      <div className="panel-dark max-w-sm">
        <p className="mono text-xs text-[#9A9A8F]">
          VERIFYING FACTS · CROSS-CHECKING PLACES · PREPARING HANDOFF PACKET
        </p>
        {isRecording && (
          <p className="mono text-sm sig-red mt-2">
            ● RECORDING ({duration}s) — KEEP TALKING, I'M LISTENING
          </p>
        )}
      </div>
      {!loading && error && (
        <Link to="/triage" className="btn-brutal btn-brutal-paper text-xs">
          SEE WHAT HAPPENED
        </Link>
      )}
    </div>
  );
}