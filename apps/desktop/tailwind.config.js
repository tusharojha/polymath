/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      /* ─────────────────────────────
       * Color System (Semantic-first)
       * ───────────────────────────── */
      colors: {
        /* App surfaces */
        background: "#f3f4f6",          // main app canvas (slightly darker = better contrast)
        backgroundSubtle: "#fafafa",

        surface: "#f8fafc",             // default cards / panes
        surfaceElevated: "#f1f5f9",     // secondary cards
        surfaceFloating: "#ffffff",     // primary reading / focus pane

        /* Borders */
        border: "#cbd5e1",
        borderSubtle: "#e2e8f0",

        /* Foreground (text hierarchy) */
        fg: "#0f172a",                  // headings / key ideas
        fgMuted: "#475569",             // subheadings / labels
        fgSubtle: "#64748b",            // body text
        fgHint: "#94a3b8",              // metadata / hints

        /* Accent = cognition & focus */
        accent: "#2563eb",
        accentHover: "#1d4ed8",
        accentPressed: "#1e40af",
        accentSoft: "#eff6ff",
        accentSubtle: "rgba(37, 99, 235, 0.12)",

        /* Intent states */
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
      },

      /* ─────────────────────────────
       * Shadows (Depth = Importance)
       * ───────────────────────────── */
      boxShadow: {
        none: "none",

        subtle:
          "0 1px 2px rgba(15, 23, 42, 0.06)",

        raised:
          "0 4px 12px rgba(15, 23, 42, 0.08)",

        floating:
          "0 8px 24px rgba(15, 23, 42, 0.12)",

        focus:
          "0 0 0 3px rgba(37, 99, 235, 0.35)",
      },

      /* ─────────────────────────────
       * Typography
       * ───────────────────────────── */
      fontFamily: {
        sans: [
          "InterVariable",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },

      /* ─────────────────────────────
       * Border Radius (OS-like softness)
       * ───────────────────────────── */
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
      },

      /* ─────────────────────────────
       * Transitions (calm, intentional)
       * ───────────────────────────── */
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "260ms",
      },

      transitionTimingFunction: {
        calm: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },

  plugins: [
    require("@tailwindcss/typography"),
  ],
};
