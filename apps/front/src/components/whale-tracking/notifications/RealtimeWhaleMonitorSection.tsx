'use client'

import type {
  CreateWhaleNotificationRuleInput,
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationRule,
} from '@/features/whale-notification/types'
import { Check, Copy, RefreshCw, Trash2 } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDefaultWhaleChannels } from '@/features/whale-notification/api/whale-notification-api'
import {
  buildMonitorSymbolOptions,
  DEFAULT_MONITOR_SYMBOL,
} from '@/features/whale-notification/constants'
import { toast } from '@/lib/toast'
import { useRealtimeWhaleTrades } from './useRealtimeWhaleTrades'

interface RealtimeWhaleMonitorSectionProps {
  rules: WhaleNotificationRule[]
  onCreateRule: (input: CreateWhaleNotificationRuleInput) => Promise<{ created: boolean }>
  onUpdateRule: (id: string, input: UpdateWhaleNotificationRuleInput) => Promise<void> | void
  onDeleteRule: (id: string) => Promise<void> | void
}

export function RealtimeWhaleMonitorSection({
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
}: RealtimeWhaleMonitorSectionProps) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_MONITOR_SYMBOL)
  const [thresholdDraftBySymbol, setThresholdDraftBySymbol] = useState<Record<string, string>>({})
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const onLoadError = useCallback(() => {
    toast.error({ title: t('whaleTracking.realtime.toast.loadFailed') })
  }, [t])
  const {
    rows,
    loading,
    isPaused,
    countdown,
    setIsPaused,
  } = useRealtimeWhaleTrades(onLoadError)

  const symbolOptions = useMemo(() => {
    return buildMonitorSymbolOptions(rows.map(row => row.symbol))
  }, [rows])

  const symbolRules = useMemo(
    () => rules.filter(rule => rule.type === 'SYMBOL'),
    [rules],
  )
  const selectedSymbolRule = useMemo(
    () => symbolRules.find(rule => (rule.symbol ?? '').toUpperCase() === selectedSymbol.toUpperCase()),
    [selectedSymbol, symbolRules],
  )
  const thresholdUsd = thresholdDraftBySymbol[selectedSymbol] ?? String(selectedSymbolRule?.thresholdUsd ?? 500000)

  const filteredRows = useMemo(
    () => rows.filter(row => !selectedSymbol || row.symbol === selectedSymbol),
    [rows, selectedSymbol],
  )

  const handleCreateRule = async () => {
    const threshold = Number(thresholdUsd)
    if (!Number.isFinite(threshold) || threshold <= 0) {
      toast.error({
        title: t('common.error'),
        description: t('whaleTracking.notifications.errors.invalidThreshold'),
      })
      return
    }

    setCreating(true)
    try {
      const result = await onCreateRule({
        type: 'SYMBOL',
        symbol: selectedSymbol,
        thresholdUsd: threshold,
        channels: getDefaultWhaleChannels(),
      })
      if (result.created) {
        toast.success({ title: t('whaleTracking.notifications.toast.ruleCreated') })
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      toast.success({ title: t('whaleTracking.realtime.toast.copied') })
      window.setTimeout(() => setCopiedAddress(null), 1500)
    } catch {
      toast.error({ title: t('common.error'), description: t('common.tryAgain') })
    }
  }

  const formatRelativeTime = (timestamp: number) => {
    const diffMinutes = Math.floor((Date.now() - timestamp) / 60_000)
    if (diffMinutes <= 0) return t('whaleTracking.time.justNow')
    if (diffMinutes < 60) return t('whaleTracking.time.minutesAgo', { count: diffMinutes })
    const hours = Math.floor(diffMinutes / 60)
    return t('whaleTracking.time.hoursAgo', { count: hours })
  }

  return (
    <section className="space-y-3 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
          {t('whaleTracking.notifications.sections.realtime')} ({symbolRules.length})
        </h3>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
          <select
            value={selectedSymbol}
            onChange={e => setSelectedSymbol(e.target.value)}
            className="min-w-0 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text)] focus:border-primary focus:outline-none"
          >
            {symbolOptions.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={thresholdUsd}
            onChange={e => {
              const value = e.target.value
              setThresholdDraftBySymbol(prev => ({ ...prev, [selectedSymbol]: value }))
            }}
            className="w-full min-w-0 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text)] focus:border-primary focus:outline-none md:w-[140px]"
          />
          <button
            type="button"
            onClick={() => { void handleCreateRule() }}
            disabled={creating}
            className="from-primary to-secondary rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {creating ? t('common.loading') : t('whaleTracking.notifications.actions.createMonitor')}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(prev => !prev)}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 !text-xs !font-semibold !leading-5 transition-colors ${isPaused ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-text-strong)]' : 'from-primary to-secondary border-transparent bg-gradient-to-r text-white'}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPaused ? '' : 'animate-spin'}`} style={{ animationDuration: '3s' }} />
            <span>{isPaused ? t('whaleTracking.realtime.paused') : t('whaleTracking.realtime.nextUpdate', { count: countdown })}</span>
          </button>
        </div>
      </div>
      {!!symbolRules.length && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-2.5">
          {symbolRules.map(rule => (
            <div
              key={rule.id}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2.5 py-1.5"
            >
              <span className="text-xs font-semibold text-[color:var(--cf-text-strong)]">
                {rule.symbol} · ${rule.thresholdUsd.toLocaleString('en-US')}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={e => {
                    void onUpdateRule(rule.id, { isActive: e.target.checked })
                  }}
                />
                <span className={rule.isActive ? 'text-emerald-400' : 'text-[color:var(--cf-muted)]'}>
                  {rule.isActive
                    ? t('whaleTracking.notifications.status.active')
                    : t('whaleTracking.notifications.status.paused')}
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  void onDeleteRule(rule.id)
                }}
                className="rounded p-1 text-rose-400 transition-colors hover:bg-rose-500/10"
                aria-label={t('whaleTracking.notifications.actions.removeMonitor')}
                title={t('whaleTracking.notifications.actions.removeMonitor')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="py-5 text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">{t('common.loading')}</div>
      )}

      <div className="space-y-3 md:hidden">
        {filteredRows.map(row => (
          <article key={`${row.rowKey}-mobile`} className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => handleCopy(row.address)}
                className="min-w-0 break-all font-mono !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]"
              >
                {row.address.slice(0, 8)}...{row.address.slice(-3)}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(row.address)}
                className="shrink-0 rounded-lg border border-[color:var(--cf-border)] p-2 text-[color:var(--cf-muted)]"
              >
                {copiedAddress === row.address ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 !text-xs !font-normal !leading-5">
              <div>
                <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.realtime.table.asset')}</div>
                <div className="!font-semibold text-[color:var(--cf-text-strong)]">{row.symbol}</div>
              </div>
              <div>
                <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.realtime.table.direction')}</div>
                <span className={`inline-flex rounded-md border px-2 py-1 !text-xs !font-semibold !leading-5 ${
                  row.side === 'Long'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                }`}>
                  {row.side === 'Long' ? t('whaleTracking.side.long') : t('whaleTracking.side.short')}
                </span>
              </div>
              <div>
                <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.realtime.table.positionValue')}</div>
                <div className="font-semibold text-[color:var(--cf-text-strong)]">{row.positionValueText}</div>
              </div>
              <div>
                <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.realtime.table.entryPrice')}</div>
                <div className="text-[color:var(--cf-text)]">{row.entryPriceText}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[color:var(--cf-muted)]">{t('whaleTracking.realtime.table.time')}</div>
                <div className="text-[color:var(--cf-text-strong)]">{formatRelativeTime(row.timestamp)}</div>
              </div>
            </div>
          </article>
        ))}
        {!filteredRows.length && !loading && (
          <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-8 text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
            {t('whaleTracking.notifications.emptyRealtime')}
          </div>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-[color:var(--cf-border)]">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/70 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.address')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.asset')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.direction')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.positionValue')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.entryPrice')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.time')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.rowKey} className="border-b border-[color:var(--cf-border)]/60">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(row.address)}
                    className="inline-flex items-center gap-2 font-mono !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)] hover:text-primary"
                  >
                    <span>{row.address.slice(0, 8)}...{row.address.slice(-3)}</span>
                    {copiedAddress === row.address ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="px-4 py-3 !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{row.symbol}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md border px-2 py-1 !text-xs !font-semibold !leading-5 ${
                    row.side === 'Long'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  }`}>
                    {row.side === 'Long' ? t('whaleTracking.side.long') : t('whaleTracking.side.short')}
                  </span>
                </td>
                <td className="px-4 py-3 !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{row.positionValueText}</td>
                <td className="px-4 py-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">{row.entryPriceText}</td>
                <td className="px-4 py-3 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{formatRelativeTime(row.timestamp)}</td>
              </tr>
            ))}
            {!filteredRows.length && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                  {t('whaleTracking.notifications.emptyRealtime')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
