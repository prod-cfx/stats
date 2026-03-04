'use client'

import type { WhaleNotificationRule } from '@/features/whale-notification/types'
import { Trash2 } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface RulesTabProps {
  rules: WhaleNotificationRule[]
  loading: boolean
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}

export function RulesTab({ rules, loading, onToggle, onDelete }: RulesTabProps) {
  const { t } = useTranslation()

  if (loading) {
    return <div className="py-10 text-center text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</div>
  }

  if (!rules.length) {
    return (
      <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center text-sm text-[color:var(--cf-muted)]">
        {t('whaleTracking.notifications.emptyRules')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-[color:var(--cf-border)] text-xs uppercase tracking-wider text-[color:var(--cf-muted)]">
            <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.table.type')}</th>
            <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.table.target')}</th>
            <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.table.threshold')}</th>
            <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.table.channels')}</th>
            <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.table.status')}</th>
            <th className="px-4 py-3 text-right">{t('whaleTracking.notifications.table.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--cf-border)]">
          {rules.map(rule => (
            <tr key={rule.id}>
              <td className="px-4 py-4 text-sm text-[color:var(--cf-text-strong)]">
                {rule.type === 'ADDRESS'
                  ? t('whaleTracking.notifications.ruleType.address')
                  : t('whaleTracking.notifications.ruleType.symbol')}
              </td>
              <td className="px-4 py-4 text-sm text-[color:var(--cf-text-strong)]">
                {rule.type === 'ADDRESS' ? rule.address : rule.symbol}
              </td>
              <td className="px-4 py-4 text-sm text-[color:var(--cf-text)]">${rule.thresholdUsd.toLocaleString('en-US')}</td>
              <td className="px-4 py-4 text-sm text-[color:var(--cf-text)]">
                {[rule.channels.web ? t('whaleTracking.notifications.channels.web') : null,
                  rule.channels.email ? t('whaleTracking.notifications.channels.email') : null,
                  rule.channels.telegram ? t('whaleTracking.notifications.channels.telegram') : null]
                  .filter(Boolean)
                  .join(' / ') || '-'}
              </td>
              <td className="px-4 py-4 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={e => onToggle(rule.id, e.target.checked)}
                  />
                  <span className={rule.isActive ? 'text-emerald-400' : 'text-[color:var(--cf-muted)]'}>
                    {rule.isActive ? t('whaleTracking.notifications.status.active') : t('whaleTracking.notifications.status.paused')}
                  </span>
                </label>
              </td>
              <td className="px-4 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onDelete(rule.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('whaleTracking.notifications.actions.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
