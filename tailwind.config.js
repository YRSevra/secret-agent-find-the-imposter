/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agency: {
          bg: '#0A0C10',         // Main background: Deep charcoal / near-black
          bgSecondary: '#0E131C',// Secondary background
          card: '#111622',       // Card surface
          surface: '#162032',    // Elevated surface
          navy: '#162032',       // Dark navy
          accent: '#00FF88',     // Classified neon green
          accentGlow: 'rgba(0, 255, 136, 0.25)',
          warning: '#EF4444',    // Muted red
          amber: '#F59E0B',      // Warning amber
          border: '#1E293B',     // Subtle dark slate border
          borderLight: '#334155',// Lighter slate border for interactive states
          text: '#F8FAFC',       // Primary text: crisp white
          muted: '#94A3B8',      // Secondary text: soft gray
          dark: '#05070A',       // Deepest black for code/terminals
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(0, 255, 136, 0.2)',
        'glow-md': '0 0 20px rgba(0, 255, 136, 0.3)',
        'glow-lg': '0 0 35px rgba(0, 255, 136, 0.4)',
        'card-dark': '0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(30, 41, 59, 0.6)',
      },
      backgroundImage: {
        'radar-grid': 'radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.04) 0%, transparent 70%)',
        'grid-pattern': 'linear-gradient(to right, rgba(30, 41, 59, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(30, 41, 59, 0.2) 1px, transparent 1px)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-spin': 'radarSpin 8s linear infinite',
      },
      keyframes: {
        radarSpin: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
