/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      colors: {
        // Legacy aliases → neon palette
        'serpico-red': '#ff2bd6',
        'serpico-blue': '#00f5ff',
        'serpico-red-light': '#ff6be8',
        'serpico-blue-light': '#66faff',
        'serpico-red-dark': '#cc1fa8',
        'serpico-blue-dark': '#00c4d4',
        // Synth world palette
        synth: {
          void: '#07050f',
          deep: '#0f0820',
          panel: '#151030',
          border: '#2a1f5c',
          muted: '#9b8ec4',
          text: '#e8e0ff',
        },
        neon: {
          cyan: '#00f5ff',
          magenta: '#ff2bd6',
          green: '#00ff88',
          purple: '#7b2ff7',
          blue: '#4d9fff',
          amber: '#ffbd00',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0, 245, 255, 0.5), 0 0 30px rgba(0, 245, 255, 0.2)',
        'neon-magenta': '0 0 10px rgba(255, 43, 214, 0.5), 0 0 30px rgba(255, 43, 214, 0.2)',
        'neon-green': '0 0 10px rgba(0, 255, 136, 0.5), 0 0 30px rgba(0, 255, 136, 0.2)',
        'neon-purple': '0 0 15px rgba(123, 47, 247, 0.6), 0 0 40px rgba(123, 47, 247, 0.25)',
        'game-panel': '0 0 20px rgba(123, 47, 247, 0.2), inset 0 0 40px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'grid-scroll': 'grid-scroll 20s linear infinite',
        'glow-shift': 'glow-shift 4s ease-in-out infinite',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.85', filter: 'brightness(1.15)' },
        },
        'grid-scroll': {
          '0%': { backgroundPosition: '0 0, 0 0, 0 0, 0 0' },
          '100%': { backgroundPosition: '40px 40px, 40px 40px, 0 0, 0 0' },
        },
        'glow-shift': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 245, 255, 0.3), 0 0 40px rgba(123, 47, 247, 0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(255, 43, 214, 0.35), 0 0 50px rgba(0, 255, 136, 0.15)' },
        },
      },
      backgroundImage: {
        'synth-grid': `
          linear-gradient(rgba(0, 245, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 245, 255, 0.04) 1px, transparent 1px),
          radial-gradient(ellipse at 50% 0%, rgba(123, 47, 247, 0.28) 0%, transparent 55%),
          radial-gradient(ellipse at 90% 90%, rgba(0, 255, 136, 0.1) 0%, transparent 45%)
        `,
      },
      backgroundSize: {
        synth: '40px 40px, 40px 40px, 100% 100%, 100% 100%',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
