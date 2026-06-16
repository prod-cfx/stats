'use client'

import type { DataSource } from '@/types/trading'
import { AlignJustify, ArrowDownUp, ChevronDown, Copy, RotateCcw } from 'lucide-react'
import React from 'react'
import { Spinner } from '@/components/ui/loading'
import { OrderbookRow } from './OrderbookRow'
import { TradeRow } from './TradeRow'

interface BookRow {
  price: string
  amount: string
  total: string
  depth: number
}

interface TradeItem {
  id: number
  price: string
  amount: string
  time: string
  type: 'buy' | 'sell'
}

interface RightPanelViewProps {
  loading: boolean
  displaySymbol: string
  isAggregated: boolean
  selectedExchange: DataSource
  baseAsset: string
  turnoverLabel: string
  netInflowLabel: string
  highLabel: string
  lowLabel: string
  orderbook: { sells: BookRow[]; buys: BookRow[] }
  trades: TradeItem[]
  tradeTab: string
  precisionLabel: string
  pricePrecision: number
  isDecimalMenuOpen: boolean
  displayLastPriceLabel: string
  displayLastPriceUsdLabel: string
  displayChangePctLabel: string
  displayChangeAbsLabel: string
  displayChangePositive: boolean
  sellsRef: React.RefObject<HTMLDivElement | null>
  decimalMenuRef: React.RefObject<HTMLDivElement | null>
  t: (key: string, options?: Record<string, unknown>) => string
  onToggleDecimalMenu: () => void
  onSelectPrecision: (precision: number) => void
  onTabChange: (tab: string) => void
}

