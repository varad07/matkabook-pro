/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gold:     "#D4A017",
        darkgold: "#A87C10",
        dark:     "#0D0D0D",
        card:     "#1A1A2E",
        midcard:  "#16213E",
      },
    },
  },
  plugins: [],
};
