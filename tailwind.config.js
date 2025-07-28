module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false,
  theme: {
    extend: {
      spacing: {
        '30': '7.5rem',
      },
      maxWidth: {
        '30': '7.5rem',
      },
      minWidth: {
        '30': '7.5rem',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};