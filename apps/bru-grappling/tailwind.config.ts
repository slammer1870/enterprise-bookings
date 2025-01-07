/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{jsx,tsx}',
    './src/app/**/*.{jsx,tsx}',
    '../../packages/bookings/src/**/*{.js,.ts,.jsx,.tsx}',
  ], // tell tailwind where to look
  theme: {
    extend: {},
  },
  plugins: [],
}
