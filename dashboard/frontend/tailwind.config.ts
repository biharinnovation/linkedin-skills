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
        canvas: "#0B0E14",
        surface: "#111622",
        "surface-card": "#151B2B",
        "surface-hover": "#1C2438",
        borderline: "#20293D",
        "borderline-light": "#2E3A54",
        accent: {
          DEFAULT: "#0A66C2",
          hover: "#08529C",
          light: "#38BDF8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
