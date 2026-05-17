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
  <div className={`relative w-full ${height} bg-[color:var(--cf-bg)] rounded-md overflow-hidden flex border border-[color:var(--cf-border)]`}>
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
  <div className="mb-5 w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-sm">
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-6">
      <div className="flex w-full min-w-[140px] items-center gap-3 md:min-w-[180px] lg:w-auto">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-yellow-500/20 bg-yellow-500/10">
          <span className="text-base font-semibold text-yellow-500">₿</span>
        </div>
        <div className="flex flex-col">
          <span className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{symbol}</span>
          <span className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{totalLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full">
        <ProgressBar long={longPercent} short={shortPercent} height="h-8 md:h-10" />
      </div>
      <div className="flex items-center min-w-full lg:min-w-[300px] w-full lg:w-auto justify-between lg:justify-start">
        <div className="flex flex-col w-1/2 lg:w-32">
          <span className="mb-1 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{longLabel}</span>
          <span className="!text-sm !font-semibold !leading-[22px] text-[#4ade80]">{longAmount}</span>
        </div>
        <div className="flex flex-col w-1/2 lg:w-32 text-right lg:text-left">
          <span className="mb-1 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{shortLabel}</span>
          <span className="!text-sm !font-semibold !leading-[22px] text-[#ef4444]">{shortAmount}</span>
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
        <span className="text-[color:var(--cf-muted)] font-semibold w-5 md:w-6 text-center text-xs md:text-sm">{data.rank}</span>
        <ExchangeLogo name={data.name} logoUrl={data.logoUrl} size={24} className="md:w-7 md:h-7" />
        <span className="text-[color:var(--cf-text-strong)] font-medium text-xs md:text-sm">{data.name}</span>
      </div>
      <div className="flex-1 w-full lg:w-auto">
        <ProgressBar long={data.longPercent} short={data.shortPercent} height="h-6 md:h-8" />
      </div>
      <div className="flex items-center min-w-full lg:min-w-[300px] w-full lg:w-auto justify-between lg:justify-start">
        <div className="flex flex-col w-1/2 lg:w-32">
          <span className="text-[color:var(--cf-muted)] text-[9px] md:text-xs">{longLabel}</span>
          <span className="text-[#4ade80] font-semibold text-[10px] md:text-xs">{longAmount}</span>
        </div>
        <div className="flex flex-col w-1/2 lg:w-32 text-right lg:text-left">
          <span className="text-[color:var(--cf-muted)] text-[9px] md:text-xs">{shortLabel}</span>
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
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-4 md:gap-6 md:px-6 md:py-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <PageTitle>{t('longShort.title', { symbol })}</PageTitle>
          <BodyText>{t('longShort.subtitle')}</BodyText>
        </div>

        <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto pb-2 md:gap-3 md:pb-0">
          <div className="flex flex-shrink-0 gap-1">
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
              onChange={(v) => setTimeRange(v as ExchangeLongShortTimeRange)}
              minWidth="80px"
              size="sm"
            />
          </div>
          <button
            type="button"
            className="p-2 bg-[color:var(--cf-surface-2)] border border-[color:var(--cf-border)] rounded-md text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)] transition-all hover:bg-[color:var(--cf-surface-hover)] active:scale-95 group flex-shrink-0"
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
          <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-500">
            <div className="hidden items-center border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/70 px-5 py-3 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)] uppercase md:flex">
              <span className="w-[180px] pl-10">{t('longShort.table.exchange')}</span>
              <span className="flex-1 text-center">{t('longShort.table.ratio')}</span>
              <div className="flex w-[300px]">
                <span className="w-32">{t('longShort.table.longAmount')}</span>
                <span className="w-32">{t('longShort.table.shortAmount')}</span>
              </div>
            </div>
            <div className="flex flex-col divide-y divide-[color:var(--cf-border)]">
              {exchanges?.map((ex) => (
                <div key={ex.name} className="px-4 md:px-6 py-4 hover:bg-[color:var(--cf-surface-hover)] transition-colors">
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
