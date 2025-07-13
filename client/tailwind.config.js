/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-primary': '#1e293b',
        'game-secondary': '#334155',
        'game-accent': '#3b82f6',
        'game-success': '#10b981',
        'game-danger': '#ef4444',
        'game-warning': '#f59e0b',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
} 