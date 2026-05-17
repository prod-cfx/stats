'use client'

import type {
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationRule,
} from '@/features/whale-notification/types'
import type { TraderPositionsResponse, TraderSnapshotResponse } from '@/lib/api'
import { BellOff, Copy, Pencil, TrendingUp, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { fetchTraderPositions, fetchTraderSnapshot } from '@/lib/api'
import { toast } from '@/lib/toast'

const WhaleTradingStatsModal = dynamic(
  () =>
    import('@/components/whale-tracking/WhaleTradingStatsModal').then(
      mod => mod.WhaleTradingStatsModal,
    ),
  { ssr: false, loading: () => null },
)

const CreateMonitorModal = dynamic(
  () =>
    import('@/features/whale-notification/components/CreateMonitorModal').then(
      mod => mod.CreateMonitorModal,
    ),
  { ssr: false, loading: () => null },
)

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
  onDelete: (id: string) => Promise<void>
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
  const [deleteRule, setDeleteRule] = useState<WhaleNotificationRule | null>(null)
  const [isDeletingRule, setIsDeletingRule] = useState(false)

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
        addressRules.map(async rule => {
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

  const handleConfirmDelete = async () => {
    if (!deleteRule || isDeletingRule) return
    setIsDeletingRule(true)
    try {
      await onDelete(deleteRule.id)
      setDeleteRule(null)
    } catch {
      toast.error({
        title: t('whaleTracking.notifications.toast.deleteFailed'),
        description: t('common.tryAgain'),
      })
    } finally {
      setIsDeletingRule(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
          {t('whaleTracking.notifications.sections.address')} ({addressRules.length})
        </h3>
        <button
          type="button"
          onClick={onCreate}
          className="from-primary to-secondary rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white transition-opacity hover:opacity-90"
        >
          {t('whaleTracking.notifications.actions.createMonitor')}
        </button>
      </div>

      {loading && (
        <div className="py-5 text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
          {t('common.loading')}
        </div>
      )}

      {!loading && !addressRules.length && (
        <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-5 text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
          {t('whaleTracking.notifications.emptyAddress')}
        </div>
      )}

      {!!addressRules.length && (
        <>
        <div className="space-y-3 md:hidden">
          {addressRules.map(rule => {
            const address = rule.address!
            const item = metrics[address]
            const pnl = item?.unrealizedPnl ?? 0
            const pnlClass = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            return (
              <article
                key={`${rule.id}-mobile`}
                className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
                        {address.slice(0, 10)}...{address.slice(-4)}
                      </span>
                      <button
                        data-testid="address-monitor-mobile-copy"
                        type="button"
                        onClick={() => handleCopy(address)}
                        className="rounded-lg border border-[color:var(--cf-border)] p-2 text-[color:var(--cf-muted)]"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {rule.note && <div className="mt-1 break-words !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{rule.note}</div>}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <button
                      data-testid="address-monitor-mobile-stats"
                      type="button"
                      onClick={() => setStatsAddress(address)}
                      className="rounded-lg border border-[color:var(--cf-border)] p-2 text-[color:var(--cf-muted)]"
                      title={t('whaleTracking.notifications.actions.tradingStats')}
                    >
                      <TrendingUp className="h-4 w-4" />
                    </button>
                    <button
                      data-testid="address-monitor-mobile-disable-telegram"
                      type="button"
                      onClick={() => {
                        void onUpdate(rule.id, {
                          channels: { ...rule.channels, telegram: false },
                        })
                      }}
                      disabled={!rule.channels.telegram}
                      className="rounded-lg border border-[color:var(--cf-border)] p-2 text-[color:var(--cf-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                      title={t('whaleTracking.notifications.actions.disableTelegram')}
                    >
                      <BellOff className="h-4 w-4" />
                    </button>
                    <button
                      data-testid="address-monitor-mobile-edit"
                      type="button"
                      onClick={() => setEditingRule(rule)}
                      className="rounded-lg border border-[color:var(--cf-border)] p-2 text-[color:var(--cf-muted)]"
                      title={t('whaleTracking.notifications.actions.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      data-testid="address-monitor-mobile-delete"
                      type="button"
                      onClick={() => setDeleteRule(rule)}
                      className="rounded-lg border border-[color:var(--cf-border)] p-2 text-rose-400"
                      title={t('whaleTracking.notifications.actions.removeMonitor')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 !text-xs !font-normal !leading-5">
                  <div>
                    <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.addressMetrics.totalValue')}</div>
                    <div className="font-semibold text-[color:var(--cf-text-strong)]">{item ? formatCompactUsd(item.totalPositionValue) : '-'}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.holdings.table.unrealizedPnl')}</div>
                    <div className={`font-semibold ${item ? pnlClass : 'text-[color:var(--cf-text-strong)]'}`}>{item ? formatCompactUsd(item.unrealizedPnl) : '-'}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.addressMetrics.withdrawable')}</div>
                    <div className="text-[color:var(--cf-text-strong)]">{item ? formatCompactUsd(item.withdrawable) : '-'}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.addressMetrics.marginUsage')}</div>
                    <div className="text-[color:var(--cf-text-strong)]">{item ? `${item.marginUsagePercent.toFixed(0)}%` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.addressMetrics.positions')}</div>
                    <div className="text-[color:var(--cf-text-strong)]">{item ? item.positions : '-'}</div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-xl border border-[color:var(--cf-border)]">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/70 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
                <th className="px-4 py-3 text-left">{t('whaleTracking.holdings.table.address')}</th>
                <th className="px-4 py-3 text-left">
                  {t('whaleTracking.notifications.addressMetrics.totalValue')}
                </th>
                <th className="px-4 py-3 text-left">
                  {t('whaleTracking.holdings.table.unrealizedPnl')}
                </th>
                <th className="px-4 py-3 text-left">
                  {t('whaleTracking.notifications.addressMetrics.withdrawable')}
                </th>
                <th className="px-4 py-3 text-left">
                  {t('whaleTracking.notifications.addressMetrics.marginUsage')}
                </th>
                <th className="px-4 py-3 text-left">
                  {t('whaleTracking.notifications.addressMetrics.positions')}
                </th>
                <th className="px-4 py-3 text-right">
                  {t('whaleTracking.notifications.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {addressRules.map(rule => {
                const address = rule.address!
                const item = metrics[address]
                const pnl = item?.unrealizedPnl ?? 0
                const pnlClass = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                return (
                  <tr
                    key={rule.id}
                    className="border-b border-[color:var(--cf-border)]/60 bg-[color:var(--cf-surface)]"
                  >
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
                        {rule.note && (
                          <span className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{rule.note}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--cf-text-strong)]">
                      {item ? formatCompactUsd(item.totalPositionValue) : '-'}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-semibold ${item ? pnlClass : 'text-[color:var(--cf-text-strong)]'}`}
                    >
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
                          onClick={() => setDeleteRule(rule)}
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
        </>
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
          onCreate={async input => {
            await onUpdate(editingRule.id, {
              thresholdUsd: input.thresholdUsd,
              note: input.note,
              channels: input.channels,
            })
            return { created: true }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteRule)}
        title={t('whaleTracking.notifications.confirmDelete.title')}
        description={t('whaleTracking.notifications.confirmDelete.description', {
          address: deleteRule?.address ?? '',
        })}
        confirmText={
          isDeletingRule
            ? t('common.loading')
            : t('whaleTracking.notifications.actions.removeMonitor')
        }
        cancelText={t('common.cancel')}
        confirmVariant="danger"
        disabled={isDeletingRule}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
        onCancel={() => {
          if (!isDeletingRule) setDeleteRule(null)
        }}
      />
    </section>
  )
}
