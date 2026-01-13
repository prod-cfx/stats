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

// Prefer consistent brand logos, but be resilient: many public logo/CDN domains can be blocked/slow.
// We therefore try multiple sources in order and fall back to an inline SVG if all fail.
const EXCHANGE_LOGO_SOURCES: Record<string, string[]> = {
  CME: ['/images/exchanges/cme.png'],
  Binance: ['/images/exchanges/binance.png'],
  OKX: ['/images/exchanges/okx.png'],
  Bybit: ['/images/exchanges/bybit.png'],
  KuCoin: ['/images/exchanges/kucoin.png'],
  Bitfinex: ['/images/exchanges/bitfinex.png'],
  Bitget: ['/images/exchanges/bitget.png'],
  MEXC: ['/images/exchanges/mexc.png'],
  Hyperliquid: ['/images/exchanges/hyperliquid.png'],
  Gate: ['/images/exchanges/gate.png'],
  Aster: ['/images/exchanges/aster.png'],
  Lighter: ['/images/exchanges/lighter.svg'],
  Deribit: ['/images/exchanges/deribit.png'],
  Coinbase: ['/images/exchanges/coinbase.png'],
  Kraken: ['/images/exchanges/kraken.png'],
  HTX: ['/images/exchanges/htx.png'],
}

