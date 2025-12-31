'use client';

import { Check, Info, LayoutGrid, Settings } from 'lucide-react';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AggregatedOI } from '@/components/aggregated-orderbook/AggregatedOI';
import { AggregatedVolume } from '@/components/aggregated-orderbook/AggregatedVolume';
import { DepthChart } from '@/components/aggregated-orderbook/DepthChart';
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable';
import { Navbar } from '@/components/layout/Navbar';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle, SectionTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';

const EXCHANGE_LOGOS = [
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/16.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',
];

const FUTURES_EXCHANGES = ['bybit', 'binance', 'bitmex', 'okx', 'hype'];
const SPOT_EXCHANGES = ['binance', 'okx', 'hype'];

const BothIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? "white" : "#ef4444"} strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 7H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 10H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 13H14" stroke={active ? "white" : "#22c55e"} strokeWidth="2" strokeLinecap="round"/>
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? "white" : "#ef4444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? "white" : "#22c55e"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BidsIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 7H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 10H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 13H14" stroke={active ? "white" : "#22c55e"} strokeWidth="2" strokeLinecap="round"/>
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? "white" : "#22c55e"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AsksIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? "white" : "#ef4444"} strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 7H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 10H10" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M2 13H14" stroke={active ? "white" : "#8b949e"} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? "white" : "#ef4444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function AggregatedOrderBookContent() {
  const [activeTab, setActiveTab] = useState('aggregated-orderbook');
  const [marketType, setMarketType] = useState('futures');
  const [symbol, setSymbol] = useState('BTC');
  const [rowCount, setRowCount] = useState('10');
  const [displayMode, setDisplayMode] = useState('both');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(FUTURES_EXCHANGES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Update selected exchanges when market type changes
  useEffect(() => {
    setSelectedExchanges(marketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES);
  }, [marketType]);

  // Click outside to close settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExchange = (ex: string) => {
    setSelectedExchanges(prev => 
      prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex]
    );
  };

  const { data: orderbook, loading, error, reload } = useMockData(
    async () => {
      const midPrice = symbol === 'BTC' ? 89940.00 : 3345.00;
      const count = 100; // Generate up to 100 rows internally
      const depthLevel = Number.parseInt(rowCount, 10) || 10;
      // Price step grows with depth level to simulate aggregation.
      // (e.g. 1 -> fine-grained, 10 -> medium, 100 -> coarse)
      const priceStep = 10 * depthLevel;
      
      const generateRows = (isAsk: boolean) => Array.from({ length: count }, (_, i) => {
        const price = (midPrice + (isAsk ? 1 : -1) * (i + 1) * priceStep).toFixed(2);
        const amount = (Math.random() * 50 + 10).toFixed(4);
        const total = (Math.random() * 500 + 100).toFixed(0);
        return {
          price,
          amount,
          total,
          exchanges: EXCHANGE_LOGOS.slice(0, Math.min(selectedExchanges.length, 3)),
          depthPercent: Math.random() * 80 + 20
        };
      });

      return {
        asks: generateRows(true),
        bids: generateRows(false),
        currentPrice: {
          price: midPrice.toFixed(2),
          usdPrice: midPrice.toFixed(2),
          change: '+135.56',
          changePercent: '+0.15%'
        }
      };
    },
    [symbol, marketType, rowCount, selectedExchanges]
  );

  const depthChartData = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [] };
    let bidTotal = 0;
    const bidPoints = orderbook.bids.map(b => {
      bidTotal += Number.parseFloat(b.amount);
      const amount = Number.parseFloat(b.amount);
      return { 
        price: Number.parseFloat(b.price), 
        amount, 
        total: bidTotal,
        exchangeBreakdown: selectedExchanges.length > 0 ? selectedExchanges.map(ex => ({
          name: ex,
          amount: amount / selectedExchanges.length,
          color: '#22c55e'
        })) : []
      };
    });

    let askTotal = 0;
    const askPoints = orderbook.asks.map(a => {
      askTotal += Number.parseFloat(a.amount);
      const amount = Number.parseFloat(a.amount);
      return { 
        price: Number.parseFloat(a.price), 
        amount, 
        total: askTotal,
        exchangeBreakdown: selectedExchanges.length > 0 ? selectedExchanges.map(ex => ({
          name: ex,
          amount: amount / selectedExchanges.length,
          color: '#ef4444'
        })) : []
      };
    });

    return { bids: bidPoints, asks: askPoints };
  }, [orderbook, selectedExchanges]);

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageTitle>聚合挂单数据</PageTitle>
        <BodyText>全网深度及订单流聚合分析</BodyText>
      </div>
      
      <div className="flex border-b border-[#30363d] w-fit">
        {[
          { id: 'aggregated-orderbook', name: '聚合挂单' },
          { id: 'aggregated-oi', name: '聚合持仓量' },
          { id: 'aggregated-volume', name: '聚合成交量' }
        ].map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-3 text-sm font-semibold transition-all relative ${
              activeTab === tab.id 
                ? 'text-white' 
                : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
            }`}
          >
            {tab.name}
            {activeTab === tab.id && (
              <>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
              </>
            )}
          </button>
        ))}
      </div>

      <div className="relative min-h-[750px]">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          {activeTab === 'aggregated-orderbook' && orderbook ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col min-h-[750px] overflow-hidden shadow-2xl animate-in fade-in duration-500">
              <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#0d1117]/30 flex-none">
                <div className="flex items-center gap-6">
                  <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-1">
                    <button type="button" onClick={() => setMarketType('futures')} className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${marketType === 'futures' ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}>合约</button>
                    <button type="button" onClick={() => setMarketType('spot')} className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${marketType === 'spot' ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}>现货</button>
                  </div>
                  <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-1">
                    <button type="button" onClick={() => setSymbol('BTC')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${symbol === 'BTC' ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}>BTC</button>
                    <button type="button" onClick={() => setSymbol('ETH')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${symbol === 'ETH' ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}>ETH</button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                  <span>24小时成交量: <span className="text-[#e6edf3]">6.82万 BTC</span></span>
                  <span>24小时成交额: <span className="text-[#e6edf3]">¥7159万</span></span>
                </div>
              </div>
              <div className="flex-1 flex min-h-0">
                <div className="w-1/2 flex flex-col border-r border-[#30363d]">
                  <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/20 flex-none">
                    <SectionTitle className="text-lg">{symbol}/USDT 实时订单({marketType === 'futures' ? '合约' : '现货'})</SectionTitle>
                    <div className="flex items-center gap-4">
                      <div className="flex bg-[#0d1117] border border-[#30363d] rounded-md overflow-hidden p-1">
                        <button 
                          type="button" 
                          onClick={() => setDisplayMode('both')} 
                          className={`p-2 transition-all rounded relative ${displayMode === 'both' ? 'text-white' : 'hover:bg-white/5'}`}
                        >
                          {displayMode === 'both' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                          <div className="relative z-10"><BothIcon active={displayMode === 'both'} /></div>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setDisplayMode('bids')} 
                          className={`p-2 transition-all rounded relative ${displayMode === 'bids' ? 'text-white' : 'hover:bg-white/5'}`}
                        >
                          {displayMode === 'bids' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                          <div className="relative z-10"><BidsIcon active={displayMode === 'bids'} /></div>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setDisplayMode('asks')} 
                          className={`p-2 transition-all rounded relative ${displayMode === 'asks' ? 'text-white' : 'hover:bg-white/5'}`}
                        >
                          {displayMode === 'asks' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                          <div className="relative z-10"><AsksIcon active={displayMode === 'asks'} /></div>
                        </button>
                      </div>
                      
                      <FilterButton 
                        value={rowCount} 
                        options={['1', '10', '100']} 
                        onChange={setRowCount} 
                        minWidth="70px" 
                      />

                      <div className="relative" ref={settingsRef}>
                        <button 
                          type="button" 
                          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                          className={`p-2 rounded-md transition-all active:scale-95 ${
                            isSettingsOpen 
                              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' 
                              : 'text-[#8b949e] hover:text-white hover:bg-[#30363d]'
                          }`}
                        >
                          <Settings className="w-5 h-5" />
                        </button>

                        {isSettingsOpen && (
                          <div className="absolute top-full right-0 mt-2 w-48 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-2">
                            <p className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider px-2 py-1 mb-1">交易所来源</p>
                            {(marketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES).map(ex => (
                              <button
                                key={ex}
                                type="button"
                                onClick={() => toggleExchange(ex)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-white/5 group text-left"
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                  selectedExchanges.includes(ex) 
                                    ? 'bg-primary border-primary' 
                                    : 'border-[#30363d] group-hover:border-[#8b949e]'
                                }`}>
                                  {selectedExchanges.includes(ex) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className={`text-sm capitalize ${
                                  selectedExchanges.includes(ex) ? 'text-white font-medium' : 'text-[#8b949e]'
                                }`}>
                                  {ex}
                                </span>
                              </button>
                            ))}
                            <div className="mt-2 pt-2 border-t border-[#30363d] flex justify-center">
                              <button 
                                type="button"
                                onClick={() => { setIsSettingsOpen(false); reload(); }}
                                className="text-[10px] font-bold text-primary hover:underline"
                              >
                                应用更改
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <OrderbookTable asks={orderbook.asks} bids={orderbook.bids} currentPrice={orderbook.currentPrice} displayMode={displayMode as any} />
                  </div>
                </div>
                <div className="w-1/2 flex flex-col min-h-0">
                  <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/20 flex-none">
                    <SectionTitle className="text-lg">订单深度</SectionTitle>
                    <div className="flex items-center gap-2 text-yellow-500 cursor-help hover:opacity-80 transition-all">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">流动性热力图</span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 p-4 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <DepthChart bids={depthChartData.bids} asks={depthChartData.asks} />
                    </div>
                    <div className="flex items-center justify-between mt-4 text-xs text-[#8b949e] flex-none">
                      <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm" /><span>买单累计</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/50 rounded-sm" /><span>卖单累计</span></div>
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
        </LoadingState>
      </div>
    </div>
  );
}

export default function AggregatedOrderBookPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">加载中...</div>}>
          <AggregatedOrderBookContent />
        </Suspense>
      </main>
    </div>
  );
}
