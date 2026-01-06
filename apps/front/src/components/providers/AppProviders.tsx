'use client'

import type { ReactNode } from 'react'
import type { AppLocale } from '@/lib/i18n'
import React, { useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { ToastProvider } from '@/components/ui/toast'
import { createAppI18n } from '@/lib/i18n'

export function AppProviders({ children, initialLocale }: { children: ReactNode; initialLocale: AppLocale }) {
  const i18n = useMemo(() => createAppI18n(initialLocale), [initialLocale])
  return (
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </I18nextProvider>
  )
}


