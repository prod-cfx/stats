'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/components/providers/ThemeProvider'
import { ExchangeLogo } from '@/components/ui/ExchangeLogo'
import { sampleLevelsForDisplay } from './orderbook-display'

interface OrderItem {
  price: string
  amount: string
  total: string
  exchanges: string[] // URLs or identifiers
  depthPercent: number
}

interface OrderbookTableProps {
  asks: OrderItem[]
  bids: OrderItem[]
  currentPrice: {
    price: string
    usdPrice: string
    change: string
    changePercent: string
  }
  displayMode?: 'both' | 'bids' | 'asks'
  variant?: 'default' | 'compact'
}

const BOTH_SIDE_ROWS = 13
const BOTH_SIDE_WINDOW = BOTH_SIDE_ROWS * 5

const OrderRow = ({
  item,
  type,
  selected,
  onSelect,
  variant = 'default',
}: {
  item: OrderItem
  type: 'ask' | 'bid'
  selected: boolean
  onSelect: () => void
  variant?: 'default' | 'compact'
}) => {
  const [isFlash, setIsFlash] = useState(false)
  const isCompact = variant === 'compact'
  const { theme } = useTheme()

  // Lightweight "tick" effect when data changes (kept subtle, CoinGlass-like)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsFlash(true)
    const timer = setTimeout(() => setIsFlash(false), 180)
    return () => clearTimeout(timer)
  }, [item.price, item.amount])

  const isAsk = type === 'ask'
  const barColor = isAsk
    ? theme === 'dark'
      ? 'rgba(239, 68, 68, 0.15)'
      : 'rgba(239, 68, 68, 0.10)'
    : theme === 'dark'
      ? 'rgba(34, 197, 94, 0.15)'
      : 'rgba(34, 197, 94, 0.10)' // red/green low opacity
  const rowTint = 'transparent'
  const hoverTint = isAsk
    ? theme === 'dark'
      ? 'rgba(239, 68, 68, 0.08)'
      : 'rgba(239, 68, 68, 0.045)'
    : theme === 'dark'
      ? 'rgba(34, 197, 94, 0.08)'
      : 'rgba(34, 197, 94, 0.045)'
  const selectedTint = isAsk
    ? theme === 'dark'
      ? 'rgba(239, 68, 68, 0.12)'
      : 'rgba(239, 68, 68, 0.06)'
    : theme === 'dark'
      ? 'rgba(34, 197, 94, 0.12)'
      : 'rgba(34, 197, 94, 0.06)'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex items-center px-1.5 ${isCompact ? 'py-[1px]' : 'py-[5px]'} w-full cursor-pointer text-left transition-colors`}
      style={{
        background: selected ? selectedTint : rowTint,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background = hoverTint
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background = selected ? selectedTint : rowTint
      }}
    >
      {/* selected indicator */}
      {selected && (
        <div
          className={`absolute top-0 bottom-0 left-0 w-[2px] ${isAsk ? 'bg-red-500' : 'bg-green-500'}`}
        />
      )}

      {/* Depth background bar (CoinGlass-style) */}
      <div
        className="absolute top-0 right-0 bottom-0 transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, item.depthPercent))}%`, background: barColor }}
      />

      {/* tiny flash on updates */}
      {isFlash && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: isAsk ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)' }}
        />
      )}

      <div
        className={`relative z-10 flex w-full items-center ${isCompact ? 'text-[9.5px] leading-3' : 'text-[12px] leading-4'} font-mono`}
      >
        <div className={`${isCompact ? 'w-[15%]' : 'w-[22%]'} flex items-center gap-0 opacity-70`}>
          {item.exchanges.slice(0, 2).map((ex, idx) => (
            <ExchangeLogo key={idx} name={ex} size={isCompact ? 8 : 13} />
          ))}
        </div>
        <span
          className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right font-bold ${isAsk ? 'text-red-400' : 'text-green-400'}`}
        >
          {item.price}
        </span>
        <span
          className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} pr-0.5 text-right text-[color:var(--cf-text)]`}
        >
          {item.amount}
        </span>
        <span
          className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right text-[color:var(--cf-muted)]`}
        >
          {item.total}
        </span>
      </div>
    </button>
  )
}

export const OrderbookTable: React.FC<OrderbookTableProps> = ({
  asks,
  bids,
  displayMode = 'both',
  variant = 'default',
}) => {
  const { t } = useTranslation()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const isCompact = variant === 'compact'

  // Define a precise row height to ensure alignment (font + padding)
  const ROW_HEIGHT = isCompact ? 20 : 28
  const VISIBLE_ROWS = 26
  const TOTAL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS

  const { rows, canScroll } = useMemo(() => {
    const asksSorted = [...asks].sort(
      (a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price),
    )
    const bidsSorted = [...bids].sort(
      (a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price),
    )

    if (displayMode === 'asks') {
      return {
        rows: asksSorted.map(x => ({ ...x, _type: 'ask' as const })),
        canScroll: true,
      }
    }
    if (displayMode === 'bids') {
      return {
        rows: bidsSorted.map(x => ({ ...x, _type: 'bid' as const })),
        canScroll: true,
      }
    }

    // Both mode: fixed rows, but sample within a near-mid window
    // so dense books (e.g. ETH perp) still cover a wider visible range.
    const asksNearMid = asksSorted.slice(-BOTH_SIDE_WINDOW)
    const bidsNearMid = bidsSorted.slice(0, BOTH_SIDE_WINDOW)
    const sampledAsks = sampleLevelsForDisplay(asksNearMid, BOTH_SIDE_ROWS)
    const sampledBids = sampleLevelsForDisplay(bidsNearMid, BOTH_SIDE_ROWS)

    return {
      rows: [
        ...sampledAsks.map(x => ({ ...x, _type: 'ask' as const })),
        { _type: 'gap', price: '', amount: '', total: '', exchanges: [], depthPercent: 0 },
        ...sampledBids.map(x => ({ ...x, _type: 'bid' as const })),
      ],
      canScroll: false,
    }
  }, [asks, bids, displayMode])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] select-none">
      {/* Table Header */}
      <div
        className={`flex items-center border-b border-[color:var(--cf-border)] px-3 text-[color:var(--cf-muted)] ${isCompact ? 'h-[22px] text-[8.5px]' : 'h-[36px] text-[12px]'} z-10 flex-none bg-[color:var(--cf-bg)] font-semibold`}
      >
        <span className={`${isCompact ? 'w-[15%]' : 'w-[22%]'}`}>
          {t('aggregatedOrderbook.table.exchange')}
        </span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right`}>
          {t('aggregatedOrderbook.table.price')}
        </span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} pr-0.5 text-right`}>
          {t('aggregatedOrderbook.table.amount')}
        </span>
        <span className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right`}>
          {t('aggregatedOrderbook.table.total')}
        </span>
      </div>

      {/* Table Body - Fixed height for exactly 26 rows */}
      <div
        className={`min-h-0 flex-1 ${canScroll ? 'cf-scrollbar overflow-auto' : 'overflow-hidden'}`}
        style={{ height: `${TOTAL_HEIGHT}px`, maxHeight: `${TOTAL_HEIGHT}px` }}
      >
        {rows.map((r, idx) => {
          if ((r as any)._type === 'gap') {
            return <div key="gap" className="h-2 bg-[color:var(--cf-bg)]" />
          }
          const key = `${r._type}-${r.price}-${idx}`
          const side = r._type === 'ask' || r._type === 'bid' ? r._type : 'bid'
          return (
            <div key={key} style={{ height: `${ROW_HEIGHT}px` }} className="flex items-center">
              <OrderRow
                item={r}
                type={side}
                selected={selectedKey === key}
                onSelect={() => setSelectedKey(key)}
                variant={variant}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
