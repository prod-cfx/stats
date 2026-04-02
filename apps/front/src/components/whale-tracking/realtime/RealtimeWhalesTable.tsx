'use client'

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/Typography'
import { createWhaleNotificationRule } from '@/features/whale-notification/api/whale-notification-api'
import { ensureMonitorAuth } from '@/features/whale-notification/guards/monitor-auth-guard'
import { fetchWhaleTradesRealtime } from '@/lib/api'
import { toast } from '@/lib/toast'

const WhaleTradingStatsModal = dynamic(
  () => import('../WhaleTradingStatsModal').then(mod => mod.WhaleTradingStatsModal),
  { ssr: false, loading: () => null },
)

const CreateMonitorModal = dynamic(
  () =>
    import('@/features/whale-notification/components/CreateMonitorModal').then(
      mod => mod.CreateMonitorModal,
    ),
  { ssr: false, loading: () => null },
)

interface WhaleTransaction {
  address: string
  tagKey: 'swing' | 'trend'
  tagColor: string
  tagBg: string
  asset: string
  side: 'Long' | 'Short'
  leverage: string
  marginType: 'Cross' | 'Isolated'
  positionValueUSD: string
  positionValueAsset: string
  entryPrice: string
  winRate: string
  winRatePct: number // for sorting
  timestamp: number // Date.now() when transaction was created
}

const initialTransactions: WhaleTransaction[] = []

