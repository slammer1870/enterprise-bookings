// Tailwind v4 uses CSS-based configuration via @theme in globals.css
// This file is kept for plugin configuration only
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
const config = {
  // Content is handled via @source directives in CSS files
  plugins: [
    typography,
  ],
}

export default config
