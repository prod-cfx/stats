'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Info, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import { useMockData } from '@/hooks/use-mock-data';

interface CompanyData {
  asset: string;
  assetLogo: string;
  name: string;
  ticker: string;
  exchange: string;
  logo: string;
  mNav: string;
  marketCap: string;
  holdingsValue: string;
  holdingsAmount: string;
  sharePrice: string;
  change24h: string;
  change1d: string;
  change7d: string;
  infoParagraphs?: string[];
}

const initialCompanyData: CompanyData[] = [
  {
    asset: 'PYUSD',
    assetLogo: 'https://cryptologos.cc/logos/paypal-usd-pyusd-logo.png?v=040',
    name: 'PayPal Holdings, Inc.',
    ticker: 'PYPL',
    exchange: '美股-NASDAQ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    mNav: '-',
    marketCap: '$58.56B',
    holdingsValue: '-',
    holdingsAmount: '-',
    sharePrice: '$61.30',
    change24h: '+0.96%',
    change1d: '+1.25%',
    change7d: '-0.50%',
  },
  {
    asset: 'BTC',
    assetLogo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040',
    name: 'MicroStrategy Incorporated',
    ticker: 'MSTR',
    exchange: '美股-NASDAQ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/MicroStrategy_logo.svg/1200px-MicroStrategy_logo.svg.png',
    mNav: '0.83',
    marketCap: '$47.4B',
    holdingsValue: '$58.14B',
    holdingsAmount: '671.27K BTC',
    sharePrice: '$167.50',
    change24h: '+0.00%',
    change1d: '+0.10%',
    change7d: '+2.30%',
    infoParagraphs: [
      '微策略是一家美国的软件公司，提供商业智能、移动软件和云端服务。',
      '该公司于1989年由迈克尔·塞勒（Michael J. Saylor）、桑朱·班萨尔（Sanju Bansal）和托马斯·斯宾纳（Thomas Spahr）创立，专门开发用于分析内部与外部数据的软件，协助进行商业决策以及开发移动应用程序。',
      '公司总部位于弗吉尼亚州泰森斯（Tysons），属于华盛顿都会区的一部分。塞勒为执行主席，自1989年至2022年担任CEO。',
      '该公司因为持有巨量比特币而被认为是与比特币挂钩的“概念股”。',
    ],
  },
  {
    asset: 'USDC',
    assetLogo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040',
    name: 'Circle Internet Group',
    ticker: 'CRCL',
    exchange: '美股-NYSE',
    logo: 'https://www.circle.com/hubfs/logos/Circle_Logo_Green.svg',
    mNav: '0.27',
    marketCap: '$17.2B',
    holdingsValue: '$64.46B',
    holdingsAmount: '64.50B USDC',
    sharePrice: '$82.85',
    change24h: '+9.87%',
    change1d: '+10.5%',
    change7d: '+15.2%',
  },
  {
    asset: 'ETH',
    assetLogo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
    name: 'BitMine Immersion',
    ticker: 'BMNR',
    exchange: '美股-NYSE',
    logo: 'https://bitmine.tech/wp-content/uploads/2021/06/BitMine-Logo-1.png',
    mNav: '0.73',
    marketCap: '$8.94B',
    holdingsValue: '$11.62B',
    holdingsAmount: '3.97M ETH',
    sharePrice: '$31.39',
    change24h: '+1.42%',
    change1d: '-0.88%',
    change7d: '+4.15%',
  }
];

type SortField = keyof Pick<
  CompanyData,
  | 'mNav'
  | 'marketCap'
  | 'holdingsValue'
  | 'holdingsAmount'
  | 'sharePrice'
  | 'change24h'
  | 'change1d'
  | 'change7d'
> | null;
type SortDirection = 'asc' | 'desc' | null;

