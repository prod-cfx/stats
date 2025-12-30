'use client';

import * as echarts from 'echarts';
import React, { useEffect, useRef } from 'react';

interface LiquidationMapChartProps {
  data: {
    labels: string[];
    bybit: number[];
    okx: number[];
    binance: number[];
    dex: number[];
    cumulativeLong: (number | null)[];
    cumulativeShort: (number | null)[];
  };
  currentPrice: number;
}

export const LiquidationMapChart = ({ data, currentPrice }: LiquidationMapChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    
    const colors = {
      bybit: '#36b8c9',
      okx: '#f7d05e',
      binance: '#f08024',
      dex: '#bf5af2',
      cumLongLine: '#ff4d4d',
      cumShortLine: '#00c076',
      currentPrice: '#ff4d4d'
    };

    // Find the closest index to current price
    let currentPriceIndex = 0;
    let minDiff = Infinity;
    data.labels.forEach((label, index) => {
      const priceVal = Number.parseFloat(label);
      const diff = Math.abs(priceVal - currentPrice);
      if (diff < minDiff) {
        minDiff = diff;
        currentPriceIndex = index;
      }
    });

    const option = {
      backgroundColor: '#0d1117',
      tooltip: {
        trigger: 'axis',
        axisPointer: { 
          type: 'none'
        },
        backgroundColor: 'rgba(22, 27, 34, 0.95)',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: any) => {
          let res = `<div style="font-weight: bold; margin-bottom: 4px;">价格: ${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            if (item.value === 0 || item.value === undefined || item.value === null) return;
            const valueStr = item.seriesName.includes('累计') 
              ? `$${item.value.toFixed(2)}B` 
              : `$${item.value}M`;
            res += `
              <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-bottom: 2px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: ${item.color};"></span>
                  <span>${item.seriesName}</span>
                </div>
                <span style="font-weight: bold;">${valueStr}</span>
              </div>`;
          });
          return res;
        }
      },
      legend: {
        data: ['Bybit', 'OKX', 'Binance', 'DEX', '累计多单清算', '累计空单清算'],
        top: 20,
        textStyle: { color: '#8b949e', fontSize: 11 },
        icon: 'rect',
        itemWidth: 12,
        itemHeight: 8
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '12%',
        top: '15%',
        containLabel: true
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 10,
          height: 20,
          borderColor: 'transparent',
          backgroundColor: '#161b22',
          fillerColor: 'rgba(59, 130, 246, 0.1)',
          handleIcon: 'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
          handleSize: '80%',
          handleStyle: {
            color: '#30363d',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            shadowOffsetX: 2,
            shadowOffsetY: 2
          },
          textStyle: { color: '#8b949e' },
          selectedDataBackground: {
            lineStyle: { color: '#3b82f6' },
            areaStyle: { color: '#3b82f6' }
          },
          brushSelect: false
        }
      ],
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#8b949e', fontSize: 10, interval: 10 },
        splitLine: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#1c2128', type: 'dashed' } },
          axisLabel: { 
            color: '#8b949e', 
            fontSize: 10,
            formatter: (value: number) => `$${value}M`
          }
        },
        {
          type: 'value',
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: { 
            color: '#8b949e', 
            fontSize: 10,
            formatter: (value: number) => `$${value}B`
          }
        }
      ],
      series: [
        {
          name: 'Bybit',
          type: 'bar',
          stack: 'total',
          data: data.bybit,
          itemStyle: { color: colors.bybit },
          barWidth: '80%',
          z: 5
        },
        {
          name: 'OKX',
          type: 'bar',
          stack: 'total',
          data: data.okx,
          itemStyle: { color: colors.okx },
          z: 5
        },
        {
          name: 'Binance',
          type: 'bar',
          stack: 'total',
          data: data.binance,
          itemStyle: { color: colors.binance },
          z: 5
        },
        {
          name: 'DEX',
          type: 'bar',
          stack: 'total',
          data: data.dex,
          itemStyle: { color: colors.dex },
          z: 5,
          markLine: {
            silent: true,
            symbol: ['none', 'arrow'],
            symbolSize: [0, 15],
            lineStyle: {
              color: colors.currentPrice,
              type: 'dashed',
              width: 2,
              opacity: 1
            },
            label: {
              show: true,
              position: 'end',
              distance: 10,
              formatter: `{label|当前价格: }{value|${  currentPrice.toLocaleString()  }}`,
              rich: {
                label: {
                  color: '#e6edf3',
                  fontSize: 11
                },
                value: {
                  color: '#ff4d4d',
                  fontSize: 11,
                  fontWeight: 'bold'
                }
              },
              backgroundColor: '#161b22',
              borderColor: '#30363d',
              borderWidth: 1,
              borderRadius: 4,
              padding: [4, 8]
            },
            data: [
              [
                { 
                  xAxis: currentPriceIndex, 
                  yAxis: 0 // Start exactly at the bottom axis, no protrusion
                },
                { 
                  xAxis: currentPriceIndex, 
                  y: '15%' // End at the top grid area
                }
              ]
            ],
            z: 100
          }
        },
        {
          name: '累计多单清算',
          type: 'line',
          yAxisIndex: 1,
          data: data.cumulativeLong,
          smooth: 0.4,
          symbol: 'none',
          lineStyle: { color: colors.cumLongLine, width: 2 },
          itemStyle: { color: colors.cumLongLine },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255, 77, 77, 0.2)' },
              { offset: 1, color: 'rgba(255, 77, 77, 0)' }
            ])
          },
          z: 10
        },
        {
          name: '累计空单清算',
          type: 'line',
          yAxisIndex: 1,
          data: data.cumulativeShort,
          smooth: 0.4,
          symbol: 'none',
          lineStyle: { color: colors.cumShortLine, width: 2 },
          itemStyle: { color: colors.cumShortLine },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 192, 118, 0.2)' },
              { offset: 1, color: 'rgba(0, 192, 118, 0)' }
            ])
          },
          z: 10
        }
      ]
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [data, currentPrice]);

  return (
    <div className="relative w-full h-[600px] bg-[#0d1117] border border-[#30363d] rounded-lg p-2">
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
};
