/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'serpico-red': '#DC2626',
        'serpico-blue': '#2563EB',
        'serpico-red-light': '#EF4444',
        'serpico-blue-light': '#3B82F6',
        'serpico-red-dark': '#B91C1C',
        'serpico-blue-dark': '#1E40AF',
      },
    },
  },
  plugins: [],
}

