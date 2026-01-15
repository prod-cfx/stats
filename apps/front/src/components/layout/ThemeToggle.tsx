'use client'

import { Moon, Sun } from 'lucide-react'
import React from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatches (server can't know localStorage/theme)
  if (!mounted) {
    return <div className="w-[72px] h-9" aria-hidden="true" />
  }

  const Icon = theme === 'dark' ? Moon : Sun
  const label = theme === 'dark' ? '夜间' : '白天'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] transition-colors"
      aria-label="切换白天/夜间模式"
      title="切换白天/夜间模式"
    >
      <Icon className="w-4 h-4 text-[color:var(--cf-muted)]" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  )
}

