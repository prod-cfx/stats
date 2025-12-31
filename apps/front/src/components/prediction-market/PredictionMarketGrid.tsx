'use client';

import type { PredictionCardProps, PredictionRulesMeta } from './PredictionCard';
import { Bitcoin, Coins, Globe, Landmark, Rocket, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast';
import { useMockData } from '@/hooks/use-mock-data';
import { PredictionCard } from './PredictionCard';

type PredictionMarketItem = PredictionCardProps & {
  rules?: PredictionRulesMeta;
};

function rulesById(id: string): PredictionRulesMeta {
  // Per-market metadata (mock). Key point: not hard-coded globally in UI; each item carries its own rules.
  switch (id) {
    case 'btc-2025-price':
      return {
        paragraphs: [
          'This market will resolve to "Yes" if the Binance 1 minute candle for BTC/USDT 12:00 in the ET timezone (noon) on the date specified in the title has a final "Close" price higher than the price specified in the title. Otherwise, this market will resolve to "No".',
          'The resolution source for this market is Binance, specifically the BTC/USDT "Close" prices currently available at binance.com/en/trade/BTC_USDT with "1m" and "Candles" selected on the top bar.',
          'Please note that this market is about the price according to Binance BTC/USDT, not according to other sources or spot markets.',
          'Price precision is determined by the number of decimal places in the source.',
        ],
        createdAt: 'Dec 25, 2025, 1:00 AM GMT+8',
      };
    default:
      return {
        paragraphs: [
          'Resolution criteria and data source are defined by the market rules for this event.',
          'This is mock data for UI interaction preview; final rules may differ from production.',
        ],
      };
  }
}

const initialPredictions: PredictionMarketItem[] = [
  {
    id: 'btc-2025-price',
    title: 'What price will Bitcoin hit in 2025?',
    icon: <Bitcoin className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '↑ 1,000,000', probability: '86%' },
      { label: '↑ 250,000', probability: '20%' },
    ],
    status: 'LIVE',
    volume: '$35m',
    rules: rulesById('btc-2025-price'),
  },
  {
    id: 'lighter-fdv',
    title: 'Lighter market cap (FDV) one day after launch?',
    icon: <Rocket className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: '>$1B', probability: '86%' },
      { label: '>$2B', probability: '84%' },
    ],
    volume: '$35m',
    rules: rulesById('lighter-fdv'),
  },
  {
    id: 'eth-2025-price',
    title: 'What price will Ethereum hit in 2025?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$17,000', probability: '16%' },
      { label: '$14,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$12m',
    rules: rulesById('eth-2025-price'),
  },
  {
    id: 'lighter-airdrop-day',
    title: 'What day will the Lighter airdrop be?',
    icon: <Shield className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-indigo-600',
    options: [
      { label: 'December 22', probability: '26%' },
      { label: 'December 23', probability: '15%' },
    ],
    volume: '$5m',
    rules: rulesById('lighter-airdrop-day'),
  },
  {
    id: 'btc-above-dec23',
    title: 'Bitcoin above __ on December 23?',
    icon: <Bitcoin className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '78,000', probability: '100%' },
      { label: '80,000', probability: '100%' },
    ],
    status: 'LIVE',
    volume: '$8m',
    rules: rulesById('btc-above-dec23'),
  },
  {
    id: 'satoshi-move-2025',
    title: 'Will Satoshi move any Bitcoin in 2025?',
    icon: <Globe className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-slate-600',
    probability: '<1%',
    volume: '$21m',
    rules: rulesById('satoshi-move-2025'),
  },
  {
    id: 'mstr-sell-by',
    title: 'MicroStrategy sells any Bitcoin by __?',
    icon: <Landmark className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: 'December 31, 2025', probability: '86%' },
      { label: 'December 30, 2025', probability: '86%' },
    ],
    volume: '$12m',
    rules: rulesById('mstr-sell-by'),
  },
  {
    id: 'eth-2026-price',
    title: 'What price will Ethereum hit in 2026?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$100,000', probability: '86%' },
      { label: '$80,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$4m',
    rules: rulesById('eth-2026-price'),
  },
  {
    id: 'trump-mention-btc',
    title: 'Trump to mention "Bitcoin" in Inauguration Speech?',
    icon: <Globe className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-blue-600',
    options: [
      { label: 'Yes', probability: '64%' },
      { label: 'No', probability: '36%' },
    ],
    status: 'LIVE',
    volume: '$2.5m',
    rules: rulesById('trump-mention-btc'),
  },
  {
    id: 'sol-flip-eth',
    title: 'Solana to flip Ethereum in Market Cap by June?',
    icon: <Coins className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-purple-600',
    options: [
      { label: 'Yes', probability: '12%' },
      { label: 'No', probability: '88%' },
    ],
    volume: '$45m',
    rules: rulesById('sol-flip-eth'),
  },
  {
    id: 'next-legal-tender',
    title: 'Next country to adopt Bitcoin as legal tender?',
    icon: <Landmark className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-green-600',
    options: [
      { label: 'Paraguay', probability: '25%' },
      { label: 'Argentina', probability: '18%' },
    ],
    volume: '$1.2m',
    rules: rulesById('next-legal-tender'),
  },
  {
    id: 'spacex-doge',
    title: 'SpaceX to accept DOGE for Moon Mission?',
    icon: <Rocket className="w-5 h-5 text-white" />,
    iconBgColor: 'bg-orange-400',
    options: [
      { label: 'Yes', probability: '42%' },
      { label: 'No', probability: '58%' },
    ],
    status: 'LIVE',
    volume: '$9m',
    rules: rulesById('spacex-doge'),
  },
];

