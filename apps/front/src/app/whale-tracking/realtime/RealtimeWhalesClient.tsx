'use client'

import React from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { RealtimeWhalesTable } from '@/components/whale-tracking/realtime/RealtimeWhalesTable'

export function RealtimeWhalesClient() {
  return (
    <ToastProvider>
      <RealtimeWhalesTable />
    </ToastProvider>
  )
}


