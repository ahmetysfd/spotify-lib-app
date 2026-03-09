/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1DB954",
          "green-light": "#1ed760",
          black: "#191414",
          dark: "#121212",
          gray: {
            100: "#b3b3b3",
            200: "#535353",
            300: "#282828",
            400: "#181818",
            500: "#121212",
          },
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
