'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  /**
   * 后端订单唯一标识（如有）。用于 React key 与展开/收起状态的稳定键，避免同日同资产/方向的碰撞。
   */
  id?: string;
  time: string;
  asset: string;
  side: 'Buy' | 'Sell';
  count: number;
  value: string;
  amount: string;
  price: string;
  details: OrderDetail[];
}

function getOpenOrderKey(order: OpenOrder): string {
  if (order.id) return order.id;

  const detailIds = order.details
    .map(d => d.id)
    .filter(Boolean);
  if (detailIds.length > 0) {
    // 以排序后的明细 id 组合生成稳定且唯一的键（避免 details 顺序变化导致 key 改变）
    return `${order.asset}:${order.side}:${detailIds.sort().join('|')}`;
  }

  // 兜底：只用不可变字段（asset + time + side），虽可能碰撞但至少保持 key 稳定性，
  // 不会因部分成交导致 price/amount/count/status 变化而让展开状态失效
  return `${order.asset}:${order.time}:${order.side}`;
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
    marginType: 'cross',
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
    marginType: 'cross',
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
    marginType: 'cross',
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
      { time: '2025年12月11日', type: 'limit', value: '$ 94,094,000.00', amount: '22,000.0 ETH', price: '$ 4,277.0', trigger: '-', status: 'open', id: '# 265007812594' },
      { time: '2025年12月11日', type: 'limit', value: '$ 128,310,000.00', amount: '30,000.0 ETH', price: '$ 4,277.0', trigger: '-', status: 'open', id: '# 265007673433' },
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
      { time: '2025年11月27日', type: 'limit', value: '$ 40,000,000.00', amount: '12,586,532 XRP', price: '$ 3.178', trigger: '-', status: 'open', id: '# 265007812595' },
      { time: '2025年11月27日', type: 'limit', value: '$ 80,554,468.10', amount: '25,347,536 XRP', price: '$ 3.178', trigger: '-', status: 'open', id: '# 265007812596' },
    ]
  },
];

