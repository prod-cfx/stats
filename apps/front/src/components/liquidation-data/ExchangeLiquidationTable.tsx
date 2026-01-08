'use client';

import type { ExchangeLiquidationResponse } from '@/lib/api';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';
import { fetchExchangeLiquidation } from '@/lib/api';

type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE' | 'HYPE';

interface ExchangeData {
  exchange: string;
  logo: string;
  coin: CoinSymbol | 'ALL';
  amount: string;
  long: string;
  short: string;
  ratio: string;
  longShortRatio: string;
  isLongDominant: boolean;
  isTotal?: boolean;
}

type CoinFilter = CoinSymbol
type TimeFilter = '1h' | '4h' | '12h' | '24h'

const EXCHANGES = [
  {
    exchange: 'Hyperliquid',
    logo: 'https://app.hyperliquid.xyz/favicon.ico',
  },
  {
    exchange: 'Binance',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
  },
  {
    exchange: 'Bybit',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
  },
  {
    exchange: 'OKX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
  },
];

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

export const ExchangeLiquidationTable = ({ showTitle = true }: { showTitle?: boolean }) => {
  const { t, i18n } = useTranslation();
  const [coinFilter, setCoinFilter] = useState<CoinFilter>('BTC');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('4h');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRowRaw | null>(null);

  const selectedCoin = coinFilter;

  const currencyFormatter = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const { data: tableDataRaw, loading, error, reload } = useMockData<ExchangeRowRaw[] | null>(
    async () => {
      const symbol = selectedCoin
      const timeframe = timeFilter

      const response: ExchangeLiquidationResponse = await fetchExchangeLiquidation(symbol, timeframe)

      const totalRow = response.rows.find(row => row.isTotal)
      const exchangeRows = response.rows.filter(row => !row.isTotal)

      const totalAmountUsd =
        totalRow?.amountUsd ??
        exchangeRows.reduce((sum, row) => sum + row.amountUsd, 0)

      const mappedRows: ExchangeRowRaw[] = response.rows.map(row => {
        const isTotal = !!row.isTotal
        const longUsd = row.longUsd
        const shortUsd = row.shortUsd
        const amountUsd = row.amountUsd
        const longShare = typeof row.longShare === 'number'
          ? row.longShare
          : amountUsd > 0
            ? longUsd / amountUsd
            : 0

        const exMeta = EXCHANGES.find(ex => ex.exchange.toLowerCase() === row.exchange.toLowerCase())

        const ratio = isTotal
          ? 100
          : totalAmountUsd > 0
            ? (amountUsd / totalAmountUsd) * 100
            : 0

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
  );

  const tableData: ExchangeData[] = useMemo(() => {
    if (!tableDataRaw)
      return []

    return tableDataRaw.map((row) => {
      const exchange = row.isTotal ? t('common.all') : row.exchange
      return {
        exchange,
        logo: row.logo,
        coin: row.coin,
        amount: currencyFormatter.format(row.amountUsd),
        long: currencyFormatter.format(row.longUsd),
        short: currencyFormatter.format(row.shortUsd),
        ratio: `${row.ratio.toFixed(2)}%`,
        longShortRatio: t('liquidationData.table.longShare', { value: (row.longShare * 100).toFixed(2) }),
        isLongDominant: row.isLongDominant,
        isTotal: row.isTotal,
      }
    })
  }, [currencyFormatter, t, tableDataRaw])

  const selectedExchangeDisplay: ExchangeData | null = useMemo(() => {
    if (!selectedExchange)
      return null

    return {
      exchange: selectedExchange.isTotal ? t('common.all') : selectedExchange.exchange,
      logo: selectedExchange.logo,
      coin: selectedExchange.coin,
      amount: currencyFormatter.format(selectedExchange.amountUsd),
      long: currencyFormatter.format(selectedExchange.longUsd),
      short: currencyFormatter.format(selectedExchange.shortUsd),
      ratio: `${selectedExchange.ratio.toFixed(2)}%`,
      longShortRatio: t('liquidationData.table.longShare', { value: (selectedExchange.longShare * 100).toFixed(2) }),
      isLongDominant: selectedExchange.isLongDominant,
      isTotal: selectedExchange.isTotal,
    }
  }, [currencyFormatter, selectedExchange, t])

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between flex-none">
        {showTitle && <SectionTitle>{t('liquidationData.table.title')}</SectionTitle>}
        <div className={`flex gap-3 ${!showTitle ? 'w-full justify-between' : ''}`}>
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
            onChange={(v) => setCoinFilter(v as CoinFilter)}
          />
          <FilterButton
            value={timeFilter}
            options={[
              { value: '1h', label: t('liquidationData.time.1h') },
              { value: '4h', label: t('liquidationData.time.4h') },
              { value: '12h', label: t('liquidationData.time.12h') },
              { value: '24h', label: t('liquidationData.time.24h') },
            ]}
            onChange={(v) => setTimeFilter(v as TimeFilter)}
          />
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex-1 min-h-0 relative shadow-lg animate-in fade-in duration-500 flex flex-col">
        <LoadingState isLoading={loading} error={error} onRetry={reload} className="h-full">
          <div className="overflow-x-auto h-full custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d] bg-[#0d1117]/50">
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.exchange')}</th>
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.total')}</th>
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.long')}</th>
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.short')}</th>
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.share')}</th>
                  <th className="px-6 py-4 text-center">{t('liquidationData.table.columns.longShort')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {tableData.map((row, index) => (
                  <tr
                    key={index}
                    className={`transition-colors hover:bg-[#1f2937]/50 cursor-pointer ${
                      row.isTotal ? 'bg-[#21262d]/50' : ''
                    }`}
                    onClick={() => setSelectedExchange(tableDataRaw?.[index] ?? null)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {!row.isTotal && (
                          <ExchangeLogo name={row.exchange} logoUrl={row.logo} size={20} />
                        )}
                        <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'}`}>
                          {row.exchange}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'}`}>
                        {row.amount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono">
                      <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#4ade80]'}`}>
                        {row.long}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono">
                      <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#f87171]'}`}>
                        {row.short}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#8b949e]'}`}>
                        {row.ratio}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-bold ${row.isLongDominant ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
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
        title={t('liquidationData.modal.title', { exchange: selectedExchangeDisplay?.exchange ?? '' })}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
              <p className="text-xs text-[#8b949e] mb-1">{t('liquidationData.modal.primaryAsset')}</p>
              <p className="text-xl font-bold text-white">
                {selectedExchangeDisplay?.coin && selectedExchangeDisplay.coin !== 'ALL'
                  ? selectedExchangeDisplay.coin
                  : t('liquidationData.modal.multiAsset')}
              </p>
            </div>
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
              <p className="text-xs text-[#8b949e] mb-1">{t('liquidationData.modal.maxSingle')}</p>
              <p className="text-xl font-bold text-orange-400">{currencyFormatter.format(1.245e6)}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#e6edf3]">{t('liquidationData.modal.recent')}</p>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex justify-between items-center p-3 bg-[#0d1117]/50 rounded-lg text-sm border border-[#30363d]/30"
              >
                <span className="text-[#e6edf3]">0x{Math.random().toString(16).substring(2, 8)}...</span>
                <span className="text-red-400">
                  -{currencyFormatter.format(4.2e5)} ({t('liquidationData.summary.short')})
                </span>
                <span className="text-[#8b949e] text-xs">
                  {t('liquidationData.modal.minutesAgo', { minutes: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
