'use client';

import * as echarts from 'echarts';
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface DataPoint {
  ts: string;
  value: number;
}

interface PnLTrendChartProps {
  data: DataPoint[];
}

export const PnLTrendChart = ({ data }: PnLTrendChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme()

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const isNegative = data[data.length - 1]?.value < 0;
    const mainColor = isNegative ? '#ef4444' : '#22c55e';
    const areaColorTop = isNegative ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)';
    const areaColorBottom = isNegative ? 'rgba(239, 68, 68, 0)' : 'rgba(34, 197, 94, 0)';
    const axisColor = theme === 'dark' ? '#30363d' : '#cbd5e1'
    const labelColor = theme === 'dark' ? '#94a3b8' : '#475569'
    const tooltipBg = theme === 'dark' ? '#161b22' : '#ffffff'
    const tooltipText = theme === 'dark' ? '#ffffff' : '#0f172a'

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: axisColor,
        textStyle: {
          color: tooltipText,
          fontSize: 12,
        },
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: axisColor,
            type: 'dashed',
          },
          crossStyle: {
            color: axisColor,
            type: 'dashed',
          },
        },
        formatter: (params: any) => {
          const point = params[0];
          const val = point.value;
          const date = point.name;
          return `
            <div style="padding: 4px;">
              <div style="color: ${labelColor}; margin-bottom: 4px;">${date}</div>
              <div style="font-weight: bold; color: ${val >= 0 ? '#4ade80' : '#f87171'}">
                $ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          `;
        },
      },
      grid: {
        top: 20,
        left: 20,
        right: 80,
        bottom: 40,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.ts),
        axisLine: {
          lineStyle: {
            color: axisColor,
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: labelColor,
          fontSize: 12,
          interval: (index) => {
            // Show labels for 00:00 or at regular intervals
            const item = data[index];
            return item.ts.includes(' 00:00') || item.ts.includes(' 12:00');
          },
          formatter: (value: string) => {
            // Example: 2025-12-23 00:00 -> 23
            const match = value.match(/-(\d{2})\s/);
            if (!match) return '';
            return String(Number.parseInt(match[1], 10));
          },
        },
      },
      yAxis: {
        type: 'value',
        position: 'right',
        splitLine: {
          lineStyle: {
            color: axisColor,
            type: 'dashed',
          },
        },
        axisLabel: {
          color: labelColor,
          fontSize: 12,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value.toString();
          },
        },
      },
      series: [
        {
          data: data.map(d => d.value),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 0,
          showSymbol: false,
          emphasis: {
            scale: true,
            itemStyle: {
              color: mainColor,
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          },
          lineStyle: {
            color: mainColor,
            width: 2,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: areaColorTop },
              { offset: 1, color: areaColorBottom },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            data: [{ yAxis: 0, lineStyle: { color: axisColor, type: 'solid' } }],
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [data, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
};


