import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:     ["var(--font-ubuntu)", "Ubuntu", "system-ui", "sans-serif"],
        heading:  ["var(--font-poppins)", "Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        // Cuentas Claras brand palette
        brand: {
          50:  "#ECEEF9",
          100: "#D0D4F1",
          200: "#A2A9E3",
          300: "#747FD5",
          400: "#8A96E0",   // light – readable text on dark bg
          500: "#4A5BBD",   // medium – interactive text / active states
          600: "#2B3990",   // CC royal blue – borders / bg highlights
          700: "#262262",   // CC deep indigo – dark accents
          800: "#1C1A52",
          900: "#0E0D2E",
        },
        // Cuentas Claras purple accent
        cc: {
          purple:      "#92278F",
          "purple-lt": "#B85AB6",
          "purple-dk": "#6D1D6B",
          indigo:      "#262262",
          blue:        "#2B3990",
        },
        surface: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#080b18",   // slightly indigo-tinted dark base
        },
      },
    },
  },
  plugins: [],
};

export default config;
