/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#F5F5F0",
        "ink-dim": "#2A2A28",
        "paper-dim": "#E4E4DD",
        line: "#444440",
        danger: "#FF1F0F",
        amber: "#FFB000",
        safe: "#00C853",
        action: "#0057FF",
        hot: "#FF00AA",
        "sos-fire": "#FF3B2E",
      },
      fontFamily: {
        display: ['"Archivo Black"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "panic-lg": ["1.25rem", { lineHeight: "1.6rem" }],
        "panic-xl": ["1.6rem", { lineHeight: "1.9rem" }],
        "panic-2xl": ["2.1rem", { lineHeight: "2.4rem" }],
        sos: ["6.2rem", { lineHeight: "1" }],
      },
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};