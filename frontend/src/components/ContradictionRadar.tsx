/**
 * ContradictionRadar — renders contradictions with confirm-back questions
 * and a quick-answer "Confirm / Correct" UI.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { Verification } from "../types";

interface ContradictionRadarProps {
  verification: Verification;
  incidentId: string;
  onConfirm?: (correction: string) => void;
}

export default function ContradictionRadar({
  verification,
  onConfirm,
}: ContradictionRadarProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (
    verification.status !== "CONFLICT" ||
    verification.contradictions.length === 0
  ) {
    return null;
  }

  const handleSubmit = (correction: string) => {
    setSubmitted(true);
    setAnswer(correction);
    onConfirm?.(correction);
  };

  return (
    <div className="space-y-4" aria-label="Contradiction radar">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-emergency-red" />
        <h4 className="text-sm font-bold text-emergency-red">
          Contradiction Radar — {verification.contradictions.length} conflict
          {verification.contradictions.length > 1 ? "s" : ""} detected
        </h4>
      </div>

      {verification.contradictions.map((c, i) => (
        <div
          key={i}
          className="bg-emergency-red/10 border border-emergency-red/30 rounded-xl p-4 space-y-3"
        >
          <p className="text-sm">{c}</p>

          {/* Confirm-back question */}
          {verification.confirm_back_question && i === 0 && !submitted && (
            <div className="space-y-3">
              <div className="bg-emergency-bg rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-emergency-yellow">
                  📋 {verification.confirm_back_question}
                </p>
              </div>

              {/* Quick-answer buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleSubmit("Confirmed — current state is accurate")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emergency-green/20
                             text-emergency-green text-sm font-bold min-h-touch
                             hover:bg-emergency-green/30 transition-colors"
                  aria-label="Confirm the current assessment"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm
                </button>
                <button
                  onClick={() => handleSubmit(answer || "Corrected — see notes")}
                  disabled={!answer.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emergency-orange/20
                             text-emergency-orange text-sm font-bold min-h-touch
                             hover:bg-emergency-orange/30 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Submit correction"
                >
                  <XCircle className="w-4 h-4" />
                  Correct
                </button>
              </div>

              {/* Free-text correction input */}
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type correction if needed…"
                className="w-full bg-emergency-bg text-emergency-text rounded-lg px-3 py-2
                           text-sm border border-white/10 focus:border-emergency-orange
                           focus:ring-1 focus:ring-emergency-orange/30"
                aria-label="Correction text"
              />
            </div>
          )}

          {submitted && i === 0 && (
            <div className="flex items-center gap-2 bg-emergency-green/10 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 text-emergency-green" />
              <span className="text-sm text-emergency-green">
                Correction recorded: {answer}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
