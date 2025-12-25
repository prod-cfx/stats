'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Settings, Info, ChevronDown, LayoutGrid, LayoutList, List } from 'lucide-react';
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable';
import { DepthChart } from '@/components/aggregated-orderbook/DepthChart';
import { AggregatedOI } from '@/components/aggregated-orderbook/AggregatedOI';
import { AggregatedVolume } from '@/components/aggregated-orderbook/AggregatedVolume';

// Exchange logos (CDN resources used in previous pages)
const EXCHANGE_LOGOS = [
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png', // Binance
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png', // OKX
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png', // Bybit
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/16.png',  // KuCoin
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',  // Gate.io
];

export default function AggregatedOrderBookPage() {
  const [activeTab, setActiveTab] = useState('aggregated-orderbook');
  const [marketType, setMarketType] = useState('futures'); // 'futures' | 'spot'
  const [symbol, setSymbol] = useState('BTC');
  const [rowCount, setRowCount] = useState(20);
  const [displayMode, setDisplayMode] = useState('both'); // 'both' | 'asks' | 'bids'
  const [isMounted, setIsMounted] = useState(false);

  const [orderbook, setOrderbook] = useState({
    asks: [] as any[],
    bids: [] as any[],
    currentPrice: {
      price: '89940.00',
      usdPrice: '89940.00',
      change: '+135.56',
      changePercent: '+0.15%'
    }
  });

  useEffect(() => {
    setIsMounted(true);

    const generateInitialData = () => {
      const midPrice = 89940.00;
      const newAsks = Array.from({ length: rowCount }, (_, i) => {
        const price = (midPrice + (i + 1) * 10).toFixed(2);
        const amount = (Math.random() * 50 + 10).toFixed(4);
        const total = (Math.random() * 500 + 100).toFixed(0);
        return {
          price,
          amount,
          total,
          exchanges: EXCHANGE_LOGOS.slice(0, Math.floor(Math.random() * 3) + 1),
          depthPercent: Math.random() * 80 + 20
        };
      });

      const newBids = Array.from({ length: rowCount }, (_, i) => {
        const price = (midPrice - (i + 1) * 10).toFixed(2);
        const amount = (Math.random() * 50 + 10).toFixed(4);
        const total = (Math.random() * 500 + 100).toFixed(0);
        return {
          price,
          amount,
          total,
          exchanges: EXCHANGE_LOGOS.slice(0, Math.floor(Math.random() * 3) + 1),
          depthPercent: Math.random() * 80 + 20
        };
      });

      setOrderbook({
        asks: newAsks,
        bids: newBids,
        currentPrice: {
          price: midPrice.toFixed(2),
          usdPrice: midPrice.toFixed(2),
          change: '+135.56',
          changePercent: '+0.15%'
        }
      });
    };

    generateInitialData();

    const interval = setInterval(() => {
      setOrderbook(prev => {
        const midPrice = parseFloat(prev.currentPrice.price) + (Math.random() - 0.5) * 2;
        return {
          ...prev,
          currentPrice: {
            ...prev.currentPrice,
            price: midPrice.toFixed(2),
            usdPrice: midPrice.toFixed(2)
          },
          asks: prev.asks.map(a => ({
            ...a,
            amount: (parseFloat(a.amount) + (Math.random() - 0.5) * 0.5).toFixed(4),
            depthPercent: Math.min(100, Math.max(10, a.depthPercent + (Math.random() - 0.5) * 5))
          })),
          bids: prev.bids.map(b => ({
            ...b,
            amount: (parseFloat(b.amount) + (Math.random() - 0.5) * 0.5).toFixed(4),
            depthPercent: Math.min(100, Math.max(10, b.depthPercent + (Math.random() - 0.5) * 5))
          }))
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [rowCount]);

  const depthChartData = useMemo(() => {
    // Generate cumulative data for depth chart
    let bidTotal = 0;
    const bidPoints = orderbook.bids.map(b => {
      bidTotal += parseFloat(b.amount);
      const amount = parseFloat(b.amount);
      return { 
        price: parseFloat(b.price), 
        amount: amount, 
        total: bidTotal,
        exchangeBreakdown: [
          { name: 'Bybit', amount: amount * 0.15, color: '#22c55e' },
          { name: 'Binance', amount: amount * 0.45, color: '#22c55e' },
          { name: 'Bitmex', amount: amount * 0.1, color: '#22c55e' },
          { name: 'OKX', amount: amount * 0.3, color: '#22c55e' },
        ]
      };
    });

    let askTotal = 0;
    const askPoints = orderbook.asks.map(a => {
      askTotal += parseFloat(a.amount);
      const amount = parseFloat(a.amount);
      return { 
        price: parseFloat(a.price), 
        amount: amount, 
        total: askTotal,
        exchangeBreakdown: [
          { name: 'Bybit', amount: amount * 0.15, color: '#ef4444' },
          { name: 'Binance', amount: amount * 0.45, color: '#ef4444' },
          { name: 'Bitmex', amount: amount * 0.1, color: '#ef4444' },
          { name: 'OKX', amount: amount * 0.3, color: '#ef4444' },
        ]
      };
    });

    return { bids: bidPoints, asks: askPoints };
  }, [orderbook]);

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
          
          {/* Top Tabs */}
          <div className="flex border-b border-[#30363d] w-fit">
            {[
              { id: 'aggregated-orderbook', name: '聚合挂单' },
              { id: 'aggregated-oi', name: '聚合持仓量' },
              { id: 'aggregated-volume', name: '聚合成交量' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-8 py-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === tab.id 
                    ? 'text-white border-blue-500 bg-blue-500/5' 
                    : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Main Content Card */}
          {activeTab === 'aggregated-orderbook' ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col min-h-[800px] overflow-hidden shadow-2xl">
              
              {/* Filter Bar */}
              <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#0d1117]/30">
                <div className="flex items-center gap-6">
                  {/* Market Type Switch */}
                  <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-1">
                    <button 
                      onClick={() => setMarketType('futures')}
                      className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${
                        marketType === 'futures' ? 'bg-blue-600 text-white shadow-lg' : 'text-[#8b949e] hover:text-[#e6edf3]'
                      }`}
                    >
                      合约
                    </button>
                    <button 
                      onClick={() => setMarketType('spot')}
                      className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${
                        marketType === 'spot' ? 'bg-blue-600 text-white shadow-lg' : 'text-[#8b949e] hover:text-[#e6edf3]'
                      }`}
                    >
                      现货
                    </button>
                  </div>

                  {/* Symbol Switch */}
                  <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-1">
                    <button 
                      onClick={() => setSymbol('BTC')}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                        symbol === 'BTC' ? 'bg-[#30363d] text-white' : 'text-[#8b949e] hover:text-[#e6edf3]'
                      }`}
                    >
                      BTC
                    </button>
                    <button 
                      onClick={() => setSymbol('ETH')}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                        symbol === 'ETH' ? 'bg-[#30363d] text-white' : 'text-[#8b949e] hover:text-[#e6edf3]'
                      }`}
                    >
                      ETH
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                  <span>24小时成交量: <span className="text-[#e6edf3]">6.82万 BTC</span></span>
                  <span>24小时成交额: <span className="text-[#e6edf3]">¥7159万</span></span>
                </div>
              </div>

              {/* Main Panel Area */}
              <div className="flex-1 flex min-h-0">
                
                {/* Left Column: Orderbook Table */}
                <div className="w-1/2 flex flex-col border-r border-[#30363d]">
                  <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#e6edf3]">{symbol}/USDT 实时订单({marketType === 'futures' ? '合约' : '现货'})</h2>
                    
                    <div className="flex items-center gap-4">
                      {/* Display Mode */}
                      <div className="flex bg-[#0d1117] border border-[#30363d] rounded-md overflow-hidden">
                        <button 
                          onClick={() => setDisplayMode('both')}
                          className={`p-2 transition-colors ${displayMode === 'both' ? 'bg-[#30363d] text-blue-400' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDisplayMode('asks')}
                          className={`p-2 transition-colors ${displayMode === 'asks' ? 'bg-[#30363d] text-red-400' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                        >
                          <LayoutList className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDisplayMode('bids')}
                          className={`p-2 transition-colors ${displayMode === 'bids' ? 'bg-[#30363d] text-green-400' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Row Count */}
                      <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 cursor-pointer hover:border-[#8b949e] transition-all">
                        <span className="text-sm">{rowCount}</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>

                      <Settings className="w-5 h-5 text-[#8b949e] cursor-pointer hover:text-white transition-colors" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <OrderbookTable 
                      asks={orderbook.asks} 
                      bids={orderbook.bids} 
                      currentPrice={orderbook.currentPrice}
                    />
                  </div>
                </div>

                {/* Right Column: Depth Chart */}
                <div className="w-1/2 flex flex-col">
                  <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#e6edf3]">订单深度</h2>
                    <div className="flex items-center gap-2 text-yellow-500 cursor-pointer hover:opacity-80 transition-all">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">流动性热力图</span>
                    </div>
                  </div>

                  <div className="flex-1 p-4 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <DepthChart 
                        bids={depthChartData.bids} 
                        asks={depthChartData.asks} 
                      />
                    </div>
                    
                    {/* Legend/Labels */}
                    <div className="flex items-center justify-between mt-4 text-xs text-[#8b949e]">
                      <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500/50 rounded-sm" />
                          <span>买单累计</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500/50 rounded-sm" />
                          <span>卖单累计</span>
                        </div>
                      </div>
                      <span>单位: BTC</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : activeTab === 'aggregated-oi' ? (
            <AggregatedOI />
          ) : activeTab === 'aggregated-volume' ? (
            <AggregatedVolume />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#161b22] border border-[#30363d] rounded-xl min-h-[600px]">
              <div className="flex flex-col items-center gap-4 text-[#8b949e]">
                <LayoutGrid className="w-12 h-12 opacity-20" />
                <p>功能开发中...</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

