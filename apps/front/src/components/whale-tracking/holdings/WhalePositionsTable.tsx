'use client'

import type { WhaleHoldingApiItem } from '@/lib/api'
import { ArrowUpDown, Check, ChevronDown, ChevronUp, Copy, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { BodyText, PageTitle } from '@/components/ui/Typography'
import { useAsync } from '@/hooks/use-async'
import { fetchWhaleHoldings } from '@/lib/api'

const WhaleTradingStatsModal = dynamic(
  () => import('../WhaleTradingStatsModal').then(mod => mod.WhaleTradingStatsModal),
  { ssr: false, loading: () => null },
)

interface WhalePosition {
  address: string
  tags: { key: 'whale' | 'hft' | 'steady'; color: string; bg: string }[]
  asset: string
  side: 'Long' | 'Short'
  leverage: string
  marginType: 'Cross' | 'Isolated'
  positionValueUSD: string
  positionValueAsset: string
  pnlUSD: string
  pnlPercent: string
  margin: string
  entryPrice: string
  liqPrice: string
  createdMinutesAgo: number // 0 => just now
  remark: string
}

export const WhalePositionsTable = () => {
  const { t } = useTranslation()
  const params = useParams()
  const lng = (params as any)?.lng ?? 'zh'
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL'>('ALL')
  const [sideFilter, setSideFilter] = useState<'ALL' | 'Long' | 'Short'>('ALL')
  const [pnlFilter, setPnlFilter] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL')
  const [sortField, setSortField] = useState<
    'positionValue' | 'pnl' | 'margin' | 'createdTime' | null
  >('positionValue')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>('desc')


  const formatRelativeMinutes = (mins: number) => {
    if (mins <= 0) return t('whaleTracking.time.justNow')
    if (mins < 60) return t('whaleTracking.time.minutesAgo', { count: mins })
    const hours = Math.floor(mins / 60)
    return t('whaleTracking.time.hoursAgo', { count: hours })
  }

  const {
    data: rawHoldings,
    loading,
    error,
    execute,
  } = useAsync<WhaleHoldingApiItem[]>(
    async () => {
      return fetchWhaleHoldings({
        symbol: assetFilter !== 'ALL' ? assetFilter : undefined,
        // 仅保留名义价值较大的鲸鱼单子
        minPositionValueUsd: 1_000_000,
        limit: 200,
      })
    },
    { immediate: true },
  )

  // 资产过滤变化时重新拉取（首屏请求由 useAsync 的 immediate=true 触发）
  const hasMountedRef = useRef(false)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    execute()
  }, [execute, assetFilter])

  const sortedPositions = useMemo(() => {
    if (!rawHoldings) return []

    const now = Date.now()

    // 先在数值层面做过滤和排序，最后再做格式化，避免 locale 相关的字符串互转问题
    const enriched = rawHoldings.map((h) => {
      // snapshotTime 来自新的 HyperliquidWhalePosition 数据源
      const snapshotAt = new Date(h.snapshotTime).getTime()
      const createdMinutesAgo = Math.max(0, Math.floor((now - snapshotAt) / 60_000))

      const positionValueUsd = h.positionValueUsd
      const marginValue = positionValueUsd / 10 // 简单估算，仅用于展示
      const side: 'Long' | 'Short' = h.side === 'LONG' ? 'Long' : 'Short'

      // 使用 API 返回的真实 pnl 和 roe 数据
      const pnlUsd = h.pnl ?? 0
      const pnlPct = h.roe ?? 0

      return {
        raw: h,
        createdMinutesAgo,
        positionValueUsd,
        marginValue,
        side,
        pnlUsd,
        pnlPct,
      }
    })

    const filtered = enriched.filter(item => {
      const { raw, side, pnlUsd } = item
      if (assetFilter !== 'ALL' && raw.symbol !== assetFilter) return false
      if (sideFilter !== 'ALL' && side !== sideFilter) return false
      if (pnlFilter === 'PROFIT' && pnlUsd <= 0) return false
      if (pnlFilter === 'LOSS' && pnlUsd >= 0) return false
      return true
    })

    const sorted =
      !sortField || !sortOrder
        ? filtered
        : [...filtered].sort((a, b) => {
            let valA: number
            let valB: number

            switch (sortField) {
              case 'positionValue':
                valA = a.positionValueUsd
                valB = b.positionValueUsd
                break
              case 'pnl':
                valA = a.pnlUsd
                valB = b.pnlUsd
                break
              case 'margin':
                valA = a.marginValue
                valB = b.marginValue
                break
              case 'createdTime': {
                valA = a.createdMinutesAgo
                valB = b.createdMinutesAgo
                // smaller minutesAgo is more recent
                return sortOrder === 'desc' ? valA - valB : valB - valA
              }
              default:
                return 0
            }

            return sortOrder === 'desc' ? valB - valA : valA - valB
          })

    // 最后将数值映射为用于展示的字符串
    const mapped: WhalePosition[] = sorted.map(item => {
      const {
        raw,
        createdMinutesAgo,
        positionValueUsd,
        marginValue,
        side,
        pnlUsd,
        pnlPct,
      } = item

      const positionValueUSD = `$${positionValueUsd.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`

      const positionValueAsset = `${raw.positionSize.toFixed(2)} ${raw.symbol}`

      const margin = `$${marginValue.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`

      const entryPrice = `$${raw.entryPrice.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`

      const liqPrice = raw.liquidationPrice != null
        ? `$${raw.liquidationPrice.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : '--'

      const pnlUSD = pnlUsd != null
        ? `${pnlUsd >= 0 ? '+' : '-'}$${Math.abs(pnlUsd).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`
        : '--'
      const pnlPercent = pnlPct != null
        ? `${pnlPct >= 0 ? '+' : '-'}${Math.abs(pnlPct * 100).toFixed(2)}%`
        : '--'

      const tags: WhalePosition['tags'] = [{ key: 'whale', color: '#c084fc', bg: '#a855f733' }]

      return {
        address: raw.userAddress,
        tags,
        asset: raw.symbol,
        side,
        leverage: raw.leverage != null ? `${raw.leverage}x` : '—',
        marginType: 'Cross',
        positionValueUSD,
        positionValueAsset,
        pnlUSD,
        pnlPercent,
        margin,
        entryPrice,
        liqPrice,
        createdMinutesAgo,
        remark: '',
      }
    })

    return mapped
  }, [rawHoldings, assetFilter, sideFilter, pnlFilter, sortField, sortOrder])

  const handleSort = (field: Exclude<typeof sortField, null>) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc')
      } else if (sortOrder === 'asc') {
        setSortField(null)
        setSortOrder(null)
      } else {
        setSortOrder('desc')
      }
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const renderSortIcon = (field: Exclude<typeof sortField, null>) => {
    if (sortField !== field) {
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

  const handleShowStats = (address: string) => {
    setSelectedAddress(address)
    setIsModalOpen(true)
  }

  const handleCopy = async (address: string) => {
    if (copiedAddress === address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <PageTitle>{t('whaleTracking.holdings.title')}</PageTitle>
          <BodyText>{t('whaleTracking.holdings.subtitle')}</BodyText>
          <div className="flex items-center gap-4">{/* Removed standalone sort buttons */}</div>
        </div>
        <div className="flex items-center gap-3">
          <FilterButton
            value={assetFilter}
            options={[
              { value: 'ALL', label: t('common.all') },
              { value: 'BTC', label: 'BTC' },
              { value: 'ETH', label: 'ETH' },
              { value: 'SOL', label: 'SOL' },
            ]}
            onChange={v => setAssetFilter(v as typeof assetFilter)}
          />
          <FilterButton
            value={sideFilter}
            options={[
              { value: 'ALL', label: t('whaleTracking.holdings.filters.allSides') },
              { value: 'Long', label: t('whaleTracking.side.long') },
              { value: 'Short', label: t('whaleTracking.side.short') },
            ]}
            onChange={v => setSideFilter(v as typeof sideFilter)}
          />
          <FilterButton
            value={pnlFilter}
            options={[
              { value: 'ALL', label: t('whaleTracking.holdings.filters.allUnrealizedPnl') },
              { value: 'PROFIT', label: t('whaleTracking.holdings.filters.profit') },
              { value: 'LOSS', label: t('whaleTracking.holdings.filters.loss') },
            ]}
            onChange={v => setPnlFilter(v as typeof pnlFilter)}
          />
        </div>
      </div>

      <div className="relative min-h-[400px] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
        <LoadingState
          isLoading={loading}
          error={Boolean(error)}
          isEmpty={!loading && sortedPositions.length === 0}
          onRetry={execute}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)]">
                  <th className="px-6 py-4 text-left">
                    {t('whaleTracking.holdings.table.address')}
                  </th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.asset')}</th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.leverage')}</th>
                  <th
                    className="group cursor-pointer px-6 py-4 text-left select-none"
                    onClick={() => handleSort('positionValue')}
                  >
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.positionValue')}
                      {renderSortIcon('positionValue')}
                    </div>
                  </th>
                  {/* PnL 列当前仅展示占位符，不提供排序交互以避免“空操作”体验 */}
                  <th className="px-6 py-4 text-left whitespace-nowrap">
                    {t('whaleTracking.holdings.table.unrealizedPnl')}
                  </th>
                  <th
                    className="group cursor-pointer px-6 py-4 text-left select-none"
                    onClick={() => handleSort('margin')}
                  >
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.margin')}
                      {renderSortIcon('margin')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    {t('whaleTracking.holdings.table.entryPrice')}
                  </th>
                  <th className="px-6 py-4 text-left">
                    {t('whaleTracking.holdings.table.liqPrice')}
                  </th>
                  <th
                    className="group cursor-pointer px-6 py-4 text-left whitespace-nowrap select-none"
                    onClick={() => handleSort('createdTime')}
                  >
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.createdTime')}
                      {renderSortIcon('createdTime')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    {t('whaleTracking.holdings.table.remark')}
                  </th>
                  <th className="w-16 px-6 py-4 text-center">
                    {t('whaleTracking.holdings.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--cf-border)]">
                {sortedPositions.map((pos, idx) => (
                  <tr
                    key={idx}
                    className="group cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                    onClick={() => handleShowStats(pos.address)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="group/address relative flex items-center gap-2">
                          <Link
                            href={`/${lng}/whale-tracking/profile/?address=${pos.address}`}
                            className="text-body font-medium text-[color:var(--cf-text-strong)] decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {pos.address.substring(0, 6)}...
                            {pos.address.substring(pos.address.length - 4)}
                          </Link>
                          {/* Hover-to-reveal full address tooltip */}
                          <div className="pointer-events-none invisible absolute top-0 left-0 z-30 -translate-y-[120%] rounded-lg border border-black/10 bg-black/90 px-3 py-2 font-mono text-xs whitespace-nowrap text-white opacity-0 shadow-2xl transition-all duration-200 group-hover/address:visible group-hover/address:opacity-100 dark:border-white/10 dark:bg-white/90 dark:text-black">
                            {pos.address}
                            <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
                          </div>
                          <button
                            type="button"
                            className={`transition-colors ${copiedAddress === pos.address ? 'text-green-500' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
                            onClick={e => {
                              e.stopPropagation()
                              handleCopy(pos.address)
                            }}
                          >
                            {copiedAddress === pos.address ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {pos.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-caption rounded px-1.5 py-0.5 font-medium"
                              style={{ color: tag.color, backgroundColor: tag.bg }}
                            >
                              {t(`whaleTracking.tags.${tag.key}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`text-caption rounded px-1.5 py-0.5 font-bold ${pos.side === 'Long' ? 'bg-[#22c55e33] text-[#4ade80]' : 'bg-[#ef444433] text-[#f87171]'}`}
                        >
                          {pos.side === 'Long'
                            ? t('whaleTracking.side.longAbbr')
                            : t('whaleTracking.side.shortAbbr')}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-body font-bold text-[color:var(--cf-text-strong)]">
                            {pos.asset}
                          </span>
                          <span className="text-caption text-[color:var(--cf-muted)]">
                            {pos.marginType === 'Cross'
                              ? t('whaleTracking.margin.cross')
                              : t('whaleTracking.margin.isolated')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">{pos.leverage}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body font-medium text-[color:var(--cf-text-strong)]">
                          {pos.positionValueUSD}
                        </span>
                        <span className="text-caption text-[color:var(--cf-muted)]">
                          {pos.positionValueAsset}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`text-body font-medium ${pos.pnlUSD.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}
                        >
                          {pos.pnlUSD}
                        </span>
                        <span
                          className={`text-caption ${pos.pnlPercent.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}
                        >
                          {pos.pnlPercent}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">{pos.margin}</td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">
                      {pos.entryPrice}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">{pos.liqPrice}</td>
                    <td className="px-6 py-4 text-[color:var(--cf-muted)]">
                      {formatRelativeMinutes(pos.createdMinutesAgo)}
                    </td>
                    <td className="text-caption max-w-[150px] truncate px-6 py-4 text-[color:var(--cf-muted)]">
                      {pos.remark}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-muted)] transition-all hover:text-[color:var(--cf-text-strong)] active:scale-95"
                        onClick={e => {
                          e.stopPropagation()
                          handleShowStats(pos.address)
                        }}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>

      <WhaleTradingStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  )
}
