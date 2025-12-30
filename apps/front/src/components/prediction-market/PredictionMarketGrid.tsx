'use client';

import type { PredictionCardProps } from './PredictionCard';
import { Bitcoin, Coins, Globe, Landmark, Rocket, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast';
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
];

export const PredictionMarketGrid = () => {
  const [selectedPrediction, setSelectedPrediction] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const { success } = useToast();

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

  const handleVote = (label: string) => {
    success('已选择（Mock）', `您已为 "${label}" 投下一票`);
    setSelectedPrediction(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex border-b border-[#30363d] w-fit mb-6">
        {['所有预测', '近期热门', '即将结束'].map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`px-6 py-3 text-sm font-bold transition-all relative ${
              i === 0 ? 'text-white' : 'text-[#8b949e] hover:text-white'
            }`}
          >
            {tab}
            {i === 0 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

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
        title="预测详情"
        width="max-w-xl"
        loading={modalLoading}
      >
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedPrediction?.iconBgColor || 'bg-[#374151]'}`}>
              {selectedPrediction?.icon}
            </div>
            <h3 className="text-xl font-bold text-white leading-tight">{selectedPrediction?.title}</h3>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-[#8b949e] uppercase tracking-wider">选择一个选项进行预测</p>
            {selectedPrediction?.options?.map((opt: any, idx: number) => (
              <button
                key={idx}
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
            )) || (
              <div className="py-8 text-center bg-[#0d1117] rounded-xl border border-[#30363d]">
                <p className="text-3xl font-bold text-white mb-1">{selectedPrediction?.probability}</p>
                <p className="text-[#8b949e] text-xs uppercase tracking-widest">当前概率</p>
                <button 
                  type="button"
                  onClick={() => handleVote('YES')}
                  className="mt-6 px-10 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  参与预测
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#30363d] flex justify-between text-xs text-[#8b949e]">
            <span>交易量: {selectedPrediction?.volume || '--'}</span>
            <span>状态: {selectedPrediction?.status || 'Active'}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