export function RightPanelView({
  loading,
  displaySymbol,
  isAggregated,
  selectedExchange,
  baseAsset,
  turnoverLabel,
  netInflowLabel,
  highLabel,
  lowLabel,
  orderbook,
  trades,
  tradeTab,
  precisionLabel,
  pricePrecision,
  isDecimalMenuOpen,
  displayLastPriceLabel,
  displayLastPriceUsdLabel,
  displayChangePctLabel,
  displayChangeAbsLabel,
  displayChangePositive,
  sellsRef,
  decimalMenuRef,
  t,
  onToggleDecimalMenu,
  onSelectPrecision,
  onTabChange,
}: RightPanelViewProps) {
  return (
    <div className="relative flex w-full min-w-0 flex-col rounded-none border-l-0 md:rounded-lg md:border-l border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)]">
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[color:var(--cf-surface)]/80 backdrop-blur-sm">
          <Spinner size="md" className="text-primary" />
        </div>
      )}

      <div className="flex-none border-b border-[color:var(--cf-border)]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="!text-[15px] !font-semibold !leading-[22px]">{displaySymbol}</span>
            <Copy className="size-3 cursor-pointer text-[color:var(--cf-muted)]" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="from-primary to-secondary bg-gradient-to-br bg-clip-text !text-xs !font-semibold !leading-5 text-transparent">
              {isAggregated
                ? t('chart.toolbar.aggregationOn')
                : t(
                    `rightPanel.exchange${(selectedExchange || 'binance').charAt(0).toUpperCase() + (selectedExchange || 'binance').slice(1)}`,
                  )}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-3 pb-2 !text-xs !font-normal !leading-5">
          <div className="flex items-center justify-between">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {isAggregated ? t('rightPanel.accumulatedTurnoverUsd') : t('rightPanel.turnoverUsd')}:
            </span>
            <span className="font-medium whitespace-nowrap">{turnoverLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {isAggregated
                ? t('rightPanel.accumulatedNetInflowUsd')
                : t('rightPanel.netInflowUsd')}
              :
            </span>
            <span className="font-medium whitespace-nowrap text-red-400">{netInflowLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('rightPanel.high')}:
            </span>
            <span className="font-medium whitespace-nowrap">{highLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('rightPanel.low')}:
            </span>
            <span className="font-medium whitespace-nowrap">{lowLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex-none">
          <div className="relative flex items-center justify-between px-2 py-1.5 text-[color:var(--cf-muted)]">
            <div className="flex items-center gap-3">
              <RotateCcw className="size-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
              <AlignJustify className="size-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
              <ArrowDownUp className="size-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
            </div>
            <div className="flex items-center gap-2" ref={decimalMenuRef}>
              <button
                type="button"
                onClick={onToggleDecimalMenu}
                className="flex items-center gap-1 text-[10px] whitespace-nowrap hover:text-[color:var(--cf-text)]"
              >
                <span>{precisionLabel}</span>
                <ChevronDown className="size-3" />
              </button>

              {isDecimalMenuOpen && (
                <div className="absolute top-full right-2 z-50 mt-1 w-[120px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] py-1 shadow-sm">
                  {[2, 1, 0, -1, -2].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSelectPrecision(p)}
                      className={`w-full px-3 py-2 text-left !text-xs !leading-5 transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                        pricePrecision === p
                          ? 'bg-gradient-to-r from-primary to-secondary !font-semibold text-white'
                          : 'text-[color:var(--cf-text)]'
                      }`}
                    >
                      {p >= 0
                        ? t('rightPanel.decimalPlaces', { count: p })
                        : t('rightPanel.integerPlaces', { count: Math.abs(p) })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center px-2 py-1 text-[10px] text-[color:var(--cf-muted)]">
            <span className="w-[35%]">{t('rightPanel.price')}</span>
            <span className="w-[30%] text-right">
              {t('rightPanel.amount', { asset: baseAsset })}
            </span>
            <span className="w-[35%] pr-1 text-right">{t('rightPanel.orderValue')}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <div ref={sellsRef} className="cf-scrollbar h-[160px] md:h-[200px] overflow-y-auto pr-1">
            {orderbook.sells.map(s => (
              <OrderbookRow
                key={`sell-${s.price}-${s.amount}-${s.total}`}
                price={s.price}
                amount={s.amount}
                total={s.total}
                type="sell"
                depthPercent={s.depth}
              />
            ))}
          </div>

          <div className="z-10 my-0.5 flex flex-none items-center justify-between border-y border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] px-2 py-1">
            <div className="flex flex-col">
              <span className="!text-base !font-semibold !leading-6 text-green-400">
                {displayLastPriceLabel}
              </span>
              <span className="text-[10px] text-[color:var(--cf-muted)]">
                {displayLastPriceUsdLabel}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`text-xs ${displayChangePositive ? 'text-green-400' : 'text-red-400'} font-semibold`}
              >
                {displayChangePctLabel}
              </span>
              <span
                className={`text-[10px] ${displayChangePositive ? 'text-green-400' : 'text-red-400'} font-medium`}
              >
                {displayChangeAbsLabel}
              </span>
            </div>
          </div>

          <div className="cf-scrollbar h-[160px] md:h-[200px] overflow-y-auto pr-1">
            {orderbook.buys.map(b => (
              <OrderbookRow
                key={`buy-${b.price}-${b.amount}-${b.total}`}
                price={b.price}
                amount={b.amount}
                total={b.total}
                type="buy"
                depthPercent={b.depth}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-[360px] md:h-[420px] flex-none flex-col border-t-4 border-[color:var(--cf-bg)]">
        <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2">
          <div className="flex gap-4">
            {['latest', 'large'].map(id => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`relative border-b-2 py-2 !text-xs !font-semibold !leading-5 transition-colors ${tradeTab === id ? 'border-transparent text-[color:var(--cf-text-strong)]' : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
              >
                {id === 'latest' ? t('rightPanel.latestTrades') : t('rightPanel.largeTrades')}
                {tradeTab === id && (
                  <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownUp className="size-3.5 cursor-pointer text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]" />
          </div>
        </div>

        <div className="flex items-center bg-[color:var(--cf-surface)] px-2 py-1 text-[10px] text-[color:var(--cf-muted)]">
          <span className="w-[35%]">{t('rightPanel.price')}</span>
          <span className="w-[30%] text-right">{t('rightPanel.amount', { asset: baseAsset })}</span>
          <span className="w-[35%] pr-1 text-right">{t('rightPanel.tradeTime')}</span>
        </div>

        <div className="cf-scrollbar flex-1 overflow-y-auto bg-[color:var(--cf-surface)] pr-1">
          {trades.map(trade => (
            <TradeRow
              key={trade.id}
              price={trade.price}
              amount={trade.amount}
              time={trade.time}
              type={trade.type}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
