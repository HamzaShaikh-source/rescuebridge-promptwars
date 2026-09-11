/**
 * BottomNav — fixed thumb-reachable tab bar. 5 tabs max:
 * PANIC (deep-red, always) · HOME · RESOURCES · HISTORY · PROFILE
 */

import { NavLink } from "react-router-dom";
import { Phone, Home, MapPin, History, User } from "lucide-react";

const TABS = [
  { to: "/panic", label: "Panic", key: "panic", Icon: Phone, sos: true },
  { to: "/", label: "Home", key: "home", Icon: Home },
  { to: "/resources", label: "Resources", key: "resources", Icon: MapPin },
  { to: "/history", label: "History", key: "history", Icon: History },
  { to: "/profile", label: "Profile", key: "profile", Icon: User },
];

export default function BottomNav() {
  return (
    <nav className="tabbar" aria-label="Primary navigation">
      {TABS.map(({ to, label, key, Icon, sos }) => (
        <NavLink
          key={key}
          to={to}
          end={key === "home"}
          className={({ isActive }) =>
            `tabbar-link ${isActive ? "tabbar-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span aria-hidden="true">
                <Icon
                  className="w-6 h-6"
                  style={sos ? { color: "#FF3B2E" } : undefined}
                />
              </span>
              <span style={sos ? { color: "#FF3B2E" } : undefined}>{label}</span>
              {isActive && <span className="sr-only"> (current)</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}