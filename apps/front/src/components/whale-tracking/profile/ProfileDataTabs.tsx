'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

type TabType = 'spot' | 'perpetual' | 'orders' | 'trades' | 'history' | 'delegation';

interface SpotPosition {
  asset: string;
  assetLogo: string;
  share: string;
  value: string;
  amount: string;
  price: string;
}

interface PerpetualPosition {
  asset: string;
  side: 'Long' | 'Short';
  marginType: string;
  leverage: string;
  valueUSD: string;
  valueAsset: string;
  pnlUSD: string;
  pnlPercent: string;
  entryPrice: string;
  markPrice: string;
  liqPrice: string;
  margin: string;
  fundingFee: string;
}

interface OrderDetail {
  time: string;
  type: string;
  value: string;
  amount: string;
  price: string;
  trigger: string;
  status: string;
  id: string;
}

interface OpenOrder {
  time: string;
  asset: string;
  side: 'Buy' | 'Sell';
  count: number;
  value: string;
  amount: string;
  price: string;
  details: OrderDetail[];
}

interface RecentTrade {
  time: string;
  asset: string;
  action: string;
  amount: string;
  startPosition: string;
  price: string;
  pnl: string;
  fee: string;
  value: string;
}

interface CompletedTrade {
  endTime: string;
  asset: string;
  side: 'Long' | 'Short';
  duration: string;
  netPnl: string;
  size: string;
  exitPrice: string;
  fee: string;
}

interface HistoryOrder {
  time: string;
  asset: string;
  type: string;
  side: 'Buy' | 'Sell';
  amount: string;
  price: string;
  trigger: string;
  status: string;
  id: string;
}

const mockSpotPositions: SpotPosition[] = [
  {
    asset: 'XAUT',
    assetLogo: 'https://api.dicebear.com/7.x/identicon/svg?seed=xaut',
    share: '98.96 %',
    value: '$ 12.09',
    amount: '0.0027915 XAUT',
    price: '$ 4,332.0'
  },
  {
    asset: 'HYPE',
    assetLogo: 'https://api.dicebear.com/7.x/identicon/svg?seed=hype',
    share: '0.95 %',
    value: '$ 0.11',
    amount: '0.00449572 HYPE',
    price: '$ 25.8'
  },
  {
    asset: 'USDC',
    assetLogo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    share: '0.05 %',
    value: '$ 0',
    amount: '0.00560107 USDC',
    price: '$ 1'
  },
  {
    asset: 'FLY',
    assetLogo: 'https://api.dicebear.com/7.x/identicon/svg?seed=fly',
    share: '0.03 %',
    value: '$ 0',
    amount: '1,000.0 FLY',
    price: '$ 0.000004'
  }
];

const mockPerpetualPositions: PerpetualPosition[] = [
  {
    asset: 'BTC',
    side: 'Short',
    marginType: '全仓',
    leverage: '10x',
    valueUSD: '$ 166,034,001.73',
    valueAsset: '-1,899.07241 BTC',
    pnlUSD: '$ +1,232,483.39',
    pnlPercent: '+7.42 %',
    entryPrice: '$ 88,077.9',
    markPrice: '$ 87,429.0',
    liqPrice: '$ 97,656.0',
    margin: '$ 16,603,400.17',
    fundingFee: '$ 32,146.82'
  },
  {
    asset: 'ETH',
    side: 'Short',
    marginType: '全仓',
    leverage: '15x',
    valueUSD: '$ 54,863,721.24',
    valueAsset: '-18,527.5298 ETH',
    pnlUSD: '$ +956,913.25',
    pnlPercent: '+26.16 %',
    entryPrice: '$ 3,012.84',
    markPrice: '$ 2,961.2',
    liqPrice: '$ 4,014.61',
    margin: '$ 3,657,581.42',
    fundingFee: '$ 7,966.62'
  },
  {
    asset: 'SOL',
    side: 'Short',
    marginType: '全仓',
    leverage: '20x',
    valueUSD: '$ 18,772,607.28',
    valueAsset: '-151,209.08 SOL',
    pnlUSD: '$ +224,700.09',
    pnlPercent: '+23.94 %',
    entryPrice: '$ 125.636',
    markPrice: '$ 124.15',
    liqPrice: '$ 252.594',
    margin: '$ 1,877,260.73',
    fundingFee: '$ 1,246.82'
  }
];

