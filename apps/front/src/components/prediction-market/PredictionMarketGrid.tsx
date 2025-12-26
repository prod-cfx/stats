'use client';

import React from 'react';
import { PredictionCard, PredictionCardProps } from './PredictionCard';
import { Bitcoin, Coins, Rocket, Shield, Globe, Landmark, Zap } from 'lucide-react';

export const PredictionMarketGrid = () => {
  const predictions: PredictionCardProps[] = [
    {
      title: 'What price will Bitcoin hit in 2025?',
      icon: <Bitcoin className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-orange-500',
      options: [
        { label: '↑ 1,000,000', probability: '86%' },
        { label: '↑ 250,000', probability: '20%' },
      ],
      status: 'LIVE',
    },
    {
      title: 'Lighter market cap (FDV) one day after launch?',
      icon: <Rocket className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-blue-600',
      options: [
        { label: '>$1B', probability: '86%' },
        { label: '>$2B', probability: '84%' },
      ],
      volume: '$35m',
    },
    {
      title: 'What price will Ethereum hit in 2025?',
      icon: <Coins className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-blue-400',
      options: [
        { label: '$17,000', probability: '16%' },
        { label: '$14,000', probability: '86%' },
      ],
      status: 'LIVE',
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
      iconBgColor: 'bg-blue-700',
      options: [
        { label: 'December 31, 2025', probability: '86%' },
        { label: 'December 30, 2025', probability: '86%' },
      ],
      volume: '$12m',
    },
    {
      title: 'What price will Ethereum hit in 2026?',
      icon: <Coins className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-blue-400',
      options: [
        { label: '$100,000', probability: '86%' },
        { label: '$80,000', probability: '86%' },
      ],
      status: 'LIVE',
    },
    {
      title: 'Will Solana reach $500 in 2025?',
      icon: <Zap className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-purple-600',
      probability: '42%',
      volume: '$8m',
    },
    {
      title: 'US crypto regulation clarity by __?',
      icon: <Shield className="w-5 h-5 text-white" />,
      iconBgColor: 'bg-green-600',
      options: [
        { label: 'June 30, 2025', probability: '68%' },
        { label: 'December 31, 2025', probability: '82%' },
      ],
      volume: '$15m',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-12">
      {predictions.map((prediction, index) => (
        <PredictionCard key={index} {...prediction} />
      ))}
    </div>
  );
};