export const PublicCompaniesTable = () => {
  const { t, i18n } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('marketCap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: companies, loading, error, reload } = useMockData(
    async () => {
      return initialCompanyData.filter(c => 
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
        c.ticker.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    },
    [debouncedSearch]
  );

  const sortedData = useMemo(() => {
    if (!companies) return [];
    if (!sortField || !sortDirection) return companies;

    const parseCompactNumber = (raw: string): number | null => {
      const val = raw.trim();
      if (!val || val === '-') return null;

      // Keep sign; extract first number.
      const match = val.match(/[-+]?\d+(\.\d+)?/);
      if (!match || match.index == null) return null;
      const numStr = match[0];
      const num = Number(numStr);
      if (!Number.isFinite(num)) return null;

      // Detect unit right after the number (e.g. 3.1T, 47.4B, 671.27K BTC, 66.10万 BTC, 3.1万亿)
      // Note: only treat compact units when they are directly attached (or after trimming leading spaces).
      // If the suffix is separated by whitespace and looks like a symbol/code (e.g. "BTC"), we treat it as "no unit".
      const restRaw = val.slice(match.index + numStr.length);
      const rest = restRaw.trimStart();
      if (!rest) return num;

      // CJK units (order matters: handle "万亿" before "万")
      if (rest.startsWith('万亿')) return num * 1e12;
      if (rest.startsWith('兆')) return num * 1e12;
      if (rest.startsWith('千亿')) return num * 1e11;
      if (rest.startsWith('百亿')) return num * 1e10;
      if (rest.startsWith('十亿')) return num * 1e9;
      if (rest.startsWith('亿')) return num * 1e8;
      if (rest.startsWith('万')) return num * 1e4;

      // Latin compact units: extract first token (until whitespace or a non-letter symbol)
      // Examples:
      // - "1.2bn" => token "bn"
      // - "1.2 bn" => token "bn"
      // - "671.27K BTC" => token "K"
      // - "1.2B" => token "B"
      const tokenMatch = rest.match(/^[a-z]+/i);
      const token = tokenMatch?.[0]?.toLowerCase();
      if (token) {
        const multipliers: Record<string, number> = {
          // trillion
          t: 1e12,
          tn: 1e12,
          trn: 1e12,
          // billion
          b: 1e9,
          bn: 1e9,
          // million
          m: 1e6,
          mn: 1e6,
          // thousand
          k: 1e3,
          kn: 1e3,
        };

        const multiplier = multipliers[token];
        if (multiplier != null) return num * multiplier;

        // Unknown unit token: fail loudly (but keep UI working by pushing it to top in desc sorts)
        console.error(`[PublicCompaniesTable] Unknown unit token: "${token}" (raw="${val}", rest="${rest}")`);
        return null;
      }

      return num;
    };

    const parsePercent = (raw: string): number | null => {
      const v = raw.trim();
      if (!v || v === '-') return null;
      const num = Number(v.replace('%', ''));
      return Number.isFinite(num) ? num : null;
    };

    const sortValueOf = (row: CompanyData, field: SortField): number | null => {
      if (!field) return null;
      const raw = row[field];
      // Percent fields
      if (field === 'change24h' || field === 'change1d' || field === 'change7d') return parsePercent(raw);
      // mNAV: plain number or '-'
      if (field === 'mNav') return parseCompactNumber(raw);
      // Currency / compact values: $xxB, $xx, etc.
      if (field === 'marketCap' || field === 'holdingsValue' || field === 'sharePrice') return parseCompactNumber(raw.replace('$', '').replaceAll(',', ''));
      // holdingsAmount: e.g. "671.27K BTC", "64.50B USDC"
      if (field === 'holdingsAmount') return parseCompactNumber(raw.replaceAll(',', ''));
      return parseCompactNumber(raw);
    };

    return [...companies].sort((a, b) => {
      const aVal = sortValueOf(a, sortField);
      const bVal = sortValueOf(b, sortField);
      // Always push missing/invalid values to the bottom, regardless of sort direction.
      const aMissing = aVal == null;
      const bMissing = bVal == null;
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [companies, sortField, sortDirection]);

  const renderValueWithColor = (val: string) => {
    const isPositive = val.startsWith('+');
    const isNegative = val.startsWith('-');
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
        {val}
      </span>
    );
  };

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

  const formatExchange = (exchange: string) => {
    if (i18n.language !== 'en') return exchange;
    if (exchange === '美股-NASDAQ') return 'US-NASDAQ';
    if (exchange === '美股-NYSE') return 'US-NYSE';
    return exchange;
  };

  const selectedCompanyInfoParagraphs = useMemo(() => {
    if (!selectedCompany) return [];
    if (selectedCompany.infoParagraphs?.length) {
      // If current UI is English but the stored paragraphs are Chinese, fall back to translated template copy.
      if (i18n.language === 'en' && selectedCompany.infoParagraphs.some(p => /[\u4E00-\u9FFF]/.test(p))) {
        return [
          t('publicCompanies.modal.fallbackLine1', { name: selectedCompany.name, ticker: selectedCompany.ticker }),
          t('publicCompanies.modal.fallbackLine2', { exchange: formatExchange(selectedCompany.exchange), asset: selectedCompany.asset, mNav: selectedCompany.mNav }),
        ];
      }
      return selectedCompany.infoParagraphs;
    }
    return [
      t('publicCompanies.modal.fallbackLine1', { name: selectedCompany.name, ticker: selectedCompany.ticker }),
      t('publicCompanies.modal.fallbackLine2', { exchange: formatExchange(selectedCompany.exchange), asset: selectedCompany.asset, mNav: selectedCompany.mNav }),
    ];
  }, [formatExchange, i18n.language, selectedCompany, t]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <div className="group rounded-xl p-[1px] bg-[#30363d] transition-colors focus-within:bg-gradient-to-r focus-within:from-primary focus-within:to-secondary">
          <div className="relative rounded-xl bg-[#161b22]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b949e] group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('publicCompanies.searchPlaceholder')} 
              className="w-full bg-transparent border-0 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-0 transition-all placeholder:text-[#8b949e]"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative shadow-lg">
        <LoadingState isLoading={loading} error={error} onRetry={reload} isEmpty={!loading && sortedData.length === 0}>
          <div className="overflow-x-auto animate-in fade-in duration-500">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d] bg-[#0d1117]/50">
                  <th className="px-6 py-6 text-left">{t('publicCompanies.columns.asset')}</th>
                  <th className="px-6 py-6 text-left">{t('publicCompanies.columns.company')}</th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('mNav')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors uppercase"
                    >
                      mNAV {renderSortIcon('mNav')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('marketCap')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors"
                    >
                      {t('publicCompanies.columns.marketCap')} {renderSortIcon('marketCap')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('holdingsValue')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors"
                    >
                      {t('publicCompanies.columns.holdingsValue')} {renderSortIcon('holdingsValue')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('holdingsAmount')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors"
                    >
                      {t('publicCompanies.columns.holdingsAmount')} {renderSortIcon('holdingsAmount')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('sharePrice')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors"
                    >
                      {t('publicCompanies.columns.sharePrice')} {renderSortIcon('sharePrice')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('change24h')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors text-center"
                    >
                      {t('publicCompanies.columns.change24h')} {renderSortIcon('change24h')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('change1d')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors text-center"
                    >
                      {t('publicCompanies.columns.change1d')} {renderSortIcon('change1d')}
                    </button>
                  </th>
                  <th className="px-4 py-6 font-bold">
                    <button
                      type="button"
                      onClick={() => handleSort('change7d')}
                      className="flex items-center justify-center gap-1 w-full group hover:text-white transition-colors text-center"
                    >
                      {t('publicCompanies.columns.change7d')} {renderSortIcon('change7d')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#30363d]">
                {sortedData.map((row, index) => (
                  <tr 
                    key={index} 
                    className="transition-colors hover:bg-[#1f2937]/50 cursor-pointer"
                    onClick={() => setSelectedCompany(row)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-start gap-3">
                        <div className="w-6 h-6 flex-none">
                          <img src={row.assetLogo} alt={row.asset} className="w-full h-full rounded-full object-contain" />
                        </div>
                        <span className="text-white font-medium min-w-[50px]">{row.asset}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white p-1 flex-none overflow-hidden">
                          <img src={row.logo} alt={row.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-start gap-1 min-w-0">
                            <span className="text-white font-semibold truncate min-w-0">{row.name}</span>
                            <button
                              type="button"
                              aria-label={t('publicCompanies.aria.viewCompanyInfo')}
                              className="text-[#8b949e] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 flex-none -mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCompany(row);
                              }}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[#8b949e] text-xs uppercase truncate">{row.ticker} {formatExchange(row.exchange)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={row.mNav !== '-' && Number.parseFloat(row.mNav) < 1 ? 'text-red-400' : 'text-[#e6edf3]'}>
                        {row.mNav}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-white font-mono">{row.marketCap}</td>
                    <td className="px-4 py-4 text-center text-white font-mono">{row.holdingsValue}</td>
                    <td className="px-4 py-4 text-center text-white font-mono text-xs">{row.holdingsAmount}</td>
                    <td className="px-4 py-4 text-center text-white font-mono">{row.sharePrice}</td>
                    <td className="px-4 py-4 text-center font-mono">{renderValueWithColor(row.change24h)}</td>
                    <td className="px-4 py-4 text-center font-mono">{renderValueWithColor(row.change1d)}</td>
                    <td className="px-4 py-4 text-center font-mono">{renderValueWithColor(row.change7d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>

      {/* Company Detail Modal */}
      <Modal
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={t('publicCompanies.modal.title')}
        width="max-w-xl"
      >
        <div className="space-y-6">
          <div className="flex gap-4 items-start pb-4 border-b border-[#30363d]">
            <div className="w-12 h-12 rounded-xl bg-white p-2 flex-none">
              <img src={selectedCompany?.logo} className="w-full h-full object-contain" alt="" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white leading-tight truncate">{selectedCompany?.name}</h3>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="text-xs text-[#8b949e]">{t('publicCompanies.modal.ticker')}: <span className="font-bold text-[#e6edf3]">{selectedCompany?.ticker}</span></span>
                <span className="text-xs text-[#8b949e]">{t('publicCompanies.modal.exchange')}: <span className="font-bold text-[#e6edf3]">{selectedCompany ? formatExchange(selectedCompany.exchange) : ''}</span></span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-[#8b949e] uppercase tracking-wider">{t('publicCompanies.modal.sectionTitle')}</p>
            <div className="text-sm leading-relaxed text-[#e6edf3] px-1">
              {selectedCompanyInfoParagraphs.map((p, idx) => (
                <React.Fragment key={idx}>
                  <p>{p}</p>
                  {idx !== selectedCompanyInfoParagraphs.length - 1 && <div className="h-4" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
