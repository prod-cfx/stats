'use client';

import type { AggregatedLevel, OrderBookLevel as SharedOrderBookLevel } from '@ai/shared';
import type { Socket } from 'socket.io-client';
import type { TickerData } from '@/lib/api';
import type { DataSource, MarketType } from '@/types/trading';
import { AlignJustify, ArrowDownUp, ChevronDown, Copy, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { Spinner } from '@/components/ui/loading';
import { fetchTicker } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getMockBasePrice, getMockTickSize } from '@/lib/mock/market';
import { getWsBaseUrl } from '@/lib/ws';
import { OrderbookRow } from './components/OrderbookRow';
import { TradeRow } from './components/TradeRow';

// 常量定义
const AUTH_TOKEN_KEY = 'token';

// 交易所名称映射
const EXCHANGE_MAP: Record<DataSource, string> = {
  binance: 'BINANCE',
  okx: 'OKX',
  bybit: 'BYBIT',
};

// WebSocket 事件数据类型定义
interface TradesSubscribedData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  minValue?: number;
  subscriptionKey: string;
}

interface TradesUnsubscribedData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  minValue?: number;
  subscriptionKey: string;
}

interface TradeData {
  id: number;
  price: string;
  size: string;
  side: string;
  tradeTimestamp: string;
}

interface TradesEventData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  trades: TradeData[];
}

// Order Book WebSocket 事件数据类型定义
interface OrderbookSubscribedData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  isAggregated: boolean;
  depth: number;
  subscriptionKey: string;
}

interface OrderbookUnsubscribedData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  isAggregated: boolean;
  subscriptionKey: string;
}

// 使用 @ai/shared 的类型，本地仅定义 WebSocket 事件特有的接口
interface SingleVenueOrderbook {
  bids: SharedOrderBookLevel[];
  asks: SharedOrderBookLevel[];
  venueId: string;
  marketKey: string;
  updatedAt: number;
}

interface AggregatedOrderbook {
  bids: AggregatedLevel[];
  asks: AggregatedLevel[];
  updatedAt: number;
}

interface OrderbookEventData {
  exchange: string;
  instrumentType: string;
  symbol: string;
  isAggregated: boolean;
  orderbook: SingleVenueOrderbook | AggregatedOrderbook;
}

