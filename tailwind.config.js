/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // The lost & found desk: ink paper, one signal colour, film-leader greys
      colors: {
        ink: '#0E0E10',
        panel: '#17171A',
        line: '#2A2A2F',
        bone: '#F2EFE6',
        muted: '#A8A49B',
        dim: '#8A867E',
        signal: '#FF5A2E',
        nitrate: '#6FC3B8',
        gray: {
          750: '#2d3748',
          850: '#1a202c',
        }
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', '"Arial Narrow"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
