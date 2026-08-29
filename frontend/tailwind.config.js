/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['IBM Plex Sans', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      colors: {
        // Legacy aliases → police-force accents (class names unchanged)
        'serpico-red': '#ff4d6d',
        'serpico-blue': '#3ec6ff',
        'serpico-red-light': '#ff7a90',
        'serpico-blue-light': '#7dd8ff',
        'serpico-red-dark': '#e03555',
        'serpico-blue-dark': '#1aa8e8',
        synth: {
          void: '#061428',
          deep: '#0a1f3d',
          panel: '#0e2a52',
          border: '#1e4a7a',
          muted: '#8fb0d4',
          text: '#e8f1fb',
        },
        neon: {
          cyan: '#3ec6ff',
          magenta: '#ff4d6d',
          green: '#3dff9a',
          purple: '#2f6fd6',
          blue: '#5aa8ff',
          amber: '#ffc107',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(62, 198, 255, 0.35), 0 0 20px rgba(62, 198, 255, 0.12)',
        'neon-magenta': '0 0 8px rgba(255, 77, 109, 0.35), 0 0 20px rgba(255, 77, 109, 0.12)',
        'neon-green': '0 0 8px rgba(61, 255, 154, 0.3), 0 0 18px rgba(61, 255, 154, 0.1)',
        'neon-purple': '0 0 10px rgba(47, 111, 214, 0.35), 0 0 24px rgba(10, 31, 61, 0.35)',
        'game-panel': '0 8px 24px rgba(6, 20, 40, 0.45), inset 0 0 24px rgba(6, 20, 40, 0.25)',
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'grid-scroll': 'grid-scroll 20s linear infinite',
        'glow-shift': 'glow-shift 4s ease-in-out infinite',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.9', filter: 'brightness(1.08)' },
        },
        'grid-scroll': {
          '0%': { backgroundPosition: '0 0, 0 0, 0 0, 0 0' },
          '100%': { backgroundPosition: '40px 40px, 40px 40px, 0 0, 0 0' },
        },
        'glow-shift': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(62, 198, 255, 0.22), 0 0 28px rgba(47, 111, 214, 0.12)' },
          '50%': { boxShadow: '0 0 18px rgba(90, 168, 255, 0.28), 0 0 32px rgba(255, 193, 7, 0.08)' },
        },
      },
      backgroundImage: {
        'synth-grid': `
          linear-gradient(rgba(62, 198, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(62, 198, 255, 0.035) 1px, transparent 1px),
          radial-gradient(ellipse at 50% 0%, rgba(47, 111, 214, 0.22) 0%, transparent 55%),
          radial-gradient(ellipse at 90% 90%, rgba(62, 198, 255, 0.08) 0%, transparent 45%)
        `,
      },
      backgroundSize: {
        synth: '40px 40px, 40px 40px, 100% 100%, 100% 100%',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
