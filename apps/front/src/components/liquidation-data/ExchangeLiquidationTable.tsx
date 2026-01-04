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

export const ExchangeLiquidationTable = () => {
  const { t, i18n } = useTranslation();
  const [coinFilter, setCoinFilter] = useState<CoinFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('4h');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeData | null>(null);

  const selectedCoin = (coinFilter === 'ALL' ? 'ALL' : (coinFilter as CoinSymbol));
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

  const { data: tableData, loading, error, reload } = useMockData(
    async () => {
      // Mock dataset: each row has coin metadata and varies by coin + time.
      const coins: CoinSymbol[] = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE'];

      const timeScale = clamp(hours / 4, 0.5, 6); // baseline 4h

      // Build per-exchange-per-coin records
      const perCoinRows: Array<ExchangeData & { _amountUsd: number; _longUsd: number; _shortUsd: number; _longShare: number }> = [];
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
            amount: currencyFormatter.format(amountUsd),
            long: currencyFormatter.format(longUsd),
            short: currencyFormatter.format(shortUsd),
            ratio: '0%',
            longShortRatio: t('liquidationData.table.longShare', { value: (longShare * 100).toFixed(2) }),
            isLongDominant: longUsd > shortUsd,
            _amountUsd: amountUsd,
            _longUsd: longUsd,
            _shortUsd: shortUsd,
            _longShare: longShare,
          });
        }
      }

      interface InternalRow {
        exchange: string
        logo: string
        coin: CoinSymbol | 'ALL'
        amountUsd: number
        longUsd: number
        shortUsd: number
        longShare: number
        isLongDominant: boolean
      }

      // Filter by coin, or aggregate "ALL" across coins.
      const internalRows: InternalRow[] = selectedCoin === 'ALL'
        ? EXCHANGES.map(ex => {
          const rows = perCoinRows.filter(r => r.exchange === ex.exchange)
          const amountUsd = rows.reduce((acc, r) => acc + r._amountUsd, 0)
          const longUsd = rows.reduce((acc, r) => acc + r._longUsd, 0)
          const shortUsd = rows.reduce((acc, r) => acc + r._shortUsd, 0)
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
            amountUsd: r._amountUsd,
            longUsd: r._longUsd,
            shortUsd: r._shortUsd,
            longShare: r._longShare,
            isLongDominant: r._longUsd > r._shortUsd,
          }))

      internalRows.sort((a, b) => b.amountUsd - a.amountUsd)

      const totalAmountUsd = internalRows.reduce((acc, r) => acc + r.amountUsd, 0)
      const totalLongUsd = internalRows.reduce((acc, r) => acc + r.longUsd, 0)
      const totalShortUsd = internalRows.reduce((acc, r) => acc + r.shortUsd, 0)

      const enrichedRows: ExchangeData[] = internalRows.map(r => {
        const ratio = totalAmountUsd === 0 ? 0 : (r.amountUsd / totalAmountUsd) * 100
        return {
          exchange: r.exchange,
          logo: r.logo,
          coin: r.coin,
          amount: currencyFormatter.format(r.amountUsd),
          long: currencyFormatter.format(r.longUsd),
          short: currencyFormatter.format(r.shortUsd),
          ratio: `${ratio.toFixed(2)}%`,
          longShortRatio: t('liquidationData.table.longShare', { value: (r.longShare * 100).toFixed(2) }),
          isLongDominant: r.isLongDominant,
        }
      })

      const total: ExchangeData = {
        exchange: t('common.all'),
        logo: '',
        coin: selectedCoin === 'ALL' ? 'ALL' : selectedCoin,
        amount: currencyFormatter.format(totalAmountUsd),
        long: currencyFormatter.format(totalLongUsd),
        short: currencyFormatter.format(totalShortUsd),
        ratio: '100%',
        longShortRatio: t('liquidationData.table.longShare', {
          value: (totalAmountUsd === 0 ? 0 : (totalLongUsd / totalAmountUsd) * 100).toFixed(2),
        }),
        isLongDominant: totalLongUsd > totalShortUsd,
        isTotal: true,
      }

      return [total, ...enrichedRows]
    },
    [coinFilter, timeFilter, hours]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('liquidationData.table.title')}</SectionTitle>
        <div className="flex gap-3">
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

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative shadow-lg animate-in fade-in duration-500">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="overflow-x-auto">
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
                {tableData?.map((row, index) => (
                  <tr 
                    key={index} 
                    className={`transition-colors hover:bg-[#1f2937]/50 cursor-pointer ${
                      row.isTotal ? 'bg-[#21262d]/50' : ''
                    }`}
                    onClick={() => setSelectedExchange(row)}
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
        isOpen={!!selectedExchange}
        onClose={() => setSelectedExchange(null)}
        title={t('liquidationData.modal.title', { exchange: selectedExchange?.exchange ?? '' })}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
              <p className="text-xs text-[#8b949e] mb-1">{t('liquidationData.modal.primaryAsset')}</p>
              <p className="text-xl font-bold text-white">
                {selectedExchange?.coin && selectedExchange.coin !== 'ALL' ? selectedExchange.coin : t('liquidationData.modal.multiAsset')}
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
