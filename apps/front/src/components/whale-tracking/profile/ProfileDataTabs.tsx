'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserFillsResponse } from '@/lib/api'
import { CompletedTradesTable } from './CompletedTradesTable'

// Inline SVG icon components to avoid lucide-react LSP TS2786 errors
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

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

type TabType = 'spot' | 'perpetual' | 'orders' | 'trades' | 'history' | 'delegation'

// 后端 API 数据类型
interface PerpPositionDto {
  coin: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  positionValue: number
  marginUsed: number
  leverage: { type: 'cross' | 'isolated'; value: number }
  unrealizedPnl: number
  unrealizedPnlPercent: number
  fundingRate?: number
  roi: number
}

interface SpotBalanceDto {
  coin: string
  total: number
  hold: number
  available: number
  value: number
}

interface OpenOrderDto {
  orderId: number
  coin: string
  side: 'BUY' | 'SELL'
  type: string
  price: number
  size: number
  origSize: number
  value: number
  timestamp: string
  triggerPrice?: number | null
}

// Props 接口
interface ProfileDataTabsProps {
  spotPositions: SpotBalanceDto[]
  perpPositions: PerpPositionDto[]
  openOrders: OpenOrderDto[]
  fillsData: UserFillsResponse | null
}

// 前端显示类型
interface SpotPosition {
  asset: string
  share: string
  value: string
  amount: string
  price: string
}

interface PerpetualPosition {
  asset: string
  side: 'Long' | 'Short'
  marginType: string
  leverage: string
  valueUSD: string
  valueAsset: string
  pnlUSD: string
  pnlPercent: string
  entryPrice: string
  markPrice: string
  liqPrice: string
  margin: string
  fundingFee: string
}

interface OrderDetail {
  time: string
  type: string
  value: string
  amount: string
  price: string
  trigger: string
  status: string
  id: string
}

interface OpenOrder {
  /**
   * 后端订单唯一标识（如有）。用于 React key 与展开/收起状态的稳定键，避免同日同资产/方向的碰撞。
   */
  id?: string
  time: string
  asset: string
  side: 'Buy' | 'Sell'
  count: number
  value: string
  amount: string
  price: string
  details: OrderDetail[]
}

function getOpenOrderKey(order: OpenOrder): string {
  if (order.id) return order.id

  const detailIds = order.details.map(d => d.id).filter(Boolean)
  if (detailIds.length > 0) {
    // 以排序后的明细 id 组合生成稳定且唯一的键（避免 details 顺序变化导致 key 改变）
    return `${order.asset}:${order.side}:${detailIds.sort().join('|')}`
  }

  // 兜底：只用不可变字段（asset + time + side），虽可能碰撞但至少保持 key 稳定性，
  // 不会因部分成交导致 price/amount/count/status 变化而让展开状态失效
  return `${order.asset}:${order.time}:${order.side}`
}

interface RecentTrade {
  time: string
  asset: string
  action: string
  amount: string
  startPosition: string
  price: string
  pnl: string
  fee: string
  value: string
}

interface CompletedTrade {
  fillTime: number // 原始 fill.time 用于排序
  endTime: string
  asset: string
  side: 'Long' | 'Short'
  duration: string
}

interface HistoryOrder {
  time: string
  asset: string
  type: string
  side: 'Buy' | 'Sell'
  amount: string
  price: string
  trigger: string
  status: string
  id: string
}

