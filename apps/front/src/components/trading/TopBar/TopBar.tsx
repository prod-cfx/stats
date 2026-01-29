'use client';

import type {Socket} from 'socket.io-client';
import type {TickerData} from '@/lib/api';
import type { DataSource, MarketType } from '@/types/trading';
import { ChevronDown, Info, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io  } from 'socket.io-client'
import { fetchKlineData, fetchTicker  } from '@/lib/api'
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { getWsBaseUrl } from '@/lib/ws'
import { logger } from '@/utils/logger'

interface TopBarProps {
  isAggregated: boolean;
  selectedExchange: DataSource;
  marketType: MarketType;
  setMarketType: (v: MarketType) => void;
  selectedSymbol: string; // chart symbol format, e.g. BTCUSDT
  setSelectedSymbol: (v: string) => void;
  variant?: 'default' | 'compact';
}

interface MarketItem {
  displaySymbol: string;
  chartSymbol: string;
  base: string;
  price: number;
  changePct: number;
  volume: number;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * 从 ticker 数据计算涨跌幅
 */
export function calculateFromTicker(tickerData: TickerData, lastPrice: number) {
  const changePct = Number.parseFloat(tickerData.priceChangePercent24h || '0');
  return {
    changePct,
    changeAbs: lastPrice * (changePct / 100),
  };
}

/**
 * 计算价格涨跌幅和涨跌额
 * 优先级：实时 K线 + ticker 24h 前价格 > ticker 数据 > mock 数据
 */
export function calculatePriceChange(
  tickerData: TickerData | null,
  klineClosePrice: number | null,
  lastPrice: number,
  fallbackPct: number,
): { changePct: number; changeAbs: number } {
  // 优先：实时 K线 + ticker 24h 前价格
  if (tickerData?.priceChangePercent24h && klineClosePrice !== null) {
    const tickerChangePct = Number.parseFloat(tickerData.priceChangePercent24h);
    const currentPrice = Number.parseFloat(tickerData.currentPrice);

    // 数值校验
    if (!Number.isFinite(tickerChangePct) || !Number.isFinite(currentPrice)) {
      return calculateFromTicker(tickerData, lastPrice);
    }

    // 计算 24h 前价格
    const pctFactor = 1 + tickerChangePct / 100;
    if (pctFactor === 0) {
      return calculateFromTicker(tickerData, lastPrice);
    }

    const price24hAgo = currentPrice / pctFactor;
    if (!Number.isFinite(price24hAgo) || price24hAgo === 0) {
      return calculateFromTicker(tickerData, lastPrice);
    }

    // 基于实时价格重算涨跌幅
    const changeAbs = klineClosePrice - price24hAgo;
    return {
      changePct: (changeAbs / price24hAgo) * 100,
      changeAbs,
    };
  }

  // 降级：仅使用 ticker 数据
  if (tickerData?.priceChangePercent24h) {
    return calculateFromTicker(tickerData, lastPrice);
  }

  // 最终降级：使用 mock 数据
  return {
    changePct: fallbackPct,
    changeAbs: lastPrice * (fallbackPct / 100),
  };
}

export const TopBar = ({ isAggregated, selectedExchange, marketType, setMarketType, selectedSymbol, setSelectedSymbol, variant = 'default' }: TopBarProps) => {
  const { t, i18n } = useTranslation('common');
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [klineClosePrice, setKlineClosePrice] = useState<number | null>(null);
  const [wsConnectionStatus, setWsConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const menuRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const prevSymbolRef = useRef<string | null>(null);
  const selectedSymbolRef = useRef<string>(selectedSymbol);
  const lastKlineUpdateTimeRef = useRef<number>(0);
  const THROTTLE_INTERVAL = 1000;

  // Sync selectedSymbolRef with selectedSymbol state
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  const isCompact = variant === 'compact';

  // NOTE: Work around a ReactNode type mismatch (multiple @types/react copies) that can make lucide icons fail JSX typing.
  const ChevronDownIcon = ChevronDown as unknown as React.ComponentType<any>;
  const InfoIcon = Info as unknown as React.ComponentType<any>;
  const SearchIcon = Search as unknown as React.ComponentType<any>;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSymbolMenuOpen(false);
      }
    };
    if (isSymbolMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSymbolMenuOpen]);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
  const priceFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale])
  const priceFormatter2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale])
  const compactFormatter = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }), [locale])
  const formatUsd = (n: number) => `$${priceFormatter.format(n)}`
  const formatUsd2 = (n: number) => `$${priceFormatter2.format(n)}`
  const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  const selectedBase = useMemo(() => {
    // BTCUSDT -> BTC, ETHUSDT -> ETH
    if (!selectedSymbol) return 'BTC' // 默认值
    if (selectedSymbol.endsWith('USDT')) return selectedSymbol.slice(0, -4)
    return selectedSymbol
  }, [selectedSymbol])

  // Fetch ticker data from API
  useEffect(() => {
    if (!selectedBase) return;

    const fetchData = async () => {
      try {
        const exchange = isAggregated ? undefined : selectedExchange;
        const data = await fetchTicker(selectedBase, exchange);
        setTickerData(data);
      } catch (error) {
        logger.error('Failed to fetch ticker data:', error);
        setTickerData(null);
      }
    };

    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [selectedBase, isAggregated, selectedExchange]);

  // Fetch latest kline close price from API (fallback when WebSocket is not connected)
  useEffect(() => {
    if (!selectedSymbol) return;
    // 只在 WebSocket 未连接时才使用 API 轮询
    if (wsConnectionStatus === 'connected') return;

    const fetchLatestKline = async () => {
      try {
        const exchange = isAggregated ? undefined : selectedExchange;
        const to = Math.floor(Date.now() / 1000);
        const from = to - 60;
        const bars = await fetchKlineData({
          symbol: selectedSymbol,
          interval: '1m',
          from,
          to,
          exchange,
        });
        const latestClose = bars.at(-1)?.close;
        setKlineClosePrice(latestClose !== undefined && Number.isFinite(latestClose) ? latestClose : null);
      } catch (error) {
        logger.error('Failed to fetch kline data:', error);
        setKlineClosePrice(null);
      }
    };

    fetchLatestKline();
    // Refresh every 10 seconds
    const interval = setInterval(fetchLatestKline, 10000);
    return () => clearInterval(interval);
  }, [selectedSymbol, isAggregated, selectedExchange, wsConnectionStatus]);

  // WebSocket real-time kline updates
  useEffect(() => {
    if (!selectedSymbol) return;

    if (!socketRef.current) {
      const wsBaseUrl = getWsBaseUrl();
      setWsConnectionStatus('connecting');
      socketRef.current = io(`${wsBaseUrl}/kline`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        logger.debug('[TopBar] WebSocket connected');
        logger.debug(`[TopBar] Current selectedSymbol: ${selectedSymbol}`);
        logger.debug(`[TopBar] Current selectedSymbolRef: ${selectedSymbolRef.current}`);
        setWsConnectionStatus('connected');
        // 使用闭包中的 selectedSymbol，因为 prevSymbolRef.current 在首次连接时还未设置
        if (selectedSymbol) {
          socket.emit('subscribe', { symbol: selectedSymbol, interval: '1m' });
          logger.debug(`[TopBar] Subscribed to kline: ${selectedSymbol}`);
        }
      });

      socket.on('kline', (data: { symbol: string; interval: string; bar: { close: number } }) => {
        logger.debug(`[TopBar] Received kline data:`, data);
        const { symbol, bar } = data;

        logger.debug(`[TopBar] Comparing symbols - received: ${symbol}, current: ${selectedSymbolRef.current}`);

        // Validate symbol matches current subscription
        if (symbol !== selectedSymbolRef.current) {
          logger.debug(`[TopBar] Ignoring kline for ${symbol}, current: ${selectedSymbolRef.current}`);
          return;
        }

        logger.debug(`[TopBar] Symbol matched! Processing bar.close: ${bar.close}`);

        if (Number.isFinite(bar.close)) {
          const now = Date.now();
          if (now - lastKlineUpdateTimeRef.current >= THROTTLE_INTERVAL) {
            logger.debug(`[TopBar] Updating klineClosePrice from ${klineClosePrice} to ${bar.close}`);
            setKlineClosePrice(bar.close);
            lastKlineUpdateTimeRef.current = now;
            logger.debug(`[TopBar] Real-time price update: ${bar.close} for ${symbol}`);
          } else {
            logger.debug(`[TopBar] Throttled - skipping update (${now - lastKlineUpdateTimeRef.current}ms since last)`);
          }
        } else {
          logger.warn(`[TopBar] Invalid bar.close value: ${bar.close}`);
        }
      });

      socket.on('ping', () => {
        logger.debug('[TopBar] Ping sent');
      });

      socket.on('pong', (latency: number) => {
        logger.debug(`[TopBar] Pong received, latency: ${latency}ms`);
      });

      socket.on('disconnect', () => {
        logger.debug('[TopBar] WebSocket disconnected');
        setWsConnectionStatus('disconnected');
      });

      socket.on('connect_error', (error) => {
        logger.error('[TopBar] WebSocket connection error:', error);
        setWsConnectionStatus('error');
      });

      socket.on('error', (error) => {
        logger.error('[TopBar] WebSocket error:', error);
        setWsConnectionStatus('error');
      });
    }

    const socket = socketRef.current;
    const prevSymbol = prevSymbolRef.current;

    if (prevSymbol && prevSymbol !== selectedSymbol) {
      socket.emit('unsubscribe', { symbol: prevSymbol, interval: '1m' });
    }

    prevSymbolRef.current = selectedSymbol;
    lastKlineUpdateTimeRef.current = 0;

    if (socket.connected) {
      socket.emit('subscribe', { symbol: selectedSymbol, interval: '1m' });
    } else {
      setWsConnectionStatus('connecting');
    }

    return () => {};
  }, [selectedSymbol]);

  useEffect(() => {
    return () => {
      if (!socketRef.current) return;
      if (prevSymbolRef.current) {
        socketRef.current.emit('unsubscribe', {
          symbol: prevSymbolRef.current,
          interval: '1m',
        });
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Mock raw values (keep as numbers so locale switching works)
  const basePriceByAsset: Record<string, number> = {
    BTC: 87010.0,
    ETH: 4850.2,
    SOL: 145.8,
    XRP: 1.12,
    BNB: 620.5,
    DOGE: 0.38,
    ADA: 0.75,
    AVAX: 42.6,
    LINK: 18.9,
    DOT: 8.4,
  };

  // Use API data if available, otherwise fallback to mock
  const basePrice = basePriceByAsset[selectedBase] ?? 100;
  const lastPrice = klineClosePrice ?? (tickerData
    ? Number.parseFloat(tickerData.currentPrice)
    : isAggregated
      ? basePrice
      : selectedExchange === 'binance'
        ? basePrice * 1.0001
        : basePrice * 0.9999);

  const changePctByAsset: Record<string, number> = {
    BTC: -0.45,
    ETH: 1.25,
    SOL: 5.4,
    XRP: -2.3,
    BNB: 0.8,
    DOGE: 8.5,
    ADA: -1.1,
    AVAX: 3.2,
    LINK: 0.5,
    DOT: -0.9,
  };
  const { changePct, changeAbs } = calculatePriceChange(
    tickerData,
    klineClosePrice,
    lastPrice,
    changePctByAsset[selectedBase] ?? 0.5,
  );

  // Index price and mark price
  const indexPrice = tickerData && tickerData.indexPrice
    ? Number.parseFloat(tickerData.indexPrice)
    : lastPrice * 1.0005;
  const markPrice = lastPrice; // Use currentPrice as mark price

  // Funding rate
  const fundingRatePct = tickerData && tickerData.fundingRate
    ? Number.parseFloat(tickerData.fundingRate) * 100
    : 0.004;

  // 24h high/low - fallback to mock calculation
  const low24h = lastPrice * 0.994;
  const high24h = lastPrice * 1.012;

  // Open interest / volume should match the selected base asset (not hardcoded BTC)
  const openInterestByAsset: Record<string, number> = {
    BTC: 24_000,
    ETH: 180_000,
    SOL: 2_600_000,
    XRP: 85_000_000,
    BNB: 120_000,
    DOGE: 950_000_000,
    ADA: 220_000_000,
    AVAX: 1_800_000,
    LINK: 12_500_000,
    DOT: 35_000_000,
  }
  const volume24hByAsset: Record<string, number> = {
    BTC: 68_200,
    ETH: 520_000,
    SOL: 8_500_000,
    XRP: 1_250_000_000,
    BNB: 340_000,
    DOGE: 5_800_000_000,
    ADA: 1_900_000_000,
    AVAX: 6_200_000,
    LINK: 48_000_000,
    DOT: 92_000_000,
  }

  const oiBase = openInterestByAsset[selectedBase] ?? 10_000
  const volBase = volume24hByAsset[selectedBase] ?? 50_000

  const exchangeMultiplier = isAggregated ? 1 : selectedExchange === 'binance' ? 0.6 : 0.4

  // Use API data if available, otherwise fallback to mock
  const openInterest = tickerData && tickerData.openInterestUsd
    ? Number.parseFloat(tickerData.openInterestUsd) / lastPrice // Convert USD to base asset quantity
    : oiBase * exchangeMultiplier

  const volume24h = tickerData && tickerData.volumeUsd
    ? Number.parseFloat(tickerData.volumeUsd) / lastPrice // Convert USD to base asset quantity
    : volBase * exchangeMultiplier

  // Mock Market Data
  const marketList = useMemo(() => {
    return getMockMarketList({ marketType, isAggregated, selectedExchange }) as MarketItem[]
  }, [marketType, isAggregated, selectedExchange]);

  const filteredMarketList = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return marketList;
    return marketList.filter((m) => m.displaySymbol.toUpperCase().includes(q) || m.base.toUpperCase().includes(q));
  }, [marketList, searchQuery]);

  const selectedDisplaySymbol = useMemo(() => {
    if (!selectedSymbol) return 'BTCUSDT' // 默认值
    if (marketType === 'spot' && selectedSymbol.endsWith('USDT')) {
      return `${selectedSymbol.slice(0, -4)}/USDT`;
    }
    return selectedSymbol;
  }, [marketType, selectedSymbol]);

  return (
    <div className={`${isCompact ? 'h-[48px]' : 'h-[61px]'} bg-[color:var(--cf-surface)] border-b border-[color:var(--cf-border)] flex items-center text-[color:var(--cf-text)] w-full`}>
      {/* Left Area: Removed Navigation */}
      
      {/* Center & Right Area: Full width now */}
      <div className="flex-1 flex items-center gap-2 md:gap-6 px-2 md:px-4 h-full relative min-w-0">
        {wsConnectionStatus === 'error' && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>实时数据连接失败</span>
            </div>
          </div>
        )}

        {wsConnectionStatus === 'connecting' && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-1 text-xs text-yellow-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
              <span>连接中...</span>
            </div>
          </div>
        )}
        {/* Symbol and Main Price */}
        <div className="flex items-center gap-2 md:gap-4 flex-none relative" ref={menuRef}>
          <button
            type="button"
            className={`flex items-center gap-2 cursor-pointer group hover:bg-[color:var(--cf-surface-hover)] rounded transition-colors ${isCompact ? 'p-1' : 'p-1'}`}
            onClick={() => setIsSymbolMenuOpen(!isSymbolMenuOpen)}
          >
            <div className={`${isCompact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'} bg-orange-500 rounded-full flex items-center justify-center font-bold text-black`}>
              ₿
            </div>
            <div className="flex items-center gap-1">
              <span className={`font-bold whitespace-nowrap ${isCompact ? 'text-sm' : 'text-base'}`}>
                {t('trade.symbolWithType', {
                  symbol: selectedDisplaySymbol,
                  type: marketType === 'futures' ? t('trade.perpTag') : t('trade.market_type_spot'),
                })}
              </span>
              <ChevronDownIcon className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)] transition-transform ${isSymbolMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Symbol Selector Dropdown */}
          {isSymbolMenuOpen && (
            <div className={`absolute top-full left-0 mt-2 w-[90vw] md:w-[480px] max-w-[480px] bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100`}>
              {/* Header / Tabs */}
              <div className="flex items-center border-b border-[color:var(--cf-border)]">
                <button
                  type="button"
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'futures' ? 'text-[color:var(--cf-text)] bg-[color:var(--cf-surface-2)]' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                  onClick={() => setMarketType('futures')}
                >
                  {t('trade.market_type_futures')}
                </button>
                <button
                  type="button"
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'spot' ? 'text-[color:var(--cf-text)] bg-[color:var(--cf-surface-2)]' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                  onClick={() => setMarketType('spot')}
                >
                  {t('trade.market_type_spot')}
                </button>
              </div>

              {/* Search Bar */}
              <div className={`${isCompact ? 'p-2' : 'p-3'} border-b border-[color:var(--cf-border)]`}>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--cf-muted)]" />
                  <input 
                    type="text" 
                    placeholder={t('chart.modal.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} pl-9 pr-3 text-[color:var(--cf-text)] placeholder-[color:var(--cf-muted)] focus:outline-none focus:border-[#58a6ff]`}
                  />
                </div>
              </div>

              {/* List Header */}
              <div className={`grid grid-cols-4 ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2'} text-xs text-[color:var(--cf-muted)] bg-[color:var(--cf-surface-2)]`}>
                <div className="text-left col-span-1">{t('trade.column_symbol')}</div>
                <div className="text-right col-span-1">{t('trade.column_price')}</div>
                <div className="text-right col-span-1">{t('trade.column_change')}</div>
                <div className="text-right col-span-1">{t('trade.column_volume')}</div>
              </div>

              {/* Market List */}
              <div className="flex-1 overflow-y-auto max-h-[400px] cf-scrollbar pr-1">
                {filteredMarketList.map((item) => {
                  const isSelected = item.chartSymbol === selectedSymbol;
                  return (
                  <button
                    key={`${marketType}-${item.chartSymbol}`}
                    type="button"
                    className={`w-full text-left grid grid-cols-4 ${isCompact ? 'px-3 py-2' : 'px-4 py-2.5'} text-xs cursor-pointer transition-colors border-b border-[color:var(--cf-border)]/50 last:border-0 ${
                      isSelected ? 'bg-[color:var(--cf-surface-2)]' : 'hover:bg-[color:var(--cf-surface-hover)]'
                    }`}
                    onClick={() => {
                      setSelectedSymbol(item.chartSymbol);
                      setIsSymbolMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 text-left col-span-1 min-w-0">
                      <span className={`font-bold truncate ${isSelected ? 'text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text)]'}`}>{item.displaySymbol}</span>
                      {marketType === 'futures' && !isCompact && (
                        <span className="ml-1 px-1.5 py-0.5 rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[10px] text-[color:var(--cf-muted)] whitespace-nowrap">
                          {t('trade.perpTag')}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[color:var(--cf-text)] font-mono col-span-1">
                      {priceFormatter.format(item.price)}
                    </div>
                    <div className={`text-right font-medium col-span-1 ${item.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {formatPct(item.changePct)}
                    </div>
                    <div className="text-right text-[color:var(--cf-text)] col-span-1">
                      {compactFormatter.format(item.volume)}
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <span className={`${isCompact ? 'text-base' : 'text-lg'} text-[#ef4444] font-semibold leading-tight`}>{priceFormatter.format(lastPrice)}</span>
          <div className="flex items-center gap-2 text-[10px] leading-tight text-[#ef4444]">
            <span>{changeAbs >= 0 ? `+${priceFormatter.format(changeAbs)}` : priceFormatter.format(changeAbs)}</span>
            <span>{formatPct(changePct)}</span>
          </div>
        </div>

        {/* Market Stats - Flexible list with reduced gap for small screens */}
        <div className={`flex-1 flex items-center gap-3 md:gap-6 ${isCompact ? 'text-[10px]' : 'text-[11px]'} overflow-x-auto no-scrollbar`}>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.index_price')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{formatUsd(indexPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.mark_price')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{formatUsd(markPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <div className="flex items-center gap-1">
              <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.funding_rate')}</span>
              <InfoIcon className="w-3 h-3 text-[color:var(--cf-muted)]" />
            </div>
            <span className="text-orange-400 whitespace-nowrap">{formatPct(fundingRatePct)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.24h_low')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{formatUsd2(low24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.24h_high')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{formatUsd(high24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.open_interest')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{compactFormatter.format(openInterest)} {selectedBase}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[color:var(--cf-muted)] whitespace-nowrap">{t('trade.24h_volume')}</span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">{compactFormatter.format(volume24h)} {selectedBase}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
