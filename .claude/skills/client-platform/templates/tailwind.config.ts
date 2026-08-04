import type { Config } from "tailwindcss";

// Brand tokens — SWAP THESE PER CLIENT (colors + fonts + logo mark in ui.tsx).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0E1015", 800: "#171A22", 700: "#232733" },
        body: "#3C4354",
        muted: "#6B7385",
        brand: { DEFAULT: "#2563EB", 600: "#1D4ED8", 400: "#60A5FA", soft: "#E7EFFE" },
        accent: { DEFAULT: "#D4FF4F", ink: "#4A5A00" },
        line: { DEFAULT: "#E6E8EF", strong: "#D6D9E4" },
        surface: { DEFAULT: "#FFFFFF", soft: "#F5F6FA", cream: "#FBFAF6" },
        success: "#15803D",
        star: "#E0A31E",
      },
      borderRadius: { xl: "16px", "2xl": "24px" },
      fontFamily: {
        sans: ["Figtree", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Bricolage Grotesque'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,16,21,.06), 0 1px 3px rgba(14,16,21,.05)",
        md: "0 12px 28px -14px rgba(14,16,21,.22), 0 2px 8px -3px rgba(14,16,21,.08)",
        brand: "0 20px 44px -18px rgba(37,99,235,.55)",
      },
    },
  },
  plugins: [],
};
export default config;
