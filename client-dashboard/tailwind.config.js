/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Navy - structural color (sidebar, headings, primary text accents)
        indigo: {
          50: '#eef2f7',
          100: '#dbe3ee',
          200: '#aebdd6',
          500: '#2c4166',
          600: '#1e3354',
          700: '#16243d',
          800: '#101a2e',
          900: '#0b1220',
          950: '#0a1526',
        },
        // Orange - accent/CTA color (buttons, icon badges, highlights)
        accent: {
          50: '#fef6e7',
          100: '#fdecc4',
          400: '#f9b84a',
          500: '#f5a623',
          600: '#e0900f',
          700: '#b9740c',
        },
        cream: {
          50: '#f7f8fa',
          100: '#eef0f3',
          200: '#e2e6eb',
        },
      },
    },
  },
  plugins: [],
};