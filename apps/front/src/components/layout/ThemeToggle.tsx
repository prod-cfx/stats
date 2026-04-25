'use client'

import { Moon, Sun } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/components/providers/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- hydrate on mount only
    setMounted(true)
  }, [])

  // Avoid hydration mismatches (server can't know localStorage/theme)
  if (!mounted) {
    return <div className="h-9 w-[72px]" aria-hidden="true" />
  }

  const Icon = theme === 'dark' ? Moon : Sun
  const label =
    theme === 'dark'
      ? t('theme.dark', { defaultValue: 'Dark' })
      : t('theme.light', { defaultValue: 'Light' })
  const toggleLabel = t('theme.toggle', { defaultValue: 'Toggle light/dark mode' })

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2 text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <Icon className="h-4 w-4 text-[color:var(--cf-muted)]" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  )
}
