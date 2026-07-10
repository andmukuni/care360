/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./inertia/**/*.{vue,js,ts}', './resources/views/**/*.edge'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.375rem',
        xl: '0.5rem',
      },
      colors: {
        primary: {
          DEFAULT: '#171717',
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        sand: {
          1: '#fdfdfc',
          2: '#f9f9f8',
          3: '#f1f0ef',
          4: '#e9e8e6',
          5: '#e2e1de',
          6: '#dad9d6',
          7: '#cfceca',
          8: '#bcbbb5',
          9: '#8d8d86',
          10: '#82827c',
          11: '#63635e',
          12: '#21201c',
        },
      },
    },
  },
  plugins: [],
}
