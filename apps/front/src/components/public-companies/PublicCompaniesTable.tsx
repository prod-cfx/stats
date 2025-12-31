'use client';

import { ArrowUpDown, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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

export const PublicCompaniesTable = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<string>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
    [debouncedSearch, sortField, sortOrder]
  );

  const sortedData = useMemo(() => {
    if (!companies) return [];
    return [...companies].sort((a, b) => {
      const valA = a[sortField as keyof CompanyData] || '';
      const valB = b[sortField as keyof CompanyData] || '';
      return sortOrder === 'desc' 
        ? String(valB).localeCompare(String(valA)) 
        : String(valA).localeCompare(String(valB));
    });
  }, [companies, sortField, sortOrder]);

  const renderValueWithColor = (val: string) => {
    const isPositive = val.startsWith('+');
    const isNegative = val.startsWith('-');
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
        {val}
      </span>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="relative max-w-md group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b949e] group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索公司名称或股票代码..." 
          className="w-full bg-[#161b22] border border-[#30363d] rounded-xl pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-[#8b949e]"
        />
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative shadow-lg">
        <LoadingState isLoading={loading} error={error} onRetry={reload} isEmpty={!loading && sortedData.length === 0}>
          <div className="overflow-x-auto animate-in fade-in duration-500">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d] bg-[#0d1117]/50">
                  <th className="px-6 py-6 text-left">币种</th>
                  <th className="px-6 py-6 text-left">公司</th>
                  <th className="px-4 py-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('mNav')}>
                    <div className="flex items-center justify-center gap-1 uppercase">
                      mNAV <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('marketCap')}>
                    <div className="flex items-center justify-center gap-1">
                      市值 <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('holdingsValue')}>
                    <div className="flex items-center justify-center gap-1">
                      持币价值 <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-6">
                    <div className="flex items-center justify-center gap-1">
                      持币量
                    </div>
                  </th>
                  <th className="px-4 py-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('sharePrice')}>
                    <div className="flex items-center justify-center gap-1">
                      股价 <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-6">
                    <div className="flex items-center justify-center gap-1 text-center">
                      24h涨跌
                    </div>
                  </th>
                  <th className="px-4 py-6">
                    <div className="flex items-center justify-center gap-1 text-center">
                      1天增减
                    </div>
                  </th>
                  <th className="px-4 py-6">
                    <div className="flex items-center justify-center gap-1 text-center">
                      7天增减
                    </div>
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
                      <div className="flex items-center justify-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-white p-1 flex-none overflow-hidden">
                          <img src={row.logo} alt={row.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-semibold">{row.name}</span>
                          <span className="text-[#8b949e] text-xs uppercase">{row.ticker} {row.exchange}</span>
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
        title={selectedCompany?.name}
        width="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="flex gap-6 p-4 bg-[#0d1117] rounded-2xl border border-[#30363d]">
            <div className="w-20 h-20 bg-white rounded-2xl p-2 flex-none">
              <img src={selectedCompany?.logo} className="w-full h-full object-contain" alt="" />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-2xl font-bold text-white">{selectedCompany?.ticker}</h4>
              <p className="text-[#8b949e]">{selectedCompany?.exchange}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#0d1117]/50 rounded-xl border border-[#30363d]/50">
              <p className="text-xs text-[#8b949e] uppercase mb-1">当前股价</p>
              <p className="text-xl font-bold text-white">{selectedCompany?.sharePrice}</p>
            </div>
            <div className="p-4 bg-[#0d1117]/50 rounded-xl border border-[#30363d]/50">
              <p className="text-xs text-[#8b949e] uppercase mb-1">持有 {selectedCompany?.asset} 价值</p>
              <p className="text-xl font-bold text-primary">{selectedCompany?.holdingsValue}</p>
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
            <p className="text-sm text-primary font-bold mb-2">💡 分析结论 (Mock)</p>
            <p className="text-sm text-[#c9d1d9] leading-relaxed">
              该上市公司目前持有巨额 {selectedCompany?.asset} 资产，其股价走势与加密市场高度正相关。当前 mNAV 指标为 {selectedCompany?.mNav}，显示出其市场溢价状态。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
