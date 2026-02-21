/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#e0e7ff',
          DEFAULT: '#6366f1',
          dark: '#4338ca',
          accent: '#4f46e5',
        },
        secondary: {
          light: '#f3f4f6',
          DEFAULT: '#9ca3af',
          dark: '#6b7280',
        },
        background: {
          light: '#ffffff',
          DEFAULT: '#f9fafb',
          dark: '#1f2937',
          hover: '#f3f4f6',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
        },
        border: {
          light: '#e5e7eb',
          DEFAULT: '#d1d5db',
        },
        accent: {
          yellow: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}