'use client'

import type { ExchangeLongShortRatioApiItem, ExchangeLongShortTimeRange } from '@/lib/api'
import { RefreshCw } from 'lucide-react'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ExchangeLogo } from '@/components/ui/ExchangeLogo'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { BodyText, PageTitle } from '@/components/ui/Typography'
import { useAsync } from '@/hooks/use-async'
import { fetchExchangeLongShortRatio } from '@/lib/api'

type ExchangeData = ExchangeLongShortRatioApiItem

const ProgressBar = ({ long, short, height = 'h-8', showText = true }: { long: number, short: number, height?: string, showText?: boolean }) => (
  <div className={`relative w-full ${height} bg-[#0d1117] rounded-md overflow-hidden flex border border-[#30363d]`}>
    <div className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] flex items-center justify-center transition-all duration-500" style={{ width: `${long}%` }}>
      {showText && long > 15 && <span className="text-white text-xs font-bold">{long.toFixed(2)}%</span>}
    </div>
    <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#dc2626] flex items-center justify-center transition-all duration-500" style={{ width: `${short}%` }}>
      {showText && short > 15 && <span className="text-white text-xs font-bold">{short.toFixed(2)}%</span>}
    </div>
  </div>
)

const SummaryCard = ({
  symbol,
  longPercent,
  shortPercent,
  longAmount,
  shortAmount,
  totalLabel,
  longLabel,
  shortLabel,
}: {
  symbol: string
  longPercent: number
  shortPercent: number
  longAmount: string
  shortAmount: string
  totalLabel: string
  longLabel: string
  shortLabel: string
}) => (
  <div className="w-full bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-6 mb-6 shadow-sm">
    <div className="flex flex-col lg:flex-row items-center gap-4 md:gap-8">
      <div className="flex items-center gap-4 min-w-[140px] md:min-w-[180px] w-full lg:w-auto">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 flex-shrink-0">
          <span className="text-yellow-500 font-bold text-lg md:text-xl">₿</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-bold text-lg md:text-xl">{symbol}</span>
          <span className="text-[#8b949e] text-xs md:text-sm">{totalLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full">
        <ProgressBar long={longPercent} short={shortPercent} height="h-8 md:h-10" />
      </div>
      <div className="flex items-center min-w-full lg:min-w-[300px] w-full lg:w-auto justify-between lg:justify-start">
        <div className="flex flex-col w-1/2 lg:w-32">
          <span className="text-[#8b949e] text-[10px] md:text-xs mb-1">{longLabel}</span>
          <span className="text-[#4ade80] font-bold text-base md:text-lg">{longAmount}</span>
        </div>
        <div className="flex flex-col w-1/2 lg:w-32 text-right lg:text-left">
          <span className="text-[#8b949e] text-[10px] md:text-xs mb-1">{shortLabel}</span>
          <span className="text-[#ef4444] font-bold text-base md:text-lg">{shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
)

const ExchangeRow = ({
  data,
  longLabel,
  shortLabel,
  longAmount,
  shortAmount,
}: {
  data: ExchangeData
  longLabel: string
  shortLabel: string
  longAmount: string
  shortAmount: string
}) => (
  <div className="w-full transition-colors group">
    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 md:gap-6">
      <div className="flex items-center gap-3 md:gap-4 min-w-[140px] md:min-w-[180px]">
        <span className="text-[#8b949e] font-semibold w-5 md:w-6 text-center text-xs md:text-sm">{data.rank}</span>
        <ExchangeLogo name={data.name} logoUrl={data.logoUrl} size={24} className="md:w-7 md:h-7" />
        <span className="text-white font-medium text-xs md:text-sm">{data.name}</span>
      </div>
      <div className="flex-1 w-full lg:w-auto">
        <ProgressBar long={data.longPercent} short={data.shortPercent} height="h-6 md:h-8" />
      </div>
      <div className="flex items-center min-w-full lg:min-w-[300px] w-full lg:w-auto justify-between lg:justify-start">
        <div className="flex flex-col w-1/2 lg:w-32">
          <span className="text-[#8b949e] text-[9px] md:text-xs">{longLabel}</span>
          <span className="text-[#4ade80] font-semibold text-[10px] md:text-xs">{longAmount}</span>
        </div>
        <div className="flex flex-col w-1/2 lg:w-32 text-right lg:text-left">
          <span className="text-[#8b949e] text-[9px] md:text-xs">{shortLabel}</span>
          <span className="text-[#ef4444] font-semibold text-[10px] md:text-xs">{shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
)

export function LongShortRatioClient() {
  const { t, i18n } = useTranslation()
  const [symbol, setSymbol] = React.useState('BTC')
  const [timeRange, setTimeRange] = React.useState<ExchangeLongShortTimeRange>('4h')

  const currencyFormatter = React.useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const { data: exchanges, loading, error, execute } = useAsync<ExchangeLongShortRatioApiItem[]>(
    async () => {
      return fetchExchangeLongShortRatio({
        symbol,
        timeRange,
      })
    },
    { immediate: true },
  )

  // symbol/timeRange 变化时重新拉取（首屏请求由 immediate=true 触发）
  const hasMountedRef = useRef(false)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    execute()
  }, [execute, symbol, timeRange])

  const summary = React.useMemo(() => {
    if (!exchanges || exchanges.length === 0) {
      return null
    }

    const longAmountUsd = exchanges.reduce((sum, ex) => sum + ex.longAmountUsd, 0)
    const shortAmountUsd = exchanges.reduce((sum, ex) => sum + ex.shortAmountUsd, 0)
    const total = longAmountUsd + shortAmountUsd

    if (!Number.isFinite(total) || total <= 0) {
      return null
    }

    const longPercent = (longAmountUsd / total) * 100
    const shortPercent = 100 - longPercent

    return {
      longAmountUsd,
      shortAmountUsd,
      longPercent,
      shortPercent,
    }
  }, [exchanges])

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6 md:gap-10 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 md:gap-3">
          <PageTitle className="text-xl md:text-2xl">{t('longShort.title', { symbol })}</PageTitle>
          <BodyText className="text-xs md:text-sm">{t('longShort.subtitle')}</BodyText>
        </div>

        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <div className="flex gap-1 flex-shrink-0">
            <FilterButton value={symbol} options={['BTC', 'ETH', 'SOL', 'XRP', 'HYPE', 'DOGE', 'BNB']} onChange={setSymbol} minWidth="70px" size="sm" />
            <FilterButton
              value={timeRange}
              options={[
                { value: '5m', label: t('longShort.timeRanges.5m') },
                { value: '15m', label: t('longShort.timeRanges.15m') },
                { value: '30m', label: t('longShort.timeRanges.30m') },
                { value: '1h', label: t('longShort.timeRanges.1h') },
                { value: '4h', label: t('longShort.timeRanges.4h') },
                { value: '12h', label: t('longShort.timeRanges.12h') },
                { value: '24h', label: t('longShort.timeRanges.24h') },
              ]}
              onChange={(v) => setTimeRange(v as any)}
              minWidth="80px"
              size="sm"
            />
          </div>
          <button
            type="button"
            className="p-2 bg-[#161b22] border border-[#30363d] rounded-md text-[#8b949e] hover:text-[#c9d1d9] transition-all hover:bg-[#30363d] active:scale-95 group flex-shrink-0"
            onClick={() => {
              const btn = document.querySelector('.refresh-icon')
              btn?.classList.add('animate-spin')
              setTimeout(() => {
                btn?.classList.remove('animate-spin')
                execute()
              }, 500)
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 refresh-icon" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 relative min-h-[600px]">
        <LoadingState
          isLoading={loading}
          error={Boolean(error)}
          isEmpty={!loading && !error && (!exchanges || exchanges.length === 0)}
          onRetry={execute}
        >
          <SummaryCard
            symbol={symbol}
            longPercent={summary?.longPercent ?? 50}
            shortPercent={summary?.shortPercent ?? 50}
            longAmount={currencyFormatter.format(summary?.longAmountUsd ?? 0)}
            shortAmount={currencyFormatter.format(summary?.shortAmountUsd ?? 0)}
            totalLabel={t('longShort.summary.total')}
            longLabel={t('longShort.summary.long')}
            shortLabel={t('longShort.summary.short')}
          />
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-500">
            <div className="hidden md:flex items-center px-6 py-4 text-caption text-[#8b949e] uppercase tracking-wider font-bold border-b border-[#30363d] bg-[#0d1117]/50">
              <span className="w-[180px] pl-10">{t('longShort.table.exchange')}</span>
              <span className="flex-1 text-center">{t('longShort.table.ratio')}</span>
              <div className="flex w-[300px]">
                <span className="w-32">{t('longShort.table.longAmount')}</span>
                <span className="w-32">{t('longShort.table.shortAmount')}</span>
              </div>
            </div>
            <div className="flex flex-col divide-y divide-[#30363d]">
              {exchanges?.map((ex) => (
                <div key={ex.name} className="px-4 md:px-6 py-4 hover:bg-[#21262d] transition-colors">
                  <ExchangeRow
                    data={ex}
                    longLabel={t('longShort.summary.long')}
                    shortLabel={t('longShort.summary.short')}
                    longAmount={currencyFormatter.format(ex.longAmountUsd)}
                    shortAmount={currencyFormatter.format(ex.shortAmountUsd)}
                  />
                </div>
              ))}
            </div>
          </div>
        </LoadingState>
      </div>
    </div>
  )
}


