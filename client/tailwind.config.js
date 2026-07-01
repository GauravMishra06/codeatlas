/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          bg: '#0D1117',
          card: '#161B22',
          border: '#30363D',
          text: '#E6EDF3',
          muted: '#8B949E',
          blue: '#58A6FF',
          green: '#3FB950',
          purple: '#BC8CFF',
          yellow: '#E3B341',
          red: '#F78166',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
