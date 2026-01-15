'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExchangeLogo } from '@/components/ui/ExchangeLogo';
import { useTheme } from '@/components/providers/ThemeProvider';

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
  const { theme } = useTheme();

  // Lightweight "tick" effect when data changes (kept subtle, CoinGlass-like)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsFlash(true);
    const timer = setTimeout(() => setIsFlash(false), 180);
    return () => clearTimeout(timer);
  }, [item.price, item.amount]);

  const isAsk = type === 'ask';
  const barColor = isAsk
    ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.10)')
    : (theme === 'dark' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.10)'); // red/green low opacity
  const rowTint = 'transparent';
  const hoverTint = isAsk
    ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.045)')
    : (theme === 'dark' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.045)');
  const selectedTint = isAsk
    ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)')
    : (theme === 'dark' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.06)');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative group flex items-center px-1.5 ${isCompact ? 'py-[1px]' : 'py-[5px]'} transition-colors cursor-pointer text-left w-full
      `}
      style={{
        background: selected ? selectedTint : rowTint,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = hoverTint;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = selected
          ? selectedTint
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
            <ExchangeLogo key={idx} name={ex} size={isCompact ? 8 : 13} />
          ))}
        </div>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right font-bold ${isAsk ? 'text-red-400' : 'text-green-400'}`}>{item.price}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right text-[color:var(--cf-text)] pr-0.5`}>{item.amount}</span>
        <span className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right text-[color:var(--cf-muted)]`}>{item.total}</span>
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
    
    // Both mode: Fixed 13 asks and 13 bids
    return {
      rows: [
        ...asksSorted.slice(-13).map((x) => ({ ...x, _type: 'ask' as const })),
        { _type: 'gap', price: '', amount: '', total: '', exchanges: [], depthPercent: 0 },
        ...bidsSorted.slice(0, 13).map((x) => ({ ...x, _type: 'bid' as const })),
      ],
      canScroll: false
    };
  }, [asks, bids, displayMode]);

  return (
    <div className="flex flex-col h-full bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] overflow-hidden select-none">
      {/* Table Header */}
      <div className={`flex items-center px-3 border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)] ${isCompact ? 'text-[8.5px] h-[22px]' : 'text-[12px] h-[36px]'} font-semibold flex-none bg-[color:var(--cf-bg)] z-10`}>
        <span className={`${isCompact ? 'w-[15%]' : 'w-[22%]'}`}>{t('aggregatedOrderbook.table.exchange')}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right`}>{t('aggregatedOrderbook.table.price')}</span>
        <span className={`${isCompact ? 'w-[28%]' : 'w-[26%]'} text-right pr-0.5`}>{t('aggregatedOrderbook.table.amount')}</span>
        <span className={`${isCompact ? 'w-[29%]' : 'w-[26%]'} text-right`}>{t('aggregatedOrderbook.table.total')}</span>
      </div>

      {/* Table Body - Fixed height for exactly 26 rows */}
      <div 
        className={`flex-1 min-h-0 ${canScroll ? 'overflow-auto cf-scrollbar' : 'overflow-hidden'}`}
        style={{ height: `${TOTAL_HEIGHT}px`, maxHeight: `${TOTAL_HEIGHT}px` }}
      >
        {rows.map((r, idx) => {
          if ((r as any)._type === 'gap') {
             return <div key="gap" className="h-2 bg-[color:var(--cf-bg)]" />
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



