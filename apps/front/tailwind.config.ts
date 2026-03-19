import type { Config } from 'tailwindcss'
import baseConfig from '../../tailwind.config.js'

const config: Config = {
  ...baseConfig,
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...(baseConfig.theme?.extend || {}),
      animation: {
        scroll: 'scroll 30s linear infinite',
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
}

export default config
