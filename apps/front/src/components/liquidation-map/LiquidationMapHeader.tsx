import { RefreshCcw } from 'lucide-react';
import React from 'react';
import { FilterButton } from '@/components/ui/FilterButton';
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
