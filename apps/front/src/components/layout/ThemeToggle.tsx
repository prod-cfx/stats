'use client'

import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/components/providers/ThemeProvider'

export function ThemeToggle() {
  const { toggleTheme } = useTheme()
  const { t } = useTranslation()

  const toggleLabel = t('theme.toggle', { defaultValue: 'Toggle light/dark mode' })

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-10 w-10 items-center justify-center rounded-full text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface-hover)] md:min-h-8 md:w-8"
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <span className="hidden dark:inline-flex" aria-hidden="true">
        <Moon className="size-4 text-[color:var(--cf-muted)]" />
      </span>
      <span className="inline-flex dark:hidden" aria-hidden="true">
        <Sun className="size-4 text-[color:var(--cf-muted)]" />
      </span>
    </button>
  )
}
