'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitle } from '@/components/ui/Typography';

interface OIData {
  rank: number | string;
  exchange: string;
  logo: string;
  oiBtc: string;
  oiUsd: string;
  ratio: string;
  change1h: string;
  change4h: string;
  change24h: string;
  oiVolRatio: string;
  isTotal?: boolean;
}

type SortField = 'oiBtc' | 'oiUsd' | 'ratio' | 'change1h' | 'change4h' | 'change24h' | null;
type SortDirection = 'asc' | 'desc' | null;

const mockOIData: OIData[] = [
  {
    rank: '',
    exchange: '全部',
    logo: '',
    oiBtc: '66.10万 BTC',
    oiUsd: '$593.86亿',
    ratio: '100%',
    change1h: '+0.24%',
    change4h: '+1.78%',
    change24h: '+1.39%',
    oiVolRatio: '0.9476',
    isTotal: true
  },
  {
    rank: 1,
    exchange: 'Binance',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
    oiBtc: '12.35万 BTC',
    oiUsd: '$110.98亿',
    ratio: '18.68%',
    change1h: '+0.49%',
    change4h: '+2.25%',
    change24h: '+0.40%',
    oiVolRatio: '0.9406'
  },
  {
    rank: 2,
    exchange: 'CME',
    logo: 'https://www.cmegroup.com/favicon.ico',
    oiBtc: '12.30万 BTC',
    oiUsd: '$110.49亿',
    ratio: '18.6%',
    change1h: '+0.16%',
    change4h: '+0.99%',
    change24h: '+1.32%',
    oiVolRatio: '1.2749'
  },
  {
    rank: 3,
    exchange: 'Bybit',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
    oiBtc: '6.06万 BTC',
    oiUsd: '$54.47亿',
    ratio: '9.17%',
    change1h: '-0.05%',
    change4h: '+2.17%',
    change24h: '+0.35%',
    oiVolRatio: '1.0773'
  },
  {
    rank: 4,
    exchange: 'MEXC',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/544.png',
    oiBtc: '5.86万 BTC',
    oiUsd: '$52.61亿',
    ratio: '8.85%',
    change1h: '+0.35%',
    change4h: '+2.84%',
    change24h: '+1.57%',
    oiVolRatio: '0.4723'
  },
  {
    rank: 5,
    exchange: 'Gate',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',
    oiBtc: '5.33万 BTC',
    oiUsd: '$47.89亿',
    ratio: '8.06%',
    change1h: '+0.98%',
    change4h: '+6.05%',
    change24h: '+4.81%',
    oiVolRatio: '0.9265'
  },
  {
    rank: 6,
    exchange: 'HTX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/102.png',
    oiBtc: '3.99万 BTC',
    oiUsd: '$35.80亿',
    ratio: '6.02%',
    change1h: '+0.18%',
    change4h: '+0.89%',
    change24h: '+1.29%',
    oiVolRatio: '0.8976'
  },
  {
    rank: 7,
    exchange: 'OKX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
    oiBtc: '3.78万 BTC',
    oiUsd: '$33.91亿',
    ratio: '5.71%',
    change1h: '-0.22%',
    change4h: '+1.64%',
    change24h: '+1.25%',
    oiVolRatio: '0.6000'
  },
  {
    rank: 8,
    exchange: 'Hyperliquid',
    logo: 'https://app.hyperliquid.xyz/favicon.ico',
    oiBtc: '1.89万 BTC',
    oiUsd: '$16.98亿',
    ratio: '2.86%',
    change1h: '+0.87%',
    change4h: '+2.34%',
    change24h: '+1.92%',
    oiVolRatio: '0.8234'
  },
  {
    rank: 9,
    exchange: 'Aster',
    logo: 'https://via.placeholder.com/20/6366f1/ffffff?text=A',
    oiBtc: '0.98万 BTC',
    oiUsd: '$8.81亿',
    ratio: '1.48%',
    change1h: '+0.56%',
    change4h: '+1.78%',
    change24h: '+1.23%',
    oiVolRatio: '0.7156'
  },
  {
    rank: 10,
    exchange: 'Lighter',
    logo: 'https://lighter.xyz/favicon.ico',
    oiBtc: '0.67万 BTC',
    oiUsd: '$6.02亿',
    ratio: '1.01%',
    change1h: '-0.12%',
    change4h: '+0.89%',
    change24h: '+0.67%',
    oiVolRatio: '0.6789'
  }
];

const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', 'ZEC', 'BCH', 'SUI', 'ADA', 'LINK', 'AVAX'];

