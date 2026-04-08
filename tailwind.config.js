import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "error": "#c12048",
        "surface-dim": "#e5e2d9",
        "primary-fixed": "#fddc00",
        "inverse-primary": "#fddc00",
        "on-primary-fixed-variant": "#665800",
        "inverse-surface": "#0e0e0b",
        "surface-container": "#f6f3eb",
        "on-surface-variant": "#65645f",
        "error-container": "#f74b6d",
        "secondary": "#cc000c",
        "on-tertiary-fixed-variant": "#00308f",
        "tertiary-fixed-dim": "#829fff",
        "on-tertiary-fixed": "#001345",
        "on-primary": "#ffffff",
        "tertiary-fixed": "#96adff",
        "on-tertiary-container": "#00297c",
        "on-primary-container": "#5b4e00",
        "tertiary-dim": "#2750bc",
        "inverse-on-surface": "#9f9d97",
        "surface-container-lowest": "#ffffff",
        "secondary-container": "#ffc3bb",
        "on-primary-fixed": "#463b00",
        "surface": "#fdffda",
        "primary-dim": "#665800",
        "on-error-container": "#510017",
        "error-dim": "#a70138",
        "on-secondary-fixed": "#700003",
        "on-surface": "#383833",
        "primary-fixed-dim": "#edce00",
        "tertiary": "#375dc9",
        "primary": "#746400",
        "outline": "#82807b",
        "surface-bright": "#fdffda",
        "secondary-fixed": "#ffc3bb",
        "on-secondary-fixed-variant": "#a60008",
        "surface-container-low": "#fcf9f1",
        "surface-tint": "#746400",
        "on-error": "#ffffff",
        "surface-variant": "#ebe8df",
        "on-secondary-container": "#940006",
        "secondary-dim": "#b50009",
        "tertiary-container": "#96adff",
        "on-background": "#383833",
        "secondary-fixed-dim": "#ffb0a5",
        "primary-container": "#fddc00",
        "surface-container-high": "#f0eee5",
        "outline-variant": "#bbb9b3",
        "on-tertiary": "#ffffff",
        "on-secondary": "#ffffff",
        "surface-container-highest": "#ebe8df",
        "background": "#fdffda"
      },
      "borderRadius": {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      "fontFamily": {
        "headline": ["Epilogue"],
        "body": ["Be Vietnam Pro"],
        "label": ["Space Grotesk"]
      },
      "keyframes": {
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" }
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" }
        }
      },
      "animation": {
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 3s infinite",
        "wiggle": "wiggle 3s ease-in-out infinite",
        "spin-slow": "spin 12s linear infinite"
      }
    },
  },
  plugins: [forms, containerQueries],
}
