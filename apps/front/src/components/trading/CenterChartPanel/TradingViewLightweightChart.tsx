'use client';

import { CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, LineSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const TradingViewLightweightChart = ({ symbol, interval }: { symbol: string, interval: string }) => {
  const { t } = useTranslation();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [ohlc, setOhlc] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    
    // 彻底清空容器
    container.innerHTML = '';

    // 创建图表实例 (v5 API)
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#161b22' },
        horzLines: { color: '#161b22' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          labelBackgroundColor: '#1f2937',
        },
        horzLine: {
          labelBackgroundColor: '#1f2937',
        },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#30363d',
      }
    });

    // 1. K线序列 (Main Series)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2ea043',
      downColor: '#da3633',
      borderVisible: false,
      wickUpColor: '#2ea043',
      wickDownColor: '#da3633',
    });

    // 2. 成交量序列 (Volume)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Set as overlay
    });

    // 将成交量放在底部 20%
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 3. 示例均线 (SMA 20)
    const smaSeries = chart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    // 生成模拟数据
    const candleData = [];
    const volumeData = [];
    const smaData = [];
    
    const now = Math.floor(Date.now() / 1000);
    const step = 900; // 15m
    let lastClose = 87500;

    for (let i = 0; i < 300; i++) {
      const time = (now - (300 - i) * step);
      const open = lastClose + (Math.random() - 0.5) * 100;
      const high = open + Math.random() * 80;
      const low = open - Math.random() * 80;
      const close = low + Math.random() * (high - low);
      
      const timeVal = time as any;
      
      const candle = {
        time: timeVal,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      };
      
      candleData.push(candle);
      
      volumeData.push({
        time: timeVal,
        value: Math.floor(Math.random() * 100000),
        color: close > open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      });

      // Simple SMA calculation
      if (i >= 20) {
        let sum = 0;
        for (let j = 0; j < 20; j++) {
          sum += candleData[i - j].close;
        }
        smaData.push({
          time: timeVal,
          value: Number((sum / 20).toFixed(2)),
        });
      }

      lastClose = close;
    }

    candlestickSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    smaSeries.setData(smaData);
    
    chart.timeScale().fitContent();
    chartRef.current = chart;

    // 初始设置 OHLC 为最后一个点
    const lastCandle = candleData[candleData.length - 1];
    setOhlc(lastCandle);

    // 订阅十字线移动事件
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const data = param.seriesData.get(candlestickSeries);
        if (data) {
          setOhlc(data);
        }
      } else {
        setOhlc(lastCandle);
      }
    });

    const handleResize = () => {
      if (chart && container) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [isMounted]);

  return (
    <div className="w-full h-full bg-[#0d1117] min-h-[500px] relative overflow-hidden">
      {/* Chart Legend / Info Overlay */}
      {ohlc && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] text-white">₿</div>
            <span className="text-[#c9d1d9]">{symbol} {t('chart.perpetual')} · {interval} · OKX</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex gap-1">
              <span className="text-[#8b949e]">{t('chart.ohlc.open')}=</span>
              <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.open.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#8b949e]">{t('chart.ohlc.high')}=</span>
              <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.high.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#8b949e]">{t('chart.ohlc.low')}=</span>
              <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.low.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#8b949e]">{t('chart.ohlc.close')}=</span>
              <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.close.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>
                {(ohlc.close - ohlc.open).toFixed(2)} ({( ((ohlc.close - ohlc.open) / ohlc.open) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs mt-1">
            <div className="flex gap-1">
              <span className="text-[#8b949e]">{t('chart.volume')}</span>
              <span className="text-[#26a69a]">201.94</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toolbar (Optional - like the one on the left in image) */}
      <div className="absolute top-1/4 left-2 z-10 flex flex-col gap-2 bg-[#161b22] border border-[#30363d] p-1 rounded">
        {['+', '-', '✎', '⌗', '○', 'T'].map((tool, i) => (
          <button key={i} className="w-7 h-7 flex items-center justify-center text-[#8b949e] hover:bg-[#30363d] rounded transition-colors">
            {tool}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};
