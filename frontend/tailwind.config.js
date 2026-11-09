/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dicom: {
          bg: '#0a0d14',
          panel: '#111726',
          border: '#1e293b',
          accent: '#38bdf8',
          accentHover: '#0284c7',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
