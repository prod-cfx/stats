'use client'

import type {HyperliquidHistoricalOrderEntry} from '@/lib/hyperliquid-api';
import { ArrowUpDown, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import React, { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { getRelativeTimeParams } from '@/lib/formatters'
import {
  fetchTraderHistoricalOrdersFromHyperliquid,
  fetchUserFillsFromHyperliquid
  
} from '@/lib/hyperliquid-api'

type AnyComponent = React.ComponentType<Record<string, unknown>>

// Workaround: this repo mixes @types/react 18/19.
// The language server reports TS2786 for these icons, but Next build succeeds.
// Keep opaque aliases for local JSX usage.
const ArrowUpDownIcon = ArrowUpDown as unknown as AnyComponent
const ChevronDownIcon = ChevronDown as unknown as AnyComponent
const ChevronUpIcon = ChevronUp as unknown as AnyComponent
const SearchIcon = Search as unknown as AnyComponent
const XIcon = X as unknown as AnyComponent

type TabType = 'spot' | 'perpetual' | 'orders' | 'trades' | 'delegation'
type SortOrder = 'asc' | 'desc' | null

interface TableViewState {
  activeTab: TabType
  sortField: string | null
  sortOrder: SortOrder
  assetFilter: string
  isFilterOpen: boolean
}

type TableViewAction =
  | { type: 'selectTab'; tab: TabType }
  | { type: 'toggleSort'; field: string }
  | { type: 'setAssetFilter'; value: string }
  | { type: 'clearAssetFilter' }
  | { type: 'selectAssetFilter'; value: string }
  | { type: 'toggleAssetFilter' }

const INITIAL_TABLE_VIEW_STATE: TableViewState = {
  activeTab: 'perpetual',
  sortField: null,
  sortOrder: null,
  assetFilter: '',
  isFilterOpen: false,
}

function tableViewReducer(state: TableViewState, action: TableViewAction): TableViewState {
  switch (action.type) {
    case 'selectTab':
      return { ...state, activeTab: action.tab, sortField: null, sortOrder: null }
    case 'toggleSort': {
      if (state.sortField !== action.field) {
        return { ...state, sortField: action.field, sortOrder: 'desc' }
      }
      if (state.sortOrder === 'desc') return { ...state, sortOrder: 'asc' }
      if (state.sortOrder === 'asc') return { ...state, sortField: null, sortOrder: null }
      return { ...state, sortOrder: 'desc' }
    }
    case 'setAssetFilter':
      return { ...state, assetFilter: action.value }
    case 'clearAssetFilter':
      return { ...state, assetFilter: '' }
    case 'selectAssetFilter':
      return { ...state, assetFilter: action.value, isFilterOpen: false }
    case 'toggleAssetFilter':
      return { ...state, isFilterOpen: !state.isFilterOpen }
  }
}

function cleanSortableNumeric(value: unknown) {
  if (typeof value !== 'string') return value
  const matches = value.replace(/,/g, '').match(/-?[\d.]+/)
  return matches ? Number.parseFloat(matches[0]) : 0
}

function toSortableValue(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value
  return String(value ?? '')
}

export function compareProfileSortableValues(
  sortableA: string | number,
  sortableB: string | number,
  sortOrder: Exclude<SortOrder, null>,
) {
  if (sortableA === sortableB) return 0

  return sortOrder === 'desc'
    ? Number(sortableB > sortableA) || -1
    : Number(sortableA > sortableB) || -1
}

function parseZhDateTime(value: string) {
  if (!value) return 0
  return new Date(value.replace('年', '-').replace('月', '-').replace('日', '')).getTime()
}

function parseDurationMinutes(value: string) {
  if (!value) return 0
  const hours = value.match(/(\d+)小时/)
  const minutes = value.match(/(\d+)分/)
  return (hours ? Number.parseInt(hours[1]) * 60 : 0) + (minutes ? Number.parseInt(minutes[1]) : 0)
}

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
  traderAddress: string
  // Back-compat: caller still passes `address`.
  address?: string
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
  timestamp: number
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
  timestamp: number
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

  const detailIds: string[] = []
  for (const detail of order.details) {
    if (detail.id) {
      detailIds.push(detail.id)
    }
  }

  if (detailIds.length > 0) {
    // 以排序后的明细 id 组合生成稳定且唯一的键（避免 details 顺序变化导致 key 改变）
    return `${order.asset}:${order.side}:${detailIds.sort().join('|')}`
  }

  // 兜底：只用不可变字段（asset + time + side），虽可能碰撞但至少保持 key 稳定性，
  // 不会因部分成交导致 price/amount/count/status 变化而让展开状态失效
  return `${order.asset}:${order.time}:${order.side}`
}

interface RecentTrade {
  id: string
  time: string
  timestamp: number
  asset: string
  action: string
  amount: string
  startPosition: string
  price: string
  pnl: string
  fee: string
  value: string
}

type TradesState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

interface RecentTradesState {
  status: TradesState
  trades: RecentTrade[]
  error: string | null
}

type RecentTradesAction =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'success'; trades: RecentTrade[] }
  | { type: 'error'; message: string }
  | { type: 'retry' }

