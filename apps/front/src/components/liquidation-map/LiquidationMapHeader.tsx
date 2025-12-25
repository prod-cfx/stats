import React from 'react';
import { RefreshCcw, ChevronDown } from 'lucide-react';

interface LiquidationMapHeaderProps {
  symbol: string;
  setSymbol: (s: string) => void;
  range: string;
  setRange: (r: string) => void;
  onRefresh: () => void;
}

const FilterButton = ({ label, value, options, onChange }: { 
  label: string, 
  value: string, 
  options: string[], 
  onChange: (v: string) => void 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] text-sm min-w-[100px] hover:bg-[#30363d] transition-colors"
      >
        <span className="mr-2">{value}</span>
        <ChevronDown className={`w-4 h-4 text-[#8b949e] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-20">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[#e6edf3] hover:bg-[#21262d] transition-colors first:rounded-t-md last:rounded-b-md"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const LiquidationMapHeader = ({ symbol, setSymbol, range, setRange, onRefresh }: LiquidationMapHeaderProps) => {
  return (
    <div className="flex flex-col gap-6 mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#e6edf3]">比特币交易所清算地图</h1>
        <div className="flex items-center gap-3">
          <FilterButton 
            label="CEX/DEX" 
            value="All" 
            options={['All', 'CEX', 'DEX']} 
            onChange={() => {}} 
          />
          <FilterButton 
            label="Symbol" 
            value={symbol} 
            options={['BTC', 'ETH', 'SOL']} 
            onChange={setSymbol} 
          />
          <FilterButton 
            label="TimeRange" 
            value={range} 
            options={['1小时', '4小时', '1天', '7天']} 
            onChange={setRange} 
          />
          <button 
            onClick={onRefresh}
            className="p-2 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] hover:bg-[#30363d] transition-colors active:bg-[#3d444d]"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
