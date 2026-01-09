'use client';

import type { DataSource, MarketType } from '@/types/trading';
import { ChevronDown, Info, Search, Star } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

export const TopBar = ({ isAggregated, selectedExchange, marketType, setMarketType, selectedSymbol, setSelectedSymbol, variant = 'default' }: TopBarProps) => {
  const { t, i18n } = useTranslation('common');
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  // NOTE: Work around a ReactNode type mismatch (multiple @types/react copies) that can make lucide icons fail JSX typing.
  const ChevronDownIcon = ChevronDown as unknown as React.ComponentType<any>;
  const InfoIcon = Info as unknown as React.ComponentType<any>;
  const SearchIcon = Search as unknown as React.ComponentType<any>;
  const StarIcon = Star as unknown as React.ComponentType<any>;

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

  const basePrice = basePriceByAsset[selectedBase] ?? 100;
  const lastPrice =
    isAggregated
      ? basePrice // Aggregated uses "largest volume exchange" (simulated as base)
      : selectedExchange === 'binance'
        ? basePrice * 1.0001
        : basePrice * 0.9999;

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
  const changePct = changePctByAsset[selectedBase] ?? 0.5;
  const changeAbs = lastPrice * (changePct / 100);
  const indexPrice = lastPrice * 1.0005;
  const markPrice = lastPrice * 0.9999;
  const fundingRatePct = 0.004;
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
  const openInterest = oiBase * exchangeMultiplier
  const volume24h = volBase * exchangeMultiplier

  // Mock Market Data
  const marketList = useMemo(() => {
    const baseList: MarketItem[] = [
      { displaySymbol: 'BTC', chartSymbol: 'BTCUSDT', base: 'BTC', price: 87010.0, changePct: -0.45, volume: 68200 * 87000 },
      { displaySymbol: 'ETH', chartSymbol: 'ETHUSDT', base: 'ETH', price: 4850.2, changePct: 1.25, volume: 450000 * 4800 },
      { displaySymbol: 'SOL', chartSymbol: 'SOLUSDT', base: 'SOL', price: 145.8, changePct: 5.4, volume: 1200000 * 145 },
      { displaySymbol: 'XRP', chartSymbol: 'XRPUSDT', base: 'XRP', price: 1.12, changePct: -2.3, volume: 50000000 * 1.1 },
      { displaySymbol: 'BNB', chartSymbol: 'BNBUSDT', base: 'BNB', price: 620.5, changePct: 0.8, volume: 150000 * 620 },
      { displaySymbol: 'DOGE', chartSymbol: 'DOGEUSDT', base: 'DOGE', price: 0.38, changePct: 8.5, volume: 800000000 * 0.38 },
      { displaySymbol: 'ADA', chartSymbol: 'ADAUSDT', base: 'ADA', price: 0.75, changePct: -1.1, volume: 45000000 * 0.75 },
      { displaySymbol: 'AVAX', chartSymbol: 'AVAXUSDT', base: 'AVAX', price: 42.6, changePct: 3.2, volume: 800000 * 42 },
      { displaySymbol: 'LINK', chartSymbol: 'LINKUSDT', base: 'LINK', price: 18.9, changePct: 0.5, volume: 1200000 * 18 },
      { displaySymbol: 'DOT', chartSymbol: 'DOTUSDT', base: 'DOT', price: 8.4, changePct: -0.9, volume: 2500000 * 8.4 },
    ];

    // Adjust prices based on exchange selection simulation
    return baseList.map(item => {
      let price = item.price;
      let volume = item.volume;

      if (!isAggregated) {
        if (selectedExchange === 'binance') {
          price *= 1.0001;
          volume *= 0.6;
        } else {
          price *= 0.9999;
          volume *= 0.3;
        }
      }

      // Slightly different data for Spot vs Futures
      if (marketType === 'spot') {
        price *= 1.0005; // Spot usually slight premium/discount
        volume *= 0.8; 
      }

      const displaySymbol =
        marketType === 'futures'
          ? `${item.chartSymbol}` // BTCUSDT
          : `${item.base}/USDT`; // BTC/USDT

      return {
        ...item,
        displaySymbol,
        price,
        volume
      };
    });
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
    <div className={`${isCompact ? 'h-[48px]' : 'h-[61px]'} bg-[#161b22] border-b border-[#30363d] flex items-center text-[#c9d1d9] w-full`}>
      {/* Left Area: Removed Navigation */}
      
      {/* Center & Right Area: Full width now */}
      <div className="flex-1 flex items-center gap-6 px-4 h-full relative min-w-0">
        {/* Symbol and Main Price */}
        <div className="flex items-center gap-4 flex-none relative" ref={menuRef}>
          <button
            type="button"
            className={`flex items-center gap-2 cursor-pointer group hover:bg-[#1f2937] rounded transition-colors ${isCompact ? 'p-1' : 'p-1'}`}
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
              <ChevronDownIcon className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} text-[#8b949e] group-hover:text-[#c9d1d9] transition-transform ${isSymbolMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Symbol Selector Dropdown */}
          {isSymbolMenuOpen && (
            <div className={`absolute top-full left-0 mt-2 ${isCompact ? 'w-[320px]' : 'w-[480px]'} bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100`}>
              {/* Header / Tabs */}
              <div className="flex items-center border-b border-[#30363d]">
                <button
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'futures' ? 'text-[#c9d1d9] bg-[#1f2937]' : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1f2937]/50'}`}
                  onClick={() => setMarketType('futures')}
                >
                  {t('trade.market_type_futures')}
                </button>
                <button
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'spot' ? 'text-[#c9d1d9] bg-[#1f2937]' : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1f2937]/50'}`}
                  onClick={() => setMarketType('spot')}
                >
                  {t('trade.market_type_spot')}
                </button>
              </div>

              {/* Search Bar */}
              <div className={`${isCompact ? 'p-2' : 'p-3'} border-b border-[#30363d]`}>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]" />
                  <input 
                    type="text" 
                    placeholder={t('chart.modal.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full bg-[#0d1117] border border-[#30363d] rounded ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} pl-9 pr-3 text-[#c9d1d9] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff]`}
                  />
                </div>
              </div>

              {/* List Header */}
              <div className={`grid grid-cols-4 ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2'} text-xs text-[#8b949e] bg-[#1c2128]`}>
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
                    className={`w-full text-left grid grid-cols-4 ${isCompact ? 'px-3 py-2' : 'px-4 py-2.5'} text-xs cursor-pointer transition-colors border-b border-[#30363d]/50 last:border-0 ${
                      isSelected ? 'bg-[#1f2937]' : 'hover:bg-[#1f2937]'
                    }`}
                    onClick={() => {
                      setSelectedSymbol(item.chartSymbol);
                      setIsSymbolMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 text-left col-span-1 min-w-0">
                      <StarIcon className="w-3 h-3 text-[#8b949e] hover:text-yellow-500 flex-shrink-0" />
                      <span className={`font-bold truncate ${isSelected ? 'text-white' : 'text-[#c9d1d9]'}`}>{item.displaySymbol}</span>
                      {marketType === 'futures' && !isCompact && (
                        <span className="ml-1 px-1.5 py-0.5 rounded border border-[#30363d] bg-[#0d1117] text-[10px] text-[#8b949e] whitespace-nowrap">
                          {t('trade.perpTag')}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[#c9d1d9] font-mono col-span-1">
                      {priceFormatter.format(item.price)}
                    </div>
                    <div className={`text-right font-medium col-span-1 ${item.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {formatPct(item.changePct)}
                    </div>
                    <div className="text-right text-[#c9d1d9] col-span-1">
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
        <div className={`flex-1 flex items-center gap-6 ${isCompact ? 'text-[10px]' : 'text-[11px]'} overflow-x-auto no-scrollbar`}>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.index_price')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(indexPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.mark_price')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(markPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <div className="flex items-center gap-1">
              <span className="text-[#8b949e] whitespace-nowrap">{t('trade.funding_rate')}</span>
              <InfoIcon className="w-3 h-3 text-[#8b949e]" />
            </div>
            <span className="text-orange-400 whitespace-nowrap">{formatPct(fundingRatePct)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_low')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd2(low24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_high')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(high24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.open_interest')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{compactFormatter.format(openInterest)} {selectedBase}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_volume')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{compactFormatter.format(volume24h)} {selectedBase}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