const mockRecentTrades: RecentTrade[] = [
  { time: '2025年12月19日', asset: 'HYPE', action: 'openLongAdd', amount: '123.3 HYPE', startPosition: '230,598.33 HYPE', price: '$ 24.306', pnl: '-', fee: '0.36 USDC', value: '$ 2,997.13' },
  { time: '2025年12月19日', asset: 'HYPE', action: 'openLongAdd', amount: '34.17 HYPE', startPosition: '230,564.16 HYPE', price: '$ 24.306', pnl: '-', fee: '0.10 USDC', value: '$ 830.54' },
  { time: '2025年12月19日', asset: 'HYPE', action: 'openLongAdd', amount: '39,120.76 HYPE', startPosition: '191,443.4 HYPE', price: '$ 24.3000178902', pnl: '-', fee: '380.25 USDC', value: '$ 950,634.42' },
  { time: '2025年12月18日', asset: 'HYPE', action: 'openLongAdd', amount: '361.27 HYPE', startPosition: '191,082.13 HYPE', price: '$ 25.111', pnl: '-', fee: '1.09 USDC', value: '$ 9,071.85' },
  { time: '2025年12月18日', asset: 'HYPE', action: 'openLongAdd', amount: '126.92 HYPE', startPosition: '190,955.21 HYPE', price: '$ 25.111', pnl: '-', fee: '0.38 USDC', value: '$ 3,187.09' },
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
  { time: '2025年12月19日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '39,278.23 HYPE', price: '$ 24.306', trigger: '-', status: 'cancelled', id: '# 273191937200' },
  { time: '2025年12月19日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '160,909.26 HYPE', price: '$ 24.306', trigger: '-', status: 'openOrder', id: '# 273191937200' },
  { time: '2025年12月18日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '0 HYPE', price: '$ 24.666', trigger: '-', status: 'cancelled', id: '# 273034661279' },
  { time: '2025年12月18日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '230,601.34 HYPE', price: '$ 24.666', trigger: '-', status: 'openOrder', id: '# 273034661279' },
  { time: '2025年12月18日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '45,155.62 HYPE', price: '$ 25.111', trigger: '-', status: 'cancelled', id: '# 273022680305' },
  { time: '2025年12月18日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '219,729.19 HYPE', price: '$ 25.111', trigger: '-', status: 'openOrder', id: '# 273022680305' },
  { time: '2025年12月18日', asset: 'HYPE', type: 'limit', side: 'Buy', amount: '116,124.2 HYPE', price: '$ 25.111', trigger: '-', status: 'filled', id: '# 273021487169' },
];

export const ProfileDataTabs = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('perpetual');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [assetFilter, setAssetFilter] = useState('');
  const [isFilterOpen, setIsAssetFilterOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());

  const normalizeDateLabel = (value: string) => {
    // 2025年12月19日 -> 2025-12-19 (language-agnostic)
    return value.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/g, (_, y, m, d) => {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    });
  };

  const formatDurationLabel = (value: string) => {
    // 925小时 35分 -> 925h 35m (English-friendly), keep as-is if unknown format
    const h = value.match(/(\d+)\s*小时/);
    const m = value.match(/(\d+)\s*分/);
    if (!h && !m) return value;
    const hh = h ? Number.parseInt(h[1], 10) : 0;
    const mm = m ? Number.parseInt(m[1], 10) : 0;
    return t('whaleTracking.time.duration', { hours: hh, minutes: mm });
  };

  const translateMarginType = (key: string) => {
    return t(`whaleTracking.margin.${key}`);
  };

  const translateOrderType = (key: string) => {
    return t(`whaleTracking.profile.orderType.${key}`);
  };

  const translateOrderStatus = (key: string) => {
    return t(`whaleTracking.profile.orderStatus.${key}`);
  };

  const translateTradeAction = (key: string) => {
    return t(`whaleTracking.profile.tradeAction.${key}`);
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setExpandedOrders(newSet);
  };

  const tabs = [
    { id: 'spot', label: t('whaleTracking.profile.tabs.spot', { count: mockSpotPositions.length }) },
    { id: 'perpetual', label: t('whaleTracking.profile.tabs.perpetual', { count: mockPerpetualPositions.length }) },
    { id: 'orders', label: t('whaleTracking.profile.tabs.orders', { count: mockOpenOrders.length }) },
    { id: 'trades', label: t('whaleTracking.profile.tabs.trades') },
    { id: 'history', label: t('whaleTracking.profile.tabs.history') },
    { id: 'delegation', label: t('whaleTracking.profile.tabs.delegation') },
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
        {side === 'Long' || side === 'Buy' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
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
            className={`px-6 py-4 text-sm font-bold transition-all relative group ${
              activeTab === tab.id 
                ? 'text-white' 
                : 'text-[#8b949e] hover:text-white'
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
                    <span>{activeTab === 'history' ? t('whaleTracking.profile.columns.endTime') : t('whaleTracking.profile.columns.time')}</span>
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
                    <span>{t('whaleTracking.profile.columns.asset')}</span>
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
                          placeholder={t('whaleTracking.profile.assetFilter.placeholder')} 
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
                  <th className="px-6 py-4 text-left">{t('whaleTracking.profile.columns.share')}</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.value')}</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.amount')}</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.price')}</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                </>
              ) : activeTab === 'perpetual' ? (
                <>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('valueUSD')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.positionValue')}</span>
                      {renderSortIcon('valueUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('pnlUSD')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.unrealizedPnl')}</span>
                      {renderSortIcon('pnlUSD')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('entryPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.entryPrice')}</span>
                      {renderSortIcon('entryPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('markPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.markPrice')}</span>
                      {renderSortIcon('markPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('liqPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.liqPrice')}</span>
                      {renderSortIcon('liqPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('margin')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.margin')}</span>
                      {renderSortIcon('margin')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fundingFee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.fundingFee')}</span>
                      {renderSortIcon('fundingFee')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">{t('whaleTracking.profile.columns.tpSl')}</th>
                </>
              ) : activeTab === 'orders' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('whaleTracking.profile.columns.side')}</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.value')}</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.amount')}</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.price')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.trigger')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.status')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.orderId')}</th>
                </>
              ) : activeTab === 'trades' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('whaleTracking.profile.columns.action')}</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.amount')}</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('startPosition')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.startPosition')}</span>
                      {renderSortIcon('startPosition')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('value')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.value')}</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.price')}</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('pnl')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.closedPnl')}</span>
                      {renderSortIcon('pnl')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.fee')}</span>
                      {renderSortIcon('fee')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">{t('whaleTracking.profile.columns.tradeRecord')}</th>
                </>
              ) : activeTab === 'history' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('whaleTracking.profile.columns.side')}</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('duration')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.duration')}</span>
                      {renderSortIcon('duration')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('netPnl')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.netPnl')}</span>
                      {renderSortIcon('netPnl')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('size')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.size')}</span>
                      {renderSortIcon('size')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('exitPrice')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.exitPrice')}</span>
                      {renderSortIcon('exitPrice')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('fee')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.fee')}</span>
                      {renderSortIcon('fee')}
                    </button>
                  </th>
                </>
              ) : activeTab === 'delegation' ? (
                <>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('whaleTracking.profile.columns.type')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('whaleTracking.profile.columns.side')}</th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.amount')}</span>
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleSort('price')} className="flex items-center justify-end gap-1.5 ml-auto hover:text-white group whitespace-nowrap">
                      <span>{t('whaleTracking.profile.columns.price')}</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.trigger')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.executionStatus')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('whaleTracking.profile.columns.orderId')}</th>
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
                      <span className="text-[#8b949e] text-[10px] font-medium uppercase">
                        {translateMarginType(pos.marginType)} {pos.leverage}
                      </span>
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
            )) : activeTab === 'orders' ? filteredOpenOrders.map((order) => {
              const orderKey = getOpenOrderKey(order);
              return (
                <React.Fragment key={orderKey}>
                  <tr className="hover:bg-[#1f2937]/50 transition-colors cursor-pointer" onClick={() => toggleOrderExpansion(orderKey)}>
                    <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                      {normalizeDateLabel(order.time)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white text-sm font-bold uppercase">{order.asset}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${order.side === 'Buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
                        </span>
                        <span className="text-[#8b949e] text-xs font-medium">{t('whaleTracking.profile.orders.orderCount', { count: order.count })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.value}</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{order.amount}</td>
                    <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.price}</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">-</td>
                    <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">-</td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className={`text-[#8b949e] hover:text-white transition-all ${expandedOrders.has(orderKey) ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedOrders.has(orderKey) && order.details.map((detail, dIdx) => (
                    <tr key={detail.id || dIdx} className="bg-[#0d1117]/30 text-[#8b949e]">
                    <td className="px-6 py-3 pl-12 text-xs">
                      {normalizeDateLabel(detail.time)}
                    </td>
                    <td className="px-6 py-3 text-white/70 text-xs font-bold uppercase">
                      {order.asset}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${order.side === 'Buy' ? 'bg-green-500/10 text-green-400/70' : 'bg-red-500/10 text-red-400/70'}`}>
                          {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
                        </span>
                        <span className="text-[10px]">{translateOrderType(detail.type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-xs">{detail.value}</td>
                    <td className="px-6 py-3 text-right text-[10px] uppercase">{detail.amount}</td>
                    <td className="px-6 py-3 text-right text-xs">{detail.price}</td>
                    <td className="px-6 py-3 text-right text-xs">{detail.trigger}</td>
                    <td className="px-6 py-3 text-right text-xs">{translateOrderStatus(detail.status)}</td>
                    <td className="px-6 py-3 text-right text-[10px]">{detail.id}</td>
                  </tr>
                ))}
                </React.Fragment>
              )
            }) : activeTab === 'trades' ? filteredRecentTrades.map((trade, idx) => (
              <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors">
                <td className="px-6 py-4 text-[#8b949e] text-sm font-medium whitespace-nowrap">
                  {normalizeDateLabel(trade.time)}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {trade.asset}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-green-500/20 text-green-400 uppercase whitespace-nowrap`}>
                    {translateTradeAction(trade.action)}
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
                  {normalizeDateLabel(trade.endTime)}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {trade.asset}
                </td>
                <td className="px-6 py-4">
                  {renderSideBadge(trade.side)}
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{formatDurationLabel(trade.duration)}</td>
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
                  {normalizeDateLabel(order.time)}
                </td>
                <td className="px-6 py-4 text-white text-sm font-bold uppercase">
                  {order.asset}
                </td>
                <td className="px-6 py-4 text-white text-xs font-medium">{translateOrderType(order.type)}</td>
                <td className="px-6 py-4">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-green-500/20 text-green-400 uppercase`}>
                    {order.side === 'Buy' ? t('whaleTracking.side.buy') : t('whaleTracking.side.sell')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium uppercase">{order.amount}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{order.price}</td>
                <td className="px-6 py-4 text-right text-[#8b949e] text-xs font-medium">{order.trigger}</td>
                <td className="px-6 py-4 text-right">
                  {order.status === 'filled' ? (
                    <div className="flex items-center justify-end gap-1.5 text-green-400">
                      <div className="w-4 h-4 rounded-full border border-green-400 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M3.5 6.5l-2-2L1 5l2.5 2.5L9 2l-.5-.5L3.5 6.5z" />
                        </svg>
                      </div>
                    </div>
                  ) : order.status === 'cancelled' ? (
                    <div className="flex items-center justify-end gap-1.5 text-[#8b949e]">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
                      </svg>
                    </div>
                  ) : (
                    <span className="text-[#8b949e] text-xs font-medium uppercase">{translateOrderStatus(order.status)}</span>
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
