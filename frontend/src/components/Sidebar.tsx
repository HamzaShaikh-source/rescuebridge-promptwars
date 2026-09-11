/**
 * Sidebar — desktop navigation (md+). Bottom tab bar handles mobile.
 * Brutalist fixed rail: brand, tabs, always-visible SOS call block.
 */

import { NavLink } from "react-router-dom";
import { Phone, Home, MapPin, History, User, Ambulance } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", key: "home", Icon: Home },
  { to: "/resources", label: "Resources", key: "resources", Icon: MapPin },
  { to: "/history", label: "History", key: "history", Icon: History },
  { to: "/profile", label: "Profile", key: "profile", Icon: User },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-ink border-r-4 border-paper">
      <div className="px-6 py-6 border-b-4 border-paper">
        <p className="font-display text-xl leading-none tracking-tight">
          RESCUE
          <br />
          BRIDGE
        </p>
        <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-widest text-[#9A9A8F]">
          panic → verified handoff
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary navigation">
        {TABS.map(({ to, label, key, Icon }) => (
          <NavLink
            key={key}
            to={to}
            end={key === "home"}
            className={({ isActive }) =>
              `flex items-center gap-4 px-6 py-4 font-mono text-xs font-bold uppercase tracking-wider border-l-4 transition-colors ${
                isActive
                  ? "bg-ink-dim border-amber text-paper"
                  : "border-transparent text-[#9A9A8F] hover:text-paper hover:bg-ink-dim"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{label}</span>
                {isActive && <span className="sr-only"> (current)</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-6">
        <a
          href="tel:112"
          className="flex min-h-[68px] items-center justify-center gap-3 bg-danger border-4 border-paper font-display text-sm tracking-wide text-paper hover:bg-[#FF3B2E]"
        >
          <Ambulance className="w-6 h-6" aria-hidden="true" />
          <span className="inline-flex items-center gap-2">
            <Phone className="w-4 h-4" aria-hidden="true" />
            112 — EMERGENCY
          </span>
        </a>
      </div>
    </aside>
  );
}