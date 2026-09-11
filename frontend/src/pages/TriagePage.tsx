/**
 * TriagePage — post-submit verdict screen. Marquee VerdictCard + verification,
 * contradiction, and lifecycle detail. Empty state if nothing submitted.
 */

import { Link } from "react-router-dom";
import { VerifyDetails } from "../components/VerifyBadge";
import ContradictionRadar from "../components/ContradictionRadar";
import LifecycleStepper from "../components/LifecycleStepper";
import VerdictCard from "../components/VerdictCard";
import { useTriageContext } from "../context/TriageContext";

export default function TriagePage() {
  const { result, loading, error, lifecycle, ledger, advance, confirm } =
    useTriageContext();

  if (loading) {
    return (
      <div className="min-h-[78vh] flex flex-col items-center justify-center gap-6 text-center">
        <div className="working-frame">
          <span className="working-block" aria-hidden="true" />
          <span className="display text-[1.4rem]">WORKING…</span>
        </div>
        <p className="mono text-xs text-[#9A9A8F]">
          VERIFYING FACTS · CROSS-CHECKING PLACES · PREPARING HANDOFF
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center">
        <div className="panel-dark">
          <p className="display text-[1.4rem] text-[#F5F5F0]">NO ACTIVE INCIDENT</p>
          <p className="mono text-xs text-[#9A9A8F] mt-2">
            {error ? `LAST ATTEMPT FAILED: ${error}` : "SUBMIT A REPORT FIRST."}
          </p>
        </div>
        <Link to="/panic" className="btn-brutal btn-brutal-red">
          START SOS
        </Link>
        <Link to="/resources" className="btn-brutal btn-brutal-paper text-xs">
          FIND NEARBY HELP
        </Link>
      </div>
    );
  }

  const t = result.triage;

  return (
    <div className="space-y-3">
      <VerdictCard result={result} />

      <div className="panel-dark">
        <div className="label-block text-[#9A9A8F]">VERIFICATION TRACE</div>
        <div className="mt-2">
          <VerifyDetails
            checksDone={t.verification.checks_done}
            contradictions={t.verification.contradictions}
            uncertainties={t.verification.uncertainties}
          />
        </div>
      </div>

      <ContradictionRadar
        verification={t.verification}
        incidentId={t.handoff_packet.incident_id}
        onConfirm={(correction) => void confirm(correction)}
      />

      <DetailBlock label="MEDICAL CONTEXT">
        {t.medical_context.symptoms.length > 0 && (
          <p className="text-sm">
            <span className="label-block text-[#0A0A0A]">SYMPTOMS:</span>{" "}
            {t.medical_context.symptoms.join(", ")}
          </p>
        )}
        {t.medical_context.allergy_flags.length > 0 && (
          <p className="text-sm sig-red">
            <span className="label-block text-[#0A0A0A]">ALLERGY RISK:</span>{" "}
            {t.medical_context.allergy_flags.join(", ")}
          </p>
        )}
      </DetailBlock>

      {t.environmental_hazards.length > 0 && (
        <DetailBlock label="ENVIRONMENTAL HAZARDS">
          {t.environmental_hazards.map((h, i) => (
            <p key={i} className="text-sm">
              <span className="sig-hot font-bold uppercase">{h.hazard_type}:</span>{" "}
              {h.description} <span className="text-[#6E6E64]">({h.severity_impact})</span>
            </p>
          ))}
        </DetailBlock>
      )}

      <LifecycleStepper
        currentState={lifecycle}
        ledger={ledger}
        incidentId={t.handoff_packet.incident_id}
        onAdvance={(s) => void advance(s)}
      />
    </div>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="label-block text-[#0A0A0A]">{label}</div>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}