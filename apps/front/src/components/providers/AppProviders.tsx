'use client'

import type { ReactNode } from 'react'
import type { AppLocale } from '@/lib/i18n'
import React, { useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { ToastProvider } from '@/components/ui/toast'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { createAppI18n } from '@/lib/i18n'
import { I18nSync } from './I18nSync'
import { ThemeProvider } from './ThemeProvider'

interface AppProvidersProps {
  children: ReactNode
  lng?: AppLocale
}

export function AppProviders({ children, lng = 'zh' }: AppProvidersProps) {
  // 使用 createAppI18n 创建 i18n 实例，initImmediate: false 确保 SSR 渲染正确语言
  const i18n = useMemo(() => createAppI18n(lng), [lng])

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <I18nSync />
            {children}
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