export const PredictionMarketGrid = () => {
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionMarketItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const { success } = useToast();

  const { data: predictions, loading, error, reload } = useMockData(
    async () => initialPredictions,
    []
  );

  const handleCardClick = (p: PredictionMarketItem) => {
    setModalLoading(true);
    setSelectedPrediction(p);
    // Modal internal loading: 800-1200ms
    setTimeout(() => setModalLoading(false), 1000);
  };

  const handleVote = (label: string) => {
    success('已选择（Mock）', `您已为 "${label}" 投下一票`);
    setSelectedPrediction(null);
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
        title="Market Details"
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

          {/* Options / Probability */}
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#8b949e] uppercase tracking-wider">选择一个选项进行预测</p>
            {selectedPrediction?.options?.length ? (
              <div className="space-y-3">
                {selectedPrediction.options.map((opt, idx) => (
                  <button
                    key={`${opt.label}-${idx}`}
                    type="button"
                    onClick={() => handleVote(opt.label)}
                    className="w-full flex justify-between items-center p-4 bg-[#0d1117] border border-[#30363d] rounded-xl hover:border-primary transition-all group active:scale-[0.98]"
                  >
                    <span className="text-white font-bold">{opt.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-bold">{opt.probability}</span>
                      <div className="w-5 h-5 rounded-full border-2 border-[#30363d] group-hover:border-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : selectedPrediction?.probability ? (
              <div className="py-8 text-center bg-[#0d1117] rounded-xl border border-[#30363d]">
                <p className="text-3xl font-bold text-white mb-1">{selectedPrediction.probability}</p>
                <p className="text-[#8b949e] text-xs uppercase tracking-widest">当前概率</p>
                <button
                  type="button"
                  onClick={() => handleVote('YES')}
                  className="mt-6 px-10 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  参与预测
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[#8b949e] border border-[#30363d] rounded-xl bg-[#0d1117]/30">
                暂无可选项（Mock）
              </div>
            )}
          </div>

          {/* Rules */}
          <div className="space-y-4 pt-2">
            <h4 className="text-lg font-bold text-white">Rules</h4>
            <div className="text-sm leading-relaxed text-[#e6edf3] px-1">
              {(selectedPrediction?.rules?.paragraphs || []).map((p, idx) => (
                <React.Fragment key={idx}>
                  <p>{p}</p>
                  {idx !== (selectedPrediction?.rules?.paragraphs?.length ?? 0) - 1 && <div className="h-5" />}
                </React.Fragment>
              ))}
            </div>

            {selectedPrediction?.rules?.createdAt && (
              <div className="pt-6 border-t border-[#30363d] text-xs text-[#8b949e]">
                <span className="font-bold">Created At: {selectedPrediction.rules.createdAt}</span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
