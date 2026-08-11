/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#eef1fc',
          100: '#d9defa',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
        },
        cream: {
          50: '#fdfcf7',
          100: '#faf6ea',
          200: '#f5eed6',
        },
      },
    },
  },
  plugins: [],
};
