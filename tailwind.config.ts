import type { Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
        ui:      ['"Barlow Condensed"', 'sans-serif'],
      },
      colors: {
        tier: {
          S: '#FF6B35',
          A: '#39FF14',
          B: '#00B4FF',
          C: '#CC44FF',
          D: '#FFB300',
          F: '#FF1744',
        },
      },
    },
  },
} satisfies Config
