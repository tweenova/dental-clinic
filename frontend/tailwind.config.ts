import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        background: "var(--color-bg-base)",
        "bg-base": "var(--color-bg-base)",
        forest: "var(--color-forest)",
        gold: "var(--color-gold)",
        bone: "var(--color-bone)",
        cream: "var(--color-cream)",
        sand: "var(--color-sand)",
        line: "var(--color-line)",
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
      },
      fontFamily: {
        primary: ["var(--font-primary, var(--font-fraunces))", "Georgia", "serif"],
        secondary: ["var(--font-secondary, var(--font-manrope))", "system-ui", "sans-serif"],
        display: ["var(--font-primary, var(--font-fraunces))", "Georgia", "serif"],
        sans: ["var(--font-secondary, var(--font-manrope))", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