const mockOpenOrders: OpenOrder[] = [
  { 
    time: '2025年12月11日', 
    asset: 'ETH', 
    side: 'Sell', 
    count: 2, 
    value: '$ 222,404,000', 
    amount: '52,000 ETH', 
    price: '$ 4,277 - 4,277',
    details: [
      { time: '2025年12月11日', type: '限价', value: '$ 94,094,000.00', amount: '22,000.0 ETH', price: '$ 4,277.0', trigger: '-', status: '开仓', id: '# 265007812594' },
      { time: '2025年12月11日', type: '限价', value: '$ 128,310,000.00', amount: '30,000.0 ETH', price: '$ 4,277.0', trigger: '-', status: '开仓', id: '# 265007673433' },
    ]
  },
  { 
    time: '2025年11月27日', 
    asset: 'XRP', 
    side: 'Sell', 
    count: 3, 
    value: '$ 120,554,468.1', 
    amount: '37,934,068 XRP', 
    price: '$ 3.178 - 3.178',
    details: [
      { time: '2025年11月27日', type: '限价', value: '$ 40,000,000.00', amount: '12,586,532 XRP', price: '$ 3.178', trigger: '-', status: '开仓', id: '# 265007812595' },
      { time: '2025年11月27日', type: '限价', value: '$ 80,554,468.10', amount: '25,347,536 XRP', price: '$ 3.178', trigger: '-', status: '开仓', id: '# 265007812596' },
    ]
  },
];

const mockRecentTrades: RecentTrade[] = [
  { time: '2025年12月19日', asset: 'HYPE', action: '开多 加仓', amount: '123.3 HYPE', startPosition: '230,598.33 HYPE', price: '$ 24.306', pnl: '-', fee: '0.36 USDC', value: '$ 2,997.13' },
  { time: '2025年12月19日', asset: 'HYPE', action: '开多 加仓', amount: '34.17 HYPE', startPosition: '230,564.16 HYPE', price: '$ 24.306', pnl: '-', fee: '0.10 USDC', value: '$ 830.54' },
  { time: '2025年12月19日', asset: 'HYPE', action: '开多 加仓', amount: '39,120.76 HYPE', startPosition: '191,443.4 HYPE', price: '$ 24.3000178902', pnl: '-', fee: '380.25 USDC', value: '$ 950,634.42' },
  { time: '2025年12月18日', asset: 'HYPE', action: '开多 加仓', amount: '361.27 HYPE', startPosition: '191,082.13 HYPE', price: '$ 25.111', pnl: '-', fee: '1.09 USDC', value: '$ 9,071.85' },
  { time: '2025年12月18日', asset: 'HYPE', action: '开多 加仓', amount: '126.92 HYPE', startPosition: '190,955.21 HYPE', price: '$ 25.111', pnl: '-', fee: '0.38 USDC', value: '$ 3,187.09' },
];

