'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionTitle } from '@/components/ui/Typography';

interface OIData {
  rank: number | string;
  exchange: string;
  logo: string;
  oiAsset: number;
  oiUsd: number;
  ratioPct: number;
  change1hPct: number;
  change4hPct: number;
  change24hPct: number;
  oiVolRatio: number;
  isTotal?: boolean;
}

type SortField = 'oiAsset' | 'oiUsd' | 'ratioPct' | 'change1hPct' | 'change4hPct' | 'change24hPct' | null;
type SortDirection = 'asc' | 'desc' | null;

const mockOIData: OIData[] = [
  {
    rank: '',
    exchange: 'ALL',
    logo: '',
    oiAsset: 661_000,
    oiUsd: 59_386_000_000,
    ratioPct: 100,
    change1hPct: 0.24,
    change4hPct: 1.78,
    change24hPct: 1.39,
    oiVolRatio: 0.9476,
    isTotal: true
  },
  {
    rank: 1,
    exchange: 'Binance',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
    oiAsset: 123_500,
    oiUsd: 11_098_000_000,
    ratioPct: 18.68,
    change1hPct: 0.49,
    change4hPct: 2.25,
    change24hPct: 0.40,
    oiVolRatio: 0.9406
  },
  {
    rank: 2,
    exchange: 'CME',
    logo: 'https://www.cmegroup.com/favicon.ico',
    oiAsset: 123_000,
    oiUsd: 11_049_000_000,
    ratioPct: 18.6,
    change1hPct: 0.16,
    change4hPct: 0.99,
    change24hPct: 1.32,
    oiVolRatio: 1.2749
  },
  {
    rank: 3,
    exchange: 'Bybit',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
    oiAsset: 60_600,
    oiUsd: 5_447_000_000,
    ratioPct: 9.17,
    change1hPct: -0.05,
    change4hPct: 2.17,
    change24hPct: 0.35,
    oiVolRatio: 1.0773
  },
  {
    rank: 4,
    exchange: 'MEXC',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/544.png',
    oiAsset: 58_600,
    oiUsd: 5_261_000_000,
    ratioPct: 8.85,
    change1hPct: 0.35,
    change4hPct: 2.84,
    change24hPct: 1.57,
    oiVolRatio: 0.4723
  },
  {
    rank: 5,
    exchange: 'Gate',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',
    oiAsset: 53_300,
    oiUsd: 4_789_000_000,
    ratioPct: 8.06,
    change1hPct: 0.98,
    change4hPct: 6.05,
    change24hPct: 4.81,
    oiVolRatio: 0.9265
  },
  {
    rank: 6,
    exchange: 'HTX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/102.png',
    oiAsset: 39_900,
    oiUsd: 3_580_000_000,
    ratioPct: 6.02,
    change1hPct: 0.18,
    change4hPct: 0.89,
    change24hPct: 1.29,
    oiVolRatio: 0.8976
  },
  {
    rank: 7,
    exchange: 'OKX',
    logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
    oiAsset: 37_800,
    oiUsd: 3_391_000_000,
    ratioPct: 5.71,
    change1hPct: -0.22,
    change4hPct: 1.64,
    change24hPct: 1.25,
    oiVolRatio: 0.6
  },
  {
    rank: 8,
    exchange: 'Hyperliquid',
    logo: 'https://app.hyperliquid.xyz/favicon.ico',
    oiAsset: 18_900,
    oiUsd: 1_698_000_000,
    ratioPct: 2.86,
    change1hPct: 0.87,
    change4hPct: 2.34,
    change24hPct: 1.92,
    oiVolRatio: 0.8234
  },
  {
    rank: 9,
    exchange: 'Aster',
    logo: 'https://via.placeholder.com/20/6366f1/ffffff?text=A',
    oiAsset: 9_800,
    oiUsd: 881_000_000,
    ratioPct: 1.48,
    change1hPct: 0.56,
    change4hPct: 1.78,
    change24hPct: 1.23,
    oiVolRatio: 0.7156
  },
  {
    rank: 10,
    exchange: 'Lighter',
    logo: 'https://lighter.xyz/favicon.ico',
    oiAsset: 6_700,
    oiUsd: 602_000_000,
    ratioPct: 1.01,
    change1hPct: -0.12,
    change4hPct: 0.89,
    change24hPct: 0.67,
    oiVolRatio: 0.6789
  }
];

const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', 'ZEC', 'BCH', 'SUI', 'ADA', 'LINK', 'AVAX'];

