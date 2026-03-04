'use client'

import type { WhaleDeliveryStatus, WhaleNotificationInboxItem } from '@/features/whale-notification/types'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface InboxTabProps {
  items: WhaleNotificationInboxItem[]
  loading: boolean
  onRead: (id: string) => void
  onReadAll: () => void
}

function DeliveryBadge({ status }: { status: WhaleDeliveryStatus }) {
  const statusClass =
    status === 'SENT'
      ? 'bg-emerald-500/10 text-emerald-400'
      : status === 'FAILED'
        ? 'bg-red-500/10 text-red-400'
        : status === 'PENDING'
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)]'

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass}`}>{status}</span>
}

export function InboxTab({ items, loading, onRead, onReadAll }: InboxTabProps) {
  const { t } = useTranslation()

  if (loading) {
    return <div className="py-10 text-center text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReadAll}
          className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-1.5 text-sm text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
        >
          {t('whaleTracking.notifications.actions.markAllRead')}
        </button>
      </div>

      {!items.length && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center text-sm text-[color:var(--cf-muted)]">
          {t('whaleTracking.notifications.emptyInbox')}
        </div>
      )}

      {items.map(item => (
        <div
          key={item.id}
          className={`rounded-xl border p-4 ${item.read ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]' : 'border-primary/40 bg-primary/5'}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{item.title}</div>
              <div className="mt-1 text-xs text-[color:var(--cf-muted)]">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
            {!item.read && (
              <button
                type="button"
                onClick={() => onRead(item.id)}
                className="rounded-md px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
              >
                {t('whaleTracking.notifications.actions.markRead')}
              </button>
            )}
          </div>

          <div className="mb-3 text-sm text-[color:var(--cf-text)]">{item.content}</div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.channels.web')}:</span>
            <DeliveryBadge status={item.channels.web} />
            <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.channels.email')}:</span>
            <DeliveryBadge status={item.channels.email} />
            <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.channels.telegram')}:</span>
            <DeliveryBadge status={item.channels.telegram} />
          </div>
        </div>
      ))}
    </div>
  )
}
