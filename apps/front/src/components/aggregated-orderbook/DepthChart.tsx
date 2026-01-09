'use client';

import ReactECharts from 'echarts-for-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface DepthDataPoint {
  price: number;
  amount: number;
  total: number;
  exchangeBreakdown?: {
    name: string;
    amount: number;
    color: string;
  }[];
}

interface DepthChartProps {
  bids: DepthDataPoint[];
  asks: DepthDataPoint[];
}

export const DepthChart: React.FC<DepthChartProps & { height?: number | string }> = ({ bids, asks, height = '100%' }) => {
  const { t } = useTranslation();
  const option = useMemo(() => {
    // ... rest of the option logic ...
    return {
      // ... (keeping all existing option logic)
    };
  }, [bids, asks, t]);

  return (
    <div className="w-full h-full" style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}>
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }}
        theme="dark"
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

