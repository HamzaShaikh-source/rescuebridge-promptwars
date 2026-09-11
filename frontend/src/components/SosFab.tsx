/**
 * SosFab — floating CALL 112 speed-dial, visible on every page except /panic
 * (where the panic speed-dial IS the page).
 */

import { Phone } from "lucide-react";

export default function SosFab() {
  return (
    <a
      href="tel:112"
      className="fixed z-40 flex items-center justify-center gap-2"
      style={{
        right: 14,
        bottom: 88,
        width: 76,
        height: 76,
        borderRadius: 9999,
        background: "#FF1F0F",
        color: "#F5F5F0",
        border: "3px solid #F5F5F0",
        textDecoration: "none",
      }}
      data-round
      aria-label="Call 112 emergency services"
    >
      <Phone className="w-8 h-8" aria-hidden="true" />
    </a>
  );
}