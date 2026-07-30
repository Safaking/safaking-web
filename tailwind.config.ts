import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        royal: {
          50: "#FDF6EC",
          100: "#F9EBD4",
          200: "#F0D5A8",
          300: "#E4B872",
          400: "#D4A04A",
          500: "#C9A227",
          600: "#A8841F",
          700: "#856619",
          800: "#634D13",
          900: "#3D2F0C",
        },
        maroon: {
          50: "#FDF2F4",
          100: "#FCE4E8",
          200: "#F9C8D0",
          300: "#F09BA8",
          400: "#E05D72",
          500: "#C8324F",
          600: "#A8233D",
          700: "#8B1E2F",
          800: "#6B0F1A",
          900: "#4A0D18",
          950: "#2D060E",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "float-slow": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        shimmer: "shimmer 3s linear infinite",
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "spin-slow": "spin 20s linear infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
      },
      backgroundImage: {
        "royal-gradient":
          "linear-gradient(135deg, #4A0D18 0%, #8B1E2F 40%, #6B0F1A 70%, #2D060E 100%)",
        "gold-gradient":
          "linear-gradient(135deg, #C9A227 0%, #E4B872 50%, #A8841F 100%)",
        "cream-gradient":
          "linear-gradient(180deg, #FDF6EC 0%, #F9EBD4 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
