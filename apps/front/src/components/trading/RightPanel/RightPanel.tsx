'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, ChevronDown, Settings, RotateCcw, AlignJustify, ArrowDownUp, ExternalLink } from 'lucide-react';
import { OrderbookRow } from './components/OrderbookRow';
import { TradeRow } from './components/TradeRow';

export const RightPanel = () => {
  const [tradeTab, setTradeTab] = useState('latest');
  const [isMounted, setIsMounted] = useState(false);
  const sellsRef = useRef<HTMLDivElement>(null);
  
  const [orderbook, setOrderbook] = useState({
    sells: [],
    buys: []
  });

  const [trades, setTrades] = useState([]);

  useEffect(() => {
    setIsMounted(true);
    
    // Generate more initial data to support scrolling
    const initialOrderbook = {
      sells: Array.from({ length: 60 }, (_, i) => ({
        price: (87030.49 + i * 0.05).toFixed(2),
        amount: (Math.random() * 0.1).toFixed(5),
        total: (Math.random() * 10).toFixed(2),
        depth: Math.random() * 100
      })).reverse(), // [High ... Low]
      buys: Array.from({ length: 60 }, (_, i) => ({
        price: (87029.75 - i * 0.05).toFixed(2),
        amount: (Math.random() * 0.1).toFixed(5),
        total: (Math.random() * 10).toFixed(2),
        depth: Math.random() * 100
      })) // [High ... Low]
    };
    
    const initialTrades = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      price: '87029.76',
      amount: (Math.random() * 0.05).toFixed(5),
      time: new Date(Date.now() - i * 1000).toLocaleTimeString('zh-CN', { hour12: false }),
      type: Math.random() > 0.5 ? 'buy' : 'sell'
    }));

    setOrderbook(initialOrderbook);
    setTrades(initialTrades);

    // Initial scroll for Sells to show bottom (best asks)
    if (sellsRef.current) {
      sellsRef.current.scrollTop = sellsRef.current.scrollHeight;
    }

    const interval = setInterval(() => {
      setOrderbook(prev => ({
        sells: prev.sells.map(s => ({
          ...s,
          amount: (parseFloat(s.amount) + (Math.random() - 0.5) * 0.001).toFixed(5),
          depth: Math.min(100, Math.max(5, s.depth + (Math.random() - 0.5) * 10))
        })),
        buys: prev.buys.map(b => ({
          ...b,
          amount: (parseFloat(b.amount) + (Math.random() - 0.5) * 0.001).toFixed(5),
          depth: Math.min(100, Math.max(5, b.depth + (Math.random() - 0.5) * 10))
        }))
      }));

      const newTrade = {
        id: Date.now(),
        price: (87029.76 + (Math.random() - 0.5) * 0.1).toFixed(2),
        amount: (Math.random() * 0.05).toFixed(5),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      };
      setTrades(prev => [newTrade, ...prev.slice(0, 59)]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Effect to scroll sells to bottom on mount/data init
  useEffect(() => {
    if (sellsRef.current) {
      // Small timeout to ensure rendering is complete
      setTimeout(() => {
        if (sellsRef.current) {
          sellsRef.current.scrollTop = sellsRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isMounted]);

  if (!isMounted) return <div className="w-full h-full bg-[#161b22]" />;

  return (
    <div className="w-full h-full bg-[#161b22] border-l border-[#30363d] flex flex-col overflow-hidden text-[#c9d1d9]">
      
      {/* --- MODULE 1: Top Static Info (Fixed Height) --- */}
      <div className="flex-none border-b border-[#30363d]">
        {/* Symbol Header */}
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">BTC/USDT</span>
            <Copy className="w-3 h-3 text-[#8b949e] cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-400 cursor-pointer hover:text-blue-300">
            <span>币安</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-3 pb-2 grid grid-cols-2 gap-y-1 gap-x-4 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#8b949e]">成交额($):</span>
            <span>7159万</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">最高:</span>
            <span>¥87,967.5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">净流入($):</span>
            <span className="text-[#ef4444]">-351万</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">最低:</span>
            <span>¥87,508.52</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-3 pb-2 flex items-center gap-2">
          {['加预警', '加自选', '策略', '简况'].map((label, i) => (
            <button key={i} className="flex-1 bg-[#21262d] border border-[#30363d] rounded py-1 text-[10px] text-[#c9d1d9] hover:bg-[#30363d] hover:border-[#8b949e] transition-all">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* --- MODULE 2: Orderbook (Flex-1, Scrollable) --- */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        {/* Toolbar (Fixed) */}
        <div className="flex-none">
          <div className="px-2 py-1.5 flex items-center justify-between text-[#8b949e]">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <AlignJustify className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <ArrowDownUp className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] cursor-pointer hover:text-[#c9d1d9]">
                <span>2位小数</span>
                <ChevronDown className="w-3 h-3" />
              </div>
              <Settings className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
            </div>
          </div>

          <div className="px-2 py-1 flex items-center justify-between border-t border-[#30363d] bg-[#161b22]">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#c9d1d9] cursor-pointer">
              <span>查看主力挂单情况</span>
              <ChevronDown className="w-3 h-3 -rotate-90" />
            </div>
            <div className="w-6 h-3 bg-[#30363d] rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 w-2 h-2 bg-[#8b949e] rounded-full" />
            </div>
          </div>

          <div className="px-2 py-1 flex items-center gap-4 text-[10px] border-b border-[#30363d]">
            <div className="flex items-center gap-1">
              <span className="text-[#8b949e]">委比:</span>
              <span className="text-[#ef4444]">-0.76%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#8b949e]">委差:</span>
              <span className="text-[#ef4444]">-8.80095</span>
            </div>
          </div>

          <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e]">
            <span className="w-[35%]">价格(USDT)</span>
            <span className="w-[30%] text-right">数量(BTC)</span>
            <span className="w-[35%] text-right pr-1">委托额</span>
          </div>
        </div>

        {/* Independent Scrolling Areas */}
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Sells - Scrollable (Default col + scroll to bottom) */}
          {/* We use standard col layout but force scroll to bottom on mount */}
          <div ref={sellsRef} className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
            {/* Standard Order: High -> Low. We render as is. */}
            {orderbook.sells.map((s, i) => (
              <OrderbookRow key={`sell-${i}`} price={s.price} amount={s.amount} total={s.total} type="sell" depthPercent={s.depth} />
            ))}
          </div>
          
          {/* Current Price Ticker - Fixed */}
          <div className="py-1 px-2 flex items-center justify-between border-y border-[#30363d] bg-[#1c2128] my-0.5 flex-none z-10">
            <div className="flex flex-col">
              <span className="text-base font-bold text-[#22c55e]">87,029.76</span>
              <span className="text-[10px] text-[#8b949e]">$87,029.76</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-[#22c55e] font-semibold">+0.15%</span>
              <span className="text-[10px] text-[#22c55e] font-medium">+135.56</span>
            </div>
          </div>

          {/* Buys - Scrollable (Standard) */}
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
             {/* orderbook.buys is [High -> Low]. Visual: Best Bid at top. Standard flow. */}
            {orderbook.buys.map((b, i) => (
              <OrderbookRow key={`buy-${i}`} price={b.price} amount={b.amount} total={b.total} type="buy" depthPercent={b.depth} />
            ))}
          </div>
        </div>
      </div>

      {/* --- MODULE 3: Trades (Fixed Height at Bottom, Scrollable) --- */}
      <div className="h-[260px] flex flex-col border-t-4 border-[#0d1117] flex-none">
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-2 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex gap-4">
            <button 
              onClick={() => setTradeTab('latest')}
              className={`py-2 text-[11px] font-bold border-b-2 transition-colors ${tradeTab === 'latest' ? 'text-[#c9d1d9] border-[#c9d1d9]' : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'}`}
            >
              最新成交
            </button>
            <button 
              onClick={() => setTradeTab('large')}
              className={`py-2 text-[11px] font-bold border-b-2 transition-colors ${tradeTab === 'large' ? 'text-[#c9d1d9] border-[#c9d1d9]' : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'}`}
            >
              大额成交
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border border-[#30363d] rounded flex items-center justify-center">
                {/* Checkbox mock */}
              </div>
              <span className="text-[10px] text-[#8b949e]">极速</span>
            </div>
            <ArrowDownUp className="w-3 h-3 text-[#8b949e]" />
            <Settings className="w-3 h-3 text-[#8b949e]" />
          </div>
        </div>

        {/* Trade Columns */}
        <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e] bg-[#161b22]">
          <span className="w-[35%]">价格(USDT)</span>
          <span className="w-[30%] text-right">数量(BTC)</span>
          <span className="w-[35%] text-right pr-1">成交时间</span>
        </div>

        {/* Scrollable Trades List */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#161b22]">
          {trades.map((t) => (
            <TradeRow key={t.id} price={t.price} amount={t.amount} time={t.time} type={t.type as 'buy' | 'sell'} />
          ))}
        </div>
      </div>
    </div>
  );
};