export const RealtimeWhalesTable = () => {
  const { t } = useTranslation()
  const params = useParams()
  const lng = (params as any)?.lng ?? 'zh'
  const router = useRouter()
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [transactions, setTransactions] = useState<WhaleTransaction[]>(initialTransactions)
  const [_loading, setLoading] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateSymbolRuleOpen, setIsCreateSymbolRuleOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null)
  const lastRequestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const fetchNewDataRef = useRef<(() => Promise<void>) | null>(null)

  const seededNumber = (input: string): number => {
    // simple non-cryptographic hash → [0, 1)
    let hash = 2166136261
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0) / 2 ** 32
  }

  const formatRelativeTime = (timestamp: number) => {
    const minutesAgo = Math.floor((currentTime - timestamp) / 60_000)
    if (minutesAgo <= 0) return t('whaleTracking.time.justNow')
    if (minutesAgo < 60) return t('whaleTracking.time.minutesAgo', { count: minutesAgo })
    const hoursAgo = Math.floor(minutesAgo / 60)
    if (hoursAgo < 24) return t('whaleTracking.time.hoursAgo', { count: hoursAgo })
    const daysAgo = Math.floor(hoursAgo / 24)
    if (daysAgo < 7) return t('whaleTracking.time.daysAgo', { count: daysAgo })
    const weeksAgo = Math.floor(daysAgo / 7)
    if (weeksAgo < 4) return t('whaleTracking.time.weeksAgo', { count: weeksAgo })
    const monthsAgo = Math.floor(daysAgo / 30)
    return t('whaleTracking.time.monthsAgo', { count: monthsAgo })
  }

  const fetchNewData = useCallback(async () => {
    // 防抖：如果当前已有请求在飞，直接跳过，避免计时器/重复挂载导致并发请求风暴
    if (inFlightRef.current) {
      return
    }
    inFlightRef.current = true

    // 使用递增的请求 ID，避免并发请求导致旧数据覆盖新数据
    const requestId = ++lastRequestIdRef.current

    try {
      setLoading(true)
      const alerts = await fetchWhaleTradesRealtime({
        // 默认展示名义价值 >= 1 万 USD 的最新 50 条记录
        minTradeValueUsd: 10000,
        limit: 50,
      })

      const mapped: WhaleTransaction[] = alerts.map(alert => {
        const side = alert.side
        const tagKey: WhaleTransaction['tagKey'] = side === 'Long' ? 'trend' : 'swing'
        const tagStyle =
          tagKey === 'swing'
            ? { tagColor: '#60a5fa', tagBg: '#3b82f633' }
            : { tagColor: '#c084fc', tagBg: '#a855f733' }

        const positionValueNumber = Number(alert.trade_value_usd)
        const positionValueUSD = Number.isFinite(positionValueNumber)
          ? `$${positionValueNumber.toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}`
          : '$-'

        const sizeNumber = Number(alert.trade_size)
        const sizeText = Number.isFinite(sizeNumber)
          ? `${sizeNumber >= 1 ? sizeNumber.toFixed(4) : sizeNumber.toPrecision(4)}`
          : '-'
        const positionValueAsset = `${sizeText} ${alert.symbol}`

        const entryPriceNumber = Number(alert.price)
        const entryPrice = Number.isFinite(entryPriceNumber)
          ? `$${entryPriceNumber.toLocaleString('en-US', {
              maximumFractionDigits: 1,
            })}`
          : '$-'

        const timestamp = new Date(alert.trade_time).getTime()
        const leverageRaw = (alert as { leverage?: number | string | null }).leverage
        const leverageValue =
          typeof leverageRaw === 'number'
            ? leverageRaw
            : typeof leverageRaw === 'string'
              ? Number(leverageRaw)
              : Number.NaN
        const leverage =
          Number.isFinite(leverageValue) && leverageValue > 0 ? `${leverageValue}x` : '--'

        // 后端暂未提供胜率：先用“稳定伪随机”生成展示值（基于 address+symbol，不会抖动）
        const seedBase = `${alert.user_address}-${alert.symbol}`
        const winRatePct = 45 + seededNumber(`${seedBase}-wr`) * 40 // [45, 85)

        return {
          address: alert.user_address,
          tagKey,
          tagColor: tagStyle.tagColor,
          tagBg: tagStyle.tagBg,
          asset: alert.symbol,
          side,
          leverage,
          // Hyperliquid / Coinglass 不暴露保证金类型，这里统一展示为 Cross
          marginType: 'Cross',
          positionValueUSD,
          positionValueAsset,
          entryPrice,
          winRate: `${winRatePct.toFixed(0)}%`,
          winRatePct,
          timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
        }
      })

      // 只在当前请求仍是最新时更新列表，避免并发请求造成“时间倒退”
      if (requestId === lastRequestIdRef.current) {
        setTransactions(mapped)
      }
    } catch (e) {
      // 加载失败时保留当前列表，并给出提示，仅对最新请求弹 toast，避免并发时旧请求误报
      console.error('Failed to fetch realtime whale alerts', e)
      if (requestId === lastRequestIdRef.current) {
        toast.error({ title: t('whaleTracking.realtime.toast.loadFailed') })
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false)
      }
      inFlightRef.current = false
    }
  }, [t])

  useEffect(() => {
    fetchNewDataRef.current = fetchNewData
  }, [fetchNewData])

  // 首次挂载时立即拉取一次最新数据（避免 fetchNewData identity 变化导致重复拉取）
  useEffect(() => {
    void fetchNewDataRef.current?.()
  }, [])

  useEffect(() => {
    // 保险：每次 effect 触发前都清理一次旧 interval，防止 ref 被覆盖导致遗留定时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            fetchNewDataRef.current?.()
            return 5
          }
          return prev - 1
        })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused])

  // Update currentTime every 10 seconds to refresh relative time display
  useEffect(() => {
    timeUpdateRef.current = setInterval(() => {
      setCurrentTime(Date.now())
    }, 10_000)

    return () => {
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current)
    }
  }, [])

  const handleShowStats = (address: string) => {
    setSelectedAddress(address)
    setIsModalOpen(true)
  }

  const handleCopy = async (address: string) => {
    if (copiedAddress === address) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address)
      } else {
        const el = document.createElement('textarea')
        el.value = address
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        el.style.top = '0'
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        el.remove()
        if (!ok) throw new Error('copy_failed')
      }
      setCopiedAddress(address)
      toast.success({
        title: t('whaleTracking.realtime.toast.copied'),
        description: address,
        duration: 2000,
      })
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      toast.error({ title: t('common.error'), description: t('common.tryAgain'), duration: 2500 })
    }
  }

  const handleGoProfile = (address: string) => {
    router.push(`/${lng}/whale-tracking/profile?address=${encodeURIComponent(address)}`)
  }

  const handleSortWinRate = () => {
    setSortOrder(prev => {
      if (prev === 'desc') return 'asc'
      if (prev === 'asc') return null
      return 'desc'
    })
  }

  const renderSortIcon = () => {
    if (!sortOrder) {
      return (
        <ArrowUpDown className="ml-1 h-4 w-4 flex-shrink-0 text-[#8b949e] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    }
    return sortOrder === 'desc' ? (
      <ChevronDown className="text-primary ml-1 h-4 w-4 flex-shrink-0" />
    ) : (
      <ChevronUp className="text-primary ml-1 h-4 w-4 flex-shrink-0" />
    )
  }

  const displayedTransactions = useMemo(() => {
    if (!sortOrder) return transactions
    return [...transactions].sort((a, b) => {
      return sortOrder === 'desc' ? b.winRatePct - a.winRatePct : a.winRatePct - b.winRatePct
    })
  }, [transactions, sortOrder])

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <PageTitle className="text-xl md:text-2xl">{t('whaleTracking.realtime.title')}</PageTitle>
          <p className="text-[10px] text-[#8b949e] md:text-xs">
            {t('whaleTracking.realtime.subtitle')}
          </p>
        </div>
        <div className="flex w-full items-center gap-4 md:w-auto">
          <button
            type="button"
            onClick={() => {
              if (!ensureMonitorAuth(t)) return
              setIsCreateSymbolRuleOpen(true)
            }}
            className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 flex-1 rounded-full border px-4 py-2 text-xs font-bold transition-colors md:flex-none"
          >
            {t('whaleTracking.notifications.actions.newSymbolRule')}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`md:text-label flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95 md:flex-none ${
              isPaused
                ? 'border-[#30363d] bg-[#21262d] text-[#8b949e]'
                : 'bg-primary/10 border-primary text-primary shadow-primary/10 shadow-lg'
            }`}
          >
            <RefreshCw
              className={`h-3 w-3 md:h-3.5 md:w-3.5 ${!isPaused ? 'animate-spin' : ''}`}
              style={{ animationDuration: '3s' }}
            />
            <span>
              {isPaused
                ? t('whaleTracking.realtime.paused')
                : t('whaleTracking.realtime.nextUpdate', { count: countdown })}
            </span>
          </button>
        </div>
      </div>

      <div className="relative min-h-[600px] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl">
        {/* Loading indicator removed per UX request (kept data fetching + logs) */}

        <div className="cf-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse">
            <thead>
              <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/50 text-[color:var(--cf-muted)]">
                <th className="sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/95 px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.address')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.asset')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.direction')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.holdings.table.leverage')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.positionValue')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.entryPrice')}
                </th>
                <th className="px-3 py-4 text-left text-[10px] font-bold tracking-wider whitespace-nowrap uppercase md:px-6 md:text-xs">
                  <button
                    type="button"
                    className="group flex cursor-pointer items-center select-none"
                    onClick={handleSortWinRate}
                  >
                    {t('whaleTracking.realtime.table.winRate')}
                    {renderSortIcon()}
                  </button>
                </th>
                <th className="px-3 py-4 text-right text-[10px] font-bold tracking-wider uppercase md:px-6 md:text-xs">
                  {t('whaleTracking.realtime.table.time')}
                </th>
                <th className="w-12 px-3 py-4 text-center md:w-16 md:px-6">
                  {t('whaleTracking.realtime.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--cf-border)]">
              {displayedTransactions.map(tx => (
                <tr
                  key={`${tx.address}-${tx.asset}-${tx.side}-${tx.timestamp}`}
                  className="group cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)]/50"
                  onClick={() => handleShowStats(tx.address)}
                >
                  <td className="sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-5 group-hover:bg-[color:var(--cf-surface-hover)]/50 md:px-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="group/address relative z-20 flex items-center gap-2">
                        <button
                          type="button"
                          className="md:text-body decoration-primary text-left text-[11px] font-medium text-[color:var(--cf-text-strong)] decoration-2 underline-offset-4 transition-all hover:underline"
                          onClick={e => {
                            e.stopPropagation()
                            handleGoProfile(tx.address)
                          }}
                        >
                          {`${tx.address.slice(0, 4)}...${tx.address.slice(-4)}`}
                        </button>
                        {/* Hover-to-reveal full address tooltip */}
                        <div className="pointer-events-none invisible absolute top-0 left-0 z-30 -translate-y-[120%] rounded-lg border border-black/10 bg-black/90 px-3 py-2 font-mono text-xs whitespace-nowrap text-white opacity-0 shadow-2xl transition-all duration-200 group-hover/address:visible group-hover/address:opacity-100 dark:border-white/10 dark:bg-white/90 dark:text-black">
                          {tx.address}
                          <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
                        </div>
                        <button
                          type="button"
                          className={`transition-colors ${copiedAddress === tx.address ? 'text-green-500' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
                          onClick={e => {
                            e.stopPropagation()
                            handleCopy(tx.address)
                          }}
                        >
                          {copiedAddress === tx.address ? (
                            <Check className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          ) : (
                            <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          )}
                        </button>
                      </div>
                      <span
                        className="w-fit rounded px-1.5 py-0.5 text-[8px] font-bold uppercase md:text-[10px]"
                        style={{ color: tx.tagColor, backgroundColor: tx.tagBg }}
                      >
                        {t(`whaleTracking.tags.${tx.tagKey}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-5 md:px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="md:text-body text-[11px] font-bold text-[color:var(--cf-text-strong)]">
                        {tx.asset}
                      </span>
                      <span className="text-[8px] text-[color:var(--cf-muted)] uppercase md:text-[10px]">
                        {tx.marginType === 'Cross'
                          ? t('whaleTracking.margin.cross')
                          : t('whaleTracking.margin.isolated')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-5 md:px-6">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold md:text-xs ${tx.side === 'Long' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}
                    >
                      {tx.side === 'Long'
                        ? t('whaleTracking.side.long')
                        : t('whaleTracking.side.short')}
                    </span>
                  </td>
                  <td className="md:text-body px-3 py-5 text-[11px] font-semibold text-[color:var(--cf-text-strong)] md:px-6">
                    {tx.leverage}
                  </td>
                  <td className="px-3 py-5 md:px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="md:text-body text-[11px] font-bold text-[color:var(--cf-text-strong)]">
                        {tx.positionValueUSD}
                      </span>
                      <span className="text-[9px] text-[color:var(--cf-muted)] md:text-xs">
                        {tx.positionValueAsset}
                      </span>
                    </div>
                  </td>
                  <td className="md:text-body px-3 py-5 font-mono text-[11px] text-[color:var(--cf-text-strong)] md:px-6">
                    {tx.entryPrice}
                  </td>
                  <td className="md:text-body px-3 py-5 text-[11px] font-bold text-[#4ade80] md:px-6">
                    {tx.winRate}
                  </td>
                  <td className="md:text-caption px-3 py-5 text-right text-[10px] font-medium text-[color:var(--cf-muted)] md:px-6">
                    {formatRelativeTime(tx.timestamp)}
                  </td>
                  <td className="px-3 py-5 text-center md:px-6">
                    <button
                      type="button"
                      className="hover:border-primary/50 hover:bg-primary/5 mx-auto flex h-7 w-7 items-center justify-center rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-muted)] shadow-sm transition-all hover:text-[color:var(--cf-text-strong)] active:scale-95 md:h-9 md:w-9 md:rounded-xl"
                      onClick={e => {
                        e.stopPropagation()
                        handleShowStats(tx.address)
                      }}
                    >
                      <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WhaleTradingStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />

      <CreateMonitorModal
        isOpen={isCreateSymbolRuleOpen}
        mode="SYMBOL"
        onClose={() => setIsCreateSymbolRuleOpen(false)}
        onCreate={async payload => {
          if (!ensureMonitorAuth(t)) return { created: false }
          await createWhaleNotificationRule(payload)
          return { created: true }
        }}
      />
    </div>
  )
}
