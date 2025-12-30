'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SectionTitle } from '@/components/ui/Typography';

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

const mockExchangeData: ExchangeData[] = [
  {
    exchange: '全部',
    logo: '',
    amount: '$3659.98万',
    long: '$3071.64万',
    short: '$588.33万',
    ratio: '100%',
    longShortRatio: '83.93%做多',
    isLongDominant: true,
    isTotal: true,
  },
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
  },
  {
    exchange: 'HTX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/102.png',
    amount: '$333.13万',
    long: '$306.05万',
    short: '$27.09万',
    ratio: '9.1%',
    longShortRatio: '91.87%做多',
    isLongDominant: true,
  },
  {
    exchange: 'Gate',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',
    amount: '$286.57万',
    long: '$210.00万',
    short: '$76.57万',
    ratio: '7.83%',
    longShortRatio: '73.28%做多',
    isLongDominant: true,
  },
  {
    exchange: 'CoinEx',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
    amount: '$15.73万',
    long: '$13.38万',
    short: '$2.36万',
    ratio: '0.43%',
    longShortRatio: '85.02%做多',
    isLongDominant: true,
  },
  {
    exchange: 'Aster',
    logo: 'https://via.placeholder.com/20/dc2626/ffffff?text=A',
    amount: '$9854.48',
    long: '$9854.48',
    short: '$0',
    ratio: '0.03%',
    longShortRatio: '100%做多',
    isLongDominant: true,
  },
  {
    exchange: 'Bitfinex',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/37.png',
    amount: '$1524.42',
    long: '$0',
    short: '$1524.42',
    ratio: '0%',
    longShortRatio: '100%做空',
    isLongDominant: false,
  },
];

export const ExchangeLiquidationTable = () => {
  const [exchangeFilter, setExchangeFilter] = useState('全部');
  const [timeFilter, setTimeFilter] = useState('4小时');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>交易所爆仓</SectionTitle>
        <div className="flex gap-3">
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] text-sm hover:border-[#8b949e] transition-colors">
              交易所 ({exchangeFilter})
              <ChevronDown className="w-4 h-4 text-[#8b949e]" />
            </button>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] text-sm hover:border-[#8b949e] transition-colors">
              时间 ({timeFilter})
              <ChevronDown className="w-4 h-4 text-[#8b949e]" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d]">
                <th className="px-6 py-4 text-center">交易所</th>
                <th className="px-6 py-4 text-center">爆仓金额</th>
                <th className="px-6 py-4 text-center">多单爆仓</th>
                <th className="px-6 py-4 text-center">空单爆仓</th>
                <th className="px-6 py-4 text-center">占比</th>
                <th className="px-6 py-4 text-center">多空比</th>
              </tr>
            </thead>
            <tbody>
              {mockExchangeData.map((row, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-[#30363d] transition-colors hover:bg-[#1f2937]/30 ${
                    row.isTotal ? 'bg-[#21262d]' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {row.logo && (
                        <img src={row.logo} alt={row.exchange} className="w-5 h-5 rounded-full" />
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
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'}`}>
                      {row.long}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'}`}>
                      {row.short}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm ${row.isTotal ? 'font-bold text-white' : 'text-[#e6edf3]'}`}>
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
      </div>
    </div>
  );
};


