'use client'

import type { ReactNode } from 'react'
import React, { useMemo } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import i18n from '@/lib/i18n'
import { I18nSync } from './I18nSync'

export type AppLocale = 'zh' | 'en'

interface AppProvidersProps {
  children: ReactNode
  lng?: AppLocale
}

export function AppProviders({ children, lng }: AppProvidersProps) {
  // 在渲染前同步设置 i18n 语言，确保构建期 HTML 就是目标语言
  useMemo(() => {
    if (lng && i18n.language !== lng) {
      i18n.changeLanguage(lng)
    }
  }, [lng])

  return (
    <ToastProvider>
      <I18nSync />
      {children}
    </ToastProvider>
  )
}


