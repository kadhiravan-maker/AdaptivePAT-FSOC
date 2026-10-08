/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          dark: '#040814',
          panel: '#0b1426',
          panelHeader: '#101b33',
          border: '#1a365d',
          cyan: '#00aaff',
          blue: '#3b82f6',
          laser: '#ff0055',
          beacon: '#00ff66',
          purple: '#b000ff'
        }
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, rgba(0, 170, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 170, 255, 0.05) 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}
