/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/mediclinic-system.html",
    "./public/mediclinic-app.js",
    "./public/mediclinic-manager.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: { DEFAULT: "#2B7A9E", d: "#236583" },
        peach: { DEFAULT: "#E8734A", d: "#B3431B" },
        ok: "#276749",
        bad: "#C53030",
        snow: "#F7F9FA",
        line: "#E2E8F0",
        ink: "#1A202C",
        slate2: "#4A5568",
        mute: "#52637A",
      },
    },
  },
  plugins: [],
};
