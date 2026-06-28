/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ====== Поверхности (тёплая бежевая база) ======
        soft: {
          bg: "#FAF7F2",
          surface: "#FFFFFF",
          "surface-2": "#F4EFE7",
          "surface-3": "#FBF8F3",
        },
        // ====== Текст ======
        text: {
          DEFAULT: "#1F1B16",
          soft: "#6B6358",
          muted: "#9A9388",
          inverse: "#FFFFFF",
        },
        // ====== Бренд / accent ======
        accent: {
          DEFAULT: "#F26A4A",
          dark: "#DC5635",
          soft: "#FFEEE5",
        },
        // ====== Семантика ======
        success: { DEFAULT: "#16A34A", dark: "#15803D", soft: "#DCFCE7" },
        warning: { DEFAULT: "#F5A623", dark: "#B45309", soft: "#FEF3C7" },
        info: { DEFAULT: "#2D9CDB", dark: "#0E6BA8", soft: "#E0F2FE" },
        purple: { DEFAULT: "#6E5BFF", dark: "#5847E0", soft: "#EEEBFF" },
        red: { DEFAULT: "#DC2626", dark: "#991B1B", soft: "#FEE2E2" },
        // ====== Границы ======
        border: { DEFAULT: "#ECE6DA", soft: "#F1ECE3" },
      },
      borderRadius: {
        soft: { sm: 10, md: 14, lg: 18, xl: 22, "2xl": 28, "3xl": 36 },
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
      boxShadow: {
        // Совпадают с web soft-палитрой
        "soft-sm": "0 1px 2px rgba(31, 27, 22, 0.04)",
        soft: "0 4px 16px rgba(31, 27, 22, 0.06)",
        "soft-lg": "0 12px 32px rgba(31, 27, 22, 0.08)",
      },
    }, 
  },
  plugins: [],
};
