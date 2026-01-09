'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';

interface OrderItem {
  price: string;
  amount: string;
  total: string;
  exchanges: string[]; // URLs or identifiers
  depthPercent: number;
}

interface OrderbookTableProps {
  asks: OrderItem[];
  bids: OrderItem[];
  currentPrice: {
    price: string;
    usdPrice: string;
    change: string;
    changePercent: string;
  };
  displayMode?: 'both' | 'bids' | 'asks';
  variant?: 'default' | 'compact';
}

const OrderRow = ({
  item,
  type,
  selected,
  onSelect,
  variant = 'default',
}: {
  item: OrderItem;
  type: 'ask' | 'bid';
  selected: boolean;
  onSelect: () => void;
  variant?: 'default' | 'compact';
}) => {
  const [isFlash, setIsFlash] = useState(false);
  const isCompact = variant === 'compact';

  // Lightweight "tick" effect when data changes (kept subtle, CoinGlass-like)
  React.useEffect(() => {
    setIsFlash(true);
    const timer = setTimeout(() => setIsFlash(false), 180);
    return () => clearTimeout(timer);
  }, [item.price, item.amount]);

  const isAsk = type === 'ask';
  const barColor = isAsk ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'; // red-500 / green-500 low opacity
  const rowTint = 'transparent';
  const hoverTint = isAsk ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative group flex items-center px-1.5 ${isCompact ? 'py-[1px]' : 'py-[5px]'} transition-colors cursor-pointer text-left w-full
      `}
      style={{
        background: selected ? (isAsk ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)') : rowTint,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = hoverTint;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = selected
          ? (isAsk ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)')
          : rowTint;
      }}
    >
      {/* selected indicator */}
      {selected && (
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${isAsk ? 'bg-red-500' : 'bg-green-500'}`} />
      )}

      {/* Depth background bar (CoinGlass-style) */}
      <div
        className="absolute right-0 top-0 bottom-0 transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, item.depthPercent))}%`, background: barColor }}
      />

      {/* tiny flash on updates */}
      {isFlash && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: isAsk ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)' }}
        />
      )}
      
      <div className={`relative w-full flex items-center z-10 ${isCompact ? 'text-[9.5px] leading-3' : 'text-[12px] leading-4'} font-mono`}>
        <div className={`${isCompact ? 'w-[15%]' : 'w-[22%]'} flex items-center gap-0 opacity-70`}>
          {item.exchanges.slice(0, 2).map((ex, idx) => (
            <ExchangeLogo key={idx} logoUrl={ex} size={isCompact ? 8 : 13} />
          ))}
        </div>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right font-bold ${isAsk ? 'text-red-400' : 'text-green-400'}`}>{item.price}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right text-[#e6edf3] pr-0.5`}>{item.amount}</span>
        <span className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right text-[#8b949e]`}>{item.total}</span>
      </div>
    </button>
  );
};

export const OrderbookTable: React.FC<OrderbookTableProps> = ({ 
  asks, 
  bids, 
  displayMode = 'both',
  variant = 'default'
}) => {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isCompact = variant === 'compact';

  // Define a precise row height to ensure alignment (font + padding)
  const ROW_HEIGHT = isCompact ? 20 : 28; 
  const VISIBLE_ROWS = 26;
  const TOTAL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

  const { rows, canScroll } = useMemo(() => {
    const asksSorted = [...asks].sort((a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price));
    const bidsSorted = [...bids].sort((a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price));

    if (displayMode === 'asks') {
      return { 
        rows: asksSorted.map((x) => ({ ...x, _type: 'ask' as const })), 
        canScroll: true 
      };
    } 
    if (displayMode === 'bids') {
      return { 
        rows: bidsSorted.map((x) => ({ ...x, _type: 'bid' as const })), 
        canScroll: true 
      };
    }
    
    // Both mode: 8 asks, mid price, 8 bids
    const askCount = isCompact ? 8 : 13;
    const bidCount = isCompact ? 8 : 13;
    
    return {
      rows: [
        ...asksSorted.slice(-askCount).map((x) => ({ ...x, _type: 'ask' as const })),
        { isMid: true } as any, // Placeholder for mid price
        ...bidsSorted.slice(0, bidCount).map((x) => ({ ...x, _type: 'bid' as const })),
      ],
      canScroll: false
    };
  }, [asks, bids, displayMode, isCompact]);

  return (
    <div className={`flex flex-col ${isCompact ? 'h-fit' : 'h-full'} bg-[#0d1117] text-[#c9d1d9] ${isCompact ? 'overflow-visible' : 'overflow-hidden'} select-none`}>
      {/* Table Header */}
      <div className={`flex items-center px-3 border-b border-[#30363d] text-[#8b949e] ${isCompact ? 'text-[8.5px] h-[22px]' : 'text-[12px] h-[36px]'} font-semibold flex-none bg-[#0d1117] z-10`}>
        <span className={`${isCompact ? 'w-[15%]' : 'w-[22%]'}`}>{t('aggregatedOrderbook.table.exchange')}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right`}>{t('aggregatedOrderbook.table.price')}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right pr-0.5`}>{t('aggregatedOrderbook.table.amount')}</span>
        <span className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right`}>{t('aggregatedOrderbook.table.total')}</span>
      </div>

      {/* Table Body - Fixed height for exactly 26 rows */}
      <div 
        className={`flex-1 min-h-0 ${canScroll ? 'overflow-auto cf-scrollbar' : 'overflow-hidden'}`}
        style={{ height: isCompact ? 'auto' : `${TOTAL_HEIGHT}px`, maxHeight: isCompact ? 'none' : `${TOTAL_HEIGHT}px` }}
      >
        {rows.map((r, idx) => {
          if ((r as any).isMid) {
            return (
              <div key="mid-price" className={`flex items-center justify-center ${isCompact ? 'h-[24px] py-1' : 'h-[36px] py-2'} bg-white/5 border-y border-white/5`}>
                <div className={`flex items-center gap-3 ${isCompact ? 'text-[11px]' : 'text-sm'} font-bold`}>
                  <span className="text-white">{currentPrice.price}</span>
                  <span className={currentPrice.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}>
                    {currentPrice.changePercent}
                  </span>
                </div>
              </div>
            );
          }
          const key = `${r._type}-${r.price}-${idx}`;
          return (
            <div key={key} style={{ height: `${ROW_HEIGHT}px` }} className="flex items-center">
              <OrderRow
                item={r}
                type={r._type}
                selected={selectedKey === key}
                onSelect={() => setSelectedKey(key)}
                variant={variant}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};



