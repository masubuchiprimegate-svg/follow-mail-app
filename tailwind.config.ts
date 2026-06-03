import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202A",
        mist: "#F5F7FA",
        line: "#D9E1E8",
        teal: "#0F766E",
        coral: "#D85F4F"
      }
    }
  },
  plugins: []
};

export default config;
