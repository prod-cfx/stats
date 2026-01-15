'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubTitle } from '@/components/ui/Typography';
import { API_BASE_URL } from '@/lib/api-client';

// Type definition matching backend AggregatedVolumeResponseDto
interface AggregatedVolumeItem {
  id: number;
  exchange: string;
  symbol: string;
  instrumentType?: 'SPOT' | 'PERPETUAL';
  volumeUsd: string;
  dataTimestamp: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

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
  isCompact?: boolean;
}

const TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB'];

const VolumeComparisonCard: React.FC<VolumeComparisonCardProps> = ({ title, symbol, items, onSymbolChange, isCompact }) => {
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
    <div className={`bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-2xl ${isCompact ? 'p-4 gap-4' : 'p-6 gap-6'} flex flex-col shadow-xl h-full relative`}>
      {/* Card Header ... */}
      <div className="flex items-center justify-between">
        <SubTitle className={isCompact ? '!text-sm' : ''}>{title}</SubTitle>
        <div className="relative" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg ${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} font-medium text-[color:var(--cf-muted)] hover:border-[color:var(--cf-muted)] transition-all hover:text-[color:var(--cf-text)]`}
          >
            <span>{symbol}</span>
            <ChevronDown className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`absolute top-full right-0 mt-2 ${isCompact ? 'w-24' : 'w-32'} bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto cf-scrollbar`}
              >
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onSymbolChange?.(t);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between ${isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                      symbol === t ? 'text-[color:var(--cf-text-strong)] bg-[color:var(--cf-surface-2)] font-bold' : 'text-[color:var(--cf-muted)]'
                    }`}
                  >
                    <span>{t}</span>
                    {symbol === t && <Check className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-primary`} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Rows List */}
      <div className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-4'} relative`}>
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className={`flex items-center ${isCompact ? 'gap-2' : 'gap-4'} group cursor-pointer relative`}
            onMouseEnter={() => setHoveredItem(item)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {/* Name */}
            <span className={`${isCompact ? 'w-16 text-xs' : 'w-24 text-sm'} font-medium transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
              hoveredItem?.name === item.name ? 'text-[color:var(--cf-text-strong)] bg-[color:var(--cf-bg)] px-2 py-0.5 rounded border border-[color:var(--cf-border)]' : 'text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)]'
            }`}>
              {displayName(item.name)}
            </span>

            {/* Progress Bar Container */}
            <div className={`flex-1 ${isCompact ? 'h-1.5' : 'h-2'} bg-[color:var(--cf-bg)] rounded-full overflow-hidden relative border border-[color:var(--cf-border)]/50`}>
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
            <span className={`${isCompact ? 'w-16 text-xs' : 'w-24 text-sm'} text-right font-bold text-[color:var(--cf-text)]`}>
              {item.amount}
            </span>
            
            {/* Tooltip */}
            <AnimatePresence>
              {hoveredItem?.name === item.name && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute -top-16 z-[100] bg-[color:var(--cf-surface)]/95 border border-[color:var(--cf-border)] rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[200px] pointer-events-none -translate-x-1/4"
                  style={{ left: `calc(${isCompact ? '64px' : '96px'} + ${item.percent / 2}%)` }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-bold text-[color:var(--cf-text-strong)] border-b border-[color:var(--cf-border)]/60 pb-1.5">{displayName(item.name)}</div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full ring-2 ring-[color:var(--cf-border)]/50" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-[color:var(--cf-muted)] font-medium">{t('aggregatedOrderbook.volume.contractTurnover')}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-[color:var(--cf-text-strong)] tracking-tight">{item.amount}</span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -bottom-1.5 left-1/4 -translate-x-1/2 w-3 h-3 bg-[color:var(--cf-surface)] border-r border-b border-[color:var(--cf-border)] rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AggregatedVolume = ({ variant = 'default' }: { variant?: 'default' | 'compact' }) => {
  const { t } = useTranslation();
  const [leftSymbol, setLeftSymbol] = useState('BTC');
  const [rightSymbol, setRightSymbol] = useState('ETH');
  const [leftItems, setLeftItems] = useState<VolumeItem[]>([]);
  const [rightItems, setRightItems] = useState<VolumeItem[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  const isCompact = variant === 'compact';

  // Color palette for exchanges
  const EXCHANGE_COLORS = [
    '#3b82f6', '#a855f7', '#f43f5e', '#eab308', '#22c55e',
    '#06b6d4', '#6366f1', '#8b5cf6', '#ef4444', '#f59e0b',
    '#10b981', '#0ea5e9', '#ec4899', '#14b8a6', '#f97316'
  ];

  // Fetch aggregated volume data from backend
  const fetchVolumeData = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/markets/volume/aggregated?symbol=${symbol}&instrumentType=PERPETUAL&page=1&limit=20`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = await res.json();
      const response = body && typeof body === 'object' && 'data' in body ? body : { data: body };

      if (response.data && response.data.items) {
        const items = response.data.items;

        // Calculate total volume for percentage calculation
        const totalVolume = items.find((item: AggregatedVolumeItem) => item.exchange === 'All')?.volumeUsd
          ? Number.parseFloat(items.find((item: AggregatedVolumeItem) => item.exchange === 'All')!.volumeUsd)
          : 0;

        // Convert API data to VolumeItem format
        const volumeItems: VolumeItem[] = items.map((item: AggregatedVolumeItem, idx: number) => {
          const volumeUsd = Number.parseFloat(item.volumeUsd);
          const percent = totalVolume > 0 ? (volumeUsd / totalVolume) * 100 : 0;
          const amountB = volumeUsd / 1_000_000_000;

          return {
            name: item.exchange === 'All' ? 'TOTAL' : item.exchange,
            amount: `$${amountB.toFixed(2)}B`,
            percent,
            color: EXCHANGE_COLORS[idx % EXCHANGE_COLORS.length],
          };
        });

        return volumeItems;
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch volume data for ${symbol}:`, error);
      return [];
    }
  }, []);

  // Fetch left symbol data
  useEffect(() => {
    let isMounted = true;

    const fetchLeft = async () => {
      const data = await fetchVolumeData(leftSymbol);
      if (isMounted) {
        setLeftItems(data);
        setIsLoading(false);
      }
    };

    fetchLeft();

    // Poll every 3 seconds
    const interval = setInterval(fetchLeft, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [leftSymbol, fetchVolumeData]);

  // Fetch right symbol data (only if not compact)
  useEffect(() => {
    if (isCompact) return;

    let isMounted = true;

    const fetchRight = async () => {
      const data = await fetchVolumeData(rightSymbol);
      if (isMounted) {
        setRightItems(data);
      }
    };

    fetchRight();

    // Poll every 3 seconds
    const interval = setInterval(fetchRight, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rightSymbol, fetchVolumeData, isCompact]);

  return (
    <div className={`flex flex-col ${isCompact ? 'gap-2 pb-0 h-full' : 'gap-8 pb-12'}`}>
      <div className={`grid grid-cols-1 ${isCompact ? 'h-full' : 'xl:grid-cols-2'} ${isCompact ? 'gap-0' : 'gap-8'} items-stretch`}>
        <VolumeComparisonCard 
          title={t('aggregatedOrderbook.volume.title', { symbol: leftSymbol })} 
          symbol={leftSymbol} 
          items={leftItems}
          onSymbolChange={setLeftSymbol}
          isCompact={isCompact}
        />
        {!isCompact && (
          <VolumeComparisonCard 
            title={t('aggregatedOrderbook.volume.title', { symbol: rightSymbol })} 
            symbol={rightSymbol} 
            items={rightItems}
            onSymbolChange={setRightSymbol}
            isCompact={isCompact}
          />
        )}
      </div>
    </div>
  );
};