export const AggregatedOI = ({ variant = 'default' }: { variant?: 'default' | 'compact' }) => {
  const { t, i18n } = useTranslation();
  const [activeSymbol, setActiveTabSymbol] = useState('BTC');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  const numberCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const currencyCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const sortedData = useMemo(() => {
    // Generate different data values based on the symbol to avoid data mismatch
    const symbolSeed = activeSymbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const data = mockOIData.map(row => {
      if (row.isTotal) return row;
      
      // Slightly vary the numbers based on the symbol for realistic mock behavior
      const factor = 1 + (symbolSeed % 10 - 5) / 100;
      
      return {
        ...row,
        oiAsset: row.oiAsset * factor,
        oiUsd: row.oiUsd * factor,
      };
    });

    if (!sortField || !sortDirection) return data;

    const exchangeRows = data.filter(row => !row.isTotal);
    const totalRow = data.find(row => row.isTotal);

    exchangeRows.sort((a, b) => {
      const aVal = a[sortField as keyof OIData] as number;
      const bVal = b[sortField as keyof OIData] as number;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return totalRow ? [totalRow, ...exchangeRows] : exchangeRows;
  }, [sortField, sortDirection, activeSymbol]);

  const formatSignedPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
  const formatRatio = (val: number) => `${val.toFixed(2)}%`
  const formatAssetAmount = (val: number) => `${numberCompact.format(val)} ${activeSymbol}`

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

  const renderValueWithColor = (val: number) => {
    const isPositive = val > 0;
    const isNegative = val < 0;
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
        {formatSignedPct(val)}
      </span>
    );
  };

  return (
    <div className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-6'}`}>
      <div className="flex items-center justify-between">
        <SectionTitle className={isCompact ? '!text-sm' : ''}>{t('aggregatedOrderbook.openInterest.title', { symbol: activeSymbol })}</SectionTitle>
      </div>

      <div className={`flex flex-col bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden ${isCompact ? '' : 'shadow-2xl'}`}>
        {/* Symbol Tabs & Search */}
        <div className={`flex items-center justify-between px-4 border-b border-[#30363d] bg-[#0d1117]/30 ${isCompact ? 'py-1' : ''}`}>
          {!isCompact ? (
            <div className="flex items-center overflow-x-auto cf-scrollbar">
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
          ) : (
            <div className="flex-1" />
          )}
          <div className={`flex items-center gap-2 pl-4 ${isCompact ? 'py-1' : 'py-2'}`}>
            <div className="relative" ref={dropdownRef}>
              {/* For compact mode, combine symbol selection and search into a single button-like dropdown */}
              {isCompact ? (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between gap-2 bg-[#0d1117] border border-[#30363d] rounded-md px-2 py-1 text-xs text-[#e6edf3] hover:border-[#8b949e] transition-all min-w-[80px]"
                >
                  <span className="font-medium">{activeSymbol}</span>
                  <ChevronDown className={`w-3 h-3 text-[#8b949e] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] z-10" />
                  <input 
                    type="text" 
                    placeholder={t('aggregatedOrderbook.openInterest.searchPlaceholder')} 
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
                </>
              )}
              
              {isDropdownOpen && (
                <div className={`absolute top-full right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 overflow-hidden cf-scrollbar ${isCompact ? 'w-32 max-h-48' : 'left-0 max-h-60'}`}>
                  {isCompact && (
                    <div className="p-2 border-b border-[#30363d]">
                      <input 
                        type="text" 
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3] focus:outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-40 cf-scrollbar">
                    {(searchQuery ? filteredSymbols : symbols).map(s => (
                      <div 
                        key={s}
                        onClick={() => {
                          setActiveTabSymbol(s);
                          setSearchQuery('');
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} text-[#e6edf3] hover:bg-[#30363d] cursor-pointer transition-colors ${activeSymbol === s ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto cf-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className={`bg-[#0d1117]/50 text-[#8b949e] uppercase tracking-wider ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-center border-b border-[#30363d] w-16`}>{t('aggregatedOrderbook.openInterest.table.rank')}</th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold border-b border-[#30363d]`}>{t('aggregatedOrderbook.openInterest.table.exchange')}</th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('oiAsset')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {isCompact ? t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: '' }) : t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: activeSymbol })} {renderSortIcon('oiAsset')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('oiUsd')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.oiUsd')} {renderSortIcon('oiUsd')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('ratioPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.ratio')} {renderSortIcon('ratioPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('change1hPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.change1h')} {renderSortIcon('change1hPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('change4hPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.change4h')} {renderSortIcon('change4hPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    onClick={() => handleSort('change24hPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.change24h')} {renderSortIcon('change24hPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-center border-b border-[#30363d]`}>{t('aggregatedOrderbook.openInterest.table.oiVolRatio')}</th>
              </tr>
            </thead>
            <tbody className={isCompact ? 'text-xs' : 'text-sm'}>
              {sortedData.map((row) => (
                <tr 
                  key={row.isTotal ? 'total' : row.exchange} 
                  className={`border-b border-[#30363d]/50 hover:bg-[#1f2937]/30 transition-colors ${
                    row.isTotal ? 'bg-[#30363d]/20 font-bold' : ''
                  }`}
                >
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-center text-[#8b949e]`}>{row.rank}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'}`}>
                    <div className="flex items-center gap-2">
                      {row.logo && (
                        <div className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full overflow-hidden flex-none border border-[#30363d]`}>
                          <img src={row.logo} alt={row.exchange} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className={row.isTotal ? `text-white ${isCompact ? 'font-bold text-sm' : ''}` : 'text-[#e6edf3]'}>
                        {row.isTotal ? t('common.all') : row.exchange}
                      </span>
                    </div>
                  </td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right text-[#e6edf3]`}>{formatAssetAmount(row.oiAsset)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right text-[#e6edf3]`}>{currencyCompact.format(row.oiUsd)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right text-[#e6edf3]`}>{formatRatio(row.ratioPct)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right font-medium`}>{renderValueWithColor(row.change1hPct)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right font-medium`}>{renderValueWithColor(row.change4hPct)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-right font-medium`}>{renderValueWithColor(row.change24hPct)}</td>
                  <td className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} text-center text-[#e6edf3]`}>{row.oiVolRatio.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

