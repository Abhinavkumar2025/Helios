/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        helios: {
          950: "#070a11",
          900: "#0b0f19",
          850: "#0f1523",
          800: "#131b2e",
          750: "#19243c",
          700: "#1e2c4a",
          600: "#2a3d66",
        },
        solar: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        emergency: {
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        radar: {
          cyan: "#06b6d4",
          green: "#10b981",
          amber: "#f59e0b",
          purple: "#a855f7",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "glow-solar": "0 0 20px -3px rgba(245, 158, 11, 0.35)",
        "glow-emergency": "0 0 25px 2px rgba(239, 68, 68, 0.45)",
        "glow-cyan": "0 0 20px -3px rgba(6, 182, 212, 0.35)",
        "card-subtle": "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
}
