/* eslint-disable react-refresh/only-export-components */
'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'cf-theme'

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  // Help browser render built-in controls correctly
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    // Read initial theme synchronously to avoid "first render uses dark" issues
    // (important for charts that initialize on mount).
    try {
      const fromDom = document.documentElement.dataset.theme
      if (fromDom === 'light' || fromDom === 'dark') return fromDom
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
      const preferred =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      return preferred
    } catch {
      return 'dark'
    }
  })

  // Initialize from DOM (set by inline script) / localStorage fallback
  useEffect(() => {
    try {
      const fromDom = document.documentElement.dataset.theme
      if (fromDom === 'light' || fromDom === 'dark') {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- hydration sync
        setThemeState(fromDom)
        return
      }
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        applyTheme(stored)
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- hydration sync
        setThemeState(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // ignore
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
