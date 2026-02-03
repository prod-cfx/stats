'use client'

import type { ExchangeLiquidationResponse } from '@/lib/api'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExchangeLogo } from '@/components/ui/ExchangeLogo'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { Modal } from '@/components/ui/Modal'
import { SectionTitle } from '@/components/ui/Typography'
import { useMockData } from '@/hooks/use-mock-data'
import { fetchExchangeLiquidation } from '@/lib/api'

type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE' | 'HYPE'

interface ExchangeData {
  exchange: string
  logo: string
  coin: CoinSymbol | 'ALL'
  amount: string
  long: string
  short: string
  ratio: string
  longShortRatio: string
  isLongDominant: boolean
  isTotal?: boolean
}

type CoinFilter = CoinSymbol | 'ALL'
type TimeFilter = '1h' | '4h' | '12h' | '24h'

const EXCHANGES = [
  {
    exchange: 'Hyperliquid',
    logo: '/images/exchanges/hyperliquid.png',
  },
  {
    exchange: 'Binance',
    logo: '/images/exchanges/binance.png',
  },
  {
    exchange: 'Bybit',
    logo: '/images/exchanges/bybit.png',
  },
  {
    exchange: 'OKX',
    logo: '/images/exchanges/okx.png',
  },
  {
    exchange: 'Bitget',
    logo: '/images/exchanges/bitget.png',
  },
  {
    exchange: 'HTX',
    logo: '/images/exchanges/htx.png',
  },
  {
    exchange: 'MEXC',
    logo: '/images/exchanges/mexc.png',
  },
  {
    exchange: 'Aster',
    logo: '/images/exchanges/aster.png',
  },
  {
    exchange: 'Lighter',
    logo: '/images/exchanges/lighter.svg',
  },
]

interface ExchangeRowRaw {
  exchange: string
  logo: string
  coin: CoinSymbol | 'ALL'
  amountUsd: number
  longUsd: number
  shortUsd: number
  longShare: number
  ratio: number // share of total amount (0-100)
  isLongDominant: boolean
  isTotal?: boolean
}

