/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14221b",
        forest: "#1b4d3e",
        moss: "#2f6f56",
        gold: "#c4a35a",
        paper: "#f6f1e7",
        sand: "#efe6d4",
        brick: "#8c2f2f",
        ok: "#1f7a4d",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Source Sans 3", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        tablet: "0 18px 40px rgba(20, 34, 27, 0.12)",
      },
    },
  },
  plugins: [],
};
