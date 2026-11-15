/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Palette
        'ice-silver': '#DCE3E8',
        'deep-aubergine': {
          DEFAULT: '#25162F',
          dark: '#190E20',
          darker: '#120A17',
          surface: '#311E3E',
          card: '#291834',
          border: '#3D264D',
        },
        'marigold': {
          DEFAULT: '#E6AD3C',
          light: '#F0C265',
          dark: '#B88422',
        },
        // Supporting Palette
        'muted-lavender': '#8F7B9E',
        'slate-grey': '#65717C',
        'soft-silver': '#AEBAC4',

        // Restrained Financial Status Indicators
        status: {
          approved: {
            bg: 'rgba(46, 125, 50, 0.12)',
            text: '#81C784',
            border: 'rgba(76, 175, 80, 0.3)',
            solid: '#2E7D32',
          },
          hold: {
            bg: 'rgba(217, 119, 6, 0.12)',
            text: '#FCD34D',
            border: 'rgba(245, 158, 11, 0.3)',
            solid: '#D97706',
          },
          blocked: {
            bg: 'rgba(198, 40, 40, 0.12)',
            text: '#E57373',
            border: 'rgba(239, 83, 80, 0.3)',
            solid: '#C62828',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 2px 8px -2px rgba(0, 0, 0, 0.25)',
        'elevated': '0 8px 24px -4px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
