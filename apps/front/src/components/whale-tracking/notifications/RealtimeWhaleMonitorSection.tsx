'use client'

import type { WhaleTradeDto } from '@ai/api-contracts'
import type { CreateWhaleNotificationRuleInput, WhaleNotificationRule } from '@/features/whale-notification/types'
import { Check, Copy, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDefaultWhaleChannels } from '@/features/whale-notification/api/whale-notification-api'
import { fetchWhaleTradesRealtime } from '@/lib/api'
import { toast } from '@/lib/toast'

interface RealtimeWhaleMonitorSectionProps {
  rules: WhaleNotificationRule[]
  onCreateRule: (input: CreateWhaleNotificationRuleInput) => Promise<void>
}

interface RealtimeRow {
  address: string
  symbol: string
  positionValueUsd: number
  positionValueText: string
  entryPriceText: string
  timestamp: number
}

export function RealtimeWhaleMonitorSection({ rules, onCreateRule }: RealtimeWhaleMonitorSectionProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RealtimeRow[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [thresholdUsd, setThresholdUsd] = useState('500000')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchWhaleTradesRealtime({ limit: 50 })
      const mapped = (list as WhaleTradeDto[]).map((item) => {
        const tradeValue = Number(item.trade_value_usd)
        const price = Number(item.price)
        return {
          address: item.user_address,
          symbol: item.symbol,
          positionValueUsd: Number.isFinite(tradeValue) ? tradeValue : 0,
          positionValueText: Number.isFinite(tradeValue)
            ? `$ ${tradeValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : '$ -',
          entryPriceText: Number.isFinite(price)
            ? `$ ${price.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
            : '$ -',
          timestamp: new Date(item.trade_time).getTime(),
        }
      })
      setRows(mapped)
    } catch {
      toast.error({ title: t('whaleTracking.realtime.toast.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (isPaused) return

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void fetchRows()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchRows, isPaused])

  const symbolOptions = useMemo(() => {
    const set = new Set<string>(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'])
    for (const row of rows) set.add(row.symbol)
    return Array.from(set)
  }, [rows])

  const symbolRules = useMemo(
    () => rules.filter(rule => rule.type === 'SYMBOL'),
    [rules],
  )

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
      await onCreateRule({
        type: 'SYMBOL',
        symbol: selectedSymbol,
        thresholdUsd: threshold,
        channels: getDefaultWhaleChannels(),
      })
      toast.success({ title: t('whaleTracking.notifications.toast.ruleCreated') })
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
    <section className="space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">
          {t('whaleTracking.notifications.sections.realtime')} ({symbolRules.length})
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSymbol}
            onChange={e => setSelectedSymbol(e.target.value)}
            className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm"
          >
            {symbolOptions.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={thresholdUsd}
            onChange={e => setThresholdUsd(e.target.value)}
            className="w-[140px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => { void handleCreateRule() }}
            disabled={creating}
            className="from-primary to-secondary rounded-full bg-gradient-to-r px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {creating ? t('common.loading') : t('whaleTracking.notifications.actions.createMonitor')}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(prev => !prev)}
            className="flex items-center gap-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-2 text-xs font-bold text-[color:var(--cf-text-strong)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPaused ? '' : 'animate-spin'}`} style={{ animationDuration: '3s' }} />
            <span>{isPaused ? t('whaleTracking.realtime.paused') : t('whaleTracking.realtime.nextUpdate', { count: countdown })}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-6 text-center text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[color:var(--cf-border)]">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/70 text-xs text-[color:var(--cf-muted)]">
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.address')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.asset')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.positionValue')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.entryPrice')}</th>
              <th className="px-4 py-3 text-left">{t('whaleTracking.realtime.table.time')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={`${row.address}-${index}`} className="border-b border-[color:var(--cf-border)]/60">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(row.address)}
                    className="inline-flex items-center gap-2 font-mono text-sm text-[color:var(--cf-text-strong)] hover:text-primary"
                  >
                    <span>{row.address.slice(0, 8)}...{row.address.slice(-3)}</span>
                    {copiedAddress === row.address ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[color:var(--cf-text-strong)]">{row.symbol}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[color:var(--cf-text-strong)]">{row.positionValueText}</td>
                <td className="px-4 py-3 text-sm text-[color:var(--cf-text)]">{row.entryPriceText}</td>
                <td className="px-4 py-3 text-sm text-[color:var(--cf-muted)]">{formatRelativeTime(row.timestamp)}</td>
              </tr>
            ))}
            {!filteredRows.length && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[color:var(--cf-muted)]">
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
