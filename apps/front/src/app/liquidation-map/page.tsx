'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart';
import { LiquidationMapHeader } from '@/components/liquidation-map/LiquidationMapHeader';

const generateMockData = (symbol: string, range: string) => {
  const labels = [];
  const startPrice = symbol === 'BTC' ? 80000 : symbol === 'ETH' ? 2800 : 120;
  const endPrice = symbol === 'BTC' ? 100000 : symbol === 'ETH' ? 3800 : 200;
  const currentPrice = symbol === 'BTC' ? 89083 : symbol === 'ETH' ? 3345 : 168;
  const stepCount = 150;
  const step = (endPrice - startPrice) / stepCount;
  
  for (let i = 0; i <= stepCount; i++) {
    labels.push(Math.round(startPrice + i * step).toString());
  }

  const multiplier = range === '1天' ? 1 : range === '7天' ? 2.5 : 0.5;

  const bybit: number[] = [];
  const okx: number[] = [];
  const binance: number[] = [];
  const dex: number[] = [];

  labels.forEach((label) => {
    const price = Number.parseFloat(label);
    const dist = Math.abs(price - currentPrice);
    
    // Smooth intensity based on distance from current price
    const intensity = Math.max(0, (1 - dist / (currentPrice * 0.15)) * 40 * multiplier * (Math.random() * 0.5 + 0.5));
    
    // Add bars even close to center, but maybe smaller
    const minIntensity = dist < (currentPrice * 0.01) ? intensity * 0.3 : intensity;

    if (intensity > 0) {
      bybit.push(Math.round(minIntensity * 0.2));
      okx.push(Math.round(minIntensity * 0.3));
      binance.push(Math.round(minIntensity * 0.35));
      dex.push(Math.round(minIntensity * 0.15));
    } else {
      bybit.push(0);
      okx.push(0);
      binance.push(0);
      dex.push(0);
    }
  });

  // Calculate Cumulative values starting FROM the center
  const cumulativeLong = Array.from({length: labels.length}).fill(null);
  const cumulativeShort = Array.from({length: labels.length}).fill(null);
  
  const currentIdx = labels.findIndex(l => Math.abs(Number.parseFloat(l) - currentPrice) < 150);

  // Cumulative Long: Sum from center towards LEFT (lower prices)
  // Start with 0 at the current price
  let longSum = 0;
  cumulativeLong[currentIdx] = 0;
  for (let i = currentIdx - 1; i >= 0; i--) {
    const barTotal = (bybit[i] + okx[i] + binance[i] + dex[i]);
    longSum += barTotal * 0.15;
    cumulativeLong[i] = longSum;
  }

  // Cumulative Short: Sum from center towards RIGHT (higher prices)
  // Start with 0 at the current price
  let shortSum = 0;
  cumulativeShort[currentIdx] = 0;
  for (let i = currentIdx + 1; i < labels.length; i++) {
    const barTotal = (bybit[i] + okx[i] + binance[i] + dex[i]);
    shortSum += barTotal * 0.15;
    cumulativeShort[i] = shortSum;
  }

  return { labels, bybit, okx, binance, dex, cumulativeLong, cumulativeShort };
};

export default function LiquidationMapPage() {
  const [symbol, setSymbol] = useState('BTC');
  const [range, setRange] = useState('1天');
  const [currentPrice, setCurrentPrice] = useState(89083);
  const [data, setData] = useState(() => generateMockData('BTC', '1天'));

  useEffect(() => {
    let newPrice = 89083;
    if (symbol === 'BTC') newPrice = 89083;
    else if (symbol === 'ETH') newPrice = 3345;
    else newPrice = 168;
    
    setCurrentPrice(newPrice);
    setData(generateMockData(symbol, range));
  }, [symbol, range]);

  const handleRefresh = () => {
    setData(generateMockData(symbol, range));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <LiquidationMapHeader 
            symbol={symbol} 
            setSymbol={setSymbol} 
            range={range} 
            setRange={setRange} 
            onRefresh={handleRefresh}
          />
          
          <div className="flex flex-col gap-4">
            <LiquidationMapChart data={data} currentPrice={currentPrice} />
          </div>
          
          <footer className="mt-12 pt-8 border-t border-[#30363d] flex justify-between items-center text-[#8b949e] text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20" />
                <span className="text-white font-bold text-lg tracking-tight">Coinflux</span>
              </div>
              <p className="max-w-xs leading-relaxed">
                Your one-stop shop for crypto data aggregation and advanced market analysis.
              </p>
            </div>
            <div className="flex gap-8 font-medium">
              <a href="#" className="hover:text-white transition-colors no-underline">Telegram</a>
              <a href="#" className="hover:text-white transition-colors no-underline">Twitter</a>
              <a href="#" className="hover:text-white transition-colors no-underline">Github</a>
              <a href="#" className="hover:text-white transition-colors no-underline">Docs</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