const mockCompletedTrades: CompletedTrade[] = [
  { endTime: '2025年11月21日', asset: 'kPEPE', side: 'Short', duration: '925小时 35分', netPnl: '$ +6,535,295.63', size: '10,736,581 kPEPE', exitPrice: '$ 0.0052744813', fee: '$ 1,666.32' },
  { endTime: '2025年11月21日', asset: 'DOGE', side: 'Long', duration: '394小时 46分', netPnl: '$ -3,417.66', size: '79,441 DOGE', exitPrice: '$ 0.1338342817', fee: '$ 6.26' },
  { endTime: '2025年11月17日', asset: 'ASTER', side: 'Short', duration: '824小时 59分', netPnl: '$ +3,151,403.12', size: '4,336 ASTER', exitPrice: '$ 1.1350020521', fee: '$ 9,725.01' },
  { endTime: '2025年11月5日', asset: 'DOGE', side: 'Short', duration: '555小时 57分', netPnl: '$ +7,867,537.75', size: '68,487 DOGE', exitPrice: '$ 0.1569813989', fee: '$ 4,538.00' },
  { endTime: '2025年11月5日', asset: 'XRP', side: 'Short', duration: '598小时 51分', netPnl: '$ +1,698,568.27', size: '5,652 XRP', exitPrice: '$ 2.1570388694', fee: '$ 3,425.56' },
  { endTime: '2025年11月5日', asset: 'ETH', side: 'Short', duration: '595小时 18分', netPnl: '$ +3,186,000.00', size: '200.2266 ETH', exitPrice: '$ 3,413', fee: '$ 3,825.44' },
  { endTime: '2025年10月11日', asset: 'DOGE', side: 'Long', duration: '24分', netPnl: '$ +332,142.15', size: '76,593 DOGE', exitPrice: '$ 0.1788799913', fee: '$ 485.32' },
];

