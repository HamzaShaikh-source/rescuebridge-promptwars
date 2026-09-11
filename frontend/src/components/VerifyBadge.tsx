/**
 * VerifyBadge — prominent verification status badge.
 * Displays VERIFIED / PARTIAL / CONFLICT with icon and colour.
 */

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { VerificationStatus } from "../types";

interface VerifyBadgeProps {
  status: VerificationStatus;
  checksDone: number;
  contradictions: number;
}

const CONFIG: Record<
  VerificationStatus,
  {
    label: string;
    className: string;
    Icon: typeof ShieldCheck;
    description: string;
  }
> = {
  VERIFIED: {
    label: "VERIFIED",
    className: "badge-verified",
    Icon: ShieldCheck,
    description: "All facts cross-checked and consistent",
  },
  PARTIAL: {
    label: "PARTIAL",
    className: "badge-partial",
    Icon: ShieldAlert,
    description: "Some facts verified, some unconfirmed",
  },
  CONFLICT: {
    label: "CONFLICT",
    className: "badge-conflict",
    Icon: ShieldQuestion,
    description: "Contradictions detected in input",
  },
};

export default function VerifyBadge({
  status,
  checksDone,
  contradictions,
}: VerifyBadgeProps) {
  const { label, className, Icon } = CONFIG[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${className}`}
      role="status"
      aria-label={`Verification status: ${label}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      <span>{label}</span>
      <span className="text-xs font-normal opacity-75">
        ({checksDone} checks
        {contradictions > 0 && `, ${contradictions} conflict${contradictions > 1 ? "s" : ""}`})
      </span>
    </div>
  );
}

export function VerifyDetails({
  checksDone,
  contradictions,
  uncertainties,
}: {
  checksDone: { source: string; result: string }[];
  contradictions: string[];
  uncertainties: string[];
}) {
  return (
    <div className="space-y-3 text-sm">
      {checksDone.length > 0 && (
        <div>
          <h4 className="text-emergency-muted font-semibold mb-1">
            Checks Performed
          </h4>
          <ul className="space-y-1">
            {checksDone.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emergency-green mt-0.5">✓</span>
                <span>
                  <strong>{c.source}:</strong> {c.result}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {contradictions.length > 0 && (
        <div>
          <h4 className="text-emergency-red font-semibold mb-1">
            Contradictions
          </h4>
          <ul className="space-y-1">
            {contradictions.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emergency-red mt-0.5">⚠</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {uncertainties.length > 0 && (
        <div>
          <h4 className="text-emergency-yellow font-semibold mb-1">
            Uncertainties
          </h4>
          <ul className="space-y-1">
            {uncertainties.map((u, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emergency-yellow mt-0.5">?</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
