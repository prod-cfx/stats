'use client';

import type { PredictionCardProps } from './PredictionCard';
import { Bitcoin, Coins, Globe, Landmark, Rocket, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { useMockData } from '@/hooks/use-mock-data';
import { PredictionCard } from './PredictionCard';

const initialPredictions: PredictionCardProps[] = [
  {
    title: 'What price will Bitcoin hit in 2025?',
    icon: <Bitcoin className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '↑ 1,000,000', probability: '86%' },
      { label: '↑ 250,000', probability: '20%' },
    ],
    status: 'LIVE',
    volume: '$35m',
  },
  {
    title: 'Lighter market cap (FDV) one day after launch?',
    icon: <Rocket className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: '>$1B', probability: '86%' },
      { label: '>$2B', probability: '84%' },
    ],
    volume: '$35m',
  },
  {
    title: 'What price will Ethereum hit in 2025?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$17,000', probability: '16%' },
      { label: '$14,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$12m',
  },
  {
    title: 'What day will the Lighter airdrop be?',
    icon: <Shield className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-indigo-600',
    options: [
      { label: 'December 22', probability: '26%' },
      { label: 'December 23', probability: '15%' },
    ],
    volume: '$5m',
  },
  {
    title: 'Bitcoin above __ on December 23?',
    icon: <Bitcoin className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '78,000', probability: '100%' },
      { label: '80,000', probability: '100%' },
    ],
    status: 'LIVE',
    volume: '$8m',
  },
  {
    title: 'Will Satoshi move any Bitcoin in 2025?',
    icon: <Globe className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-slate-600',
    probability: '<1%',
    volume: '$21m',
  },
  {
    title: 'MicroStrategy sells any Bitcoin by __?',
    icon: <Landmark className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: 'December 31, 2025', probability: '86%' },
      { label: 'December 30, 2025', probability: '86%' },
    ],
    volume: '$12m',
  },
  {
    title: 'What price will Ethereum hit in 2026?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$100,000', probability: '86%' },
      { label: '$80,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$4m',
  },
  {
    title: 'Trump to mention "Bitcoin" in Inauguration Speech?',
    icon: <Globe className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-blue-600',
    options: [
      { label: 'Yes', probability: '64%' },
      { label: 'No', probability: '36%' },
    ],
    status: 'LIVE',
    volume: '$2.5m',
  },
  {
    title: 'Solana to flip Ethereum in Market Cap by June?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-purple-600',
    options: [
      { label: 'Yes', probability: '12%' },
      { label: 'No', probability: '88%' },
    ],
    volume: '$45m',
  },
  {
    title: 'Next country to adopt Bitcoin as legal tender?',
    icon: <Landmark className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-green-600',
    options: [
      { label: 'Paraguay', probability: '25%' },
      { label: 'Argentina', probability: '18%' },
    ],
    volume: '$1.2m',
  },
  {
    title: 'SpaceX to accept DOGE for Moon Mission?',
    icon: <Rocket className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-400',
    options: [
      { label: 'Yes', probability: '42%' },
      { label: 'No', probability: '58%' },
    ],
    status: 'LIVE',
    volume: '$9m',
  },
];

export const PredictionMarketGrid = () => {
  const [selectedPrediction, setSelectedPrediction] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { data: predictions, loading, error, reload } = useMockData(
    async () => initialPredictions,
    []
  );

  const handleCardClick = (p: any) => {
    setModalLoading(true);
    setSelectedPrediction(p);
    // Modal internal loading: 800-1200ms
    setTimeout(() => setModalLoading(false), 1000);
  };

  return (
    <div className="space-y-8">
      <div className="relative min-h-[400px]">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-12 animate-in fade-in duration-500">
            {predictions?.map((prediction, index) => (
              <div key={index} onClick={() => handleCardClick(prediction)} className="cursor-pointer">
                <PredictionCard {...prediction} />
              </div>
            ))}
          </div>
        </LoadingState>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedPrediction}
        onClose={() => setSelectedPrediction(null)}
        title="Market Rules"
        width="max-w-xl"
        loading={modalLoading}
      >
        <div className="space-y-6">
          <div className="flex gap-4 items-start pb-4 border-b border-[#30363d]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedPrediction?.iconBgColor || 'bg-[#374151]'}`}>
              {selectedPrediction?.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">{selectedPrediction?.title}</h3>
              <div className="flex gap-3 mt-2">
                <span className="text-xs text-[#8b949e]">交易量: {selectedPrediction?.volume}</span>
                <span className="text-xs text-[#f87171] font-bold">● {selectedPrediction?.status || 'LIVE'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              Rules
            </h4>
            
            <div className="text-sm leading-relaxed text-[#e6edf3] px-1">
              <p>
                This market will resolve to "Yes" if the Binance 1 minute candle for BTC/USDT 12:00 in the ET timezone (noon) on the date specified in the title has a final "Close" price higher than the price specified in the title. Otherwise, this market will resolve to "No".
              </p>
              <div className="h-5" />

              <p>
                The resolution source for this market is Binance, specifically the BTC/USDT "Close" prices currently available at <a href="https://www.binance.com/en/trade/BTC_USDT" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">binance.com/en/trade/BTC_USDT</a> with "1m" and "Candles" selected on the top bar.
              </p>
              <div className="h-5" />

              <p>
                Please note that this market is about the price according to Binance BTC/USDT, not according to other sources or spot markets.
              </p>
              <div className="h-5" />

              <p>
                Price precision is determined by the number of decimal places in the source.
              </p>
            </div>

            <div className="pt-6 border-t border-[#30363d] text-xs text-[#8b949e]">
              <span className="font-bold">Created At: Dec 25, 2025, 1:00 AM GMT+8</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
