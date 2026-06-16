'use client'

import { useMemo, useSyncExternalStore } from 'react'

interface ClientTimeTextProps {
  value: string | number | Date
  className?: string
}

const emptyServerSnapshot = () => ''
const noopSubscribe = () => () => undefined
const clientTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatClientTime(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return clientTimeFormatter.format(date)
}

export function ClientTimeText({ value, className }: ClientTimeTextProps) {
  const dateTime = useMemo(() => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }, [value])
  const getClientSnapshot = useMemo(() => () => formatClientTime(value), [value])
  const text = useSyncExternalStore(noopSubscribe, getClientSnapshot, emptyServerSnapshot)

  return (
    <time className={className} dateTime={dateTime}>
      {text}
    </time>
  )
}
