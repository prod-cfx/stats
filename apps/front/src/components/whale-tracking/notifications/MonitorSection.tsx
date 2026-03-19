'use client'

import type { WhaleNotificationRule } from '@/features/whale-notification/types'
import { Copy, Trash2 } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'

interface MonitorSectionProps {
  title: string
  rules: WhaleNotificationRule[]
  loading: boolean
  emptyText: string
  onCreate: () => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}

export function MonitorSection({
  title,
  rules,
  loading,
  emptyText,
  onCreate,
  onToggle,
  onDelete,
}: MonitorSectionProps) {
  const { t } = useTranslation()

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success({ title: t('common.copied') })
    } catch {
      toast.error({ title: t('common.error'), description: t('common.tryAgain') })
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">{title} ({rules.length})</h3>
        <button
          type="button"
          onClick={onCreate}
          className="from-primary to-secondary rounded-full bg-gradient-to-r px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('whaleTracking.notifications.actions.createMonitor')}
        </button>
      </div>

      {loading && (
        <div className="py-6 text-center text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</div>
      )}

      {!loading && !rules.length && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">
          {emptyText}
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => {
          const target = rule.type === 'ADDRESS' ? (rule.address ?? '-') : (rule.symbol ?? '-')
          const channelText = [
            rule.channels.web ? t('whaleTracking.notifications.channels.web') : null,
            rule.channels.email ? t('whaleTracking.notifications.channels.email') : null,
            rule.channels.telegram ? t('whaleTracking.notifications.channels.telegram') : null,
          ].filter(Boolean).join(' / ') || '-'

          return (
            <div
              key={rule.id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 md:grid-cols-[1.4fr_1fr_1.2fr_auto] md:items-center"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[color:var(--cf-text-strong)]">
                  {rule.type === 'ADDRESS' ? `${target.slice(0, 8)}...${target.slice(-4)}` : target}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(target)}
                  className="rounded p-1 text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {rule.note && <span className="text-xs text-[color:var(--cf-muted)]">{rule.note}</span>}
              </div>

              <div className="text-sm text-[color:var(--cf-text)]">
                {t('whaleTracking.notifications.table.threshold')}: ${rule.thresholdUsd.toLocaleString('en-US')}
              </div>

              <div className="text-sm text-[color:var(--cf-muted)]">{channelText}</div>

              <div className="flex items-center justify-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={e => onToggle(rule.id, e.target.checked)}
                  />
                  <span className={rule.isActive ? 'text-emerald-400' : 'text-[color:var(--cf-muted)]'}>
                    {rule.isActive ? t('whaleTracking.notifications.status.active') : t('whaleTracking.notifications.status.paused')}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => onDelete(rule.id)}
                  className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                  aria-label={t('whaleTracking.notifications.actions.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