const buildMonogramSvgDataUri = (letter: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6366f1"/>
          <stop offset="1" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="32" fill="#0d1117"/>
      <circle cx="32" cy="32" r="22" fill="url(#g)" opacity="0.35"/>
      <text x="32" y="39" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="20" font-weight="800" fill="#e6edf3">${letter}</text>
    </svg>`,
  )}`

const getExchangeLogoCandidates = (exchange: string, fallback: string) => {
  const candidates = EXCHANGE_LOGO_SOURCES[exchange] ?? []
  const out = [...candidates]
  if (fallback) out.push(fallback)
  // Always end with a deterministic inline fallback.
  out.push(buildMonogramSvgDataUri(exchange.slice(0, 1).toUpperCase()))
  return out
}

function ExchangeLogo({
  exchange,
  fallback,
  className,
}: {
  exchange: string
  fallback: string
  className: string
}) {
  const candidates = useMemo(() => getExchangeLogoCandidates(exchange, fallback), [exchange, fallback])
  const [idx, setIdx] = useState(0)

  // Reset when exchange changes
  useEffect(() => setIdx(0), [exchange])

  const src = candidates[Math.min(idx, candidates.length - 1)]

  return (
    <img
      src={src}
      alt={exchange}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
    />
  )
}

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
    exchange: 'CME',
    logo: '/images/exchanges/cme.png',
    oiAsset: 123_000,
    oiUsd: 11_049_000_000,
    ratioPct: 18.6,
    change1hPct: 0.16,
    change4hPct: 0.99,
    change24hPct: 1.32,
    oiVolRatio: 1.2749
  },
  {
    rank: 2,
    exchange: 'Binance',
    logo: '/images/exchanges/binance.png',
    oiAsset: 123_500,
    oiUsd: 11_098_000_000,
    ratioPct: 18.68,
    change1hPct: 0.49,
    change4hPct: 2.25,
    change24hPct: 0.40,
    oiVolRatio: 0.9406
  },
  {
    rank: 3,
    exchange: 'OKX',
    logo: '/images/exchanges/okx.png',
    oiAsset: 37_800,
    oiUsd: 3_391_000_000,
    ratioPct: 5.71,
    change1hPct: -0.22,
    change4hPct: 1.64,
    change24hPct: 1.25,
    oiVolRatio: 0.6
  },
  {
    rank: 4,
    exchange: 'Bybit',
    logo: '/images/exchanges/bybit.png',
    oiAsset: 60_600,
    oiUsd: 5_447_000_000,
    ratioPct: 9.17,
    change1hPct: -0.05,
    change4hPct: 2.17,
    change24hPct: 0.35,
    oiVolRatio: 1.0773
  },
  {
    rank: 5,
    exchange: 'KuCoin',
    logo: '/images/exchanges/kucoin.png',
    oiAsset: 12_000,
    oiUsd: 1_080_000_000,
    ratioPct: 1.82,
    change1hPct: 0.12,
    change4hPct: 0.45,
    change24hPct: 0.78,
    oiVolRatio: 0.85
  },
  {
    rank: 6,
    exchange: 'Bitfinex',
    logo: '/images/exchanges/bitfinex.png',
    oiAsset: 11_000,
    oiUsd: 990_000_000,
    ratioPct: 1.67,
    change1hPct: -0.08,
    change4hPct: 0.22,
    change24hPct: 0.55,
    oiVolRatio: 0.92
  },
  {
    rank: 7,
    exchange: 'Bitget',
    logo: '/images/exchanges/bitget.png',
    oiAsset: 10_500,
    oiUsd: 945_000_000,
    ratioPct: 1.59,
    change1hPct: 0.31,
    change4hPct: 1.15,
    change24hPct: 2.45,
    oiVolRatio: 0.78
  },
  {
    rank: 8,
    exchange: 'Aster',
    logo: '/images/exchanges/aster.png',
    oiAsset: 10_200,
    oiUsd: 918_000_000,
    ratioPct: 1.55,
    change1hPct: 0.15,
    change4hPct: 0.88,
    change24hPct: 1.25,
    oiVolRatio: 0.65
  },
  {
    rank: 9,
    exchange: 'MEXC',
    logo: '/images/exchanges/mexc.png',
    oiAsset: 10_000,
    oiUsd: 900_000_000,
    ratioPct: 1.52,
    change1hPct: -0.15,
    change4hPct: 0.35,
    change24hPct: 0.95,
    oiVolRatio: 0.45
  },
  {
    rank: 10,
    exchange: 'Lighter',
    logo: '/images/exchanges/lighter.svg',
    oiAsset: 9_900,
    oiUsd: 891_000_000,
    ratioPct: 1.5,
    change1hPct: 0.45,
    change4hPct: 1.25,
    change24hPct: 2.15,
    oiVolRatio: 0.55
  },
  {
    rank: 11,
    exchange: 'Hyperliquid',
    logo: '/images/exchanges/hyperliquid.png',
    oiAsset: 9_800,
    oiUsd: 882_000_000,
    ratioPct: 1.49,
    change1hPct: 0.87,
    change4hPct: 2.34,
    change24hPct: 1.92,
    oiVolRatio: 0.8234
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
    <div className={`flex flex-col h-full ${isCompact ? 'gap-2' : 'gap-6'}`}>
      <div className="flex items-center justify-between">
        <SectionTitle className={isCompact ? '!text-sm' : ''}>{t('aggregatedOrderbook.openInterest.title', { symbol: activeSymbol })}</SectionTitle>
      </div>

      <div className={`flex flex-col flex-1 min-h-0 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden ${isCompact ? '' : 'shadow-2xl'}`}>
        {/* Symbol Tabs & Search */}
        <div className={`flex items-center justify-between px-4 border-b border-[#30363d] bg-[#0d1117]/30 ${isCompact ? 'py-1 flex-row-reverse' : ''}`}>
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
          <div className={`flex items-center gap-2 ${isCompact ? 'pr-4 py-1' : 'pl-4 py-2'}`}>
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
                <div className={`absolute top-full ${isCompact ? 'left-0' : 'right-0'} mt-1 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 overflow-hidden cf-scrollbar ${isCompact ? 'w-32 max-h-48' : 'left-0 max-h-60'}`}>
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
        <div className="flex-1 overflow-auto cf-scrollbar relative">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-[#0d1117]">
              <tr className={`text-[#8b949e] uppercase tracking-wider ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-center border-b border-[#30363d] w-16`}>{t('aggregatedOrderbook.openInterest.table.rank')}</th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold border-b border-[#30363d]`}>{t('aggregatedOrderbook.openInterest.table.exchange')}</th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
                    onClick={() => handleSort('oiAsset')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {isCompact ? t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: '' }) : t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: activeSymbol })} {renderSortIcon('oiAsset')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
                    onClick={() => handleSort('oiUsd')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.oiUsd')} {renderSortIcon('oiUsd')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
                    onClick={() => handleSort('ratioPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.ratio')} {renderSortIcon('ratioPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
                    onClick={() => handleSort('change1hPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.change1h')} {renderSortIcon('change1hPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
                    onClick={() => handleSort('change4hPct')}
                    className="flex items-center justify-end gap-1 w-full group hover:text-white transition-colors"
                  >
                    {t('aggregatedOrderbook.openInterest.table.change4h')} {renderSortIcon('change4hPct')}
                  </button>
                </th>
                <th className={`${isCompact ? 'px-2 py-2' : 'px-4 py-4'} font-bold text-right border-b border-[#30363d]`}>
                  <button 
                    type="button"
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
                          <ExchangeLogo
                            exchange={row.exchange}
                            fallback={row.logo}
                            className="w-full h-full object-contain bg-[#0d1117]"
                          />
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