function formatHmsLocal(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
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
  // NOTE: Work around a ReactNode type mismatch (multiple @types/react copies) that can make lucide icons fail JSX typing.
  const ChevronDownIcon = ChevronDown as unknown as React.ComponentType<any>;
  const CopyIcon = Copy as unknown as React.ComponentType<any>;
  const RotateCcwIcon = RotateCcw as unknown as React.ComponentType<any>;
  const AlignJustifyIcon = AlignJustify as unknown as React.ComponentType<any>;
  const ArrowDownUpIcon = ArrowDownUp as unknown as React.ComponentType<any>;

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
      const time = formatHmsLocal(baseTs - i * 1000);
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
  const [trades, setTrades] = useState<Array<{ id: number; price: string; amount: string; time: string; type: 'buy' | 'sell' }>>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null); // 最新成交价
  const [tickerData, setTickerData] = useState<TickerData | null>(null); // 24h 统计数据

  // Fetch ticker data for 24h statistics
  useEffect(() => {
    let isMounted = true;
    const selectedBase = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;

    const fetchData = async () => {
      try {
        const exchange = isAggregated ? undefined : selectedExchange;
        const data = await fetchTicker(selectedBase, exchange);
        if (isMounted) {
          setTickerData(data);
        }
      } catch (error) {
        logger.error('[RightPanel] Failed to fetch ticker data:', error);
        if (isMounted) {
          setTickerData(null);
        }
      }
    };

    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol, isAggregated, selectedExchange]);

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
    setLoading(false);
    /* eslint-enable react-hooks-extra/no-direct-set-state-in-use-effect */
  }, [createDeterministicMock, locale]); // Re-run when source/format changes

  // WebSocket 连接管理 - Trades 实时数据
  useEffect(() => {
    const wsBaseUrl = getWsBaseUrl();
    let socket: Socket | null = null;

    const connectWebSocket = () => {
      // 获取 token（从 localStorage）
      const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';

      // 创建 Socket.IO 连接
      socket = io(`${wsBaseUrl}/kline`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        auth: { token },
      });

      // 监听连接事件
      socket.on('connect', () => {
        logger.debug('[RightPanel] Socket.IO connected, subscribing to trades');

        const exchange = EXCHANGE_MAP[selectedExchange] || 'BINANCE';
        const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL';

        // 发送订阅请求
        const minValue = tradeTab === 'large' ? 100000 : undefined;
        socket?.emit('subscribeTrades', {
          exchange,
          instrumentType,
          symbol: symbol.toUpperCase(),
          minValue,
          limit: 50,
        });

        // 发送 Order Book 订阅请求
        socket?.emit('subscribeOrderbook', {
          exchange,
          instrumentType,
          symbol: symbol.toUpperCase(),
          isAggregated,
          depth: 60,
        });
      });

      // 监听订阅确认
      socket.on('tradesSubscribed', (data: TradesSubscribedData) => {
        logger.debug('[RightPanel] Trades subscribed:', data);
      });

      // 监听 Order Book 订阅确认
      socket.on('orderbookSubscribed', (data: OrderbookSubscribedData) => {
        logger.debug('[RightPanel] Orderbook subscribed:', data);
        setLoading(false);
      });

      // 监听实时 trades 数据
      socket.on('trades', (data: TradesEventData) => {
        const { trades: receivedTrades } = data;

        if (receivedTrades && Array.isArray(receivedTrades)) {
          // 格式化 trades 数据
          const formattedTrades = receivedTrades.map((trade: TradeData) => {
            const side = trade.side?.toLowerCase();
            return {
              id: trade.id, // 使用数据库主键作为唯一标识
              price: Number(trade.price).toFixed(fractionDigits),
              amount: Number(trade.size).toFixed(5),
              time: formatHmsLocal(Number(trade.tradeTimestamp)),
              type: (side === 'buy' || side === 'sell' ? side : 'buy') as 'buy' | 'sell',
            };
          });

          setTrades(formattedTrades);

          // 更新最新成交价（Last Price）- 业内标准做法
          if (receivedTrades.length > 0) {
            const latestTrade = receivedTrades[0]; // trades 数组按时间倒序，第一个是最新的
            const price = Number(latestTrade.price);
            if (Number.isFinite(price)) {
              setLastPrice(price);
            }
          }
        }
      });

      // 监听实时 orderbook 数据
      socket.on('orderbook', (data: OrderbookEventData) => {
        logger.debug('[RightPanel] Orderbook data received:', {
          exchange: data.exchange,
          instrumentType: data.instrumentType,
          symbol: data.symbol,
          isAggregated: data.isAggregated,
          bidsCount: data.orderbook?.bids?.length ?? 0,
          asksCount: data.orderbook?.asks?.length ?? 0,
          bestBid: data.orderbook?.bids?.[0],
          bestAsk: data.orderbook?.asks?.[0],
        });

        const { orderbook } = data;

        if (orderbook && orderbook.bids?.length > 0 && orderbook.asks?.length > 0) {
          // 计算累计量用于深度百分比
          const bidsSlice = (orderbook.bids || []).slice(0, 60);
          const asksSlice = (orderbook.asks || []).slice(0, 60);

          // 计算买卖双方的最大累计量
          let bidsCumulative = 0;
          const bidsWithCumulative = bidsSlice.map((level) => {
            const size = 'size' in level ? level.size : ('sizeTotal' in level ? level.sizeTotal : 0);
            bidsCumulative += size;
            return { level, cumulative: bidsCumulative };
          });

          let asksCumulative = 0;
          const asksWithCumulative = asksSlice.map((level) => {
            const size = 'size' in level ? level.size : ('sizeTotal' in level ? level.sizeTotal : 0);
            asksCumulative += size;
            return { level, cumulative: asksCumulative };
          });

          const maxCumulative = Math.max(bidsCumulative, asksCumulative);

          const formatLevel = (item: { level: SharedOrderBookLevel | AggregatedLevel; cumulative: number }) => {
            const { level, cumulative } = item;
            const price = 'price' in level ? level.price : 0;
            const size = 'size' in level ? level.size : ('sizeTotal' in level ? level.sizeTotal : 0);
            // 基于累计量计算深度百分比
            const depth = maxCumulative > 0 ? (cumulative / maxCumulative) * 100 : 0;
            return {
              price: price.toFixed(fractionDigits),
              amount: size.toFixed(5),
              total: (price * size).toFixed(2),
              depth,
            };
          };

          const formattedOrderbook = {
            sells: asksWithCumulative.map(formatLevel).reverse(),
            buys: bidsWithCumulative.map(formatLevel),
          };

          logger.debug('[RightPanel] Formatted orderbook:', {
            sellsCount: formattedOrderbook.sells.length,
            buysCount: formattedOrderbook.buys.length,
            topSell: formattedOrderbook.sells[formattedOrderbook.sells.length - 1],
            topBuy: formattedOrderbook.buys[0],
          });

          setOrderbook(formattedOrderbook);
        } else {
          logger.warn('[RightPanel] Orderbook data is empty or invalid, keeping mock data');
        }
      });

      // 监听取消订阅确认
      socket.on('tradesUnsubscribed', (data: TradesUnsubscribedData) => {
        logger.debug('[RightPanel] Trades unsubscribed:', data);
      });

      // 监听 Order Book 取消订阅确认
      socket.on('orderbookUnsubscribed', (data: OrderbookUnsubscribedData) => {
        logger.debug('[RightPanel] Orderbook unsubscribed:', data);
      });

      // 监听连接错误
      socket.on('connect_error', (error) => {
        logger.error('[RightPanel] Socket.IO connection error:', error);
        setLoading(true);
      });

      // 监听断开连接
      socket.on('disconnect', (reason) => {
        logger.warn('[RightPanel] Socket.IO disconnected:', reason);
        setLoading(true);
      });
    };

    connectWebSocket();

    return () => {
      if (socket) {
        const exchange = EXCHANGE_MAP[selectedExchange] || 'BINANCE';
        const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL';
        const minValue = tradeTab === 'large' ? 100000 : undefined;

        // 发送取消订阅请求
        socket.emit('unsubscribeTrades', {
          exchange,
          instrumentType,
          symbol: symbol.toUpperCase(),
          minValue,
        });

        // 发送 Order Book 取消订阅请求
        socket.emit('unsubscribeOrderbook', {
          exchange,
          instrumentType,
          symbol: symbol.toUpperCase(),
          isAggregated,
          depth: 60,
        });

        // 断开连接
        socket.disconnect();
      }
    };
  }, [symbol, selectedExchange, marketType, isAggregated, tradeTab, fractionDigits]); // 依赖项：symbol/exchange/marketType/tab 变化时重新订阅

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

  // Calculate mid price from real-time data
  // 业内标准：优先使用 Last Price（最新成交价），降级到 Mid Price
  const midPrice = (() => {
    // 优先级 1: Last Price（最新成交价）- 业内标准
    if (lastPrice !== null && Number.isFinite(lastPrice)) {
      return lastPrice;
    }

    // 优先级 2: Mid Price（买卖中间价）- 无成交时的备选
    const bestBid = orderbook.buys[0]?.price ? Number.parseFloat(orderbook.buys[0].price) : null;
    const bestAsk = orderbook.sells.length > 0 && orderbook.sells[orderbook.sells.length - 1]?.price
      ? Number.parseFloat(orderbook.sells[orderbook.sells.length - 1].price)
      : null;

    if (bestBid && bestAsk && Number.isFinite(bestBid) && Number.isFinite(bestAsk)) {
      return (bestBid + bestAsk) / 2;
    }

    // 优先级 3: Fallback to mock data
    return basePriceForStats * (isAggregated ? 1.0000 : selectedExchange === 'binance' ? 1.0008 : 0.9992);
  })();

  // Calculate 24h price change from ticker data
  const { midChangePct, midChangeAbs } = (() => {
    // 优先使用 ticker 数据的 24h 涨跌幅
    if (tickerData?.priceChangePercent24h) {
      const changePct = Number.parseFloat(tickerData.priceChangePercent24h);
      if (Number.isFinite(changePct)) {
        const changeAbs = midPrice * (changePct / 100);
        return { midChangePct: changePct, midChangeAbs: changeAbs };
      }
    }

    // Fallback to mock data
    const mockChangePct = isAggregated ? 0.15 : selectedExchange === 'binance' ? 0.12 : 0.1;
    return {
      midChangePct: mockChangePct,
      midChangeAbs: midPrice * (mockChangePct / 100),
    };
  })();

  const precisionLabel =
    pricePrecision >= 0
      ? t('rightPanel.decimalPlaces', { count: pricePrecision })
      : t('rightPanel.integerPlaces', { count: Math.abs(pricePrecision) });

  const displaySymbol = marketType === 'spot' && symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}/USDT` : symbol;

  return (
    <div className="w-full bg-[color:var(--cf-surface)] border-l border-[color:var(--cf-border)] rounded-xl flex flex-col text-[color:var(--cf-text)] relative">
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[color:var(--cf-surface)]/80 backdrop-blur-sm">
          <Spinner size="md" className="text-primary" />
        </div>
      )}

      {/* --- MODULE 1: Top Static Info --- */}
      <div className="flex-none border-b border-[color:var(--cf-border)]">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{displaySymbol}</span>
            <CopyIcon className="w-3 h-3 text-[color:var(--cf-muted)] cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="bg-gradient-to-br from-primary to-secondary text-transparent bg-clip-text">
              {isAggregated ? t('chart.toolbar.aggregationOn') : t(`rightPanel.exchange${(selectedExchange || 'binance').charAt(0).toUpperCase() + (selectedExchange || 'binance').slice(1)}`)}
            </span>
          </div>
        </div>

        <div className="px-3 pb-2 flex flex-col gap-1 text-[10px]">
          <div className="flex justify-between items-center">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">
              {isAggregated ? t('rightPanel.accumulatedTurnoverUsd') : t('rightPanel.turnoverUsd')}:
            </span>
            <span className="whitespace-nowrap font-medium">{compactFormatter.format(turnoverVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">
              {isAggregated ? t('rightPanel.accumulatedNetInflowUsd') : t('rightPanel.netInflowUsd')}:
            </span>
            <span className="text-red-400 whitespace-nowrap font-medium">{compactFormatter.format(netInflowVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('rightPanel.high')}:</span>
            <span className="whitespace-nowrap font-medium">{formatUsd(highVal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('rightPanel.low')}:</span>
            <span className="whitespace-nowrap font-medium">{formatUsd(lowVal)}</span>
          </div>
        </div>

        {/* 用户系统未接入：隐藏“加预警/加自选/策略/简况”等用户态入口 */}
      </div>

      {/* --- MODULE 2: Orderbook --- */}
      <div className="flex flex-col">
        <div className="flex-none">
          <div className="px-2 py-1.5 flex items-center justify-between text-[color:var(--cf-muted)] relative">
            <div className="flex items-center gap-3">
              <RotateCcwIcon className="w-3.5 h-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
              <AlignJustifyIcon className="w-3.5 h-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
              <ArrowDownUpIcon className="w-3.5 h-3.5 cursor-pointer hover:text-[color:var(--cf-text)]" />
            </div>
            <div className="flex items-center gap-2" ref={decimalMenuRef}>
              <button
                type="button"
                onClick={() => setIsDecimalMenuOpen((v) => !v)}
                className="flex items-center gap-1 text-[10px] hover:text-[color:var(--cf-text)] whitespace-nowrap"
              >
                <span>{precisionLabel}</span>
                <ChevronDownIcon className="w-3 h-3" />
              </button>

              {isDecimalMenuOpen && (
                <div className="absolute right-2 top-full mt-1 w-[120px] bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded shadow-lg z-50 py-1">
                  {[2, 1, 0, -1, -2].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPricePrecision(p);
                        setIsDecimalMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                        pricePrecision === p ? 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text)] font-bold' : 'text-[color:var(--cf-text)]'
                      }`}
                    >
                      {p >= 0 ? t('rightPanel.decimalPlaces', { count: p }) : t('rightPanel.integerPlaces', { count: Math.abs(p) })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center px-2 py-1 text-[10px] text-[color:var(--cf-muted)]">
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
          
          <div className="py-1 px-2 flex items-center justify-between border-y border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] my-0.5 flex-none z-10">
            <div className="flex flex-col">
              <span className="text-base font-bold text-green-400">{priceFormatter.format(midPrice)}</span>
              <span className="text-[10px] text-[color:var(--cf-muted)]">{formatUsd(midPrice)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-xs ${midChangePct >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold`}>
                {`${midChangePct >= 0 ? '+' : ''}${midChangePct.toFixed(2)}%`}
              </span>
              <span className={`text-[10px] ${midChangePct >= 0 ? 'text-green-400' : 'text-red-400'} font-medium`}>
                {`${midChangePct >= 0 ? '+' : ''}${priceFormatter.format(midChangeAbs)}`}
              </span>
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
      <div className="h-[420px] flex flex-col border-t-4 border-[color:var(--cf-bg)] flex-none">
        <div className="flex items-center justify-between px-2 bg-[color:var(--cf-surface)] border-b border-[color:var(--cf-border)]">
          <div className="flex gap-4">
            {['latest', 'large'].map(id => (
              <button 
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`py-2 text-[11px] font-bold border-b-2 transition-colors relative ${tradeTab === id ? 'text-[color:var(--cf-text-strong)] border-primary' : 'text-[color:var(--cf-muted)] border-transparent hover:text-[color:var(--cf-text-strong)]'}`}
              >
                {id === 'latest' ? t('rightPanel.latestTrades') : t('rightPanel.largeTrades')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownUpIcon className="w-3.5 h-3.5 text-[color:var(--cf-muted)] cursor-pointer hover:text-[color:var(--cf-text-strong)]" />
          </div>
        </div>

        <div className="flex items-center px-2 py-1 text-[10px] text-[color:var(--cf-muted)] bg-[color:var(--cf-surface)]">
          <span className="w-[35%]">{t('rightPanel.price')}</span>
                <span className="w-[30%] text-right">{t('rightPanel.amount', { asset: baseAsset })}</span>
          <span className="w-[35%] text-right pr-1">{t('rightPanel.tradeTime')}</span>
        </div>

        <div className="flex-1 overflow-y-auto bg-[color:var(--cf-surface)] cf-scrollbar pr-1">
          {trades.map((t) => (
            <TradeRow key={t.id} price={t.price} amount={t.amount} time={t.time} type={t.type as 'buy' | 'sell'} />
          ))}
        </div>
      </div>
    </div>
  );
};
