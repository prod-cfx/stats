'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';

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

type CoinFilter = 'ALL' | CoinSymbol
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hashToUnit(str: string): number {
  // deterministic 0..1 based on string hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function timeToHours(timeFilter: TimeFilter): number {
  switch (timeFilter) {
    case '1h':
      return 1;
    case '4h':
      return 4;
    case '12h':
      return 12;
    case '24h':
      return 24;
    default:
      return 4;
  }
}

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

export const ExchangeLiquidationTable = ({ showTitle = true, variant = 'default' }: { showTitle?: boolean; variant?: 'default' | 'compact' }) => {
  const { t, i18n } = useTranslation();
  const [coinFilter, setCoinFilter] = useState<CoinFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('4h');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRowRaw | null>(null);

  const isCompact = variant === 'compact';
  const cellPadding = isCompact ? 'px-2 py-1.5' : 'px-6 py-4';
  const textSize = isCompact ? 'text-[11px]' : 'text-sm';
  const headerTextSize = isCompact ? 'text-[10px]' : 'text-xs';

  const selectedCoin = (coinFilter === 'ALL' ? 'ALL' : (coinFilter as CoinSymbol));
  const hours = useMemo(() => timeToHours(timeFilter), [timeFilter]);
  const hours = useMemo(() => timeToHours(timeFilter), [timeFilter]);

  const currencyFormatter = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const { data: tableDataRaw, loading, error, reload } = useMockData(
    async () => {
      // Mock dataset: each row has coin metadata and varies by coin + time.
      const coins: CoinSymbol[] = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE'];

      const timeScale = clamp(hours / 4, 0.5, 6); // baseline 4h

      // Build per-exchange-per-coin records
      const perCoinRows: Array<{
        exchange: string
        logo: string
        coin: CoinSymbol
        amountUsd: number
        longUsd: number
        shortUsd: number
        longShare: number
      }> = [];
      for (const ex of EXCHANGES) {
        for (const coin of coins) {
          // Base in USD (millions), scaled by time filter.
          const baseMillions = 2 + 12 * hashToUnit(`${ex.exchange}:${coin}`); // 2..14 (M)
          const volatility = 0.85 + 0.35 * hashToUnit(`${ex.exchange}:${coin}:${hours}`); // 0.85..1.2
          const amountUsd = baseMillions * 1e6 * timeScale * volatility;

          const longShare = clamp(0.35 + 0.55 * hashToUnit(`${ex.exchange}:${coin}:long:${hours}`), 0.05, 0.95);
          const longUsd = amountUsd * longShare;
          const shortUsd = amountUsd - longUsd;

          perCoinRows.push({
            exchange: ex.exchange,
            logo: ex.logo,
            coin,
            amountUsd,
            longUsd,
            shortUsd,
            longShare,
          });
        }
      }

      // Filter by coin, or aggregate "ALL" across coins.
      const internalRows: Array<Omit<ExchangeRowRaw, 'ratio'>> = selectedCoin === 'ALL'
        ? EXCHANGES.map(ex => {
          const rows = perCoinRows.filter(r => r.exchange === ex.exchange)
          const amountUsd = rows.reduce((acc, r) => acc + r.amountUsd, 0)
          const longUsd = rows.reduce((acc, r) => acc + r.longUsd, 0)
          const shortUsd = rows.reduce((acc, r) => acc + r.shortUsd, 0)
          const longShare = amountUsd === 0 ? 0 : longUsd / amountUsd
          return {
            exchange: ex.exchange,
            logo: ex.logo,
            coin: 'ALL' as const,
            amountUsd,
            longUsd,
            shortUsd,
            longShare,
            isLongDominant: longUsd > shortUsd,
          }
        })
        : perCoinRows
          .filter(r => r.coin === selectedCoin)
          .map(r => ({
            exchange: r.exchange,
            logo: r.logo,
            coin: r.coin,
            amountUsd: r.amountUsd,
            longUsd: r.longUsd,
            shortUsd: r.shortUsd,
            longShare: r.longShare,
            isLongDominant: r.longUsd > r.shortUsd,
          }))

      internalRows.sort((a, b) => b.amountUsd - a.amountUsd)

      const totalAmountUsd = internalRows.reduce((acc, r) => acc + r.amountUsd, 0)
      const totalLongUsd = internalRows.reduce((acc, r) => acc + r.longUsd, 0)
      const totalShortUsd = internalRows.reduce((acc, r) => acc + r.shortUsd, 0)

      const rows: ExchangeRowRaw[] = internalRows.map(r => {
        const ratio = totalAmountUsd === 0 ? 0 : (r.amountUsd / totalAmountUsd) * 100
        return {
          exchange: r.exchange,
          logo: r.logo,
          coin: r.coin,
          amountUsd: r.amountUsd,
          longUsd: r.longUsd,
          shortUsd: r.shortUsd,
          longShare: r.longShare,
          ratio,
          isLongDominant: r.isLongDominant,
        }
      })

      const total: ExchangeRowRaw = {
        exchange: 'TOTAL',
        logo: '',
        coin: selectedCoin === 'ALL' ? 'ALL' : selectedCoin,
        amountUsd: totalAmountUsd,
        longUsd: totalLongUsd,
        shortUsd: totalShortUsd,
        longShare: totalAmountUsd === 0 ? 0 : totalLongUsd / totalAmountUsd,
        ratio: 100,
        isLongDominant: totalLongUsd > totalShortUsd,
        isTotal: true,
      }

      return [total, ...rows]
    },
    [coinFilter, timeFilter, hours]
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
    <div className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-6'} h-full`}>
      <div className="flex items-center justify-between flex-none">
        {showTitle && <SectionTitle>{t('liquidationData.table.title')}</SectionTitle>}
        <div className={`flex gap-3 ${!showTitle ? 'w-full justify-between' : ''}`}>
          <FilterButton 
            value={coinFilter} 
            options={[
              { value: 'ALL', label: t('common.all') },
              { value: 'BTC', label: 'BTC' },
              { value: 'ETH', label: 'ETH' },
              { value: 'SOL', label: 'SOL' },
              { value: 'XRP', label: 'XRP' },
              { value: 'DOGE', label: 'DOGE' },
              { value: 'HYPE', label: 'HYPE' },
            ]} 
            onChange={(v) => setCoinFilter(v as CoinFilter)}
            size={isCompact ? 'sm' : 'md'}
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
            size={isCompact ? 'sm' : 'md'}
          />
        </div>
      </div>

      <div className={`bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex-1 min-h-0 relative ${isCompact ? '' : 'shadow-lg'} animate-in fade-in duration-500 flex flex-col`}>
        <LoadingState isLoading={loading} error={error} onRetry={reload} className="h-full">
          <div className="overflow-x-auto h-full cf-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className={`text-[#8b949e] ${headerTextSize} font-bold border-b border-[#30363d] bg-[#0d1117]/50`}>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.exchange')}</th>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.total')}</th>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.long')}</th>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.short')}</th>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.share')}</th>
                  <th className={`${cellPadding} text-center`}>{t('liquidationData.table.columns.longShort')}</th>
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
                    <td className={cellPadding}>
                      <div className="flex items-center justify-center gap-2">
                        {!row.isTotal && (
                          <ExchangeLogo name={row.exchange} logoUrl={row.logo} size={isCompact ? 16 : 20} />
                        )}
                        <span className={`${textSize} ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'} tracking-tight`}>
                          {row.exchange}
                        </span>
                      </div>
                    </td>
                    <td className={`${cellPadding} text-center`}>
                      <span className={`${textSize} ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'} tracking-tight`}>
                        {row.amount}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-center font-mono`}>
                      <span className={`${textSize} ${row.isTotal ? 'font-bold text-white' : 'text-[#4ade80]'} tracking-tight`}>
                        {row.long}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-center font-mono`}>
                      <span className={`${textSize} ${row.isTotal ? 'font-bold text-white' : 'text-[#f87171]'} tracking-tight`}>
                        {row.short}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-center`}>
                      <span className={`${textSize} ${row.isTotal ? 'font-bold text-white' : 'text-[#8b949e]'} tracking-tight`}>
                        {row.ratio}
                      </span>
                    </td>
                    <td className={`${cellPadding} text-center`}>
                      <span className={`${textSize} font-bold ${row.isLongDominant ? 'text-[#4ade80]' : 'text-[#f87171]'} tracking-tight`}>
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
                {selectedExchangeDisplay?.coin && selectedExchangeDisplay.coin !== 'ALL' ? selectedExchangeDisplay.coin : t('liquidationData.modal.multiAsset')}
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
              <div key={i} className="flex justify-between items-center p-3 bg-[#0d1117]/50 rounded-lg text-sm border border-[#30363d]/30">
                <span className="text-[#e6edf3]">0x{Math.random().toString(16).substring(2, 8)}...</span>
                <span className="text-red-400">-{currencyFormatter.format(4.2e5)} ({t('liquidationData.summary.short')})</span>
                <span className="text-[#8b949e] text-xs">{t('liquidationData.modal.minutesAgo', { minutes: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
