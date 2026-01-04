'use client'

import type { ReactNode} from 'react';
import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Ensure we don't SSR-render untranslated keys and cause hydration mismatches.
    // We render children only after i18next is initialized on the client.
    const markReady = () => setReady(true)

    if (i18n.isInitialized) {
      markReady()
    }
    else {
      i18n.on('initialized', markReady)
    }

    const handleLanguageChanged = (lng: string) => {
      document.documentElement.lang = lng
    }

    i18n.on('languageChanged', handleLanguageChanged)
    // Set initial lang
    if (i18n.language) {
      document.documentElement.lang = i18n.language
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
      i18n.off('initialized', markReady)
    }
  }, [])

  if (!ready)
    return null

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

