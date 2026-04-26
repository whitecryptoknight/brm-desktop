/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  theme: {
    extend: {
      colors: {
        brm: {
          forest: {
            950: "#0D1F13",
            800: "#1B3A22",
            700: "#243F2B",
            600: "#2D5535",
          },
          amber: {
            700: "#C56A00",
            600: "#E07810",
            500: "#F5A623",
            400: "#F7BB55",
            50:  "#FFF8EC",
          },
          parchment: "#F7F4EF",
          border:    "#DDD8CE",
        },
      },
    },
  },
  plugins: [],
};