const mockHistoryOrders: HistoryOrder[] = [
  { time: '2025年12月19日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '39,278.23 HYPE', price: '$ 24.306', trigger: '-', status: '已撤单', id: '# 273191937200' },
  { time: '2025年12月19日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '160,909.26 HYPE', price: '$ 24.306', trigger: '-', status: '挂单', id: '# 273191937200' },
  { time: '2025年12月18日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '0 HYPE', price: '$ 24.666', trigger: '-', status: '已撤单', id: '# 273034661279' },
  { time: '2025年12月18日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '230,601.34 HYPE', price: '$ 24.666', trigger: '-', status: '挂单', id: '# 273034661279' },
  { time: '2025年12月18日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '45,155.62 HYPE', price: '$ 25.111', trigger: '-', status: '已撤单', id: '# 273022680305' },
  { time: '2025年12月18日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '219,729.19 HYPE', price: '$ 25.111', trigger: '-', status: '挂单', id: '# 273022680305' },
  { time: '2025年12月18日', asset: 'HYPE', type: '限价', side: 'Buy', amount: '116,124.2 HYPE', price: '$ 25.111', trigger: '-', status: '完全成交', id: '# 273021487169' },
];

export const ProfileDataTabs = () => {
  const [activeTab, setActiveTab] = useState<TabType>('perpetual');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [assetFilter, setAssetFilter] = useState('');
  const [isFilterOpen, setIsAssetFilterOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrderExpansion = (orderId: string) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setExpandedOrders(newSet);
  };

  const tabs = [
    { id: 'spot', label: `现货持仓 (${mockSpotPositions.length})` },
    { id: 'perpetual', label: `永续合约持仓 (${mockPerpetualPositions.length})` },
    { id: 'orders', label: `挂单 (${mockOpenOrders.length})` },
    { id: 'trades', label: '最近成交' },
    { id: 'history', label: '已完成交易' },
    { id: 'delegation', label: '历史委托' },
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else if (sortOrder === 'asc') {
        setSortField(null);
        setSortOrder(null);
      } else setSortOrder('desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-[#8b949e] opacity-30 group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'desc' ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  const getFilteredAndSortedData = <T extends { asset: string }>(
    rawData: T[],
    currentSortField: string | null,
    currentSortOrder: 'asc' | 'desc' | null,
    currentAssetFilter: string
  ) => {
    let data = [...rawData];
    if (currentAssetFilter) {
      data = data.filter(item => item.asset.toLowerCase().includes(currentAssetFilter.toLowerCase()));
    }
    if (currentSortField && currentSortOrder) {
      data.sort((a: any, b: any) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];
        
        if (valA === undefined || valB === undefined) return 0;

        const cleanNumeric = (val: any) => {
          if (typeof val !== 'string') return val;
          const matches = val.replace(/,/g, '').match(/-?[\d.]+/);
          return matches ? Number.parseFloat(matches[0]) : 0;
        };

        if (currentSortField === 'time' || currentSortField === 'endTime') {
          const parseDate = (d: string) => {
            if (!d) return 0;
            return new Date(d.replace('年', '-').replace('月', '-').replace('日', '')).getTime();
          };
          const dateA = parseDate(valA);
          const dateB = parseDate(valB);
          return currentSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        }

        if (currentSortField === 'duration') {
          const getMinutes = (d: string) => {
            if (!d) return 0;
            const h = d.match(/(\d+)小时/);
            const m = d.match(/(\d+)分/);
            return (h ? Number.parseInt(h[1]) * 60 : 0) + (m ? Number.parseInt(m[1]) : 0);
          };
          valA = getMinutes(valA);
          valB = getMinutes(valB);
        } else {
          valA = cleanNumeric(valA);
          valB = cleanNumeric(valB);
        }
        
        return currentSortOrder === 'desc' ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
      });
    }
    return data;
  };

  const filteredSpotData = useMemo(() => 
    getFilteredAndSortedData(mockSpotPositions, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const filteredPerpData = useMemo(() => 
    getFilteredAndSortedData(mockPerpetualPositions, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const filteredOpenOrders = useMemo(() => 
    getFilteredAndSortedData(mockOpenOrders, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const filteredRecentTrades = useMemo(() => 
    getFilteredAndSortedData(mockRecentTrades, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const filteredCompletedTrades = useMemo(() => 
    getFilteredAndSortedData(mockCompletedTrades, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const filteredHistoryOrders = useMemo(() => 
    getFilteredAndSortedData(mockHistoryOrders, sortField, sortOrder, assetFilter),
  [assetFilter, sortField, sortOrder]);

  const renderSideBadge = (side: string) => {
    const isLong = side === 'Long' || side === 'Buy';
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
        {side === 'Long' || side === 'Buy' ? '多' : '空'}
      </span>
    );
  };

  const showTimeColumn = activeTab === 'orders' || activeTab === 'trades' || activeTab === 'history' || activeTab === 'delegation';

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex flex-col min-h-[400px]">
      {/* Tabs Header */}
      <div className="flex px-6 border-b border-[#30363d]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id as TabType); setSortField(null); setSortOrder(null); }}
            className={`px-6 py-4 text-sm font-bold transition-all border-b-2 -mb-[2px] relative group ${
              activeTab === tab.id 
                ? 'text-white border-[#3b82f6]' 
                : 'text-[#8b949e] border-transparent hover:text-white'
            }`}
          >
            <span className="relative z-10">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-secondary z-20" />
            )}
            <div className={`absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${activeTab === tab.id ? 'opacity-100' : ''}`} />
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="p-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#161b22] text-[#8b949e] text-[10px] font-bold uppercase tracking-wider border-b border-[#30363d]">
              {showTimeColumn && (
                <th className="px-6 py-4 text-left min-w-[120px]">
                  <button type="button" onClick={() => handleSort(activeTab === 'history' ? 'endTime' : 'time')} className="flex items-center gap-1.5 hover:text-white group whitespace-nowrap">
                    <span>{activeTab === 'history' ? '结束时间' : '时间'}</span>
                    {renderSortIcon(activeTab === 'history' ? 'endTime' : 'time')}
                  </button>
                </th>
              )}
              <th className="px-6 py-4 text-left min-w-[150px]">
                <div className="relative">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsAssetFilterOpen(!isFilterOpen); }}
                    className="flex items-center gap-1.5 hover:text-white transition-colors group"
                  >
                    <span>币种</span>
                    <Filter className={`w-3 h-3 ${assetFilter ? 'text-primary' : 'text-[#8b949e]'}`} />
                  </button>
                  {isFilterOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 p-2" onClick={e => e.stopPropagation()}>
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" />
                        <input 
                          type="text" 
                          autoFocus
                          value={assetFilter}
                          onChange={(e) => setAssetFilter(e.target.value)}
                          placeholder="筛选..." 
                          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-8 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                        {assetFilter && (
                          <button type="button" onClick={() => setAssetFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <X className="w-3 h-3 text-[#8b949e] hover:text-white" />
                          </button>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {Array.from(new Set([...mockSpotPositions, ...mockPerpetualPositions, ...mockOpenOrders, ...mockRecentTrades, ...mockCompletedTrades, ...mockHistoryOrders].map(i => i.asset))).map(asset => (
                          <button 
                            key={asset}
                            type="button"
                            onClick={() => { setAssetFilter(asset); setIsAssetFilterOpen(false); }}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-[#30363d] text-[#c9d1d9] hover:text-white"
                          >
                            {asset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              
              {activeTab === 'spot' ? (
                <>
                  <th className="px-6 py-4 text-left">资产份额</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价值</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>金额</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价格</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                </>
              ) : activeTab === 'perpetual' ? (
                <>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('valueUSD')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>持仓价值</span>
                      {renderSortIcon('valueUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('pnlUSD')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>未实现盈亏</span>
                      {renderSortIcon('pnlUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('entryPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>入场均价</span>
                      {renderSortIcon('entryPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('markPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>标记价</span>
                      {renderSortIcon('markPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('liqPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>清算价</span>
                      {renderSortIcon('liqPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('margin')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>保证金</span>
                      {renderSortIcon('margin')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fundingFee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>资金费用</span>
                      {renderSortIcon('fundingFee')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">止盈/止损</th>
                </>
              ) : activeTab === 'orders' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">方向</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价值</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>数量</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">价格</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">触发条件</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">状态</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">订单 ID</th>
                </>
              ) : activeTab === 'trades' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">行为</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>数量</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('startPosition')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>起始仓位</span>
                      {renderSortIcon('startPosition')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价值</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价格</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('pnl')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>已平盈亏</span>
                      {renderSortIcon('pnl')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>费用</span>
                      {renderSortIcon('fee')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">交易记录</th>
                </>
              ) : activeTab === 'history' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">方向</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('duration')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>持续时间</span>
                      {renderSortIcon('duration')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('netPnl')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>净盈亏</span>
                      {renderSortIcon('netPnl')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('size')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>规模</span>
                      {renderSortIcon('size')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('exitPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>平仓价</span>
                      {renderSortIcon('exitPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>费用</span>
                      {renderSortIcon('fee')}
                    </button>
                  </th>
                </>
              ) : activeTab === 'delegation' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">类型</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">方向</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>数量</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>价格</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">触发条件</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">执行状态</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">订单 ID</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {activeTab === 'spot' ? filteredSpotData.map((pos, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#2c2c2c] flex-shrink-0">
                      <img src={pos.assetLogo} alt={pos.asset} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white text-sm font-bold uppercase">{pos.asset}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-white text-xs font-bold">{pos.share}</span>
                    <div className="h-1 w-24 bg-[#0d1117] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400" style={{ width: pos.share }} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-white text-sm font-bold">{pos.value}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{pos.amount}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.price}</td>
              </tr>
            )) : activeTab === 'perpetual' ? filteredPerpData.map((pos, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {renderSideBadge(pos.side)}
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold">{pos.asset}</span>
                      <span className="text-[#8b949e] text-[10px] font-medium uppercase">{pos.marginType} {pos.leverage}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-bold">{pos.valueUSD}</span>
                    <span className="text-[#8b949e] text-[10px] uppercase">{pos.valueAsset}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${pos.pnlUSD.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{pos.pnlUSD}</span>
                    <span className={`text-[10px] ${pos.pnlPercent.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{pos.pnlPercent}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.entryPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.markPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.liqPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.margin}</td>
                <td className="px-6 py-4 text-right text-green-400 text-sm font-medium">{pos.fundingFee}</td>
                <td className="px-6 py-4 text-center text-[#8b949e] text-sm font-medium">-/-</td>
              </tr>
            )) : activeTab === 'orders' ? filteredOpenOrders.map((order, idx) => {
              const stableId = `${order.asset}-${order.time}-${order.side}`;
              return (
                <React.Fragment key={stableId}>
                  <tr className="hover:bg-[#1f2937]/50 transition-colors cursor-pointer" onClick={() => toggleOrderExpansion(stableId)}>
                    <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                      {order.time}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white text-sm font-bold uppercase">{order.asset}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${order.side === 'Buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {order.side === 'Buy' ? '买入' : '卖出'}
                        </span>
                        <span className="text-[#8b949e] text-xs font-medium">{order.count} 笔订单</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.value}</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{order.amount}</td>
                    <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.price}</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">-</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">-</td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className={`text-[#8b949e] hover:text-white transition-all ${expandedOrders.has(stableId) ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedOrders.has(stableId) && order.details.map((detail, dIdx) => (
                    <tr key={detail.id || dIdx} className="bg-[#0d1117]/30 text-[#8b949e]">
                    <td className="px-6 py-3 pl-12 text-xs">
                      {detail.time}
                    </td>
                    <td className="px-6 py-3 text-white/70 text-xs font-bold uppercase">
                      {order.asset}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${order.side === 'Buy' ? 'bg-green-500/10 text-green-400/70' : 'bg-red-500/10 text-red-400/70'}`}>
                          {order.side === 'Buy' ? '买入' : '卖出'}
                        </span>
                        <span className="text-[10px]">{detail.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-xs">{detail.value}</td>
                    <td className="px-6 py-3 text-right text-[10px] uppercase">{detail.amount}</td>
                    <td className="px-6 py-3 text-right text-xs">{detail.price}</td>
                    <td className="px-6 py-3 text-right text-xs">{detail.trigger}</td>
                    <td className="px-6 py-3 text-right text-xs">{detail.status}</td>
                    <td className="px-6 py-3 text-right text-[10px]">{detail.id}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          }) : activeTab === 'trades' ? filteredRecentTrades.map((trade, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                  {trade.time}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {trade.asset}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-green-500/20 text-green-400 uppercase whitespace-nowrap`}>
                    {trade.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{trade.amount}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{trade.startPosition}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{trade.value}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{trade.price}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">{trade.pnl}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{trade.fee}</td>
                <td className="px-6 py-4 text-center">
                  <button type="button" className="text-[#8b949e] hover:text-white transition-colors">
                    <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </td>
              </tr>
            )) : activeTab === 'history' ? filteredCompletedTrades.map((trade, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                  {trade.endTime}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {trade.asset}
                </td>
                <td className="px-6 py-4">
                  {renderSideBadge(trade.side)}
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{trade.duration}</td>
                <td className="px-6 py-4 text-right font-bold text-sm">
                  <span className={trade.netPnl.includes('+') ? 'text-green-400' : 'text-red-400'}>{trade.netPnl}</span>
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{trade.size}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{trade.exitPrice}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">{trade.fee}</td>
              </tr>
            )) : activeTab === 'delegation' ? filteredHistoryOrders.map((order, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                  {order.time}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {order.asset}
                </td>
                <td className="px-6 py-4 text-white text-xs font-medium">{order.type}</td>
                <td className="px-6 py-4">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-green-500/20 text-green-400 uppercase`}>
                    {order.side === 'Buy' ? '买入' : '卖出'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{order.amount}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.price}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">{order.trigger}</td>
                <td className="px-6 py-4 text-right">
                  {order.status === '完全成交' ? (
                    <div className="flex items-center justify-end gap-1.5 text-green-400">
                      <div className="w-4 h-4 rounded-full border border-green-400 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M3.5 6.5l-2-2L1 5l2.5 2.5L9 2l-.5-.5L3.5 6.5z" />
                        </svg>
                      </div>
                    </div>
                  ) : order.status === '已撤单' ? (
                    <div className="flex items-center justify-end gap-1.5 text-[#8b949e]">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
                      </svg>
                    </div>
                  ) : (
                    <span className="text-[#8b949e] text-xs font-medium uppercase">{order.status}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{order.id}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};
