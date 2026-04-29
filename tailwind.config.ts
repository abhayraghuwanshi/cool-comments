import type { Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        tier: {
          S: "#ff7f00",
          A: "#00c853",
          B: "#2979ff",
          C: "#aa00ff",
          D: "#ff6d00",
          F: "#d50000",
        },
      },
    },
  },
} satisfies Config