export const ProfileDataTabs = ({
  spotPositions,
  perpPositions,
  openOrders,
  fillsData,
}: ProfileDataTabsProps) => {
  const { t } = useTranslation()

  // 数据转换函数
  const convertSpotToDisplay = (spots: SpotBalanceDto[]): SpotPosition[] => {
    if (!spots || spots.length === 0) return []

    const totalValue = spots.reduce((sum, s) => sum + s.value, 0)

    return spots.map(spot => {
      const sharePercent = totalValue > 0 ? ((spot.value / totalValue) * 100).toFixed(2) : '0.00'
      const rawPrice = spot.total > 0 ? spot.value / spot.total : 0

      // 动态小数位数：价格越小，显示越多小数位
      let priceStr: string
      if (rawPrice === 0) {
        priceStr = '0'
      } else if (rawPrice < 0.000001) {
        priceStr = rawPrice.toFixed(8) // 非常小的价格显示 8 位小数
      } else if (rawPrice < 0.0001) {
        priceStr = rawPrice.toFixed(6) // 小价格显示 6 位小数
      } else if (rawPrice < 0.01) {
        priceStr = rawPrice.toFixed(4) // 中等价格显示 4 位小数
      } else {
        priceStr = rawPrice.toFixed(2) // 正常价格显示 2 位小数
      }

      // 价值也使用动态小数位数
      let valueStr: string
      if (spot.value === 0) {
        valueStr = '0.00'
      } else if (spot.value < 0.01) {
        valueStr = spot.value.toFixed(4) // 小额价值显示 4 位小数
      } else {
        valueStr = spot.value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      }

      return {
        asset: spot.coin,
        share: `${sharePercent} %`,
        value: `$ ${valueStr}`,
        amount: `${spot.total} ${spot.coin}`,
        price: `$ ${priceStr}`,
      }
    })
  }

  const convertPerpToDisplay = (perps: PerpPositionDto[]): PerpetualPosition[] => {
    if (!perps || perps.length === 0) return []

    return perps.map(perp => {
      const isNegativePnl = perp.unrealizedPnl < 0
      const pnlSign = isNegativePnl ? '' : '+'

      return {
        asset: perp.coin,
        side: perp.side === 'LONG' ? 'Long' : 'Short',
        marginType: perp.leverage.type,
        leverage: `${perp.leverage.value}x`,
        valueUSD: `$ ${Math.abs(perp.positionValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        valueAsset: `${perp.size} ${perp.coin}`,
        pnlUSD: `$ ${pnlSign}${Math.abs(perp.unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        pnlPercent: `${pnlSign}${perp.unrealizedPnlPercent.toFixed(2)} %`,
        entryPrice: `$ ${perp.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
        markPrice: `$ ${perp.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
        liqPrice: `$ ${perp.liquidationPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
        margin: `$ ${perp.marginUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        fundingFee: perp.fundingRate
          ? `$ ${Math.abs(perp.fundingRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '$ 0.00',
      }
    })
  }

  const convertOrdersToDisplay = (orders: OpenOrderDto[]): OpenOrder[] => {
    if (!orders || orders.length === 0) return []

    // 按 coin + side + date 分组
    type GroupKey = string
    const groups = new Map<GroupKey, OpenOrderDto[]>()

    orders.forEach(order => {
      const date = new Date(order.timestamp).toISOString().split('T')[0] // YYYY-MM-DD
      const key = `${order.coin}:${order.side}:${date}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(order)
    })

    // 将每组转换为一个 OpenOrder
    return Array.from(groups.entries()).map(([_, groupOrders]) => {
      const first = groupOrders[0]
      const totalValue = groupOrders.reduce((sum, o) => sum + o.value, 0)
      const totalSize = groupOrders.reduce((sum, o) => sum + o.size, 0)
      const prices = groupOrders.map(o => o.price)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const priceRange =
        minPrice === maxPrice
          ? `$ ${minPrice.toFixed(2)}`
          : `$ ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`

      const displayDate = new Date(first.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      return {
        id: `group-${first.coin}-${first.side}-${first.timestamp}`,
        time: displayDate,
        asset: first.coin,
        side: first.side === 'BUY' ? 'Buy' : 'Sell',
        count: groupOrders.length,
        value: `$ ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        amount: `${totalSize.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} ${first.coin}`,
        price: priceRange,
        details: groupOrders.map(order => ({
          time: displayDate,
          type: order.type,
          value: `$ ${order.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          amount: `${order.size} ${order.coin}`,
          price: `$ ${order.price.toFixed(2)}`,
          trigger: order.triggerPrice ? `$ ${order.triggerPrice.toFixed(2)}` : '-',
          status: 'open', // Hyperliquid API 返回的都是 open orders
          id: `# ${order.orderId}`,
        })),
      }
    })
  }

  // 转换后的数据
  const displaySpotPositions = useMemo(() => convertSpotToDisplay(spotPositions), [spotPositions])
  const displayPerpPositions = useMemo(() => convertPerpToDisplay(perpPositions), [perpPositions])
  const displayOpenOrders = useMemo(() => convertOrdersToDisplay(openOrders), [openOrders])

  const [activeTab, setActiveTab] = useState<TabType>('perpetual')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null)
  const [assetFilter, setAssetFilter] = useState('')
  const [isFilterOpen, setIsAssetFilterOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set())

  const normalizeDateLabel = (value: string) => {
    // 2025年12月19日 -> 2025-12-19 (language-agnostic)
    return value.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/g, (_, y, m, d) => {
      const mm = String(m).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      return `${y}-${mm}-${dd}`
    })
  }

  const formatDurationLabel = (value: string) => {
    // 925小时 35分 -> 925h 35m (English-friendly), keep as-is if unknown format
    const h = value.match(/(\d+)\s*小时/)
    const m = value.match(/(\d+)\s*分/)
    if (!h && !m) return value
    const hh = h ? Number.parseInt(h[1], 10) : 0
    const mm = m ? Number.parseInt(m[1], 10) : 0
    return t('whaleTracking.time.duration', { hours: hh, minutes: mm })
  }

  const translateMarginType = (key: string) => {
    return t(`whaleTracking.margin.${key}`)
  }

  const translateOrderType = (key: string) => {
    return t(`whaleTracking.profile.orderType.${key}`)
  }

  const translateOrderStatus = (key: string) => {
    return t(`whaleTracking.profile.orderStatus.${key}`)
  }

  const translateTradeAction = (key: string) => {
    return t(`whaleTracking.profile.tradeAction.${key}`)
  }

  const toggleOrderExpansion = (orderId: string) => {
    const newSet = new Set(expandedOrders)
    if (newSet.has(orderId)) newSet.delete(orderId)
    else newSet.add(orderId)
    setExpandedOrders(newSet)
  }

  const tabs = [
    {
      id: 'spot',
      label: t('whaleTracking.profile.tabs.spot', { count: displaySpotPositions.length }),
    },
    {
      id: 'perpetual',
      label: t('whaleTracking.profile.tabs.perpetual', { count: displayPerpPositions.length }),
    },
    {
      id: 'orders',
      label: t('whaleTracking.profile.tabs.orders', { count: displayOpenOrders.length }),
    },
    { id: 'trades', label: t('whaleTracking.profile.tabs.trades') },
    { id: 'history', label: t('whaleTracking.profile.tabs.history') },
    { id: 'delegation', label: t('whaleTracking.profile.tabs.delegation') },
  ]

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc')
      else if (sortOrder === 'asc') {
        setSortField(null)
        setSortOrder(null)
      } else setSortOrder('desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const renderSortIcon = (field: string) => {
    if (sortField !== field)
      return (
        <SortIcon className="h-3 w-3 text-[color:var(--cf-muted)] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    return sortOrder === 'desc' ? (
      <ChevronDownIcon className="text-primary h-3 w-3" />
    ) : (
      <ChevronUpIcon className="text-primary h-3 w-3" />
    )
  }

  const getFilteredAndSortedData = <T extends { asset: string }>(
    rawData: T[],
    currentSortField: string | null,
    currentSortOrder: 'asc' | 'desc' | null,
    currentAssetFilter: string,
  ) => {
    let data = [...rawData]
    if (currentAssetFilter) {
      data = data.filter(item =>
        item.asset.toLowerCase().includes(currentAssetFilter.toLowerCase()),
      )
    }
    if (currentSortField && currentSortOrder) {
      data.sort((a: any, b: any) => {
        let valA = a[currentSortField]
        let valB = b[currentSortField]

        if (valA === undefined || valB === undefined) return 0

        const cleanNumeric = (val: any) => {
          if (typeof val !== 'string') return val
          const matches = val.replace(/,/g, '').match(/-?[\d.]+/)
          return matches ? Number.parseFloat(matches[0]) : 0
        }

        if (currentSortField === 'time' || currentSortField === 'endTime') {
          const parseDate = (d: string) => {
            if (!d) return 0
            return new Date(d.replace('年', '-').replace('月', '-').replace('日', '')).getTime()
          }
          const dateA = parseDate(valA)
          const dateB = parseDate(valB)
          return currentSortOrder === 'desc' ? dateB - dateA : dateA - dateB
        }

        if (currentSortField === 'duration') {
          const getMinutes = (d: string) => {
            if (!d) return 0
            const h = d.match(/(\d+)小时/)
            const m = d.match(/(\d+)分/)
            return (h ? Number.parseInt(h[1]) * 60 : 0) + (m ? Number.parseInt(m[1]) : 0)
          }
          valA = getMinutes(valA)
          valB = getMinutes(valB)
        } else {
          valA = cleanNumeric(valA)
          valB = cleanNumeric(valB)
        }

        return currentSortOrder === 'desc' ? (valB > valA ? 1 : -1) : valA > valB ? 1 : -1
      })
    }
    return data
  }

  const filteredSpotData = useMemo(
    () => getFilteredAndSortedData(displaySpotPositions, sortField, sortOrder, assetFilter),
    [displaySpotPositions, assetFilter, sortField, sortOrder],
  )

  const filteredPerpData = useMemo(
    () => getFilteredAndSortedData(displayPerpPositions, sortField, sortOrder, assetFilter),
    [displayPerpPositions, assetFilter, sortField, sortOrder],
  )

  const filteredOpenOrders = useMemo(
    () => getFilteredAndSortedData(displayOpenOrders, sortField, sortOrder, assetFilter),
    [displayOpenOrders, assetFilter, sortField, sortOrder],
  )

  // trades/delegation 暂无后端 API，显示空数据
  const filteredRecentTrades = useMemo<RecentTrade[]>(() => [], [])
  const filteredHistoryOrders = useMemo<HistoryOrder[]>(() => [], [])

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

  const showTimeColumn =
    activeTab === 'orders' || activeTab === 'trades' || activeTab === 'delegation'

  return (
    <div className="flex min-h-[400px] flex-col overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
      {/* Tabs Header */}
      <div className="flex border-b border-[color:var(--cf-border)] px-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as TabType)
              setSortField(null)
              setSortOrder(null)
            }}
            className={`group relative px-6 py-4 text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'text-[color:var(--cf-text-strong)]'
                : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
            }`}
          >
            <span className="relative z-10">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="from-primary to-secondary absolute inset-x-0 bottom-0 z-20 h-0.5 bg-gradient-to-r" />
            )}
            <div
              className={`from-primary/10 to-secondary/10 absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${activeTab === tab.id ? 'opacity-100' : ''}`}
            />
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto p-0">
        {activeTab === 'history' ? (
          <CompletedTradesTable fillsData={fillsData} />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[10px] font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
                {showTimeColumn && (
                  <th className="min-w-[120px] px-6 py-4 text-left">
                    <button
                      type="button"
                      onClick={() => handleSort('time')}
                      className="group flex items-center gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                    >
                      <span>{t('whaleTracking.profile.columns.time')}</span>
                      {renderSortIcon('time')}
                    </button>
                  </th>
                )}
                <th className="min-w-[150px] px-6 py-4 text-left">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setIsAssetFilterOpen(!isFilterOpen)
                      }}
                      className="group flex items-center gap-1.5 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      <span>{t('whaleTracking.profile.columns.asset')}</span>
                    </button>
                    {isFilterOpen && (
                      <div
                        className="absolute left-0 z-30 mt-2 w-48 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-2 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="relative mb-2">
                          <SearchIcon className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                          <input
                            type="text"
                            autoFocus
                            value={assetFilter}
                            onChange={e => setAssetFilter(e.target.value)}
                            placeholder={t('whaleTracking.profile.assetFilter.placeholder')}
                            className="focus:border-primary w-full rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-8 py-1.5 text-xs text-[color:var(--cf-text-strong)] focus:outline-none"
                          />
                          {assetFilter && (
                            <button
                              type="button"
                              onClick={() => setAssetFilter('')}
                              className="absolute top-1/2 right-2 -translate-y-1/2"
                            >
                              <XIcon className="h-3 w-3 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]" />
                            </button>
                          )}
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {Array.from(
                            new Set(
                              [
                                ...displaySpotPositions,
                                ...displayPerpPositions,
                                ...displayOpenOrders,
                              ].map(i => i.asset),
                            ),
                          ).map(asset => (
                            <button
                              key={asset}
                              type="button"
                              onClick={() => {
                                setAssetFilter(asset)
                                setIsAssetFilterOpen(false)
                              }}
                              className="w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                            >
                              {asset}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </th>

                {activeTab === 'spot' ? (
                  <>
                    <th className="px-6 py-4 text-left">
                      {t('whaleTracking.profile.columns.share')}
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('value')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.value')}</span>
                        {renderSortIcon('value')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.amount')}</span>
                        {renderSortIcon('amount')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('price')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.price')}</span>
                        {renderSortIcon('price')}
                      </button>
                    </th>
                  </>
                ) : activeTab === 'perpetual' ? (
                  <>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('valueUSD')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.positionValue')}</span>
                        {renderSortIcon('valueUSD')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('pnlUSD')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.unrealizedPnl')}</span>
                        {renderSortIcon('pnlUSD')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('entryPrice')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.entryPrice')}</span>
                        {renderSortIcon('entryPrice')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('markPrice')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.markPrice')}</span>
                        {renderSortIcon('markPrice')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('liqPrice')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.liqPrice')}</span>
                        {renderSortIcon('liqPrice')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('margin')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.margin')}</span>
                        {renderSortIcon('margin')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('fundingFee')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.fundingFee')}</span>
                        {renderSortIcon('fundingFee')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">
                      {t('whaleTracking.profile.columns.tpSl')}
                    </th>
                  </>
                ) : activeTab === 'orders' ? (
                  <>
                    <th className="px-6 py-4 text-left whitespace-nowrap">
                      {t('whaleTracking.profile.columns.side')}
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('value')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.value')}</span>
                        {renderSortIcon('value')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.amount')}</span>
                        {renderSortIcon('amount')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.price')}
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.trigger')}
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.status')}
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.orderId')}
                    </th>
                  </>
                ) : activeTab === 'trades' ? (
                  <>
                    <th className="px-6 py-4 text-left whitespace-nowrap">
                      {t('whaleTracking.profile.columns.action')}
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.amount')}</span>
                        {renderSortIcon('amount')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('startPosition')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.startPosition')}</span>
                        {renderSortIcon('startPosition')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('value')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.value')}</span>
                        {renderSortIcon('value')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('price')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.price')}</span>
                        {renderSortIcon('price')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('pnl')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.closedPnl')}</span>
                        {renderSortIcon('pnl')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('fee')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.fee')}</span>
                        {renderSortIcon('fee')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">
                      {t('whaleTracking.profile.columns.tradeRecord')}
                    </th>
                  </>
                ) : activeTab === 'history' ? (
                  <>
                    <th className="px-6 py-4 text-left whitespace-nowrap">
                      {t('whaleTracking.profile.columns.side')}
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('duration')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.duration')}</span>
                        {renderSortIcon('duration')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('netPnl')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.netPnl')}</span>
                        {renderSortIcon('netPnl')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('size')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.size')}</span>
                        {renderSortIcon('size')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('exitPrice')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.exitPrice')}</span>
                        {renderSortIcon('exitPrice')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('fee')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.fee')}</span>
                        {renderSortIcon('fee')}
                      </button>
                    </th>
                  </>
                ) : activeTab === 'delegation' ? (
                  <>
                    <th className="px-6 py-4 text-left whitespace-nowrap">
                      {t('whaleTracking.profile.columns.type')}
                    </th>
                    <th className="px-6 py-4 text-left whitespace-nowrap">
                      {t('whaleTracking.profile.columns.side')}
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.amount')}</span>
                        {renderSortIcon('amount')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('price')}
                        className="group ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap hover:text-[color:var(--cf-text-strong)]"
                      >
                        <span>{t('whaleTracking.profile.columns.price')}</span>
                        {renderSortIcon('price')}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.trigger')}
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.executionStatus')}
                    </th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">
                      {t('whaleTracking.profile.columns.orderId')}
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--cf-border)]">
              {activeTab === 'spot'
                ? filteredSpotData.map((pos, idx) => (
                    <tr
                      key={idx}
                      className="transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                            {pos.asset}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-[color:var(--cf-text-strong)]">
                            {pos.share}
                          </span>
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-[color:var(--cf-bg)]">
                            <div className="h-full bg-cyan-400" style={{ width: pos.share }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-[color:var(--cf-text-strong)]">
                        {pos.value}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                        {pos.amount}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                        {pos.price}
                      </td>
                    </tr>
                  ))
                : activeTab === 'perpetual'
                  ? filteredPerpData.map((pos, idx) => (
                      <tr
                        key={idx}
                        className="transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[color:var(--cf-text-strong)]">
                                {pos.asset}
                              </span>
                              <span className="text-[10px] font-medium text-[color:var(--cf-muted)] uppercase">
                                {translateMarginType(pos.marginType)} {pos.leverage}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[color:var(--cf-text-strong)]">
                              {pos.valueUSD}
                            </span>
                            <span className="text-[10px] text-[color:var(--cf-muted)] uppercase">
                              {pos.valueAsset}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col">
                            <span
                              className={`text-sm font-bold ${pos.pnlUSD.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                            >
                              {pos.pnlUSD}
                            </span>
                            <span
                              className={`text-[10px] ${pos.pnlPercent.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                            >
                              {pos.pnlPercent}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                          {pos.entryPrice}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                          {pos.markPrice}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                          {pos.liqPrice}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                          {pos.margin}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-green-500 dark:text-green-400">
                          {pos.fundingFee}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-[color:var(--cf-muted)]">
                          -/-
                        </td>
                      </tr>
                    ))
                  : activeTab === 'orders'
                    ? filteredOpenOrders.map(order => {
                        const orderKey = getOpenOrderKey(order)
                        return (
                          <React.Fragment key={orderKey}>
                            <tr
                              className="cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                              onClick={() => toggleOrderExpansion(orderKey)}
                            >
                              <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                                {normalizeDateLabel(order.time)}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                                  {order.asset}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${order.side === 'Buy' ? 'bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-red-500/20 text-red-500 dark:text-red-400'}`}
                                  >
                                    {order.side === 'Buy'
                                      ? t('whaleTracking.side.buy')
                                      : t('whaleTracking.side.sell')}
                                  </span>
                                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                                    {t('whaleTracking.profile.orders.orderCount', {
                                      count: order.count,
                                    })}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                                {order.value}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                                {order.amount}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                                {order.price}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)]">
                                -
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)]">
                                -
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  className={`text-[color:var(--cf-muted)] transition-all hover:text-[color:var(--cf-text-strong)] ${expandedOrders.has(orderKey) ? 'rotate-180' : ''}`}
                                >
                                  <ChevronDownIcon className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                            {expandedOrders.has(orderKey) &&
                              order.details.map((detail, dIdx) => (
                                <tr
                                  key={detail.id || dIdx}
                                  className="bg-[color:var(--cf-bg)]/30 text-[color:var(--cf-muted)]"
                                >
                                  <td className="px-6 py-3 pl-12 text-xs">
                                    {normalizeDateLabel(detail.time)}
                                  </td>
                                  <td className="px-6 py-3 text-xs font-bold text-[color:var(--cf-text-strong)]/70 uppercase">
                                    {order.asset}
                                  </td>
                                  <td className="px-6 py-3">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${order.side === 'Buy' ? 'bg-green-500/10 text-green-500/70' : 'bg-red-500/10 text-red-500/70'}`}
                                      >
                                        {order.side === 'Buy'
                                          ? t('whaleTracking.side.buy')
                                          : t('whaleTracking.side.sell')}
                                      </span>
                                      <span className="text-[10px]">
                                        {translateOrderType(detail.type)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-right text-xs">{detail.value}</td>
                                  <td className="px-6 py-3 text-right text-[10px] uppercase">
                                    {detail.amount}
                                  </td>
                                  <td className="px-6 py-3 text-right text-xs">{detail.price}</td>
                                  <td className="px-6 py-3 text-right text-xs">{detail.trigger}</td>
                                  <td className="px-6 py-3 text-right text-xs">
                                    {translateOrderStatus(detail.status)}
                                  </td>
                                  <td className="px-6 py-3 text-right text-[10px]">{detail.id}</td>
                                </tr>
                              ))}
                          </React.Fragment>
                        )
                      })
                    : activeTab === 'trades'
                      ? filteredRecentTrades.map((trade, idx) => (
                          <tr
                            key={idx}
                            className="transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                          >
                            <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                              {normalizeDateLabel(trade.time)}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                              {trade.asset}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-green-500 uppercase dark:text-green-400`}
                              >
                                {translateTradeAction(trade.action)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                              {trade.amount}
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                              {trade.startPosition}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                              {trade.value}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                              {trade.price}
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)]">
                              {trade.pnl}
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                              {trade.fee}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                className="text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                              >
                                <svg
                                  className="inline-block h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      : activeTab === 'delegation'
                        ? filteredHistoryOrders.map((order, idx) => (
                            <tr
                              key={idx}
                              className="transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                            >
                              <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                                {normalizeDateLabel(order.time)}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                                {order.asset}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-[color:var(--cf-text-strong)]">
                                {translateOrderType(order.type)}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-green-500 uppercase dark:text-green-400`}
                                >
                                  {order.side === 'Buy'
                                    ? t('whaleTracking.side.buy')
                                    : t('whaleTracking.side.sell')}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                                {order.amount}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-[color:var(--cf-text-strong)]">
                                {order.price}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)]">
                                {order.trigger}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {order.status === 'filled' ? (
                                  <div className="flex items-center justify-end gap-1.5 text-green-500 dark:text-green-400">
                                    <div className="flex h-4 w-4 items-center justify-center rounded-full border border-green-500 dark:border-green-400">
                                      <svg
                                        className="h-2.5 w-2.5"
                                        viewBox="0 0 10 10"
                                        fill="currentColor"
                                      >
                                        <path d="M3.5 6.5l-2-2L1 5l2.5 2.5L9 2l-.5-.5L3.5 6.5z" />
                                      </svg>
                                    </div>
                                  </div>
                                ) : order.status === 'cancelled' ? (
                                  <div className="flex items-center justify-end gap-1.5 text-[color:var(--cf-muted)]">
                                    <svg
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
                                    </svg>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                                    {translateOrderStatus(order.status)}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-medium text-[color:var(--cf-muted)] uppercase">
                                {order.id}
                              </td>
                            </tr>
                          ))
                        : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
