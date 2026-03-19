'use client'

import type {
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationRule,
} from '@/features/whale-notification/types'
import type { TraderPositionsResponse, TraderSnapshotResponse } from '@/lib/api'
import { BellOff, Copy, Pencil, TrendingUp, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WhaleTradingStatsModal } from '@/components/whale-tracking/WhaleTradingStatsModal'
import { CreateMonitorModal } from '@/features/whale-notification/components/CreateMonitorModal'
import { fetchTraderPositions, fetchTraderSnapshot } from '@/lib/api'
import { toast } from '@/lib/toast'

interface AddressMetrics {
  totalPositionValue: number
  unrealizedPnl: number
  withdrawable: number
  marginUsagePercent: number
  positions: number
}

interface AddressMonitorSectionProps {
  rules: WhaleNotificationRule[]
  loading: boolean
  onCreate: () => void
  onUpdate: (id: string, input: UpdateWhaleNotificationRuleInput) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
}

function formatCompactUsd(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$ ${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$ ${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `$ ${(value / 1_000).toFixed(1)}K`
  return `$ ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function AddressMonitorSection({
  rules,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}: AddressMonitorSectionProps) {
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState<Record<string, AddressMetrics | null>>({})
  const [statsAddress, setStatsAddress] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<WhaleNotificationRule | null>(null)

  const addressRules = useMemo(
    () => rules.filter(rule => rule.type === 'ADDRESS' && rule.address),
    [rules],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!addressRules.length) {
        if (!cancelled) setMetrics({})
        return
      }

      const next: Record<string, AddressMetrics | null> = {}
      await Promise.all(
        addressRules.map(async (rule) => {
          const address = rule.address!
          try {
            const [snapshot, positions] = await Promise.all([
              fetchTraderSnapshot(address),
              fetchTraderPositions(address, { type: 'perp' }),
            ])
            const typedSnapshot = snapshot as TraderSnapshotResponse
            const typedPositions = positions as TraderPositionsResponse
            next[address] = {
              totalPositionValue: Number(typedSnapshot.perp?.totalPositionValue ?? 0),
              unrealizedPnl: Number(typedSnapshot.perp?.unrealizedPnl ?? 0),
              withdrawable: Number(typedSnapshot.perp?.withdrawable ?? 0),
              marginUsagePercent: Number(typedSnapshot.perp?.marginUsagePercent ?? 0),
              positions: Array.isArray(typedPositions.perp) ? typedPositions.perp.length : 0,
            }
          } catch {
            next[address] = null
          }
        }),
      )

      if (!cancelled) setMetrics(next)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [addressRules])

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success({ title: t('common.copied') })
    } catch {
      toast.error({ title: t('common.error'), description: t('common.tryAgain') })
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">
          {t('whaleTracking.notifications.sections.address')} ({addressRules.length})
        </h3>
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

      {!loading && !addressRules.length && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">
          {t('whaleTracking.notifications.emptyAddress')}
        </div>
      )}

      {!!addressRules.length && (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--cf-border)]">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/70 text-xs text-[color:var(--cf-muted)]">
                <th className="px-4 py-3 text-left">{t('whaleTracking.holdings.table.address')}</th>
                <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.addressMetrics.totalValue')}</th>
                <th className="px-4 py-3 text-left">{t('whaleTracking.holdings.table.unrealizedPnl')}</th>
                <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.addressMetrics.withdrawable')}</th>
                <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.addressMetrics.marginUsage')}</th>
                <th className="px-4 py-3 text-left">{t('whaleTracking.notifications.addressMetrics.positions')}</th>
                <th className="px-4 py-3 text-right">{t('whaleTracking.notifications.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {addressRules.map((rule) => {
                const address = rule.address!
                const item = metrics[address]
                const pnl = item?.unrealizedPnl ?? 0
                const pnlClass = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                return (
                  <tr key={rule.id} className="border-b border-[color:var(--cf-border)]/60 bg-[color:var(--cf-surface)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[color:var(--cf-text-strong)]">
                          {address.slice(0, 10)}...{address.slice(-4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(address)}
                          className="rounded p-1 text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {rule.note && <span className="text-xs text-[color:var(--cf-muted)]">{rule.note}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--cf-text-strong)]">
                      {item ? formatCompactUsd(item.totalPositionValue) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold ${item ? pnlClass : 'text-[color:var(--cf-text-strong)]'}`}>
                      {item ? formatCompactUsd(item.unrealizedPnl) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--cf-text-strong)]">
                      {item ? formatCompactUsd(item.withdrawable) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--cf-text-strong)]">
                      {item ? `${item.marginUsagePercent.toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--cf-text-strong)]">
                      {item ? item.positions : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatsAddress(address)}
                          className="rounded-lg border border-[color:var(--cf-border)] p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                          title={t('whaleTracking.notifications.actions.tradingStats')}
                        >
                          <TrendingUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onUpdate(rule.id, {
                              channels: { ...rule.channels, telegram: false },
                            })
                          }}
                          disabled={!rule.channels.telegram}
                          className="rounded-lg border border-[color:var(--cf-border)] p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                          title={t('whaleTracking.notifications.actions.disableTelegram')}
                        >
                          <BellOff className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRule(rule)}
                          className="rounded-lg border border-[color:var(--cf-border)] p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                          title={t('whaleTracking.notifications.actions.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void onDelete(rule.id) }}
                          className="rounded-lg border border-[color:var(--cf-border)] p-1.5 text-rose-400 hover:bg-rose-500/10"
                          title={t('whaleTracking.notifications.actions.removeMonitor')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <WhaleTradingStatsModal
        isOpen={Boolean(statsAddress)}
        address={statsAddress ?? ''}
        onClose={() => setStatsAddress(null)}
      />

      {editingRule && (
        <CreateMonitorModal
          isOpen={Boolean(editingRule)}
          mode="ADDRESS"
          presetAddress={editingRule.address}
          titleOverride={t('whaleTracking.notifications.modal.editAddressTitle')}
          submitText={t('whaleTracking.notifications.actions.save')}
          initialValues={{
            thresholdUsd: editingRule.thresholdUsd,
            note: editingRule.note,
            channels: editingRule.channels,
          }}
          onClose={() => setEditingRule(null)}
          onCreate={async (input) => {
            await onUpdate(editingRule.id, {
              thresholdUsd: input.thresholdUsd,
              note: input.note,
              channels: input.channels,
            })
            return { created: true }
          }}
        />
      )}
    </section>
  )
}

