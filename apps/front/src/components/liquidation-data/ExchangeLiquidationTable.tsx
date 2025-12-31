'use client';

import React, { useState } from 'react';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';

interface ExchangeData {
  exchange: string;
  logo: string;
  amount: string;
  long: string;
  short: string;
  ratio: string;
  longShortRatio: string;
  isLongDominant: boolean;
  isTotal?: boolean;
}

const initialExchangeData: ExchangeData[] = [
  {
    exchange: 'Hyperliquid',
    logo: 'https://app.hyperliquid.xyz/favicon.ico',
    amount: '$1429.44万',
    long: '$1312.02万',
    short: '$117.42万',
    ratio: '39.06%',
    longShortRatio: '91.79%做多',
    isLongDominant: true,
  },
  {
    exchange: 'Binance',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
    amount: '$740.53万',
    long: '$576.40万',
    short: '$164.13万',
    ratio: '20.23%',
    longShortRatio: '77.84%做多',
    isLongDominant: true,
  },
  {
    exchange: 'Bybit',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
    amount: '$500.87万',
    long: '$403.68万',
    short: '$97.19万',
    ratio: '13.69%',
    longShortRatio: '80.6%做多',
    isLongDominant: true,
  },
  {
    exchange: 'OKX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
    amount: '$352.55万',
    long: '$249.13万',
    short: '$103.42万',
    ratio: '9.63%',
    longShortRatio: '70.66%做多',
    isLongDominant: true,
  }
];

export const ExchangeLiquidationTable = () => {
  const [coinFilter, setCoinFilter] = useState('全部');
  const [timeFilter, setTimeFilter] = useState('4小时');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeData | null>(null);

  const { data: tableData, loading, error, reload } = useMockData(
    async () => {
      // Simulate data generation
      const data = initialExchangeData.map(ex => {
        // Mock: make it feel like data changed based on filters
        const multiplier = coinFilter === '全部' ? 1 : (Math.random() * 0.5 + 0.5);
        return {
          ...ex,
          amount: `$${(Math.random() * 1000 * multiplier + 100).toFixed(2)}万`,
          long: `$${(Math.random() * 800 * multiplier + 50).toFixed(2)}万`,
          short: `$${(Math.random() * 200 * multiplier + 10).toFixed(2)}万`,
        };
      });
      
      const totalAmount = data.reduce(
        (acc, curr) => acc + Number.parseFloat(curr.amount.replace('$', '').replace('万', '')),
        0
      );
      const totalLong = data.reduce(
        (acc, curr) => acc + Number.parseFloat(curr.long.replace('$', '').replace('万', '')),
        0
      );
      const totalShort = data.reduce(
        (acc, curr) => acc + Number.parseFloat(curr.short.replace('$', '').replace('万', '')),
        0
      );

      const total = {
        exchange: '全部',
        logo: '',
        amount: `$${totalAmount.toFixed(2)}万`,
        long: `$${totalLong.toFixed(2)}万`,
        short: `$${totalShort.toFixed(2)}万`,
        ratio: '100%',
        longShortRatio: `${((totalLong / totalAmount) * 100).toFixed(2)}%做多`,
        isLongDominant: totalLong > totalShort,
        isTotal: true,
      };

      return [total, ...data];
    },
    [coinFilter, timeFilter]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>交易所爆仓</SectionTitle>
        <div className="flex gap-3">
          <FilterButton 
            value={coinFilter} 
            options={['全部', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE']} 
            onChange={setCoinFilter} 
          />
          <FilterButton 
            value={timeFilter} 
            options={['1小时', '4小时', '12小时', '24小时']} 
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
              <p className="text-xl font-bold text-white">BTC / ETH</p>
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
