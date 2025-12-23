import { fontFamily } from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './apps/front/src/**/*.{ts,tsx,js,jsx}',
    './apps/admin-front/src/**/*.{ts,tsx,js,jsx}',
    './packages/shared/src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

