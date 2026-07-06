import type { Config } from "tailwindcss";

/** Design tokens for the ElevenLabs-inspired marketplace redesign. */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      ink: "#000000",
      paper: "#f7f7f5",
      manila: "#f5f2ef",
      porcelain: "#ffffff",
      graphite: "#242424",
      teal: "#256f67",
      oxblood: "#8b3a34",
      amber: "#b9833b",
      analyst: "#4f6f9d",
      white: "#ffffff",
      black: "#000000",

      surface: {
        DEFAULT: "#ffffff",
        raised: "#f5f2ef",
        dark: "#171717",
      },
      slate: "#5f5f5b",
      "slate-mid": "#777169",
      silver: "#e8e5df",
      cloud: "#f5f5f5",
      footer: "#4e4e4e",
      muted: "#777169",
      "muted-deep": "#4e4e4e",
      hairline: "rgba(0,0,0,0.06)",
      border: "#e5e5e5",
      "border-hover": "rgba(0,0,0,0.16)",
    },

    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Aptos"', '"Segoe UI"', '"Helvetica Neue"', "sans-serif"],
        display: ['"Waldenburg"', '"Times New Roman"', "serif"],
        displayBold: ['"WaldenburgFH"', '"Inter"', "sans-serif"],
        mono: [
          '"Geist Mono"',
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