export const ExchangeLiquidationTable = ({
  showTitle = true,
  variant = 'default',
}: {
  showTitle?: boolean
  variant?: 'default' | 'compact'
}) => {
  const { t, i18n } = useTranslation()
  const [coinFilter, setCoinFilter] = useState<CoinFilter>('BTC')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('4h')
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRowRaw | null>(null)

  const isCompact = variant === 'compact'
  const cellPadding = isCompact ? 'px-2 py-1.5' : 'px-6 py-4'
  const textSize = isCompact ? 'text-[11px]' : 'text-sm'
  const headerTextSize = isCompact ? 'text-[10px]' : 'text-xs'

  const selectedCoin = coinFilter === 'ALL' ? 'ALL' : (coinFilter as CoinSymbol)

  // Encapsulate filter change to reset selected item
  const handleCoinChange = (v: CoinFilter) => {
    setCoinFilter(v)
    setSelectedExchange(null)
  }

  const handleTimeChange = (v: TimeFilter) => {
    setTimeFilter(v)
    setSelectedExchange(null)
  }

  const currencyFormatter = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const {
    data: tableDataRaw,
    loading,
    error,
    reload,
  } = useMockData<ExchangeRowRaw[] | null>(
    async () => {
      const symbol = selectedCoin
      const timeframe = timeFilter

      const response: ExchangeLiquidationResponse = await fetchExchangeLiquidation(
        symbol,
        timeframe,
      )

      const totalRow = response.rows.find(row => row.isTotal)
      const exchangeRows = response.rows.filter(row => !row.isTotal)

      const totalAmountUsd =
        totalRow?.amountUsd ?? exchangeRows.reduce((sum, row) => sum + row.amountUsd, 0)

      const mappedRows: ExchangeRowRaw[] = response.rows.map(row => {
        const isTotal = !!row.isTotal
        const longUsd = row.longUsd
        const shortUsd = row.shortUsd
        const amountUsd = row.amountUsd
        const longShare =
          typeof row.longShare === 'number'
            ? row.longShare
            : amountUsd > 0
              ? longUsd / amountUsd
              : 0

        const exMeta = EXCHANGES.find(
          ex => ex.exchange.toLowerCase() === row.exchange.toLowerCase(),
        )

        const ratio = isTotal ? 100 : totalAmountUsd > 0 ? (amountUsd / totalAmountUsd) * 100 : 0

        return {
          exchange: row.exchange === 'TOTAL' ? 'TOTAL' : row.exchange,
          logo: isTotal ? '' : (exMeta?.logo ?? ''),
          coin: row.symbol as CoinSymbol,
          amountUsd,
          longUsd,
          shortUsd,
          longShare,
          ratio,
          isLongDominant: longUsd > shortUsd,
          isTotal,
        }
      })

      return mappedRows
    },
    [coinFilter, timeFilter],
    {
      delay: 0,
      ignoreQueryOverrides: true,
    },
  )

  const tableData: ExchangeData[] = useMemo(() => {
    if (!tableDataRaw) return []

    return tableDataRaw.map(row => {
      const exchange = row.isTotal ? t('common.all') : row.exchange
      return {
        exchange,
        logo: row.logo,
        coin: row.coin,
        amount: currencyFormatter.format(row.amountUsd),
        long: currencyFormatter.format(row.longUsd),
        short: currencyFormatter.format(row.shortUsd),
        ratio: `${row.ratio.toFixed(2)}%`,
        longShortRatio: t('liquidationData.table.longShare', {
          value: (row.longShare * 100).toFixed(2),
        }),
        isLongDominant: row.isLongDominant,
        isTotal: row.isTotal,
      }
    })
  }, [currencyFormatter, t, tableDataRaw])

  const selectedExchangeDisplay: ExchangeData | null = useMemo(() => {
    if (!selectedExchange) return null

    return {
      exchange: selectedExchange.isTotal ? t('common.all') : selectedExchange.exchange,
      logo: selectedExchange.logo,
      coin: selectedExchange.coin,
      amount: currencyFormatter.format(selectedExchange.amountUsd),
      long: currencyFormatter.format(selectedExchange.longUsd),
      short: currencyFormatter.format(selectedExchange.shortUsd),
      ratio: `${selectedExchange.ratio.toFixed(2)}%`,
      longShortRatio: t('liquidationData.table.longShare', {
        value: (selectedExchange.longShare * 100).toFixed(2),
      }),
      isLongDominant: selectedExchange.isLongDominant,
      isTotal: selectedExchange.isTotal,
    }
  }, [currencyFormatter, selectedExchange, t])

  return (
    <div className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-4 md:gap-6'} h-full`}>
      <div className="flex flex-none flex-col justify-between gap-4 md:flex-row md:items-center">
        {showTitle && (
          <SectionTitle className="text-xl md:text-2xl">
            {t('liquidationData.table.title')}
          </SectionTitle>
        )}
        <div
          className={`flex flex-wrap gap-2 md:gap-3 ${!showTitle ? 'w-full justify-between' : ''}`}
        >
          <div className="flex gap-2">
            <FilterButton
              value={coinFilter}
              options={[
                { value: 'BTC', label: 'BTC' },
                { value: 'ETH', label: 'ETH' },
                { value: 'SOL', label: 'SOL' },
                { value: 'XRP', label: 'XRP' },
                { value: 'DOGE', label: 'DOGE' },
                { value: 'HYPE', label: 'HYPE' },
              ]}
              onChange={v => handleCoinChange(v as CoinFilter)}
              size={isCompact ? 'sm' : 'md'}
            />
          </div>
          <div className="flex gap-2">
            <FilterButton
              value={timeFilter}
              options={[
                { value: '1h', label: t('liquidationData.time.1h') },
                { value: '4h', label: t('liquidationData.time.4h') },
                { value: '12h', label: t('liquidationData.time.12h') },
                { value: '24h', label: t('liquidationData.time.24h') },
              ]}
              onChange={v => handleTimeChange(v as TimeFilter)}
              size={isCompact ? 'sm' : 'md'}
            />
          </div>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] ${isCompact ? '' : 'shadow-lg'} animate-in fade-in flex flex-col duration-500`}
      >
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="cf-scrollbar h-full overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse md:min-w-[800px]">
              <thead>
                <tr
                  className={`text-[color:var(--cf-muted)] ${headerTextSize} border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/70 font-bold`}
                >
                  <th
                    className={`${cellPadding} sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-left`}
                  >
                    {t('liquidationData.table.columns.exchange')}
                  </th>
                  <th className={`${cellPadding} text-right`}>
                    {t('liquidationData.table.columns.total')}
                  </th>
                  <th className={`${cellPadding} text-right`}>
                    {t('liquidationData.table.columns.long')}
                  </th>
                  <th className={`${cellPadding} text-right`}>
                    {t('liquidationData.table.columns.short')}
                  </th>
                  <th className={`${cellPadding} hidden text-right sm:table-cell`}>
                    {t('liquidationData.table.columns.share')}
                  </th>
                  <th className={`${cellPadding} text-right`}>
                    {t('liquidationData.table.columns.longShort')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--cf-border)]">
                {tableData.map((row, index) => (
                  <tr
                    key={index}
                    className={`cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                      row.isTotal ? 'bg-[color:var(--cf-surface-2)]/70' : ''
                    }`}
                    onClick={() => setSelectedExchange(tableDataRaw?.[index] ?? null)}
                  >
                    <td
                      className={`${cellPadding} sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] group-hover:bg-[color:var(--cf-surface-hover)]`}
                    >
                      <div className="flex items-center justify-start gap-2">
                        {!row.isTotal && (
                          <div className="flex-shrink-0">
                            <ExchangeLogo
                              name={row.exchange}
                              logoUrl={row.logo}
                              size={isCompact ? 14 : 18}
                            />
                          </div>
                        )}
                        <span
                          className={`${textSize} ${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text)]'} truncate tracking-tight`}
                        >
                          {row.exchange}
                        </span>
                      </div>
                    </td>
                    <td className={`${cellPadding} text-right`}>
                      <span
                        className={`${textSize} ${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text)]'} tracking-tight`}
                      >
                        {row.amount}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-right font-mono`}>
                      <span
                        className={`${textSize} ${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[#4ade80]'} tracking-tight`}
                      >
                        {row.long}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-right font-mono`}>
                      <span
                        className={`${textSize} ${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[#f87171]'} tracking-tight`}
                      >
                        {row.short}
                      </span>
                    </td>
                    <td className={`${cellPadding} hidden text-right sm:table-cell`}>
                      <span
                        className={`${textSize} ${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-muted)]'} tracking-tight`}
                      >
                        {row.ratio}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-right`}>
                      <span
                        className={`${textSize} font-bold ${row.isLongDominant ? 'text-[#4ade80]' : 'text-[#f87171]'} tracking-tight`}
                      >
                        {row.longShortRatio}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedExchangeDisplay}
        onClose={() => setSelectedExchange(null)}
        title={t('liquidationData.modal.title', {
          exchange: selectedExchangeDisplay?.exchange ?? '',
        })}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
              <p className="mb-1 text-xs text-[color:var(--cf-muted)]">
                {t('liquidationData.modal.primaryAsset')}
              </p>
              <p className="text-xl font-bold text-[color:var(--cf-text-strong)]">
                {selectedExchangeDisplay?.coin && selectedExchangeDisplay.coin !== 'ALL'
                  ? selectedExchangeDisplay.coin
                  : t('liquidationData.modal.multiAsset')}
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
              <p className="mb-1 text-xs text-[color:var(--cf-muted)]">
                {t('liquidationData.modal.maxSingle')}
              </p>
              <p className="text-xl font-bold text-orange-400">
                {currencyFormatter.format(1.245e6)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-[color:var(--cf-text)]">
              {t('liquidationData.modal.recent')}
            </p>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[color:var(--cf-border)]/40 bg-[color:var(--cf-surface-2)]/50 p-3 text-sm"
              >
                <span className="text-[color:var(--cf-text)]">
                  0x{Math.random().toString(16).substring(2, 8)}...
                </span>
                <span className="text-red-400">
                  -{currencyFormatter.format(4.2e5)} ({t('liquidationData.summary.short')})
                </span>
                <span className="text-xs text-[color:var(--cf-muted)]">
                  {t('liquidationData.modal.minutesAgo', { minutes: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
