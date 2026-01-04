'use client';

import { AlignJustify, ArrowDownUp, ChevronDown, Copy, ExternalLink, RotateCcw, Settings } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/loading';
import { OrderbookRow } from './components/OrderbookRow';
import { TradeRow } from './components/TradeRow';

export const RightPanel = () => {
  const { t, i18n } = useTranslation();
  const [tradeTab, setTradeTab] = useState('latest');
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const sellsRef = useRef<HTMLDivElement>(null);
  
  const [orderbook, setOrderbook] = useState({
    sells: [] as any[],
    buys: [] as any[]
  });

  const [trades, setTrades] = useState([] as any[]);

  useEffect(() => {
    setIsMounted(true);
    setLoading(true);
    
    // Simulate initial loading: 1200-2000ms
    setTimeout(() => {
      const initialOrderbook = {
        sells: Array.from({ length: 60 }, (_, i) => ({
          price: (87030.49 + i * 0.05).toFixed(2),
          amount: (Math.random() * 0.1).toFixed(5),
          total: (Math.random() * 10).toFixed(2),
          depth: Math.random() * 100
        })).reverse(),
        buys: Array.from({ length: 60 }, (_, i) => ({
          price: (87029.75 - i * 0.05).toFixed(2),
          amount: (Math.random() * 0.1).toFixed(5),
          total: (Math.random() * 10).toFixed(2),
          depth: Math.random() * 100
        }))
      };
      
      const initialTrades = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        price: '87029.76',
        amount: (Math.random() * 0.05).toFixed(5),
        time: new Date(Date.now() - i * 1000).toLocaleTimeString(
          i18n.language === 'zh' ? 'zh-CN' : 'en-US',
          { hour12: false }
        ),
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      }));

      setOrderbook(initialOrderbook);
      setTrades(initialTrades);
      setLoading(false);
    }, 1500);

    const interval = setInterval(() => {
      setOrderbook(prev => ({
        sells: prev.sells.map(s => ({
          ...s,
          amount: (Number.parseFloat(s.amount) + (Math.random() - 0.5) * 0.001).toFixed(5),
          depth: Math.min(100, Math.max(5, s.depth + (Math.random() - 0.5) * 10))
        })),
        buys: prev.buys.map(b => ({
          ...b,
          amount: (Number.parseFloat(b.amount) + (Math.random() - 0.5) * 0.001).toFixed(5),
          depth: Math.min(100, Math.max(5, b.depth + (Math.random() - 0.5) * 10))
        }))
      }));

      const newTrade = {
        id: Date.now(),
        price: (87029.76 + (Math.random() - 0.5) * 0.1).toFixed(2),
        amount: (Math.random() * 0.05).toFixed(5),
        time: new Date().toLocaleTimeString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }),
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      };
      setTrades(prev => [newTrade, ...prev.slice(0, 59)]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && sellsRef.current) {
      sellsRef.current.scrollTop = sellsRef.current.scrollHeight;
    }
  }, [loading]);

  const handleTabChange = (tab: string) => {
    if (tab === tradeTab) return;
    setLoading(true);
    setTradeTab(tab);
    // Tab switching loading: 600-1000ms
    setTimeout(() => setLoading(false), 800);
  };

  if (!isMounted) return null;

  return (
    <div className="w-full h-full bg-[#161b22] border-l border-[#30363d] rounded-xl flex flex-col overflow-hidden text-[#c9d1d9] relative">
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#161b22]/80 backdrop-blur-sm">
          <Spinner size="md" className="text-primary" />
        </div>
      )}

      {/* --- MODULE 1: Top Static Info --- */}
      <div className="flex-none border-b border-[#30363d]">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">BTC/USDT</span>
            <Copy className="w-3 h-3 text-[#8b949e] cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
            <span>{t('rightPanel.exchangeBinance')}</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        <div className="px-3 pb-2 grid grid-cols-2 gap-y-1 gap-x-4 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#8b949e]">{t('rightPanel.turnoverUsd')}:</span>
            <span>7159万</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">{t('rightPanel.high')}:</span>
            <span>¥87,967.5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">{t('rightPanel.netInflowUsd')}:</span>
            <span className="text-red-400">-351万</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">{t('rightPanel.low')}:</span>
            <span>¥87,508.52</span>
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center gap-2">
          {[
            t('rightPanel.addAlert'),
            t('rightPanel.addWatchlist'),
            t('rightPanel.strategy'),
            t('rightPanel.overview'),
          ].map((label, i) => (
            <button key={i} type="button" className="flex-1 bg-[#21262d] border border-[#30363d] rounded py-1 text-[10px] text-[#c9d1d9] hover:bg-[#30363d] transition-all">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* --- MODULE 2: Orderbook --- */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="flex-none">
          <div className="px-2 py-1.5 flex items-center justify-between text-[#8b949e]">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <AlignJustify className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <ArrowDownUp className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] cursor-pointer hover:text-[#c9d1d9]">
                <span>{t('rightPanel.decimalPlaces', { count: 2 })}</span>
                <ChevronDown className="w-3 h-3" />
              </div>
              <Settings className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
            </div>
          </div>

          <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e]">
            <span className="w-[35%]">{t('rightPanel.price')}</span>
            <span className="w-[30%] text-right">{t('rightPanel.amount')}</span>
            <span className="w-[35%] text-right pr-1">{t('rightPanel.orderValue')}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div ref={sellsRef} className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
            {orderbook.sells.map((s, i) => (
              <OrderbookRow key={`sell-${i}`} price={s.price} amount={s.amount} total={s.total} type="sell" depthPercent={s.depth} />
            ))}
          </div>
          
          <div className="py-1 px-2 flex items-center justify-between border-y border-[#30363d] bg-[#1c2128] my-0.5 flex-none z-10">
            <div className="flex flex-col">
              <span className="text-base font-bold text-green-400">87,029.76</span>
              <span className="text-[10px] text-[#8b949e]">$87,029.76</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-green-400 font-semibold">+0.15%</span>
              <span className="text-[10px] text-green-400 font-medium">+135.56</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
            {orderbook.buys.map((b, i) => (
              <OrderbookRow key={`buy-${i}`} price={b.price} amount={b.amount} total={b.total} type="buy" depthPercent={b.depth} />
            ))}
          </div>
        </div>
      </div>

      {/* --- MODULE 3: Trades --- */}
      <div className="h-[260px] flex flex-col border-t-4 border-[#0d1117] flex-none">
        <div className="flex items-center justify-between px-2 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex gap-4">
            {['latest', 'large'].map(id => (
              <button 
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`py-2 text-[11px] font-bold border-b-2 transition-colors relative ${tradeTab === id ? 'text-white border-primary' : 'text-[#8b949e] border-transparent hover:text-white'}`}
              >
                {id === 'latest' ? t('rightPanel.latestTrades') : t('rightPanel.largeTrades')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-3.5 h-3.5 text-[#8b949e] cursor-pointer hover:text-white" />
            <Settings className="w-3.5 h-3.5 text-[#8b949e] cursor-pointer hover:text-white" />
          </div>
        </div>

        <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e] bg-[#161b22]">
          <span className="w-[35%]">{t('rightPanel.price')}</span>
          <span className="w-[30%] text-right">{t('rightPanel.amount')}</span>
          <span className="w-[35%] text-right pr-1">{t('rightPanel.tradeTime')}</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#161b22]">
          {trades.map((t) => (
            <TradeRow key={t.id} price={t.price} amount={t.amount} time={t.time} type={t.type as 'buy' | 'sell'} />
          ))}
        </div>
      </div>
    </div>
  );
};
