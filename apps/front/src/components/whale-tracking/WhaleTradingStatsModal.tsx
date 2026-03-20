'use client'

import type { WhaleAddressPerformanceResponse } from '@/lib/api'
import ReactECharts from 'echarts-for-react'
import { ChevronDown } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { SectionTitle } from '@/components/ui/Typography'
import { useAsync } from '@/hooks/use-async'
import { fetchWhaleAddressPerformance } from '@/lib/api'

interface WhaleTradingStatsModalProps {
  isOpen: boolean
  onClose: () => void
  address: string
}

interface StatCardProps {
  label: string
  value: string
  valueColor?: string
  unit?: string
  value2?: string
  unit2?: string
  subStats: { label: string; value: string; color: string }[]
}

const StatCard = ({
  label,
  value,
  valueColor = 'text-[color:var(--cf-text-strong)]',
  unit,
  value2,
  unit2,
  subStats,
}: StatCardProps) => (
  <div className="flex h-full flex-col justify-between gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
    <div className="flex flex-col gap-1">
      <span className="text-caption font-medium text-[color:var(--cf-muted)]">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-h2 font-bold ${valueColor}`}>{value}</span>
        {unit && (
          <span className="text-caption font-medium text-[color:var(--cf-text-strong)]">
            {unit}
          </span>
        )}
        {value2 && (
          <span className="text-h2 ml-2 font-bold text-[color:var(--cf-text-strong)]">
            {value2}
          </span>
        )}
        {unit2 && (
          <span className="text-caption font-medium text-[color:var(--cf-text-strong)]">
            {unit2}
          </span>
        )}
      </div>
    </div>
    <div className="space-y-1">
      {subStats.map((stat, idx) => (
        <div key={idx} className="text-caption flex items-center justify-between">
          <span className="font-medium text-[color:var(--cf-muted)]">{stat.label}</span>
          <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  </div>
)

interface TradeCardProps {
  asset: string
  side: 'Long' | 'Short'
  time: string
  pnl: string
  duration: string
  icon: string
}

const TradeCard = ({ asset, side, time, pnl, duration, icon }: TradeCardProps) => {
  const { t } = useTranslation()
  return (
    <div className="hover:border-primary/50 group flex h-full flex-col gap-4 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
            <img src={icon} alt={asset} className="h-full w-full object-contain" />
          </div>
          <span className="text-body truncate font-bold text-[color:var(--cf-text-strong)]">
            {asset}
          </span>
          <span
            className={`flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${side === 'Long' ? 'bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-red-500/20 text-red-500 dark:text-red-400'}`}
          >
            {side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
          </span>
        </div>
        <span className="text-caption flex-shrink-0 font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
          {time}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-caption mb-1 font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
          {t('whaleTracking.modal.realizedPnl')}
        </span>
        <span
          className={`${pnl.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-h2 font-bold`}
        >
          {pnl}
        </span>
      </div>
      <div className="text-caption mt-auto flex items-center justify-between border-t border-[color:var(--cf-border)] pt-2">
        <span className="font-medium text-[color:var(--cf-muted)]">
          {t('whaleTracking.modal.duration')}
        </span>
        <span className="font-semibold text-[color:var(--cf-text-strong)]">{duration}</span>
      </div>
    </div>
  )
}

interface PerformanceCardProps {
  asset: string
  trades: number
  pnl: string
  netPnl: string
  fees: string
  icon: string
}

const PerformanceCard = ({ asset, trades, pnl, netPnl, fees, icon }: PerformanceCardProps) => {
  const { t } = useTranslation()
  return (
    <div className="hover:border-primary/50 flex h-full flex-col gap-4 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center">
            <img src={icon} alt={asset} className="h-full w-full object-contain" />
          </div>
          <span className="text-body font-bold text-[color:var(--cf-text-strong)]">{asset}</span>
        </div>
        <span className="text-caption rounded bg-[color:var(--cf-bg)] px-2 py-1 font-bold text-[color:var(--cf-muted)]">
          {t('whaleTracking.modal.tradesCount', { count: trades })}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-caption mb-1 font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
          {t('whaleTracking.modal.realizedPnl')}
        </span>
        <span
          className={`${pnl.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-h2 font-bold`}
        >
          {pnl}
        </span>
      </div>
      <div className="space-y-2 border-t border-[color:var(--cf-border)] pt-2">
        <div className="text-caption flex items-center justify-between font-medium">
          <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.modal.netPnl')}</span>
          <span
            className={`font-bold ${netPnl.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {netPnl}
          </span>
        </div>
        <div className="text-caption flex items-center justify-between font-medium">
          <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.modal.fees')}</span>
          <span className="font-bold text-[color:var(--cf-text-strong)]">{fees}</span>
        </div>
      </div>
    </div>
  )
}

interface PositionCardProps {
  asset: string
  side: 'Long' | 'Short'
  time: string
  pnl: string
  size: string
  fees: string
  icon: string
}

const PositionCard = ({ asset, side, time, pnl, size, fees, icon }: PositionCardProps) => {
  const { t } = useTranslation()
  return (
    <div className="hover:border-primary/50 flex h-full flex-col gap-4 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center">
            <img src={icon} alt={asset} className="h-full w-full object-contain" />
          </div>
          <span className="text-body font-bold text-[color:var(--cf-text-strong)]">{asset}</span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${side === 'Long' ? 'bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-red-500/20 text-red-500 dark:text-red-400'}`}
          >
            {side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
          </span>
        </div>
        <span className="text-caption font-medium text-[color:var(--cf-muted)]">{time}</span>
      </div>
      <div className="flex flex-col py-1">
        <span
          className={`${pnl.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-h2 font-bold tracking-tight`}
        >
          {pnl}
        </span>
      </div>
      <div className="mt-auto space-y-2 border-t border-[color:var(--cf-border)] pt-2">
        <div className="text-caption flex items-center justify-between font-medium">
          <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.modal.size')}</span>
          <span className="font-bold text-[color:var(--cf-text-strong)]">{size}</span>
        </div>
        <div className="text-caption flex items-center justify-between font-medium">
          <span className="text-[color:var(--cf-muted)]">{t('whaleTracking.modal.fees')}</span>
          <span className="font-bold text-[color:var(--cf-text-strong)]">{fees}</span>
        </div>
      </div>
    </div>
  )
}

const ASSET_POOL: Array<{ asset: string; icon: string }> = [
  {
    asset: 'BTC',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/btc.png',
  },
  {
    asset: 'ETH',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png',
  },
  {
    asset: 'SOL',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/sol.png',
  },
  {
    asset: 'DOGE',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/doge.png',
  },
  {
    asset: 'LINK',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/link.png',
  },
  {
    asset: 'XRP',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/xrp.png',
  },
  {
    asset: 'ADA',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/ada.png',
  },
  {
    asset: 'AVAX',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/avax.png',
  },
  {
    asset: 'ATOM',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/atom.png',
  },
  {
    asset: 'APT',
    icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/apt.png',
  },
  { asset: 'PENDLE', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=pendle' },
  { asset: 'ONDO', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ondo' },
  { asset: 'TIA', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=tia' },
  { asset: 'ENA', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ena' },
  { asset: 'FARTCOIN', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=fart' },
  { asset: 'MET', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=met' },
]

export const WhaleTradingStatsModal = ({
  isOpen,
  onClose,
  address,
}: WhaleTradingStatsModalProps) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'asset' | 'position'>('asset')
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | 'all'>('1w')
  const [timeRangeOpen, setTimeRangeOpen] = useState(false)
  const timeRangeDays = useMemo(() => {
    switch (timeRange) {
      case '1w':
        return 7
      case '1m':
        return 30
      case 'all':
      default:
        return 365
    }
  }, [timeRange])

  const {
    data: performance,
    loading,
    execute,
  } = useAsync<WhaleAddressPerformanceResponse | null>(
    async () => {
      if (!isOpen || !address) return null
      return fetchWhaleAddressPerformance(address, {
        timeRangeDays,
        limit: 200,
      })
    },
    { immediate: false },
  )

  useEffect(() => {
    // 仅在弹窗打开且地址存在时触发请求；时间范围变化时重新拉取
    if (!isOpen || !address) return
    execute()
  }, [isOpen, address, timeRangeDays, execute])

  const {
    profitTrades,
    lossTrades,
    totalTrades,
    winRate,
    pnl,
    fees,
    currentTopTrades,
    currentAssetPerformance,
    currentPositionPerformance,
  } = useMemo(() => {
    if (!performance) {
      return {
        profitTrades: 0,
        lossTrades: 0,
        totalTrades: 0,
        winRate: '0.00%',
        pnl: '$+0.00',
        fees: '$+0.00',
        currentTopTrades: [] as TradeCardProps[],
        currentAssetPerformance: [] as PerformanceCardProps[],
        currentPositionPerformance: [] as PositionCardProps[],
      }
    }

    const { summary, byAsset, trades } = performance
    const total = summary.trades ?? trades.length
    const profitCount = summary.longCount ?? 0
    const lossCount = summary.shortCount ?? 0

    const formatCurrency = (amount: number) => {
      const sign = amount >= 0 ? '+' : '-'
      const formatted = Math.abs(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `$${sign}${formatted}`
    }

    const formatRelativeTime = (iso: string) => {
      const now = Date.now()
      const ts = new Date(iso).getTime()
      const diffMs = Math.max(0, now - ts)
      const minutes = Math.floor(diffMs / 60000)
      if (minutes < 60) {
        return t('whaleTracking.time.minutesAgo', {
          count: Math.max(1, minutes),
        })
      }
      const hours = Math.floor(minutes / 60)
      if (hours < 24) {
        return t('whaleTracking.time.hoursAgo', { count: hours })
      }
      const days = Math.floor(hours / 24)
      if (days < 7) {
        return t('whaleTracking.time.daysAgo', { count: days })
      }
      if (days < 30) {
        return t('whaleTracking.time.weeksAgo', {
          count: Math.floor(days / 7),
        })
      }
      return t('whaleTracking.time.monthsAgo', {
        count: Math.max(1, Math.floor(days / 30)),
      })
    }

    const formatDuration = (iso: string) => {
      const now = Date.now()
      const ts = new Date(iso).getTime()
      // 至少按 1 分钟计算，避免 0 分钟的展示
      const diffMs = Math.max(60_000, now - ts)
      const minutesTotal = Math.floor(diffMs / 60_000)
      const hours = Math.floor(minutesTotal / 60)
      const minutes = minutesTotal % 60
      return t('whaleTracking.time.duration', { hours, minutes })
    }

    const pickIcon = (asset: string) => {
      const found = ASSET_POOL.find(a => a.asset === asset.toUpperCase())
      if (found) return found.icon
      return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
        asset.toLowerCase(),
      )}`
    }

    const winRateValue =
      typeof summary.winRatePct === 'number' ? summary.winRatePct.toFixed(2) : '0.00'

    const totalPnlNumeric = summary.pnlUsd ?? 0
    const absTotalPnl = Math.abs(totalPnlNumeric)
    const totalWeight =
      trades.reduce((acc, tr) => acc + Math.max(tr.positionValueUsd ?? 0, 0), 0) ||
      trades.length ||
      1

    const tradePnls = trades.map(tr => {
      if (absTotalPnl === 0) return 0
      const weight = Math.max(tr.positionValueUsd ?? 0, 0) || 1
      const share = weight / totalWeight
      const raw = absTotalPnl * share
      return totalPnlNumeric >= 0 ? raw : -raw
    })

    const indexedTrades = trades.map((tr, index) => ({ ...tr, _index: index }))

    // 按资产维度对 summary.pnlUsd 做占位分配，避免每个资产卡片显示完全相同的 PnL
    const totalAssetWeight =
      byAsset.reduce((acc, item) => acc + Math.max(item.totalValueUsd ?? 0, 0), 0) ||
      byAsset.length ||
      1

    const assetPnls = byAsset.map(item => {
      if (absTotalPnl === 0) return 0
      const weight = Math.max(item.totalValueUsd ?? 0, 0) || 1
      const share = weight / totalAssetWeight
      const raw = absTotalPnl * share
      return totalPnlNumeric >= 0 ? raw : -raw
    })

    const pnlValue = formatCurrency(totalPnlNumeric)
    const feesValue = formatCurrency(Math.abs(summary.totalValueUsd ?? 0) * 0.002)

    const topTrades: TradeCardProps[] = indexedTrades
      .slice()
      .sort((a, b) => b.positionValueUsd - a.positionValueUsd)
      .slice(0, 10)
      .map(tr => ({
        asset: tr.symbol,
        side: tr.side === 'LONG' ? 'Long' : 'Short',
        time: formatRelativeTime(tr.createTime),
        // 目前后端未返回逐笔真实盈亏，这里按名义价值权重对 summary.pnlUsd 做占位分配
        pnl: formatCurrency(tradePnls[tr._index]),
        duration: formatDuration(tr.createTime),
        icon: pickIcon(tr.symbol),
      }))

    const assetPerformance: PerformanceCardProps[] = byAsset.map((item, index) => {
      const assetPnl = assetPnls[index] ?? 0
      const assetPnlFormatted = formatCurrency(assetPnl)
      const assetFeesFormatted = formatCurrency(Math.abs(assetPnl) * 0.02)
      return {
        asset: item.symbol,
        trades: item.trades,
        pnl: assetPnlFormatted,
        netPnl: assetPnlFormatted,
        fees: assetFeesFormatted,
        icon: pickIcon(item.symbol),
      }
    })

    const positionPerformance: PositionCardProps[] = indexedTrades.slice(0, 12).map(tr => ({
      asset: tr.symbol,
      side: tr.side === 'LONG' ? 'Long' : 'Short',
      time: formatRelativeTime(tr.createTime),
      pnl: formatCurrency(tradePnls[tr._index]),
      size: `${tr.positionSize.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} ${tr.symbol}`,
      fees: feesValue,
      icon: pickIcon(tr.symbol),
    }))

    return {
      profitTrades: profitCount,
      lossTrades: lossCount,
      totalTrades: total,
      winRate: `${winRateValue}%`,
      pnl: pnlValue,
      fees: feesValue,
      currentTopTrades: topTrades,
      currentAssetPerformance: assetPerformance,
      currentPositionPerformance: positionPerformance,
    }
  }, [performance, t])

  // Close dropdown on outside click / when modal closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setTimeRangeOpen(false)
      return
    }
    if (!timeRangeOpen) return
    const onDocPointerDown = () => setTimeRangeOpen(false)
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [isOpen, timeRangeOpen])

  const donutOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: () => totalTrades.toString(),
            fontSize: 18,
            fontWeight: 'bold',
            color: 'var(--cf-text-strong)',
          },
          emphasis: {
            scale: false,
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: profitTrades,
              name: t('whaleTracking.modal.profit'),
              itemStyle: { color: '#22c55e' },
            },
            {
              value: lossTrades,
              name: t('whaleTracking.modal.loss'),
              itemStyle: { color: '#ef4444' },
            },
          ],
        },
      ],
    }),
    [lossTrades, profitTrades, t, totalTrades],
  )

  const formatAddress = (addr: string) =>
    addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('whaleTracking.modal.title')}
      width="max-w-[1152px]"
      loading={loading}
    >
      <div className="flex flex-col gap-8">
        {/* Header Extra Info */}
        <div className="-mt-4 mb-0 flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-2">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600" />
            <span className="text-base font-semibold text-[color:var(--cf-text-strong)]">
              {formatAddress(address)}
            </span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setTimeRangeOpen(v => !v)
              }}
              className="hover:border-primary/50 flex items-center gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-bold text-[color:var(--cf-text)] transition-all"
            >
              {t(`whaleTracking.modal.timeRange.${timeRange}`)}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${timeRangeOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {timeRangeOpen && (
              <div
                className="absolute right-0 z-30 mt-2 w-[120px] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl"
                onPointerDown={e => e.stopPropagation()}
              >
                {(['1w', '1m', 'all'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setTimeRange(opt)
                      setTimeRangeOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm font-semibold transition-colors ${
                      timeRange === opt
                        ? 'bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text-strong)]'
                        : 'text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                    }`}
                  >
                    {t(`whaleTracking.modal.timeRange.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label={t('whaleTracking.modal.winRate')}
            value={winRate}
            subStats={[
              {
                label: t('whaleTracking.modal.closedPnlBeforeFees'),
                value: pnl,
                color: 'text-green-500 dark:text-green-400',
              },
              {
                label: t('whaleTracking.modal.feesDeducted'),
                value: fees,
                color: 'text-[color:var(--cf-text-strong)]',
              },
            ]}
          />
          <div className="relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
            <span className="text-caption z-10 font-medium text-[color:var(--cf-muted)]">
              {t('whaleTracking.modal.tradeCount')}
            </span>

            <div className="absolute top-1/2 right-4 h-[80px] w-[80px] -translate-y-1/2">
              <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} />
            </div>

            <div className="z-10 mt-auto flex flex-col gap-1">
              <div className="text-caption flex items-center gap-2 font-medium">
                <span className="text-[color:var(--cf-muted)]">
                  {t('whaleTracking.modal.profit')}
                </span>
                <span className="font-bold text-green-500 dark:text-green-400">{profitTrades}</span>
              </div>
              <div className="text-caption flex items-center gap-2 font-medium">
                <span className="text-[color:var(--cf-muted)]">
                  {t('whaleTracking.modal.loss')}
                </span>
                <span className="font-bold text-red-500 dark:text-red-400">{lossTrades}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Trades Section */}
        <div className="flex flex-col gap-4">
          <SectionTitle className="text-lg">{t('whaleTracking.modal.topTrades')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {currentTopTrades.map((trade, idx) => (
              <TradeCard key={idx} {...trade} />
            ))}
          </div>
        </div>

        {/* Performance Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-8 border-b border-[color:var(--cf-border)]">
            <button
              type="button"
              onClick={() => setActiveTab('asset')}
              className={`-mb-[2px] border-b-2 px-4 py-4 text-base font-bold transition-all ${activeTab === 'asset' ? 'border-primary text-[color:var(--cf-text-strong)]' : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
            >
              {t('whaleTracking.modal.byAsset')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('position')}
              className={`-mb-[2px] border-b-2 px-4 py-4 text-base font-bold transition-all ${activeTab === 'position' ? 'border-primary text-[color:var(--cf-text-strong)]' : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
            >
              {t('whaleTracking.modal.byPosition')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {activeTab === 'asset'
              ? currentAssetPerformance.map((item, idx) => <PerformanceCard key={idx} {...item} />)
              : currentPositionPerformance.map((item, idx) => <PositionCard key={idx} {...item} />)}
          </div>
        </div>
      </div>
    </Modal>
  )
}
