import { ChevronDown, RefreshCcw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { BodyText, PageTitle } from '@/components/ui/Typography';

interface LiquidationMapHeaderProps {
  symbol: string;
  setSymbol: (s: string) => void;
  range: string;
  setRange: (r: string) => void;
  exchangeType: string;
  setExchangeType: (e: string) => void;
  onRefresh: () => void;
}

const FilterButton = ({ value, options, onChange }: { 
  value: string, 
  options: string[], 
  onChange: (v: string) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 bg-[#21262d] border rounded-md text-[#e6edf3] text-sm min-w-[100px] transition-all active:scale-95 ${
          isOpen 
            ? 'border-transparent bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20' 
            : 'border-[#30363d] hover:border-[#8b949e]'
        }`}
      >
        <span className={`mr-2 ${isOpen ? 'text-white font-bold' : ''}`}>{value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-[#8b949e]'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[#161b22] border border-[#30363d] rounded-md shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-150">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                value === opt 
                  ? 'bg-gradient-to-r from-primary to-secondary text-white font-bold' 
                  : 'text-[#e6edf3] hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const symbolNames: Record<string, string> = {
  'BTC': '比特币',
  'ETH': '以太坊',
  'SOL': 'Solana',
  'XRP': '瑞波币',
  'DOGE': '狗狗币',
  'BNB': '币安币',
  'HYPE': 'Hyperliquid',
  'LINK': 'Chainlink',
  'AVAX': 'Avalanche',
  'ADA': 'Cardano'
};

export const LiquidationMapHeader = ({ 
  symbol, 
  setSymbol, 
  range, 
  setRange, 
  exchangeType,
  setExchangeType,
  onRefresh 
}: LiquidationMapHeaderProps) => {
  return (
    <div className="flex flex-col gap-8 mb-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <PageTitle>{symbolNames[symbol] || symbol}交易所清算地图</PageTitle>
          <BodyText>实时全网爆仓热力图数据</BodyText>
        </div>
        <div className="flex items-center gap-3">
          <FilterButton 
            value={exchangeType} 
            options={['All', 'CEX', 'DEX']} 
            onChange={setExchangeType} 
          />
          <FilterButton 
            value={symbol} 
            options={['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'LINK', 'AVAX', 'ADA']} 
            onChange={setSymbol} 
          />
          <FilterButton 
            value={range} 
            options={['1天', '7天', '30天']} 
            onChange={setRange} 
          />
          <button 
            type="button"
            onClick={(e) => {
              const btn = e.currentTarget.querySelector('svg');
              btn?.classList.add('animate-spin');
              setTimeout(() => btn?.classList.remove('animate-spin'), 500);
              onRefresh();
            }}
            className="p-2 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] hover:bg-[#30363d] hover:border-[#8b949e] transition-all active:scale-95 group shadow-sm"
          >
            <RefreshCcw className="w-5 h-5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
