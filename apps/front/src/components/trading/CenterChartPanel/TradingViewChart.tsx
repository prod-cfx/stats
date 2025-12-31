'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const LightweightChart = dynamic(
  () => import('./TradingViewLightweightChart').then(mod => mod.TradingViewLightweightChart),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-[#0d1117] text-[#8b949e]">
        加载图表引擎...
      </div>
    )
  }
);

interface TradingViewChartProps {
  symbol: string;
  interval: string;
}

/**
 * Stable wrapper for the trading chart.
 * TODO: Replace Lightweight Charts with TradingView Charting Library once license is approved.
 */
export const TradingViewChart = (props: TradingViewChartProps) => {
  return <LightweightChart {...props} />;
};
