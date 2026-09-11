/**
 * AboutPage — the process story: panic input → verified handoff. Short and
 * human, tuned for a demo/judge audience.
 */

import { Link } from "react-router-dom";
import {
  Microscope,
  Radio,
  ShieldCheck,
  PhoneCall,
  Database,
} from "lucide-react";

const STEPS = [
  {
    Icon: PhoneCall,
    title: "PANIC IN",
    body: "Speak, hold SOS, or type one line — in 7 Indian languages. Three locked taps when you can't think straight: breathing, conscious, how many people.",
  },
  {
    Icon: Microscope,
    title: "VERIFY, CROSS-CHECK",
    body: "Gemini-driven triage pulls symptoms, vitals, drug and allergy flags out of the noise, then cross-checks against weather, traffic and news signals. Every claim is scored VERIFIED / PARTIAL / CONFLICT — you see the trace, not a guess.",
  },
  {
    Icon: Database,
    title: "LOCATE, RESOLVE",
    body: "Nearest hospitals, blood banks, pharmacies, fuel and police resolve against your live GPS, with walk/drive minutes. Mock-labelled fallback keeps it working even with no API keys.",
  },
  {
    Icon: Radio,
    title: "BROADCAST",
    body: "A dispatcher packet — geotag, P1–P4, timeline, what's verified — forms transitively. SHARE MY SITUATION drops it into WhatsApp in one tap.",
  },
  {
    Icon: ShieldCheck,
    title: "HANDOFF, FOLLOW",
    body: "Lifecycle stepper moves DRAFT → VERIFIED → SENT → ACKNOWLEDGED → ASSIGNED → ARRIVING → CLOSED. You see who's handling it, state by state.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-3">
      <header className="panel-dark py-6 text-center">
        <h1 className="display text-[1.8rem] text-[#F5F5F0]">HOW RESCUEBRIDGE WORKS</h1>
        <p className="mono text-xs text-[#9A9A8F] mt-2">
          ONE REPORT IN · A VERIFIED PLAN OUT
        </p>
      </header>

      {STEPS.map(({ Icon, title, body }, i) => (
        <div key={title} className="panel">
          <div className="flex items-center gap-3">
            <span className="display text-[1.6rem] sig-red">{i + 1}</span>
            <Icon className="w-6 h-6 sig-red" aria-hidden="true" />
            <h2 className="display text-[1.05rem] text-[#0A0A0A]">{title}</h2>
          </div>
          <p className="text-sm text-[#3A3A34] mt-2 leading-relaxed">{body}</p>
        </div>
      ))}

      <div className="panel border-4 border-[#FF1F0F]">
        <p className="display text-[1rem] text-[#0A0A0A]">
          THIS DECISION IS A PROMPT — THE EMERGENCY IS REAL.
        </p>
        <p className="text-sm text-[#3A3A34] mt-1">
          RescueBridge never delays a call to 112. It tells you what to do in
          order, starts the record, and hands a verified packet to whoever
          takes over.
        </p>
      </div>

      <Link to="/panic" className="btn-brutal btn-brutal-red">
        GO TO SOS
      </Link>
    </div>
  );
}