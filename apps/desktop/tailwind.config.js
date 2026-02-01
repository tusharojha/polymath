/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f6f7f9",
        backgroundSubtle: "#fafafa",
        surface: "#f8fafc",
        surfaceElevated: "#f1f5f9",

        border: "#cbd5e1",
        borderSubtle: "#e2e8f0",

        fg: "#0f172a",
        fgMuted: "#475569",
        fgSubtle: "#64748b",

        accent: "#2563eb",
        accentHover: "#1d4ed8",
        accentPressed: "#1e40af",
        accentSoft: "#eff6ff",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0,0,0,0.06)",
        focus: "0 0 0 3px rgba(37, 99, 235, 0.35)",
      },
      fontFamily: {
        sans: ['InterVariable', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
