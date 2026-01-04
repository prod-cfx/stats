'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubTitle } from '@/components/ui/Typography';

interface VolumeItem {
  name: string;
  amount: string;
  percent: number; // 0-100
  color: string;
}

interface VolumeComparisonCardProps {
  title: string;
  symbol: string;
  items: VolumeItem[];
  onSymbolChange?: (symbol: string) => void;
}

const TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB'];

const VolumeComparisonCard: React.FC<VolumeComparisonCardProps> = ({ title, symbol, items, onSymbolChange }) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<VolumeItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = (name: string) => (name === 'TOTAL' ? t('aggregatedOrderbook.volume.total') : name);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-6 shadow-xl h-full relative">
      {/* Card Header ... */}
      <div className="flex items-center justify-between">
        <SubTitle>{title}</SubTitle>
        <div className="relative" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm font-medium text-[#8b949e] hover:border-[#8b949e] transition-all hover:text-white"
          >
            <span>{symbol}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 w-32 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
              >
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onSymbolChange?.(t);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/10 ${
                      symbol === t ? 'text-white bg-white/5 font-bold' : 'text-[#8b949e]'
                    }`}
                  >
                    <span>{t}</span>
                    {symbol === t && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Rows List */}
      <div className="flex flex-col gap-4 relative">
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-4 group cursor-pointer relative"
            onMouseEnter={() => setHoveredItem(item)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {/* Name */}
            <span className={`w-24 text-sm font-medium transition-colors ${
              hoveredItem?.name === item.name ? 'text-white bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]' : 'text-[#8b949e] group-hover:text-[#e6edf3]'
            }`}>
              {displayName(item.name)}
            </span>

            {/* Progress Bar Container */}
            <div className="flex-1 h-2 bg-[#0d1117] rounded-full overflow-hidden relative border border-white/5">
              <div 
                className="h-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${item.percent}%`, 
                  backgroundColor: item.color,
                  boxShadow: hoveredItem?.name === item.name ? `0 0 15px ${item.color}` : `0 0 10px ${item.color}40`
                }}
              />
            </div>

            {/* Amount */}
            <span className="w-24 text-right text-sm font-bold text-[#e6edf3]">
              {item.amount}
            </span>

            {/* Tooltip */}
            <AnimatePresence>
              {hoveredItem?.name === item.name && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute -top-16 z-[100] bg-[#0d1117]/95 border border-[#30363d] rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[200px] pointer-events-none -translate-x-1/4"
                  style={{ left: `calc(96px + ${item.percent / 2}%)` }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-bold text-white border-b border-white/10 pb-1.5">{displayName(item.name)}</div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-[#8b949e] font-medium">{t('aggregatedOrderbook.volume.contractTurnover')}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-white tracking-tight">{item.amount}</span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -bottom-1.5 left-1/4 -translate-x-1/2 w-3 h-3 bg-[#0d1117] border-r border-b border-[#30363d] rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AggregatedVolume = () => {
  const { t } = useTranslation();
  const [leftSymbol, setLeftSymbol] = useState('BTC');
  const [rightSymbol, setRightSymbol] = useState('ETH');

  // Stable seed-based "random" for mock data consistency
  const getStableAmount = (symbol: string) => {
    if (symbol === 'BTC') return 44.59;
    if (symbol === 'ETH') return 38.24;
    const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((seed * 9301 + 49297) % 233280) / 233280 * 20 + 5;
  };

  // Mock data generator based on symbol
  const getItemsForSymbol = (symbol: string) => {
    const baseAmount = getStableAmount(symbol);
    
    return [
      { name: 'TOTAL', amount: `$${baseAmount.toFixed(2)}B`, percent: 100, color: '#3b82f6' },
      { name: 'MEXC', amount: `$${(baseAmount * 0.28).toFixed(2)}B`, percent: 28.9, color: '#a855f7' },
      { name: 'OKX', amount: `$${(baseAmount * 0.19).toFixed(2)}B`, percent: 19.2, color: '#f43f5e' },
      { name: 'Bybit', amount: `$${(baseAmount * 0.14).toFixed(2)}B`, percent: 14.6, color: '#eab308' },
      { name: 'Bitget', amount: `$${(baseAmount * 0.10).toFixed(2)}B`, percent: 10.8, color: '#22c55e' },
      { name: 'BingX', amount: `$${(baseAmount * 0.06).toFixed(2)}B`, percent: 6.7, color: '#06b6d4' },
      { name: 'Bitunix', amount: `$${(baseAmount * 0.04).toFixed(2)}B`, percent: 4.3, color: '#6366f1' },
      { name: 'Hyperliquid', amount: `$${(baseAmount * 0.03).toFixed(2)}B`, percent: 3.1, color: '#8b5cf6' },
      { name: 'Aster', amount: `$${(baseAmount * 0.03).toFixed(2)}B`, percent: 3.0, color: '#ef4444' },
      { name: 'KuCoin', amount: `$${(baseAmount * 0.03).toFixed(2)}B`, percent: 3.0, color: '#f59e0b' },
      { name: 'LBank', amount: `$${(baseAmount * 0.019).toFixed(2)}B`, percent: 1.9, color: '#10b981' },
      { name: 'Lighter', amount: `$${(baseAmount * 0.022).toFixed(2)}B`, percent: 2.2, color: '#0ea5e9' },
    ];
  };

  const leftItems = React.useMemo(() => getItemsForSymbol(leftSymbol), [leftSymbol]);
  const rightItems = React.useMemo(() => getItemsForSymbol(rightSymbol), [rightSymbol]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
        <VolumeComparisonCard 
          title={t('aggregatedOrderbook.volume.title', { symbol: leftSymbol })} 
          symbol={leftSymbol} 
          items={leftItems}
          onSymbolChange={setLeftSymbol}
        />
        <VolumeComparisonCard 
          title={t('aggregatedOrderbook.volume.title', { symbol: rightSymbol })} 
          symbol={rightSymbol} 
          items={rightItems}
          onSymbolChange={setRightSymbol}
        />
      </div>
    </div>
  );
};
