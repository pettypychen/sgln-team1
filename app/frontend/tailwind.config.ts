import type { Config } from "tailwindcss";

/** Design tokens for the Simworks brand system (see doc/design.md). */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      ink: "#000000",
      paper: "#ffffff",
      manila: "#f2f2f2",
      porcelain: "#ffffff",
      graphite: "#242424",
      teal: "#2f9e5f",
      oxblood: "#c1673c",
      amber: "#d98d5f",
      analyst: "#4a9fd8",
      blush: "#f2d9e8",
      lavender: "#ded4f2",
      aqua: "#5fd8e6",
      white: "#ffffff",
      black: "#000000",

      surface: {
        DEFAULT: "#ffffff",
        raised: "#f2f2f2",
        dark: "#0a0a0a",
      },
      slate: "#5f5f5b",
      "slate-mid": "#6b6b6b",
      silver: "#e8e5df",
      cloud: "#f5f5f5",
      footer: "#4e4e4e",
      muted: "#6b6b6b",
      "muted-deep": "#4e4e4e",
      hairline: "rgba(0,0,0,0.06)",
      border: "#e5e5e5",
      "border-hover": "rgba(0,0,0,0.16)",
    },

    extend: {
      fontFamily: {
        sans: ['"DM Sans"', '"Aptos"', '"Segoe UI"', '"Helvetica Neue"', "sans-serif"],
        display: ['"Helvetica Neue"', '"Arial"', '"DM Sans"', "sans-serif"],
        displayBold: ['"Oswald"', '"Archivo Black"', '"Arial Black"', "sans-serif"],
        mono: [
          '"Space Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        micro: ["12px", { lineHeight: "1.33", letterSpacing: "0" }],
        small: ["13px", { lineHeight: "1.45", letterSpacing: "0" }],
        label: ["15px", { lineHeight: "1.47", letterSpacing: "0" }],
        body: ["16px", { lineHeight: "1.5", letterSpacing: "0" }],
        "body-lg": ["18px", { lineHeight: "1.6", letterSpacing: "0" }],
        card: ["28px", { lineHeight: "1.12", letterSpacing: "0" }],
        display: ["64px", { lineHeight: "1.02", letterSpacing: "0" }],
      },
      fontWeight: {
        precise: "500",
      },
      letterSpacing: {
        wordmark: "0",
        tag: "0",
        trust: "0",
      },
      borderRadius: {
        sharp: "8px",
        button: "9999px",
        card: "8px",
        panel: "8px",
      },
      maxWidth: {
        container: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