const INITIAL_RECENT_TRADES_STATE: RecentTradesState = {
  status: 'idle',
  trades: [],
  error: null,
}

function recentTradesReducer(
  state: RecentTradesState,
  action: RecentTradesAction,
): RecentTradesState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'empty':
      return { status: 'empty', trades: [], error: null }
    case 'success':
      return { status: 'success', trades: action.trades, error: null }
    case 'error':
      return { status: 'error', trades: [], error: action.message }
    case 'retry':
      return { ...state, status: 'idle' }
  }
}

interface HistoryOrdersState {
  orders: HistoryOrder[] | null
  walletAddress: string | null
  visibleCount: number
  isLoading: boolean
  error: Error | null
}

type HistoryOrdersAction =
  | { type: 'loading' }
  | { type: 'success'; orders: HistoryOrder[]; renderStep: number; walletAddress: string }
  | { type: 'error'; error: Error }
  | { type: 'showMore'; nextVisibleCount: number }
  | { type: 'reset'; renderStep: number }

export function createHistoryOrdersState(renderStep: number): HistoryOrdersState {
  return {
    orders: null,
    walletAddress: null,
    visibleCount: renderStep,
    isLoading: false,
    error: null,
  }
}

export function shouldReuseHistoryOrders(state: HistoryOrdersState, walletAddress: string) {
  return state.walletAddress === walletAddress && state.orders !== null && state.error === null
}

export function getCurrentWalletHistoryOrders(
  state: HistoryOrdersState,
  walletAddress: string,
): HistoryOrder[] | null {
  return state.walletAddress === walletAddress ? state.orders : null
}

export function historyOrdersReducer(
  state: HistoryOrdersState,
  action: HistoryOrdersAction,
): HistoryOrdersState {
  switch (action.type) {
    case 'loading':
      return { ...state, isLoading: true, error: null }
    case 'success':
      return {
        orders: action.orders,
        walletAddress: action.walletAddress,
        visibleCount: action.renderStep,
        isLoading: false,
        error: null,
      }
    case 'error':
      return { ...state, orders: [], isLoading: false, error: action.error }
    case 'showMore':
      return { ...state, visibleCount: action.nextVisibleCount }
    case 'reset':
      return createHistoryOrdersState(action.renderStep)
  }
}

interface HistoryOrder {
  time: string
  timestamp: number
  asset: string
  type: string
  side: 'Buy' | 'Sell'
  amount: string
  price: string
  trigger: string
  status: string
  id: string
}

export const ProfileDataTabs = (props: ProfileDataTabsProps) => useProfileDataTabsRender(props)

