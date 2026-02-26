'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserFillsResponse } from '@/lib/api'
import { getRelativeTimeParams } from '@/lib/formatters'

const SortIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </svg>
)

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

const ChevronUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
)

interface CompletedTrade {
  fillTime: number
  endTime: string
  asset: string
  side: 'Long' | 'Short'
  duration: string
  netPnl: string
  size: string
  exitPrice: string
  fee: string
}

interface CompletedTradesTableProps {
  fillsData: UserFillsResponse | null
}

export const CompletedTradesTable = ({ fillsData }: CompletedTradesTableProps) => {
  const { t } = useTranslation()

  const [historyPage, setHistoryPage] = useState(0)
  const HISTORY_PAGE_SIZE = 50

  const formatRelativeTime = useCallback(
    (timestamp: number) => {
      const result = getRelativeTimeParams(timestamp)
      if (result.key === 'date') {
        return result.params.date ?? '-'
      }
      return t(`whaleTracking.time.${result.key}`, result.params)
    },
    [t],
  )

  const formatDuration = (durationMs: number) => {
    if (!Number.isFinite(durationMs) || durationMs < 0) return '-'
    const totalMinutes = Math.floor(durationMs / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const convertFillsToCompletedTrades = (data: UserFillsResponse | null): CompletedTrade[] => {
    if (!data || !data.fills || data.fills.length === 0) return []

    const makeFillId = (fill: UserFillsResponse['fills'][number]) => `${fill.hash}:${fill.time}`

    // Duration: closeTime - lastOpenTime for same coin + side
    const lastOpenTimeByKey = new Map<string, number>()
    const durationByFillId = new Map<string, string>()

    const fillsAsc = [...data.fills].sort((a, b) => a.time - b.time)
    for (const fill of fillsAsc) {
      const side = fill.direction.includes('Long') ? 'Long' : 'Short'
      const key = `${fill.coin}:${side}`

      if (fill.direction.startsWith('Open')) {
        lastOpenTimeByKey.set(key, fill.time)
        continue
      }

      if (fill.direction.startsWith('Close')) {
        const openTime = lastOpenTimeByKey.get(key)
        if (typeof openTime === 'number' && fill.time >= openTime) {
          durationByFillId.set(makeFillId(fill), formatDuration(fill.time - openTime))
        }
      }
    }

    return data.fills
      .filter(fill => fill.direction.startsWith('Close'))
      .map(fill => {
        const isLong = fill.direction.includes('Long')
        const endTime = new Date(fill.time)
          .toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
          .replace(/\//g, '-')

        const netPnlSign = fill.closedPnl >= 0 ? '+' : ''
        const netPnl = `${netPnlSign}${fill.closedPnl.toFixed(2)}`
        const fee = `${fill.fee.toFixed(4)} ${fill.feeToken}`

        return {
          fillTime: fill.time,
          endTime,
          asset: fill.coin,
          side: isLong ? 'Long' : 'Short',
          duration: durationByFillId.get(makeFillId(fill)) ?? '-',
          netPnl,
          size: `${Math.abs(fill.size).toFixed(4)} ${fill.coin}`,
          exitPrice: `$ ${fill.price.toFixed(4)}`,
          fee,
        }
      })
  }

  const sortedCompletedTrades = useMemo(() => {
    const trades = convertFillsToCompletedTrades(fillsData)
    return trades.sort((a, b) => b.fillTime - a.fillTime)
  }, [fillsData])

  const paginatedCompletedTrades = useMemo(() => {
    const endIndex = (historyPage + 1) * HISTORY_PAGE_SIZE
    return sortedCompletedTrades.slice(0, endIndex)
  }, [sortedCompletedTrades, historyPage])

  const formatDurationLabel = (value: string) => {
    // 925小时 35分 -> 925h 35m (English-friendly), keep as-is if unknown format
    const h = value.match(/(\d+)\s*小时/)
    const m = value.match(/(\d+)\s*分/)
    if (!h && !m) return value
    const hh = h ? Number.parseInt(h[1], 10) : 0
    const mm = m ? Number.parseInt(m[1], 10) : 0
    return t('whaleTracking.time.duration', { hours: hh, minutes: mm })
  }

  const renderSideBadge = (side: string) => {
    const isLong = side === 'Long' || side === 'Buy'
    return (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${isLong ? 'bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-red-500/20 text-red-500 dark:text-red-400'}`}
      >
        {side === 'Long' || side === 'Buy'
          ? t('whaleTracking.side.longAbbr')
          : t('whaleTracking.side.shortAbbr')}
      </span>
    )
  }

  const renderSortIcon = (
    field: string,
    currentSortField: string | null,
    currentSortOrder: 'asc' | 'desc' | null,
  ) => {
    if (currentSortField !== field)
      return (
        <SortIcon className="h-3 w-3 text-[color:var(--cf-muted)] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    return currentSortOrder === 'desc' ? (
      <ChevronDownIcon className="text-primary h-3 w-3" />
    ) : (
      <ChevronUpIcon className="text-primary h-3 w-3" />
    )
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[10px] font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
          <th className="min-w-[120px] px-6 py-4 text-left">
            <button
              type="button"
              className="group flex items-center gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.endTime')}</span>
              {renderSortIcon('endTime', null, null)}
            </button>
          </th>
          <th className="min-w-[150px] px-6 py-4 text-left">
            <span>{t('whaleTracking.profile.columns.asset')}</span>
          </th>
          <th className="px-6 py-4 text-left whitespace-nowrap">
            {t('whaleTracking.profile.columns.side')}
          </th>
          <th className="px-6 py-4 text-right">
            <button
              type="button"
              className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.duration')}</span>
              {renderSortIcon('duration', null, null)}
            </button>
          </th>
          <th className="px-6 py-4 text-right">
            <button
              type="button"
              className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.netPnl')}</span>
              {renderSortIcon('netPnl', null, null)}
            </button>
          </th>
          <th className="px-6 py-4 text-right">
            <button
              type="button"
              className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.size')}</span>
              {renderSortIcon('size', null, null)}
            </button>
          </th>
          <th className="px-6 py-4 text-right">
            <button
              type="button"
              className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.exitPrice')}</span>
              {renderSortIcon('exitPrice', null, null)}
            </button>
          </th>
          <th className="px-6 py-4 text-right">
            <button
              type="button"
              className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
            >
              <span>{t('whaleTracking.profile.columns.fee')}</span>
              {renderSortIcon('fee', null, null)}
            </button>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[color:var(--cf-border)]">
        {[
          ...paginatedCompletedTrades.map((trade, idx) => (
            <tr key={idx} className="transition-colors hover:bg-[color:var(--cf-surface-hover)]">
              <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                {formatRelativeTime(trade.fillTime)}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                {trade.asset}
              </td>
              <td className="px-6 py-4">{renderSideBadge(trade.side)}</td>
              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                {formatDurationLabel(trade.duration)}
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold">
                <span
                  className={
                    trade.netPnl.includes('+')
                      ? 'text-green-500 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400'
                  }
                >
                  {trade.netPnl}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                {trade.size}
              </td>
              <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                {trade.exitPrice}
              </td>
              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)]">
                {trade.fee}
              </td>
            </tr>
          )),
          paginatedCompletedTrades.length === 0 ? (
            <tr key="empty">
              <td colSpan={8} className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-4xl opacity-20">📊</div>
                  <p className="text-sm text-[color:var(--cf-muted)]">
                    {sortedCompletedTrades.length === 0
                      ? t('whaleTracking.profile.empty.completedTrades')
                      : t('whaleTracking.profile.empty.filteredResults')}
                  </p>
                </div>
              </td>
            </tr>
          ) : null,
          paginatedCompletedTrades.length > 0 &&
          (historyPage + 1) * HISTORY_PAGE_SIZE < sortedCompletedTrades.length ? (
            <tr key="load-more">
              <td colSpan={8} className="px-6 py-4">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setHistoryPage(historyPage + 1)}
                    className="hover:text-primary rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-6 py-2 text-sm font-medium text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                  >
                    {t('whaleTracking.profile.loadMore', '加载更多')}
                  </button>
                </div>
              </td>
            </tr>
          ) : null,
        ]}
      </tbody>
    </table>
  )
}
