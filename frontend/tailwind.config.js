/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emergency: {
          red: "#DC2626",
          "red-dark": "#991B1B",
          orange: "#EA580C",
          yellow: "#CA8A04",
          green: "#16A34A",
          blue: "#2563EB",
          bg: "#0F172A",
          surface: "#1E293B",
          surface2: "#334155",
          text: "#F8FAFC",
          muted: "#94A3B8",
        },
      },
      fontSize: {
        "panic-lg": ["1.25rem", { lineHeight: "1.75rem" }],
        "panic-xl": ["1.5rem", { lineHeight: "2rem" }],
        "panic-2xl": ["2rem", { lineHeight: "2.5rem" }],
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