export const AggregatedOI = () => {
  const [activeSymbol, setActiveTabSymbol] = useState('BTC');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse numeric values for sorting
  const parseValue = (val: string) => {
    return Number(val.replace(/[^\d.-]/g, '')) || 0;
  };

  const sortedData = useMemo(() => {
    const data = [...mockOIData];
    // Keep "Total" row separate if needed, but here we can just sort all
    if (!sortField || !sortDirection) return data;

    const exchangeRows = data.filter(row => !row.isTotal);
    const totalRow = data.find(row => row.isTotal);

    exchangeRows.sort((a, b) => {
      const aVal = parseValue(a[sortField as keyof OIData] as string);
      const bVal = parseValue(b[sortField as keyof OIData] as string);
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return totalRow ? [totalRow, ...exchangeRows] : exchangeRows;
  }, [sortField, sortDirection]);

  const filteredSymbols = useMemo(() => {
    return symbols.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-[#8b949e] opacity-30 group-hover:opacity-100 transition-opacity" />;
    return sortDirection === 'desc' 
      ? <ChevronDown className="w-3 h-3 text-primary" /> 
      : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  const renderValueWithColor = (val: string) => {
    const isPositive = val.startsWith('+');
    const isNegative = val.startsWith('-');
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
        {val}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>{activeSymbol} 合约总持仓</SectionTitle>
      </div>

      <div className="flex flex-col bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
        {/* Symbol Tabs & Search */}
        <div className="flex items-center justify-between px-4 border-b border-[#30363d] bg-[#0d1117]/30">
          <div className="flex items-center overflow-x-auto no-scrollbar">
            {symbols.map(s => (
              <button
                type="button"
                key={s}
                onClick={() => setActiveTabSymbol(s)}
                className={`px-4 py-3 text-sm font-semibold transition-all relative whitespace-nowrap ${
                  activeSymbol === s 
                    ? 'text-white' 
                    : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
                }`}
              >
                {s}
                {activeSymbol === s && (
                  <>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pl-4 py-2">
            <div className="relative" ref={dropdownRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] z-10" />
              <input 
                type="text" 
                placeholder="搜索" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="bg-[#0d1117] border border-[#30363d] rounded-md pl-9 pr-10 py-1.5 text-sm text-[#e6edf3] focus:outline-none focus:border-primary transition-all w-48 relative z-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none z-10">
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              {isDropdownOpen && filteredSymbols.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 max-h-60 overflow-y-auto">
                  {filteredSymbols.map(s => (
                    <div 
                      key={s}
                      onClick={() => {
                        setActiveTabSymbol(s);
                        setSearchQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className="px-4 py-2 text-sm text-[#e6edf3] hover:bg-[#30363d] cursor-pointer transition-colors"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#0d1117]/50 text-[#8b949e] text-xs uppercase tracking-wider">
                <th className="px-4 py-4 font-bold text-center border-b border-[#30363d] w-16">排名</th>
                <th className="px-4 py-4 font-bold border-b border-[#30363d]">交易所</th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('oiBtc')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    持仓({activeSymbol}) {renderSortIcon('oiBtc')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('oiUsd')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    持仓 {renderSortIcon('oiUsd')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('ratio')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    占比 {renderSortIcon('ratio')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('change1h')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    持仓变化(1小时) {renderSortIcon('change1h')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('change4h')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    持仓变化(4小时) {renderSortIcon('change4h')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-right border-b border-[#30363d]">
                  <button 
                    onClick={() => handleSort('change24h')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    持仓变化(24小时) {renderSortIcon('change24h')}
                  </button>
                </th>
                <th className="px-4 py-4 font-bold text-center border-b border-[#30363d]">持仓/24小时成交额</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sortedData.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`border-b border-[#30363d]/50 hover:bg-[#1f2937]/30 transition-colors ${
                    row.isTotal ? 'bg-[#30363d]/20 font-bold' : ''
                  }`}
                >
                  <td className="px-4 py-4 text-center text-[#8b949e]">{row.rank}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {row.logo && (
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-none border border-[#30363d]">
                          <img src={row.logo} alt={row.exchange} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className={row.isTotal ? 'text-white' : 'text-[#e6edf3]'}>{row.exchange}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-[#e6edf3]">{row.oiBtc.replace('BTC', activeSymbol)}</td>
                  <td className="px-4 py-4 text-right text-[#e6edf3]">{row.oiUsd}</td>
                  <td className="px-4 py-4 text-right text-[#e6edf3]">{row.ratio}</td>
                  <td className="px-4 py-4 text-right font-medium">{renderValueWithColor(row.change1h)}</td>
                  <td className="px-4 py-4 text-right font-medium">{renderValueWithColor(row.change4h)}</td>
                  <td className="px-4 py-4 text-right font-medium">{renderValueWithColor(row.change24h)}</td>
                  <td className="px-4 py-4 text-center text-[#e6edf3]">{row.oiVolRatio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

