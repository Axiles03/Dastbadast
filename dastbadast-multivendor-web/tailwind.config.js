/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ===== Legacy dark POS-палитра (оставлена для обратной совместимости) =====
        dbd: {
          bg: "#1F1D2B",
          card: "#252836",
          accent: "#EA7369",
          border: "#393C49",
          text: "#FFFFFF",
          muted: "#92929D",
          hover: "#2D303E",
        },
        // ===== Мягкая тёплая палитра (новая основная для SoftShell) =====
        soft: {
          bg: "#FAF7F2",
          surface: "#FFFFFF",
          "surface-2": "#F4EFE7",
          text: "#1F1B16",
          "text-soft": "#6B6358",
          "text-muted": "#9A9388",
          border: "#ECE6DA",
          accent: {
            DEFAULT: "#F26A4A",
            dark: "#DC5635",
            soft: "#FFEEE5",
          },
          dark: {
            DEFAULT: "#2A2640",
            2: "#0B0B14",
            border: "#393C49",
          },
          success: {
            DEFAULT: "#16A34A",
            soft: "#DCFCE7",
          },
          rating: {
            DEFAULT: "#F5A623",
            soft: "#FEF3C7",
            dark: "#B45309",
          },
          purple: {
            DEFAULT: "#6E5BFF",
            dark: "#5847E0",
          },
        },
      },
      boxShadow: {
        // Legacy
        card: "0 8px 24px rgba(0,0,0,0.25)",
        glow: "0 0 0 1px rgba(234,115,105,0.35)",
        // Мягкие слои для светлой темы
        "soft-sm": "0 1px 2px rgba(31, 27, 22, 0.04)",
        soft: "0 4px 16px rgba(31, 27, 22, 0.06)",
        "soft-lg": "0 12px 32px rgba(31, 27, 22, 0.08)",
        "soft-xl": "0 20px 48px rgba(31, 27, 22, 0.10)",
        drawer: "-12px 0 40px rgba(31, 27, 22, 0.10)",
      },
      animation: {
        "spin-slow": "spin 18s linear infinite",
        "spin-reverse": "spin 24s linear infinite reverse",
        dash: "dash 14s linear infinite",
        float: "float 4s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        dash: {
          to: { strokeDashoffset: "-200" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
