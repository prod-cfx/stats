'use client';

import React, { useMemo, useState } from 'react';
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

const COIN_OPTIONS: Array<'全部' | CoinSymbol> = ['全部', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE'];
const TIME_OPTIONS = ['1小时', '4小时', '12小时', '24小时'] as const;

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

function parseWanAmount(v: string): number {
  return Number.parseFloat(v.replace('$', '').replace('万', ''));
}

function formatWanAmount(v: number): string {
  return `$${v.toFixed(2)}万`;
}

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

function timeToHours(timeFilter: string): number {
  switch (timeFilter) {
    case '1小时':
      return 1;
    case '4小时':
      return 4;
    case '12小时':
      return 12;
    case '24小时':
      return 24;
    default:
      return 4;
  }
}

export const ExchangeLiquidationTable = () => {
  const [coinFilter, setCoinFilter] = useState('全部');
  const [timeFilter, setTimeFilter] = useState('4小时');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeData | null>(null);

  const selectedCoin = (coinFilter === '全部' ? '全部' : (coinFilter as CoinSymbol));
  const hours = useMemo(() => timeToHours(timeFilter), [timeFilter]);

  const { data: tableData, loading, error, reload } = useMockData(
    async () => {
      // Mock dataset: each row has coin metadata and varies by coin + time.
      const coins: CoinSymbol[] = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE'];

      const timeScale = clamp(hours / 4, 0.5, 6); // baseline 4h

      // Build per-exchange-per-coin records
      const perCoinRows: Array<ExchangeData & { _amount: number; _long: number; _short: number }> = [];
      for (const ex of EXCHANGES) {
        for (const coin of coins) {
          const base = 200 + 1200 * hashToUnit(`${ex.exchange}:${coin}`); // 200..1400 (万)
          const volatility = 0.85 + 0.35 * hashToUnit(`${ex.exchange}:${coin}:${hours}`); // 0.85..1.2
          const amount = base * timeScale * volatility;

          const longShare = clamp(0.35 + 0.55 * hashToUnit(`${ex.exchange}:${coin}:long:${hours}`), 0.05, 0.95);
          const long = amount * longShare;
          const short = amount - long;

          perCoinRows.push({
            exchange: ex.exchange,
            logo: ex.logo,
            coin,
            amount: formatWanAmount(amount),
            long: formatWanAmount(long),
            short: formatWanAmount(short),
            ratio: '0%',
            longShortRatio: `${(longShare * 100).toFixed(2)}%做多`,
            isLongDominant: long > short,
            _amount: amount,
            _long: long,
            _short: short,
          });
        }
      }

      // Filter by coin, or aggregate "全部" across coins.
      const visibleRowsRaw = selectedCoin === '全部'
        ? EXCHANGES.map(ex => {
          const rows = perCoinRows.filter(r => r.exchange === ex.exchange);
          const amount = rows.reduce((acc, r) => acc + r._amount, 0);
          const long = rows.reduce((acc, r) => acc + r._long, 0);
          const short = rows.reduce((acc, r) => acc + r._short, 0);
          const longShare = amount === 0 ? 0 : long / amount;
          return {
            exchange: ex.exchange,
            logo: ex.logo,
            coin: 'ALL' as const,
            amount: formatWanAmount(amount),
            long: formatWanAmount(long),
            short: formatWanAmount(short),
            ratio: '0%',
            longShortRatio: `${(longShare * 100).toFixed(2)}%做多`,
            isLongDominant: long > short,
          };
        })
        : perCoinRows
          .filter(r => r.coin === selectedCoin)
          .map(r => ({
            exchange: r.exchange,
            logo: r.logo,
            coin: r.coin,
            amount: r.amount,
            long: r.long,
            short: r.short,
            ratio: '0%',
            longShortRatio: r.longShortRatio,
            isLongDominant: r.isLongDominant,
          }));

      const visibleRows = visibleRowsRaw
        .map(r => ({
          ...r,
          _amount: parseWanAmount(r.amount),
          _long: parseWanAmount(r.long),
          _short: parseWanAmount(r.short),
        }))
        .sort((a, b) => b._amount - a._amount);

      const totalAmount = visibleRows.reduce((acc, r) => acc + r._amount, 0);
      const totalLong = visibleRows.reduce((acc, r) => acc + r._long, 0);
      const totalShort = visibleRows.reduce((acc, r) => acc + r._short, 0);

      const enrichedRows: ExchangeData[] = visibleRows.map(r => {
        const ratio = totalAmount === 0 ? 0 : (r._amount / totalAmount) * 100;
        const longShare = r._amount === 0 ? 0 : (r._long / r._amount) * 100;
        return {
          exchange: r.exchange,
          logo: r.logo,
          coin: r.coin,
          amount: r.amount,
          long: r.long,
          short: r.short,
          ratio: `${ratio.toFixed(2)}%`,
          longShortRatio: `${longShare.toFixed(2)}%做多`,
          isLongDominant: r._long > r._short,
        };
      });

      const total: ExchangeData = {
        exchange: '全部',
        logo: '',
        coin: selectedCoin === '全部' ? 'ALL' : selectedCoin,
        amount: formatWanAmount(totalAmount),
        long: formatWanAmount(totalLong),
        short: formatWanAmount(totalShort),
        ratio: '100%',
        longShortRatio: `${(totalAmount === 0 ? 0 : (totalLong / totalAmount) * 100).toFixed(2)}%做多`,
        isLongDominant: totalLong > totalShort,
        isTotal: true,
      };

      return [total, ...enrichedRows];
    },
    [coinFilter, timeFilter, hours]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>交易所爆仓</SectionTitle>
        <div className="flex gap-3">
          <FilterButton 
            value={coinFilter} 
            options={COIN_OPTIONS as unknown as string[]} 
            onChange={setCoinFilter} 
          />
          <FilterButton 
            value={timeFilter} 
            options={TIME_OPTIONS as unknown as string[]} 
            onChange={setTimeFilter} 
          />
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative shadow-lg animate-in fade-in duration-500">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d] bg-[#0d1117]/50">
                  <th className="px-6 py-4 text-center">交易所</th>
                  <th className="px-6 py-4 text-center">爆仓金额</th>
                  <th className="px-6 py-4 text-center">多单爆仓</th>
                  <th className="px-6 py-4 text-center">空单爆仓</th>
                  <th className="px-6 py-4 text-center">占比</th>
                  <th className="px-6 py-4 text-center">多空比</th>
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
                        {row.exchange !== '全部' && (
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
        title={`${selectedExchange?.exchange} 爆仓详情 (Mock)`}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
              <p className="text-xs text-[#8b949e] mb-1">主要爆仓资产</p>
              <p className="text-xl font-bold text-white">
                {selectedExchange?.coin && selectedExchange.coin !== 'ALL' ? selectedExchange.coin : 'BTC / ETH'}
              </p>
            </div>
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
              <p className="text-xs text-[#8b949e] mb-1">最大单笔金额</p>
              <p className="text-xl font-bold text-orange-400">$124.50万</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#e6edf3]">近期爆仓流水</p>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center p-3 bg-[#0d1117]/50 rounded-lg text-sm border border-[#30363d]/30">
                <span className="text-[#e6edf3]">0x{Math.random().toString(16).substring(2, 8)}...</span>
                <span className="text-red-400">-$4.20万 (Short)</span>
                <span className="text-[#8b949e] text-xs">2分钟前</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
