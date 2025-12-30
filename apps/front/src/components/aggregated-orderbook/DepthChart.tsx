'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

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

export const DepthChart: React.FC<DepthChartProps> = ({ bids, asks }) => {
  const option = useMemo(() => {
    // Sort data for depth chart
    const sortedBids = [...bids].sort((a, b) => a.price - b.price); // Low to High for bids
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price); // Low to High for asks

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#30363d',
            width: 1,
            type: 'dashed'
          }
        },
        backgroundColor: '#f0f2f5',
        borderColor: '#d1d5db',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#1f2937',
          fontFamily: 'Inter, sans-serif'
        },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (params: any) => {
          const bidIdx = params.findIndex((p: any) => p.seriesName === 'Bids');
          const askIdx = params.findIndex((p: any) => p.seriesName === 'Asks');
          
          let dataPoint: DepthDataPoint | undefined;
          let isBid = false;

          if (bidIdx !== -1) {
            dataPoint = sortedBids[params[bidIdx].dataIndex];
            isBid = true;
          } else if (askIdx !== -1) {
            dataPoint = sortedAsks[params[askIdx].dataIndex];
            isBid = false;
          }

          if (!dataPoint) return '';
          
          const breakdown = dataPoint.exchangeBreakdown || [
            { name: 'Binance', amount: dataPoint.amount * 0.4, color: isBid ? '#22c55e' : '#ef4444' },
            { name: 'OKX', amount: dataPoint.amount * 0.3, color: isBid ? '#22c55e' : '#ef4444' },
            { name: 'Bybit', amount: dataPoint.amount * 0.2, color: isBid ? '#22c55e' : '#ef4444' },
            { name: 'Bitget', amount: dataPoint.amount * 0.1, color: isBid ? '#22c55e' : '#ef4444' },
          ];

          let breakdownHtml = breakdown.map(ex => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 40px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${ex.color};"></div>
                <span style="color: #4b5563; font-weight: 500;">${ex.name}</span>
              </div>
              <span style="font-weight: 600; color: #111827;">${ex.amount.toFixed(2)} BTC</span>
            </div>
          `).join('');

          return `
            <div style="min-width: 200px;">
              <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: #111827;">${dataPoint.price.toFixed(2)}</div>
              ${breakdownHtml}
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #4b5563; font-weight: 600;">总计</span>
                <span style="font-weight: 700; color: #111827;">${dataPoint.total.toFixed(2)} BTC</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '8%',
        top: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: '#30363d', type: 'dashed' }
        },
        axisLabel: {
          color: '#8b949e',
          fontSize: 10,
          formatter: (value: number) => value.toLocaleString()
        },
        min: 'dataMin',
        max: 'dataMax'
      },
      yAxis: {
        type: 'value',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: '#30363d', type: 'dashed' }
        },
        axisLabel: {
          color: '#8b949e',
          fontSize: 10
        }
      },
      series: [
        {
          name: 'Bids',
          type: 'line',
          step: 'end',
          data: sortedBids.map(b => [b.price, b.total]),
          symbol: 'none',
          lineStyle: { width: 2, color: '#22c55e' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
                { offset: 1, color: 'rgba(34, 197, 94, 0)' }
              ]
            }
          }
        },
        {
          name: 'Asks',
          type: 'line',
          step: 'start',
          data: sortedAsks.map(a => [a.price, a.total]),
          symbol: 'none',
          lineStyle: { width: 2, color: '#ef4444' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
                { offset: 1, color: 'rgba(239, 68, 68, 0)' }
              ]
            }
          }
        }
      ]
    };
  }, [bids, asks]);

  return (
    <div className="w-full h-full min-h-[400px]">
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

