'use client';

import { RefreshCw } from 'lucide-react';
import React, { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';

// --- Types ---
interface ExchangeData {
  rank: number;
  name: string;
  logoUrl?: string;
  longPercent: number;
  shortPercent: number;
  longAmount: string;
  shortAmount: string;
}

const initialExchanges: ExchangeData[] = [
  { rank: 1, name: 'Binance', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png', longPercent: 52.44, shortPercent: 47.56, longAmount: '$11.70亿', shortAmount: '$10.61亿' },
  { rank: 2, name: 'OKX', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png', longPercent: 54.73, shortPercent: 45.27, longAmount: '$5.74亿', shortAmount: '$4.75亿' },
  { rank: 3, name: 'Bybit', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png', longPercent: 51.71, shortPercent: 48.29, longAmount: '$4.93亿', shortAmount: '$4.61亿' },
  { rank: 4, name: 'KuCoin', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png', longPercent: 47.16, shortPercent: 52.84, longAmount: '$2086.67万', shortAmount: '$2338.41万' },
  { rank: 5, name: 'Gate', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png', longPercent: 47.39, shortPercent: 52.61, longAmount: '$4.92亿', shortAmount: '$5.46亿' },
  { rank: 6, name: 'Bitget', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/513.png', longPercent: 48.96, shortPercent: 51.04, longAmount: '$3.00亿', shortAmount: '$3.13亿' },
  { rank: 7, name: 'DEX', longPercent: 55.21, shortPercent: 44.79, longAmount: '$2.85亿', shortAmount: '$2.31亿' },
];

const ProgressBar = ({ long, short, height = "h-8", showText = true }: { long: number, short: number, height?: string, showText?: boolean }) => (
  <div className={`relative w-full ${height} bg-[#0d1117] rounded-md overflow-hidden flex border border-[#30363d]`}>
    <div className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] flex items-center justify-center transition-all duration-500" style={{ width: `${long}%` }}>
      {showText && long > 15 && <span className="text-white text-xs font-bold">{long.toFixed(2)}%</span>}
    </div>
    <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#dc2626] flex items-center justify-center transition-all duration-500" style={{ width: `${short}%` }}>
      {showText && short > 15 && <span className="text-white text-xs font-bold">{short.toFixed(2)}%</span>}
    </div>
  </div>
);

const SummaryCard = ({ symbol, longPercent, shortPercent, longAmount, shortAmount }: { symbol: string, longPercent: number, shortPercent: number, longAmount: string, shortAmount: string }) => (
  <div className="w-full bg-[#161b22] border border-[#30363d] rounded-xl p-4 mb-6 shadow-sm">
    <div className="flex flex-col md:flex-row items-center gap-8">
      <div className="flex items-center gap-4 min-w-[180px]">
        <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <span className="text-yellow-500 font-bold text-xl">₿</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-bold text-xl">{symbol}</span>
          <span className="text-[#8b949e] text-sm">总计</span>
        </div>
      </div>
      <div className="flex-1 w-full">
        <ProgressBar long={longPercent} short={shortPercent} height="h-10" />
      </div>
      <div className="flex items-center min-w-[300px]">
        <div className="flex flex-col w-32">
          <span className="text-[#8b949e] text-xs mb-1">做多</span>
          <span className="text-[#4ade80] font-bold text-lg">{longAmount}</span>
        </div>
        <div className="flex flex-col w-32 ml-auto md:ml-0">
          <span className="text-[#8b949e] text-xs mb-1">做空</span>
          <span className="text-[#ef4444] font-bold text-lg">{shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
);

const ExchangeRow = ({ data }: { data: ExchangeData }) => (
  <div className="w-full transition-colors group">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-4 min-w-[180px]">
        <span className="text-[#8b949e] font-semibold w-6 text-center">{data.rank}</span>
        <ExchangeLogo name={data.name} logoUrl={data.logoUrl} size={28} />
        <span className="text-white font-medium text-sm">{data.name}</span>
      </div>
      <div className="flex-1">
        <ProgressBar long={data.longPercent} short={data.shortPercent} height="h-8" />
      </div>
      <div className="flex items-center min-w-[300px]">
        <div className="flex flex-col w-32">
          <span className="text-[#8b949e] text-xs">做多</span>
          <span className="text-[#4ade80] font-semibold text-xs">{data.longAmount}</span>
        </div>
        <div className="flex flex-col w-32 ml-auto md:ml-0">
          <span className="text-[#8b949e] text-xs">做空</span>
          <span className="text-[#ef4444] font-semibold text-xs">{data.shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
);

function LongShortRatioContent() {
  const [symbol, setSymbol] = React.useState('BTC');
  const [timeRange, setTimeRange] = React.useState('4小时');

  const { data: exchanges, loading, error, reload } = useMockData(
    async () => {
      return initialExchanges.map(ex => ({
        ...ex,
        longPercent: Math.random() * 20 + 40,
        shortPercent: 100 - (Math.random() * 20 + 40)
      }));
    },
    [symbol, timeRange]
  );

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <PageTitle>交易所 多空比 {symbol}</PageTitle>
          <BodyText>交易所多空持仓人数及持仓量比</BodyText>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <FilterButton value={symbol} options={['BTC', 'ETH', 'SOL', 'XRP', 'HYPE', 'DOGE', 'BNB']} onChange={setSymbol} minWidth="80px" />
            <FilterButton value={timeRange} options={['5分钟', '15分钟', '30分钟', '1小时', '4小时', '12小时', '24小时']} onChange={setTimeRange} minWidth="100px" />
          </div>
          <button type="button" className="p-2.5 bg-[#161b22] border border-[#30363d] rounded-md text-[#8b949e] hover:text-[#c9d1d9] transition-all hover:bg-[#30363d] active:scale-95 group" onClick={() => {
            const btn = document.querySelector('.refresh-icon');
            btn?.classList.add('animate-spin');
            setTimeout(() => { btn?.classList.remove('animate-spin'); reload(); }, 500);
          }}>
            <RefreshCw className="w-4 h-4 refresh-icon" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 relative min-h-[600px]">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <SummaryCard symbol={symbol} longPercent={50.61} shortPercent={49.39} longAmount="$43.53亿" shortAmount="$42.49亿" />
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-500">
            <div className="flex items-center px-6 py-4 text-caption text-[#8b949e] uppercase tracking-wider font-bold border-b border-[#30363d] bg-[#0d1117]/50">
              <span className="w-[180px] pl-10">交易所</span>
              <span className="flex-1 text-center">持仓占比 (多 vs 空)</span>
              <div className="flex w-[300px]">
                <span className="w-32">做多金额</span>
                <span className="w-32">做空金额</span>
              </div>
            </div>
            <div className="flex flex-col divide-y divide-[#30363d]">
              {exchanges?.map((ex) => (
                <div key={ex.name} className="px-6 py-4 hover:bg-[#21262d] transition-colors">
                  <ExchangeRow data={ex} />
                </div>
              ))}
            </div>
          </div>
        </LoadingState>
      </div>
    </div>
  );
}

export default function LongShortRatioPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">加载中...</div>}>
          <LongShortRatioContent />
        </Suspense>
      </main>
    </div>
  );
}
