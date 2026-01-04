'use client'

import type { ReactNode } from 'react'
import React from 'react'
import { ToastProvider } from '@/components/ui/toast'
import '@/lib/i18n'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  )
}


