'use client';

import type { DataSource, MarketType } from '@/types/trading';
import { AlignJustify, ArrowDownUp, ChevronDown, Copy, ExternalLink, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/loading';
import { getMockBasePrice, getMockTickSize } from '@/lib/mock/market';
import { OrderbookRow } from './components/OrderbookRow';
import { TradeRow } from './components/TradeRow';

function formatHmsUtc(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getBaseAssetFromSymbol(symbol: string | undefined | null) {
  if (!symbol) return 'BTC'; // 默认值
  // spot display may be "BTC/USDT"; internal may be "BTCUSDT"
  if (symbol.includes('/'))
    return symbol.split('/')[0] || symbol;
  if (symbol.endsWith('USDT'))
    return symbol.slice(0, -4);
  return symbol;
}

function hashStringToSeed(input: string | undefined | null) {
  const s = input || 'BTCUSDT';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RightPanelProps {
  isAggregated: boolean;
  selectedExchange: DataSource;
  symbol: string;
  marketType: MarketType;
}

export const RightPanel = ({ isAggregated, selectedExchange, symbol, marketType }: RightPanelProps) => {
  const { t, i18n } = useTranslation();
  const [tradeTab, setTradeTab] = useState('latest');
  const [loading, setLoading] = useState(false);
  const sellsRef = useRef<HTMLDivElement>(null);
  const decimalMenuRef = useRef<HTMLDivElement>(null);
  const tabLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tabLoadingTimeoutRef.current) {
        clearTimeout(tabLoadingTimeoutRef.current);
        tabLoadingTimeoutRef.current = null;
      }
    };
  }, []);
  // Precision definition:
  //  2 => 0.01, 1 => 0.1, 0 => 1, -1 => 10, -2 => 100
  const [pricePrecision, setPricePrecision] = useState<number>(2);
  const [isDecimalMenuOpen, setIsDecimalMenuOpen] = useState(false);
  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
  const baseAsset = getBaseAssetFromSymbol(symbol).toUpperCase()

  const fractionDigits = pricePrecision >= 0 ? pricePrecision : 0;
  const precisionStep = useMemo(() => {
    return pricePrecision >= 0 ? 10 ** (-pricePrecision) : 10 ** (-pricePrecision);
  }, [pricePrecision]);

  const roundToStep = useCallback((v: number) => {
    const step = precisionStep;
    return Math.round(v / step) * step;
  }, [precisionStep]);

  const createDeterministicMock = useMemo(() => {
    const seedKey = `${symbol}:${marketType}:${isAggregated ? 'agg' : selectedExchange}:p${pricePrecision}`;
    const rand = mulberry32(hashStringToSeed(seedKey));

    const basePrice = getMockBasePrice(symbol);
    const tick = getMockTickSize(basePrice);
    const priceOffset = isAggregated ? 0 : (selectedExchange === 'binance' ? tick * 10 : -tick * 10);
    const volumeMultiplier = isAggregated ? 1 : (selectedExchange === 'binance' ? 0.6 : 0.4);
    const step = Math.max(tick, precisionStep);

    const baseTs = 1_700_000_000_000; // fixed epoch for SSR/CSR deterministic formatting

    const sells = Array.from({ length: 60 }, (_, i) => {
      const price = roundToStep(basePrice + priceOffset + step * 10 + i * step).toFixed(fractionDigits);
      const amount = (rand() * 0.1 * volumeMultiplier).toFixed(5);
      const total = (Number(amount) * Number(price)).toFixed(2);
      const depth = rand() * 100;
      return { price, amount, total, depth };
    }).reverse();

    const buys = Array.from({ length: 60 }, (_, i) => {
      const price = roundToStep(basePrice + priceOffset - i * step).toFixed(fractionDigits);
      const amount = (rand() * 0.1 * volumeMultiplier).toFixed(5);
      const total = (Number(amount) * Number(price)).toFixed(2);
      const depth = rand() * 100;
      return { price, amount, total, depth };
    });

    const trades = Array.from({ length: 60 }, (_, i) => {
      const price = roundToStep(basePrice + priceOffset + (rand() - 0.5) * tick * 2).toFixed(fractionDigits);
      const amount = (rand() * 0.05 * volumeMultiplier).toFixed(5);
      const time = formatHmsUtc(baseTs - i * 1000);
      const type = rand() > 0.5 ? 'buy' : 'sell';
      return { id: baseTs - i * 1000, price, amount, time, type };
    });

    return {
      initialOrderbook: { sells, buys },
      initialTrades: trades,
      meta: { basePrice, tick, priceOffset, volumeMultiplier },
    };
  }, [
    fractionDigits,
    isAggregated,
    marketType,
    precisionStep,
    pricePrecision,
    roundToStep,
    selectedExchange,
    symbol,
  ]);

  const [orderbook, setOrderbook] = useState(() => createDeterministicMock.initialOrderbook);
  const [trades, setTrades] = useState(() => createDeterministicMock.initialTrades);

  // Close decimal menu when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (decimalMenuRef.current && !decimalMenuRef.current.contains(e.target as Node)) {
        setIsDecimalMenuOpen(false);
      }
    };
    if (isDecimalMenuOpen) {
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }
  }, [isDecimalMenuOpen]);

  useEffect(() => {
    // When source / symbol / precision changes, sync deterministic initial data immediately (no blank SSR/CSR)
    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
    setOrderbook(createDeterministicMock.initialOrderbook);
    setTrades(createDeterministicMock.initialTrades);
    setLoading(false);
    /* eslint-enable react-hooks-extra/no-direct-set-state-in-use-effect */

    const interval = setInterval(() => {
      const { basePrice, tick, priceOffset, volumeMultiplier } = createDeterministicMock.meta;

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
        price: (basePrice + priceOffset + (Math.random() - 0.5) * tick * 3).toFixed(fractionDigits),
        amount: (Math.random() * 0.05 * volumeMultiplier).toFixed(5),
        time: formatHmsUtc(Date.now()),
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      };
      setTrades(prev => [newTrade, ...prev.slice(0, 59)]);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [createDeterministicMock, fractionDigits, locale]); // Re-run when source/format changes

  useEffect(() => {
    if (!loading && sellsRef.current) {
      sellsRef.current.scrollTop = sellsRef.current.scrollHeight;
    }
  }, [loading]);

  const compactFormatter = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }), [locale])
  const priceFormatter = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }), [locale, fractionDigits])
  const formatUsd = (n: number) => `$${priceFormatter.format(n)}`

  const handleTabChange = (tab: string) => {
    if (tab === tradeTab) return;
    setLoading(true);
    setTradeTab(tab);
    // Tab switching loading: 600-1000ms
    if (tabLoadingTimeoutRef.current)
      clearTimeout(tabLoadingTimeoutRef.current);
    tabLoadingTimeoutRef.current = setTimeout(() => setLoading(false), 800);
  };

  // Dynamic Static Info Values
  const basePriceForStats = getMockBasePrice(symbol);
  const turnoverVal = Math.round(basePriceForStats * (isAggregated ? 900_000 : selectedExchange === 'binance' ? 600_000 : 350_000));
  const netInflowVal = Math.round((isAggregated ? -0.05 : selectedExchange === 'binance' ? -0.03 : -0.02) * turnoverVal);
  const highVal = basePriceForStats * (isAggregated ? 1.01 : selectedExchange === 'binance' ? 1.008 : 1.006);
  const lowVal = basePriceForStats * (isAggregated ? 0.99 : selectedExchange === 'binance' ? 0.992 : 0.994);
  const midPrice = basePriceForStats * (isAggregated ? 1.0000 : selectedExchange === 'binance' ? 1.0008 : 0.9992);
  const midChangePct = isAggregated ? 0.15 : selectedExchange === 'binance' ? 0.12 : 0.1;
  const midChangeAbs = midPrice * (midChangePct / 100);

  const precisionLabel =
    pricePrecision >= 0
      ? t('rightPanel.decimalPlaces', { count: pricePrecision })
      : t('rightPanel.integerPlaces', { count: Math.abs(pricePrecision) });

  const displaySymbol = marketType === 'spot' && symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}/USDT` : symbol;

  return (
    <div className="w-full bg-[#161b22] border-l border-[#30363d] rounded-xl flex flex-col text-[#c9d1d9] relative">
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#161b22]/80 backdrop-blur-sm">
          <Spinner size="md" className="text-primary" />
        </div>
      )}

      {/* --- MODULE 1: Top Static Info --- */}
      <div className="flex-none border-b border-[#30363d]">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{displaySymbol}</span>
            <Copy className="w-3 h-3 text-[#8b949e] cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
            <span>{isAggregated ? t('chart.toolbar.aggregationOn') : t(`rightPanel.exchange${(selectedExchange || 'binance').charAt(0).toUpperCase() + (selectedExchange || 'binance').slice(1)}`)}</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        <div className="px-3 pb-2 flex flex-col gap-1 text-[10px]">
          <div className="flex justify-between items-center">
            <span className="text-[#8b949e] whitespace-nowrap">
              {isAggregated ? t('rightPanel.accumulatedTurnoverUsd') : t('rightPanel.turnoverUsd')}:
            </span>
            <span className="whitespace-nowrap font-medium">{compactFormatter.format(turnoverVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8b949e] whitespace-nowrap">
              {isAggregated ? t('rightPanel.accumulatedNetInflowUsd') : t('rightPanel.netInflowUsd')}:
            </span>
            <span className="text-red-400 whitespace-nowrap font-medium">{compactFormatter.format(netInflowVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8b949e] whitespace-nowrap">{t('rightPanel.high')}:</span>
            <span className="whitespace-nowrap font-medium">{formatUsd(highVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8b949e] whitespace-nowrap">{t('rightPanel.low')}:</span>
            <span className="whitespace-nowrap font-medium">{formatUsd(lowVal)}</span>
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
      <div className="flex flex-col">
        <div className="flex-none">
          <div className="px-2 py-1.5 flex items-center justify-between text-[#8b949e] relative">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <AlignJustify className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
              <ArrowDownUp className="w-3.5 h-3.5 cursor-pointer hover:text-[#c9d1d9]" />
            </div>
            <div className="flex items-center gap-2" ref={decimalMenuRef}>
              <button
                type="button"
                onClick={() => setIsDecimalMenuOpen((v) => !v)}
                className="flex items-center gap-1 text-[10px] hover:text-[#c9d1d9] whitespace-nowrap"
              >
                <span>{precisionLabel}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isDecimalMenuOpen && (
                <div className="absolute right-2 top-full mt-1 w-[120px] bg-[#161b22] border border-[#30363d] rounded shadow-lg z-50 py-1">
                  {[2, 1, 0, -1, -2].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPricePrecision(p);
                        setIsDecimalMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#30363d] ${
                        pricePrecision === p ? 'bg-[#1f2937] text-[#c9d1d9] font-bold' : 'text-[#c9d1d9]'
                      }`}
                    >
                      {p >= 0 ? t('rightPanel.decimalPlaces', { count: p }) : t('rightPanel.integerPlaces', { count: Math.abs(p) })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e]">
            <span className="w-[35%]">{t('rightPanel.price')}</span>
                  <span className="w-[30%] text-right">{t('rightPanel.amount', { asset: baseAsset })}</span>
            <span className="w-[35%] text-right pr-1">{t('rightPanel.orderValue')}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <div ref={sellsRef} className="h-[200px] overflow-y-auto cf-scrollbar pr-1">
            {orderbook.sells.map((s, i) => (
              <OrderbookRow key={`sell-${i}`} price={s.price} amount={s.amount} total={s.total} type="sell" depthPercent={s.depth} />
            ))}
          </div>
          
          <div className="py-1 px-2 flex items-center justify-between border-y border-[#30363d] bg-[#1c2128] my-0.5 flex-none z-10">
            <div className="flex flex-col">
              <span className="text-base font-bold text-green-400">{priceFormatter.format(midPrice)}</span>
              <span className="text-[10px] text-[#8b949e]">{formatUsd(midPrice)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-green-400 font-semibold">{`+${midChangePct.toFixed(2)}%`}</span>
              <span className="text-[10px] text-green-400 font-medium">{`+${priceFormatter.format(midChangeAbs)}`}</span>
            </div>
          </div>

          <div className="h-[200px] overflow-y-auto cf-scrollbar pr-1">
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
          </div>
        </div>

        <div className="flex items-center px-2 py-1 text-[10px] text-[#8b949e] bg-[#161b22]">
          <span className="w-[35%]">{t('rightPanel.price')}</span>
                <span className="w-[30%] text-right">{t('rightPanel.amount', { asset: baseAsset })}</span>
          <span className="w-[35%] text-right pr-1">{t('rightPanel.tradeTime')}</span>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#161b22] cf-scrollbar pr-1">
          {trades.map((t) => (
            <TradeRow key={t.id} price={t.price} amount={t.amount} time={t.time} type={t.type as 'buy' | 'sell'} />
          ))}
        </div>
      </div>
    </div>
  );
};
