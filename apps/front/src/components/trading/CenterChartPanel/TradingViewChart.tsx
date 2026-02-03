'use client'

import type { ForwardedRef } from 'react'
import type { TradingViewChartRef as ChartingLibraryChartRef } from '@/components/tradingview/TradingViewChart'
import type { DataSource, MarketType } from '@/types/trading'
import React, { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/components/providers/ThemeProvider'
import { TradingViewChart as ChartingLibraryChart } from '@/components/tradingview/TradingViewChart'

interface TradingViewChartProps {
  symbol: string
  interval: string
  isAggregated: boolean
  selectedExchange: DataSource
  marketType: MarketType
  activeIndicators?: Array<{
    id: string
    label: string
    kind: 'chartSeries' | 'chartOverlay'
    href?: string
  }>
  onRemoveIndicator?: (id: string) => void

  // 注入到 TradingView header 的自定义按钮回调（由 CenterChartPanel 提供）
  onSelectExchange?: (exchange: DataSource) => void
  onToggleAggregate?: () => void
  onOpenIndicator?: () => void
  onOpenDataIndicator?: () => void
}

/**
 * Stable wrapper for the trading chart.
 * TODO: Replace Lightweight Charts with TradingView Charting Library once license is approved.
 */
export const TradingViewChart = forwardRef(
  (props: TradingViewChartProps, ref: ForwardedRef<ChartingLibraryChartRef>) => {
    const { t } = useTranslation()
    const { theme } = useTheme()

    // 将页面的 interval（如 15m/1h）映射到 TradingView resolution（如 15/60）
    const mapIntervalToResolution = (value: string): string => {
      switch (value) {
        case '1m':
          return '1'
        case '5m':
          return '5'
        case '15m':
          return '15'
        case '1h':
          return '60'
        case '4h':
          return '240'
        case '1d':
          return '1D'
        // 当前页面包含 1s，但 Charting Library 的 mock datafeed 不支持秒级；先回退到 1m
        case '1s':
          return '1'
        default:
          // 如果上层已经传入 TradingView resolution，则直接透传
          return value
      }
    }

    const resolution = mapIntervalToResolution(props.interval)

    return (
      <div className="h-full min-h-[500px] w-full bg-[color:var(--cf-bg)]">
        <ChartingLibraryChart
          ref={ref}
          symbol={props.symbol}
          interval={resolution}
          theme={theme === 'dark' ? 'Dark' : 'Light'}
          isAggregated={props.isAggregated}
          selectedExchange={props.selectedExchange === 'bybit' ? 'binance' : props.selectedExchange}
          onSelectExchange={props.onSelectExchange}
          onToggleAggregate={props.onToggleAggregate}
          onOpenIndicator={props.onOpenIndicator}
          onOpenDataIndicator={props.onOpenDataIndicator}
          activeIndicators={props.activeIndicators}
          onRemoveIndicator={props.onRemoveIndicator}
        />

        {/* 保留原有“加载引擎”文案风格：当 Charting Library 还未加载脚本时会显示 Loading chart... */}
        <noscript>
          <div className="flex h-full min-h-[500px] w-full items-center justify-center text-[color:var(--cf-muted)]">
            {t('chart.loadingEngine')}
          </div>
        </noscript>
      </div>
    )
  },
)