function useProfileDataTabsRender({
  spotPositions,
  perpPositions,
  openOrders,
  traderAddress,
}: ProfileDataTabsProps) {
  const { t } = useTranslation()

  const walletAddress = traderAddress

  const HISTORY_RENDER_STEP = 50
  const HISTORY_MIN_REFETCH_MS = 10_000

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

  const mapHistoricalOrdersToHistoryOrders = (
    entries: HyperliquidHistoricalOrderEntry[],
  ): HistoryOrder[] => {
    const formatDateLabel = (timestampMs: number) => {
      return new Date(timestampMs).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const formatUsdFromString = (value: string) => {
      const n = Number.parseFloat(value)
      if (!Number.isFinite(n)) return '$ 0.00'
      return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
    }

    const normalizeOrderType = (raw: string | undefined) => {
      const v = (raw ?? '').trim().toLowerCase()
      if (v.includes('market')) return 'market'
      // hyperliquid 可能出现: limit / post_only / ioc / fok / stop_limit 等
      return 'limit'
    }

    return entries.map(entry => {
      const order = entry.order
      const isBuy = order.side === 'A'
      const status = entry.status === 'canceled' ? 'cancelled' : entry.status
      const trigger = order.isTrigger ? formatUsdFromString(order.triggerPx ?? '0') : '-'

      return {
        time: formatDateLabel(order.timestamp),
        timestamp: order.timestamp,
        asset: order.coin,
        type: normalizeOrderType(order.orderType),
        side: isBuy ? 'Buy' : 'Sell',
        amount: `${order.origSz ?? order.sz} ${order.coin}`,
        price: formatUsdFromString(order.limitPx),
        trigger,
        status,
        id: `# ${order.oid}`,
      }
    })
  }

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
        fundingFee:
          perp.fundingRate != null
            ? `${perp.fundingRate >= 0 ? '+' : '-'} $ ${Math.abs(perp.fundingRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '$ 0.00',
      }
    })
  }

  const convertOrdersToDisplay = (orders: OpenOrderDto[]): OpenOrder[] => {
    if (!orders || orders.length === 0) return []

    type GroupKey = string
    const groups = new Map<GroupKey, OpenOrderDto[]>()

    orders.forEach(order => {
      const date = new Date(order.timestamp).toISOString().split('T')[0]
      const key = `${order.coin}:${order.side}:${date}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(order)
    })

    return Array.from(groups.entries()).map(([_, groupOrders]) => {
      const first = groupOrders[0]
      const firstTimestamp = new Date(first.timestamp).getTime()
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
        timestamp: firstTimestamp,
        asset: first.coin,
        side: first.side === 'BUY' ? 'Buy' : 'Sell',
        count: groupOrders.length,
        value: `$ ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        amount: `${totalSize.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} ${first.coin}`,
        price: priceRange,
        details: groupOrders.map(order => {
          const orderTimestamp = new Date(order.timestamp).getTime()
          return {
            time: displayDate,
            timestamp: orderTimestamp,
            type: order.type,
            value: `$ ${order.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            amount: `${order.size} ${order.coin}`,
            price: `$ ${order.price.toFixed(2)}`,
            trigger: order.triggerPrice ? `$ ${order.triggerPrice.toFixed(2)}` : '-',
            status: 'open',
            id: `# ${order.orderId}`,
          }
        }),
      }
    })
  }

  // 转换后的数据
  const displaySpotPositions = useMemo(() => convertSpotToDisplay(spotPositions), [spotPositions])
  const displayPerpPositions = useMemo(() => convertPerpToDisplay(perpPositions), [perpPositions])
  const displayOpenOrders = useMemo(() => convertOrdersToDisplay(openOrders), [openOrders])

  const formatUsd = (value: number, opts: { digits?: number } = {}) => {
    const digits = opts.digits ?? 2
    return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
  }

  const mapFillDirectionToTradeActionKey = (
    direction: string,
  ): 'openLong' | 'closeLong' | 'openShort' | 'closeShort' | 'openLongAdd' => {
    // Prefer Hyperbot-like labels (and keep legacy key as fallback)
    if (direction === 'Open Long') return 'openLong'
    if (direction === 'Close Long') return 'closeLong'
    if (direction === 'Open Short') return 'openShort'
    if (direction === 'Close Short') return 'closeShort'
    return 'openLongAdd'
  }

  const [{ activeTab, sortField, sortOrder, assetFilter, isFilterOpen }, dispatchTableView] =
    useReducer(tableViewReducer, INITIAL_TABLE_VIEW_STATE)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set())

  const [historyOrdersState, dispatchHistoryOrders] = useReducer(
    historyOrdersReducer,
    HISTORY_RENDER_STEP,
    createHistoryOrdersState,
  )
  const {
    walletAddress: historyOrdersWalletAddress,
    visibleCount: historyVisibleCount,
    isLoading: isHistoryLoading,
    error: historyError,
  } = historyOrdersState
  const historyOrdersAll = getCurrentWalletHistoryOrders(historyOrdersState, walletAddress)
  const lastHistoryFetchAtRef = useRef<number>(0)
  const assetFilterInputRef = useRef<HTMLInputElement | null>(null)
  const mobileHistorySentinelRef = useRef<HTMLDivElement | null>(null)
  const desktopHistorySentinelRef = useRef<HTMLDivElement | null>(null)

  const loadHistoryOrders = useCallback(async () => {
    if (isHistoryLoading) return

    const now = Date.now()
    if (
      shouldReuseHistoryOrders(historyOrdersState, walletAddress) &&
      now - lastHistoryFetchAtRef.current < HISTORY_MIN_REFETCH_MS
    ) {
      return
    }

    dispatchHistoryOrders({ type: 'loading' })

    try {
      const res = await fetchTraderHistoricalOrdersFromHyperliquid(walletAddress)
      const mapped = mapHistoricalOrdersToHistoryOrders(res.orders)
      dispatchHistoryOrders({ type: 'success', orders: mapped, renderStep: HISTORY_RENDER_STEP, walletAddress })
      lastHistoryFetchAtRef.current = now
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load history orders')
      dispatchHistoryOrders({ type: 'error', error: e })
    }
  }, [walletAddress, historyOrdersState, isHistoryLoading])

  useEffect(() => {
    if (historyOrdersWalletAddress === null || historyOrdersWalletAddress === walletAddress) return
    lastHistoryFetchAtRef.current = 0
    dispatchHistoryOrders({ type: 'reset', renderStep: HISTORY_RENDER_STEP })
  }, [historyOrdersWalletAddress, walletAddress])

  useEffect(() => {
    if (activeTab !== 'delegation') return
    if (shouldReuseHistoryOrders(historyOrdersState, walletAddress)) return
    void loadHistoryOrders()
  }, [activeTab, historyOrdersState, loadHistoryOrders, walletAddress])
  const [recentTradesState, dispatchRecentTrades] = useReducer(
    recentTradesReducer,
    INITIAL_RECENT_TRADES_STATE,
  )
  const { status: tradesState, trades: recentTrades, error: tradesError } = recentTradesState

  const loadRecentTrades = async () => {
    if (tradesState === 'loading') return
    dispatchRecentTrades({ type: 'loading' })

    try {
      const res = await fetchUserFillsFromHyperliquid(traderAddress, { aggregateByTime: true })
      const fills = res.fills

      if (!fills.length) {
        dispatchRecentTrades({ type: 'empty' })
        return
      }

      const mapped: RecentTrade[] = fills.slice(0, 50).map(fill => {
        const valueUsd = fill.price * fill.size

        return {
          id: String(fill.tid),
          time: new Date(fill.time).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          timestamp: fill.time,
          asset: fill.coin,
          action: mapFillDirectionToTradeActionKey(fill.direction),
          amount: `${fill.size.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 6,
          })} ${fill.coin}`,
          startPosition: fill.startPosition.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          }),
          price: formatUsd(fill.price, { digits: 2 }),
          pnl: formatUsd(fill.closedPnl, { digits: 2 }),
          fee: formatUsd(fill.fee, { digits: 4 }),
          value: formatUsd(valueUsd, { digits: 2 }),
        }
      })

      dispatchRecentTrades({ type: 'success', trades: mapped })
    } catch {
      dispatchRecentTrades({
        type: 'error',
        message: t('whaleTracking.profile.recentTrades.loadFailed'),
      })
    }
  }

  useEffect(() => {
    if (activeTab === 'trades' && tradesState === 'idle') {
      void loadRecentTrades()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

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

  const getTradeActionBadgeClass = (action: RecentTrade['action']) => {
    const isOpen = action === 'openLong' || action === 'openShort' || action === 'openLongAdd'
    const isLong = action === 'openLong' || action === 'closeLong' || action === 'openLongAdd'
    const isShort = action === 'openShort' || action === 'closeShort'

    // Align with rest of tables: Buy/Long is green, Sell/Short is red.
    if (isOpen) {
      if (isLong) return 'bg-green-500/10 text-green-500/70'
      if (isShort) return 'bg-red-500/10 text-red-500/70'
    }

    // Close direction is opposite (closing long => sell-ish => red; closing short => buy-ish => green)
    if (!isOpen) {
      if (action === 'closeLong') return 'bg-red-500/10 text-red-500/70'
      if (action === 'closeShort') return 'bg-green-500/10 text-green-500/70'
    }

    return 'bg-[color:var(--cf-bg)]/30 text-[color:var(--cf-muted)]'
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
    { id: 'delegation', label: t('whaleTracking.profile.tabs.delegation') },
  ]

  const handleSort = (field: string) => dispatchTableView({ type: 'toggleSort', field })

  const renderSortIcon = (field: string) => {
    if (sortField !== field)
      return (
        <ArrowUpDownIcon className="size-3 text-[color:var(--cf-muted)] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    return sortOrder === 'desc' ? (
      <ChevronDownIcon className="text-primary size-3" />
    ) : (
      <ChevronUpIcon className="text-primary size-3" />
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
      data.sort((a, b) => {
        const sortKey = currentSortField as keyof T
        let valA: unknown = a[sortKey]
        let valB: unknown = b[sortKey]

        if (valA === undefined || valB === undefined) return 0

        if (currentSortField === 'time' || currentSortField === 'endTime') {
          const dateA = typeof valA === 'string' ? parseZhDateTime(valA) : 0
          const dateB = typeof valB === 'string' ? parseZhDateTime(valB) : 0
          return currentSortOrder === 'desc' ? dateB - dateA : dateA - dateB
        }

        if (currentSortField === 'duration') {
          valA = typeof valA === 'string' ? parseDurationMinutes(valA) : 0
          valB = typeof valB === 'string' ? parseDurationMinutes(valB) : 0
        } else {
          valA = toSortableValue(cleanSortableNumeric(valA))
          valB = toSortableValue(cleanSortableNumeric(valB))
        }

        const sortableA = toSortableValue(valA)
        const sortableB = toSortableValue(valB)

        return compareProfileSortableValues(sortableA, sortableB, currentSortOrder)
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

  const filteredRecentTrades = useMemo<RecentTrade[]>(() => {
    if (activeTab !== 'trades') return []
    if (tradesState !== 'success') return []
    return getFilteredAndSortedData(recentTrades, sortField, sortOrder, assetFilter)
  }, [activeTab, assetFilter, recentTrades, sortField, sortOrder, tradesState])

  const allHistoryOrdersFiltered = useMemo(() => {
    return getFilteredAndSortedData(historyOrdersAll ?? [], sortField, sortOrder, assetFilter)
  }, [historyOrdersAll, assetFilter, sortField, sortOrder])

  const filteredHistoryOrders = useMemo<HistoryOrder[]>(() => {
    return allHistoryOrdersFiltered.slice(0, historyVisibleCount)
  }, [allHistoryOrdersFiltered, historyVisibleCount])

  const canLoadMoreHistory =
    activeTab === 'delegation' &&
    historyOrdersAll !== null &&
    historyVisibleCount < allHistoryOrdersFiltered.length

  useEffect(() => {
    if (!isFilterOpen) return
    assetFilterInputRef.current?.focus()
  }, [isFilterOpen])

  useEffect(() => {
    if (!canLoadMoreHistory) return
    const sentinelEls = [
      mobileHistorySentinelRef.current,
      desktopHistorySentinelRef.current,
    ].filter((el): el is HTMLDivElement => Boolean(el))
    if (sentinelEls.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const hit = entries.some(e => e.isIntersecting)
        if (!hit) return
        dispatchHistoryOrders({
          type: 'showMore',
          nextVisibleCount: Math.min(
            historyVisibleCount + HISTORY_RENDER_STEP,
            allHistoryOrdersFiltered.length,
          ),
        })
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    )

    sentinelEls.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [allHistoryOrdersFiltered.length, canLoadMoreHistory, historyVisibleCount])

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
      <div className="flex overflow-x-auto border-b border-[color:var(--cf-border)] px-2 md:px-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              dispatchTableView({ type: 'selectTab', tab: tab.id as TabType })
            }}
            className={`group relative flex-shrink-0 p-4 text-sm font-bold transition-all md:px-6 ${
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

      <div data-testid="profile-mobile-card-list" className="space-y-3 p-3 md:hidden">
        {activeTab === 'trades' && tradesState === 'loading' ? (
          <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">
            {t('whaleTracking.profile.recentTrades.loading')}
          </div>
        ) : activeTab === 'trades' && tradesState === 'error' ? (
          <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">
            {tradesError || t('whaleTracking.profile.recentTrades.loadFailed')}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                dispatchRecentTrades({ type: 'retry' })
                void loadRecentTrades()
              }}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : activeTab === 'trades' && tradesState === 'empty' ? (
          <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">
            {t('whaleTracking.profile.recentTrades.empty')}
          </div>
        ) : activeTab === 'spot' ? (
          filteredSpotData.map(pos => (
            <article key={`${pos.asset}-mobile`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">{pos.asset}</span>
                <span className="text-xs font-bold text-[color:var(--cf-text-strong)]">{pos.share}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.value')}</div><div className="font-semibold text-[color:var(--cf-text-strong)]">{pos.value}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.amount')}</div><div className="text-[color:var(--cf-muted)]">{pos.amount}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.price')}</div><div className="text-[color:var(--cf-text-strong)]">{pos.price}</div></div>
              </div>
            </article>
          ))
        ) : activeTab === 'perpetual' ? (
          filteredPerpData.map(pos => (
            <article key={`${pos.asset}-${pos.side}-${pos.marginType}-mobile`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[color:var(--cf-text-strong)]">{pos.asset}</div>
                  <div className="text-[10px] text-[color:var(--cf-muted)] uppercase">{translateMarginType(pos.marginType)} {pos.leverage}</div>
                </div>
                {renderSideBadge(pos.side)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.positionValue')}</div><div className="font-semibold text-[color:var(--cf-text-strong)]">{pos.valueUSD}</div><div className="text-[color:var(--cf-muted)]">{pos.valueAsset}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.unrealizedPnl')}</div><div className={pos.pnlUSD.includes('+') ? 'font-semibold text-green-500' : 'font-semibold text-red-500'}>{pos.pnlUSD}</div><div className={pos.pnlPercent.includes('+') ? 'text-green-500' : 'text-red-500'}>{pos.pnlPercent}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.entryPrice')}</div><div className="text-[color:var(--cf-text-strong)]">{pos.entryPrice}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.markPrice')}</div><div className="text-[color:var(--cf-text-strong)]">{pos.markPrice}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.liqPrice')}</div><div className="text-[color:var(--cf-text-strong)]">{pos.liqPrice}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.margin')}</div><div className="text-[color:var(--cf-text-strong)]">{pos.margin}</div></div>
              </div>
            </article>
          ))
        ) : activeTab === 'orders' ? (
          filteredOpenOrders.map(order => {
            const orderKey = getOpenOrderKey(order)
            return (
              <article key={`${orderKey}-mobile`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <button type="button" className="w-full text-left" onClick={() => toggleOrderExpansion(orderKey)}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div><div className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">{order.asset}</div><div className="text-xs text-[color:var(--cf-muted)]">{formatRelativeTime(order.timestamp)}</div></div>
                    <div className="flex items-center gap-2">{renderSideBadge(order.side)}<ChevronDownIcon className={`size-4 text-[color:var(--cf-muted)] ${expandedOrders.has(orderKey) ? 'rotate-180' : ''}`} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.value')}</div><div className="font-semibold text-[color:var(--cf-text-strong)]">{order.value}</div></div>
                    <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.amount')}</div><div className="text-[color:var(--cf-muted)]">{order.amount}</div></div>
                    <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.price')}</div><div className="text-[color:var(--cf-text-strong)]">{order.price}</div></div>
                    <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.orders.orderCount', { count: order.count })}</div></div>
                  </div>
                </button>
                {expandedOrders.has(orderKey) && (
                  <div className="mt-3 space-y-2 border-t border-[color:var(--cf-border)] pt-3">
                    {order.details.map(detail => (
                      <div key={detail.id || `${detail.timestamp}-${detail.type}-${detail.value}`} className="rounded-lg bg-[color:var(--cf-surface)] p-2 text-xs">
                        <div className="flex justify-between gap-2"><span className="text-[color:var(--cf-muted)]">{translateOrderType(detail.type)}</span><span className="text-[color:var(--cf-text-strong)]">{detail.value}</span></div>
                        <div className="mt-1 break-all text-[color:var(--cf-muted)]">{detail.id} · {detail.amount} · {detail.price}</div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          })
        ) : activeTab === 'trades' ? (
          filteredRecentTrades.map(trade => (
            <article key={`${trade.id}-mobile`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><div className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">{trade.asset}</div><div className="text-xs text-[color:var(--cf-muted)]">{formatRelativeTime(trade.timestamp)}</div></div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${getTradeActionBadgeClass(trade.action)}`}>{translateTradeAction(trade.action)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.amount')}</div><div className="text-[color:var(--cf-muted)]">{trade.amount}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.value')}</div><div className="text-[color:var(--cf-text-strong)]">{trade.value}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.price')}</div><div className="text-[color:var(--cf-text-strong)]">{trade.price}</div></div>
                <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.closedPnl')}</div><div className="text-[color:var(--cf-muted)]">{trade.pnl}</div></div>
              </div>
            </article>
          ))
        ) : activeTab === 'delegation' ? (
          isHistoryLoading && historyOrdersAll === null ? (
            <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</div>
          ) : filteredHistoryOrders.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6 text-center text-sm text-[color:var(--cf-muted)]">{t('common.noData')}</div>
          ) : (
            filteredHistoryOrders.map(order => (
              <article key={`${order.id}-mobile`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div><div className="text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">{order.asset}</div><div className="text-xs text-[color:var(--cf-muted)]">{formatRelativeTime(order.timestamp)}</div></div>
                  {renderSideBadge(order.side)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.type')}</div><div className="text-[color:var(--cf-text-strong)]">{order.type}</div></div>
                  <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.amount')}</div><div className="text-[color:var(--cf-muted)]">{order.amount}</div></div>
                  <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.price')}</div><div className="text-[color:var(--cf-text-strong)]">{order.price}</div></div>
                  <div><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.executionStatus')}</div><div className="text-[color:var(--cf-muted)]">{translateOrderStatus(order.status)}</div></div>
                  <div className="col-span-2 break-all"><div className="text-[color:var(--cf-muted)]">{t('whaleTracking.profile.columns.orderId')}</div><div className="text-[color:var(--cf-muted)]">{order.id}</div></div>
                </div>
              </article>
            ))
          )
        ) : null}
        {canLoadMoreHistory && <div ref={mobileHistorySentinelRef} className="h-1" />}
      </div>

      {/* Table Content */}
      <div className="hidden md:block overflow-x-auto p-0">
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
                      dispatchTableView({ type: 'toggleAssetFilter' })
                    }}
                    className="group flex items-center gap-1.5 transition-colors hover:text-[color:var(--cf-text-strong)]"
                  >
                    <span>{t('whaleTracking.profile.columns.asset')}</span>
                  </button>
                  {isFilterOpen && (
                    <div
                      className="absolute left-0 z-30 mt-2 w-48 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-2 shadow-2xl"
                    >
                      <div className="relative mb-2">
                        <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                        <input
                          ref={assetFilterInputRef}
                          type="text"
                          value={assetFilter}
                          onChange={e =>
                            dispatchTableView({ type: 'setAssetFilter', value: e.target.value })
                          }
                          placeholder={t('whaleTracking.profile.assetFilter.placeholder')}
                          className="focus:border-primary w-full rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-8 py-1.5 text-base text-[color:var(--cf-text-strong)] focus:outline-none md:text-xs"
                        />
                        {assetFilter && (
                          <button
                            type="button"
                            onClick={() => dispatchTableView({ type: 'clearAssetFilter' })}
                            className="absolute top-1/2 right-2 -translate-y-1/2"
                          >
                            <XIcon className="size-3 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]" />
                          </button>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {Array.from(
                          new Set(
                            [...displaySpotPositions, ...displayPerpPositions, ...displayOpenOrders].map(
                              i => i.asset,
                            ),
                          ),
                        ).map(asset => (
                          <button
                            key={asset}
                            type="button"
                            onClick={() => {
                              dispatchTableView({ type: 'selectAssetFilter', value: asset })
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
                  <th className="px-6 py-4 text-left">{t('whaleTracking.profile.columns.share')}</th>
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
                  <th className="px-6 py-4 text-left whitespace-nowrap">
                    {t('whaleTracking.profile.columns.side')}
                  </th>
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
            {activeTab === 'trades' && tradesState === 'loading' ? (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-[color:var(--cf-muted)]">
                  {t('whaleTracking.profile.recentTrades.loading')}
                </td>
              </tr>
            ) : activeTab === 'trades' && tradesState === 'error' ? (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-[color:var(--cf-muted)]">
                  {tradesError || t('whaleTracking.profile.recentTrades.loadFailed')}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => {
                      dispatchRecentTrades({ type: 'retry' })
                      void loadRecentTrades()
                    }}
                  >
                    {t('common.retry')}
                  </button>
                </td>
              </tr>
            ) : activeTab === 'trades' && tradesState === 'empty' ? (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-[color:var(--cf-muted)]">
                  {t('whaleTracking.profile.recentTrades.empty')}
                </td>
              </tr>
            ) : activeTab === 'spot' ? (
              filteredSpotData.map(pos => (
                <tr key={pos.asset} className="transition-colors hover:bg-[color:var(--cf-surface-hover)]">
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
            ) : activeTab === 'perpetual' ? (
              filteredPerpData.map(pos => (
                <tr key={`${pos.asset}-${pos.side}-${pos.marginType}`} className="transition-colors hover:bg-[color:var(--cf-surface-hover)]">
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
                  <td className="px-6 py-4">{renderSideBadge(pos.side)}</td>
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
                  <td
                    className={`px-6 py-4 text-right text-sm font-medium ${pos.fundingFee.includes('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                  >
                    {pos.fundingFee}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-[color:var(--cf-muted)]">
                    -/-
                  </td>
                </tr>
              ))
            ) : activeTab === 'orders' ? (
              filteredOpenOrders.map(order => {
                const orderKey = getOpenOrderKey(order)
                return (
                  <Fragment key={orderKey}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                      onClick={() => toggleOrderExpansion(orderKey)}
                    >
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                        {formatRelativeTime(order.timestamp)}
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
                            {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
                          </span>
                          <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                            {t('whaleTracking.profile.orders.orderCount', { count: order.count })}
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
                          <ChevronDownIcon className="size-4" />
                        </button>
                      </td>
                    </tr>
                    {expandedOrders.has(orderKey) &&
                      order.details.map(detail => (
                        <tr
                          key={detail.id || `${detail.timestamp}-${detail.type}-${detail.value}`}
                          className="bg-[color:var(--cf-bg)]/30 text-[color:var(--cf-muted)]"
                        >
                          <td className="px-6 py-3 pl-12 text-xs">{formatRelativeTime(detail.timestamp)}</td>
                          <td className="px-6 py-3 text-xs font-bold text-[color:var(--cf-text-strong)]/70 uppercase">
                            {order.asset}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${order.side === 'Buy' ? 'bg-green-500/10 text-green-500/70' : 'bg-red-500/10 text-red-500/70'}`}
                              >
                                {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
                              </span>
                              <span className="text-[10px]">{translateOrderType(detail.type)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right text-xs">{detail.value}</td>
                          <td className="px-6 py-3 text-right text-[10px] uppercase">{detail.amount}</td>
                          <td className="px-6 py-3 text-right text-xs">{detail.price}</td>
                          <td className="px-6 py-3 text-right text-xs">{detail.trigger}</td>
                          <td className="px-6 py-3 text-right text-xs">{translateOrderStatus(detail.status)}</td>
                          <td className="px-6 py-3 text-right text-[10px]">{detail.id}</td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })
            ) : activeTab === 'trades' ? (
              filteredRecentTrades.map(trade => (
                <tr key={trade.id} className="transition-colors hover:bg-[color:var(--cf-surface-hover)]">
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                    {formatRelativeTime(trade.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                    {trade.asset}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap uppercase ${getTradeActionBadgeClass(trade.action)}`}
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
                      <svg className="inline-block size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            ) : activeTab === 'delegation' ? (
              isHistoryLoading && historyOrdersAll === null ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-sm text-[color:var(--cf-muted)]">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : filteredHistoryOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-sm text-[color:var(--cf-muted)]">
                    <div className="flex items-center justify-center gap-3">
                      <span>{t('common.noData')}</span>
                      {historyError && (
                        <button
                          type="button"
                          onClick={() => {
                            void loadHistoryOrders()
                          }}
                          className="rounded-md border border-[color:var(--cf-border)] px-3 py-1 text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                        >
                          {t('common.retry')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistoryOrders.map(order => (
                  <tr key={order.id} className="transition-colors hover:bg-[color:var(--cf-surface-hover)]">
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-[color:var(--cf-muted)]">
                      {formatRelativeTime(order.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[color:var(--cf-text-strong)] uppercase">
                      {order.asset}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-[color:var(--cf-text-strong)]">{order.type}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          order.side === 'Buy'
                            ? 'bg-green-500/20 text-green-500 dark:text-green-400'
                            : 'bg-red-500/20 text-red-500 dark:text-red-400'
                        }`}
                      >
                        {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
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
                          <div className="flex size-4 items-center justify-center rounded-full border border-green-500 dark:border-green-400">
                            <svg className="size-2.5" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M3.5 6.5l-2-2L1 5l2.5 2.5L9 2l-.5-.5L3.5 6.5z" />
                            </svg>
                          </div>
                        </div>
                      ) : order.status === 'cancelled' ? (
                        <div className="flex items-center justify-end gap-1.5 text-[color:var(--cf-muted)]">
                          <svg
                            className="size-4"
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
              )
            ) : null}
          </tbody>
        </table>
        {canLoadMoreHistory && <div ref={desktopHistorySentinelRef} className="h-1" />}
      </div>
    </div>
  )
}
