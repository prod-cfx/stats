'use client';

import { RefreshCw } from 'lucide-react';
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
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
  longAmountUsd: number;
  shortAmountUsd: number;
}

const initialExchanges: ExchangeData[] = [
  { rank: 1, name: 'Binance', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png', longPercent: 52.44, shortPercent: 47.56, longAmountUsd: 1.17e9, shortAmountUsd: 1.061e9 },
  { rank: 2, name: 'OKX', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png', longPercent: 54.73, shortPercent: 45.27, longAmountUsd: 5.74e8, shortAmountUsd: 4.75e8 },
  { rank: 3, name: 'Bybit', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png', longPercent: 51.71, shortPercent: 48.29, longAmountUsd: 4.93e8, shortAmountUsd: 4.61e8 },
  { rank: 4, name: 'KuCoin', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png', longPercent: 47.16, shortPercent: 52.84, longAmountUsd: 2.086667e7, shortAmountUsd: 2.33841e7 },
  { rank: 5, name: 'Gate', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png', longPercent: 47.39, shortPercent: 52.61, longAmountUsd: 4.92e8, shortAmountUsd: 5.46e8 },
  { rank: 6, name: 'Bitget', logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/513.png', longPercent: 48.96, shortPercent: 51.04, longAmountUsd: 3.0e8, shortAmountUsd: 3.13e8 },
  { rank: 7, name: 'DEX', longPercent: 55.21, shortPercent: 44.79, longAmountUsd: 2.85e8, shortAmountUsd: 2.31e8 },
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
  symbol: string;
  longPercent: number;
  shortPercent: number;
  longAmount: string;
  shortAmount: string;
  totalLabel: string;
  longLabel: string;
  shortLabel: string;
}) => (
  <div className="w-full bg-[#161b22] border border-[#30363d] rounded-xl p-4 mb-6 shadow-sm">
    <div className="flex flex-col md:flex-row items-center gap-8">
      <div className="flex items-center gap-4 min-w-[180px]">
        <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <span className="text-yellow-500 font-bold text-xl">₿</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-bold text-xl">{symbol}</span>
          <span className="text-[#8b949e] text-sm">{totalLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full">
        <ProgressBar long={longPercent} short={shortPercent} height="h-10" />
      </div>
      <div className="flex items-center min-w-[300px]">
        <div className="flex flex-col w-32">
          <span className="text-[#8b949e] text-xs mb-1">{longLabel}</span>
          <span className="text-[#4ade80] font-bold text-lg">{longAmount}</span>
        </div>
        <div className="flex flex-col w-32 ml-auto md:ml-0">
          <span className="text-[#8b949e] text-xs mb-1">{shortLabel}</span>
          <span className="text-[#ef4444] font-bold text-lg">{shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
);

const ExchangeRow = ({
  data,
  longLabel,
  shortLabel,
  longAmount,
  shortAmount,
}: {
  data: ExchangeData;
  longLabel: string;
  shortLabel: string;
  longAmount: string;
  shortAmount: string;
}) => (
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
          <span className="text-[#8b949e] text-xs">{longLabel}</span>
          <span className="text-[#4ade80] font-semibold text-xs">{longAmount}</span>
        </div>
        <div className="flex flex-col w-32 ml-auto md:ml-0">
          <span className="text-[#8b949e] text-xs">{shortLabel}</span>
          <span className="text-[#ef4444] font-semibold text-xs">{shortAmount}</span>
        </div>
      </div>
    </div>
  </div>
);

function LongShortRatioContent() {
  const { t, i18n } = useTranslation();
  const [symbol, setSymbol] = React.useState('BTC');
  const [timeRange, setTimeRange] = React.useState<'5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '24h'>('4h');

  const currencyFormatter = React.useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    });
  }, [i18n.language]);

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
          <PageTitle>{t('longShort.title', { symbol })}</PageTitle>
          <BodyText>{t('longShort.subtitle')}</BodyText>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <FilterButton value={symbol} options={['BTC', 'ETH', 'SOL', 'XRP', 'HYPE', 'DOGE', 'BNB']} onChange={setSymbol} minWidth="80px" />
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
              minWidth="100px"
            />
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
          <SummaryCard
            symbol={symbol}
            longPercent={50.61}
            shortPercent={49.39}
            longAmount={currencyFormatter.format(4.353e9)}
            shortAmount={currencyFormatter.format(4.249e9)}
            totalLabel={t('longShort.summary.total')}
            longLabel={t('longShort.summary.long')}
            shortLabel={t('longShort.summary.short')}
          />
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-500">
            <div className="flex items-center px-6 py-4 text-caption text-[#8b949e] uppercase tracking-wider font-bold border-b border-[#30363d] bg-[#0d1117]/50">
              <span className="w-[180px] pl-10">{t('longShort.table.exchange')}</span>
              <span className="flex-1 text-center">{t('longShort.table.ratio')}</span>
              <div className="flex w-[300px]">
                <span className="w-32">{t('longShort.table.longAmount')}</span>
                <span className="w-32">{t('longShort.table.shortAmount')}</span>
              </div>
            </div>
            <div className="flex flex-col divide-y divide-[#30363d]">
              {exchanges?.map((ex) => (
                <div key={ex.name} className="px-6 py-4 hover:bg-[#21262d] transition-colors">
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
  );
}

export default function LongShortRatioPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
          <LongShortRatioContent />
        </Suspense>
      </main>
    </div>
  );
}
