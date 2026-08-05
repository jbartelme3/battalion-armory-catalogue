/** @type {import('tailwindcss').Config} */
export default {
  content: ["./frontend/index.html", "./frontend/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        condition: {
          green: "#16a34a",
          yellow: "#ca8a04",
          red: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
