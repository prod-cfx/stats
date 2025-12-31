'use client';

import ReactECharts from 'echarts-for-react';
import { ChevronDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Typography';

interface WhaleTradingStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
  unit?: string;
  value2?: string;
  unit2?: string;
  subStats: { label: string; value: string; color: string }[];
}

const StatCard = ({ label, value, valueColor = 'text-white', unit, value2, unit2, subStats }: StatCardProps) => (
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-4 flex flex-col justify-between gap-3 h-full">
    <div className="flex flex-col gap-1">
      <span className="text-[#8b949e] text-caption font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-h2 font-bold ${valueColor}`}>{value}</span>
        {unit && <span className="text-caption text-white font-medium">{unit}</span>}
        {value2 && <span className="text-h2 font-bold text-white ml-2">{value2}</span>}
        {unit2 && <span className="text-caption text-white font-medium">{unit2}</span>}
      </div>
    </div>
    <div className="space-y-1">
      {subStats.map((stat, idx) => (
        <div key={idx} className="flex justify-between items-center text-caption">
          <span className="text-[#8b949e] font-medium">{stat.label}</span>
          <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  </div>
);

interface TradeCardProps {
  asset: string;
  side: 'Long' | 'Short';
  time: string;
  pnl: string;
  duration: string;
  icon: string;
}

const TradeCard = ({ asset, side, time, pnl, duration, icon }: TradeCardProps) => (
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all group h-full">
    <div className="flex justify-between items-center gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <img src={icon} alt={asset} className="w-full h-full object-contain" />
        </div>
        <span className="text-white font-bold text-body truncate">{asset}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${side === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {side === 'Long' ? '多' : '空'}
        </span>
      </div>
      <span className="text-[#8b949e] text-caption font-medium whitespace-nowrap flex-shrink-0">{time}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider mb-1">已实现盈亏</span>
      <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2`}>{pnl}</span>
    </div>
    <div className="flex justify-between items-center text-caption pt-2 border-t border-[#30363d]/50 mt-auto">
      <span className="text-[#8b949e] font-medium">持续时间</span>
      <span className="text-white font-semibold">{duration}</span>
    </div>
  </div>
);

interface PerformanceCardProps {
  asset: string;
  trades: number;
  pnl: string;
  netPnl: string;
  fees: string;
  icon: string;
}

const PerformanceCard = ({ asset, trades, pnl, netPnl, fees, icon }: PerformanceCardProps) => (
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all h-full">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center">
          <img src={icon} alt={asset} className="w-full h-full object-contain" />
        </div>
        <span className="text-white font-bold text-body">{asset}</span>
      </div>
      <span className="text-[#8b949e] text-caption font-bold bg-[#161b22] px-2 py-1 rounded">{trades} 笔交易</span>
    </div>
    <div className="flex flex-col">
      <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider mb-1">已实现盈亏</span>
      <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2`}>{pnl}</span>
    </div>
    <div className="space-y-2 pt-2 border-t border-[#30363d]/50">
      <div className="flex justify-between items-center text-caption font-medium">
        <span className="text-[#8b949e]">净盈亏</span>
        <span className={`font-bold ${netPnl.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{netPnl}</span>
      </div>
      <div className="flex justify-between items-center text-caption font-medium">
        <span className="text-[#8b949e]">费用</span>
        <span className="text-white font-bold">{fees}</span>
      </div>
    </div>
  </div>
);

interface PositionCardProps {
  asset: string;
  side: 'Long' | 'Short';
  time: string;
  pnl: string;
  size: string;
  fees: string;
  icon: string;
}

const PositionCard = ({ asset, side, time, pnl, size, fees, icon }: PositionCardProps) => (
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all h-full">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center">
          <img src={icon} alt={asset} className="w-full h-full object-contain" />
        </div>
        <span className="text-white font-bold text-body">{asset}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${side === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {side === 'Long' ? '多' : '空'}
        </span>
      </div>
      <span className="text-[#8b949e] text-caption font-medium">{time}</span>
    </div>
    <div className="flex flex-col py-1">
      <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2 tracking-tight`}>{pnl}</span>
    </div>
    <div className="space-y-2 pt-2 border-t border-[#30363d]/50 mt-auto">
      <div className="flex justify-between items-center text-caption font-medium">
        <span className="text-[#8b949e]">规模</span>
        <span className="text-white font-bold">{size}</span>
      </div>
      <div className="flex justify-between items-center text-caption font-medium">
        <span className="text-[#8b949e]">费用</span>
        <span className="text-white font-bold">{fees}</span>
      </div>
    </div>
  </div>
);

const topTrades: TradeCardProps[] = [
  { asset: 'BTC', side: 'Short', time: '4天前', pnl: '$+25,597.98', duration: '27分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/btc.png' },
  { asset: 'DOGE', side: 'Short', time: '13小时前', pnl: '$+4,657.59', duration: '58分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/doge.png' },
  { asset: 'LINK', side: 'Short', time: '13小时前', pnl: '$+3,676.92', duration: '57分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/link.png' },
  { asset: 'SOL', side: 'Short', time: '1天前', pnl: '$+2,585.89', duration: '23分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/sol.png' },
  { asset: 'FARTCOIN', side: 'Short', time: '12小时前', pnl: '$+1,686.22', duration: '1小时 44分', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=fart' },
  { asset: 'ETH', side: 'Long', time: '1天前', pnl: '$-7.78', duration: '2分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
  { asset: 'SOL', side: 'Long', time: '1天前', pnl: '$-1,011.00', duration: '3分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/sol.png' },
  { asset: 'ETH', side: 'Short', time: '1天前', pnl: '$-71,878.55', duration: '76小时 17分', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
];

const assetPerformance: PerformanceCardProps[] = [
  { asset: 'BTC', trades: 1, pnl: '$+25,597.98', netPnl: '$-9,486.33', fees: '$+35,084.30', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/btc.png' },
  { asset: 'DOGE', trades: 1, pnl: '$+4,657.59', netPnl: '$+4,119.39', fees: '$+538.21', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/doge.png' },
  { asset: 'LINK', trades: 1, pnl: '$+3,676.92', netPnl: '$+3,018.44', fees: '$+658.48', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/link.png' },
  { asset: 'ETH', trades: 2, pnl: '$-71,886.32', netPnl: '$-73,549.28', fees: '$+1,662.95', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
];

const positionPerformance: PositionCardProps[] = [
  { asset: 'PENDLE', side: 'Short', time: '2 小时前', pnl: '$+16,549.49', size: '753 PENDLE', fees: '$+54.38', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=pendle' },
  { asset: 'ONDO', side: 'Short', time: '3 小时前', pnl: '$+13,609.38', size: '1,865 ONDO', fees: '$+55.37', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ondo' },
  { asset: 'ATOM', side: 'Short', time: '3 小时前', pnl: '$+8,515.55', size: '223.04 ATOM', fees: '$+57.23', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/atom.png' },
  { asset: 'TIA', side: 'Short', time: '3 小时前', pnl: '$+19,204.09', size: '2,868.6 TIA', fees: '$+53.78', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=tia' },
  { asset: 'APT', side: 'Short', time: '3 小时前', pnl: '$-3,436.12', size: '1,905.2 APT', fees: '$+179.24', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/apt.png' },
  { asset: 'AVAX', side: 'Short', time: '3 小时前', pnl: '$-3,195.52', size: '772.78 AVAX', fees: '$+120.09', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/avax.png' },
  { asset: 'DOGE', side: 'Short', time: '4 天前', pnl: '$-8,107.62', size: '74,132 DOGE', fees: '$+121.51', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/doge.png' },
  { asset: 'MET', side: 'Short', time: '4 天前', pnl: '$-15,878.99', size: '7,905 MET', fees: '$+64.62', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=met' },
  { asset: 'ENA', side: 'Short', time: '5 天前', pnl: '$+20,650.45', size: '6,764 ENA', fees: '$+108.18', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ena' },
  { asset: 'SOL', side: 'Short', time: '6 天前', pnl: '$-10,913.05', size: '4,013.48 SOL', fees: '$+300.70', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/sol.png' },
  { asset: 'ETH', side: 'Short', time: '6 天前', pnl: '$-3,568.89', size: '169.4628 ETH', fees: '$+298.41', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
  { asset: 'ETH', side: 'Short', time: '6 天前', pnl: '$+440.04', size: '169.2448 ETH', fees: '$+297.21', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
];

export const WhaleTradingStatsModal = ({ isOpen, onClose, address }: WhaleTradingStatsModalProps) => {
  const [activeTab, setActiveTab] = useState('asset'); // 'asset' | 'position'
  const [timeRange, setTimeRange] = useState<'1周' | '1月' | '全部'>('1周');
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Trigger loading when timeRange changes
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [timeRange, isOpen]);

  // Mock data generation based on timeRange
  const { 
    profitTrades, lossTrades, totalTrades, winRate, pnl, fees,
    currentTopTrades, currentAssetPerformance, currentPositionPerformance 
  } = useMemo(() => {
    let multiplier = 1;
    let timeScale = '天';
    if (timeRange === '1月') {
      multiplier = 4.2;
      timeScale = '周';
    }
    if (timeRange === '全部') {
      multiplier = 12.5;
      timeScale = '月';
    }

    const baseProfit = 5;
    const baseLoss = 5;
    const p = Math.floor(baseProfit * multiplier);
    const l = Math.floor(baseLoss * multiplier);
    const total = p + l;
    const wr = total > 0 ? ((p / total) * 100).toFixed(2) : '0.00';
    
    const pnlVal = (multiplier * 3975.55).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const feeVal = (multiplier * 42733.00).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Helper to scale currency strings
    const scaleCurrency = (val: string, m: number) => {
      const num = parseFloat(val.replace(/[$,+]/g, ''));
      const sign = val.includes('+') ? '+' : (val.includes('-') ? '-' : '');
      return `$${sign}${(num * m).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper to adjust time labels
    const adjustTime = (time: string, scale: string) => {
      if (timeRange === '1周') return time;
      return time.replace(/天|小时/g, scale);
    };

    return {
      profitTrades: p,
      lossTrades: l,
      totalTrades: total,
      winRate: wr + '%',
      pnl: `$+${pnlVal}`,
      fees: `$+${feeVal}`,
      currentTopTrades: topTrades.map(t => ({
        ...t,
        pnl: scaleCurrency(t.pnl, multiplier * 0.8), // Slightly vary scaling
        time: adjustTime(t.time, timeScale)
      })),
      currentAssetPerformance: assetPerformance.map(ap => ({
        ...ap,
        trades: Math.floor(ap.trades * multiplier),
        pnl: scaleCurrency(ap.pnl, multiplier),
        netPnl: scaleCurrency(ap.netPnl, multiplier),
        fees: scaleCurrency(ap.fees, multiplier)
      })),
      currentPositionPerformance: positionPerformance.map(pp => ({
        ...pp,
        pnl: scaleCurrency(pp.pnl, multiplier),
        fees: scaleCurrency(pp.fees, multiplier),
        time: adjustTime(pp.time, timeScale)
      }))
    };
  }, [timeRange]);

  // Simulate initial loading when address changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, address]);

  // Close dropdown on outside click / when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeRangeOpen(false);
      return;
    }
    if (!timeRangeOpen) return;
    const onDocPointerDown = () => setTimeRangeOpen(false);
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [isOpen, timeRangeOpen]);

  const donutOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'pie',
        radius: ['60%', '80%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => totalTrades.toString(),
          fontSize: 18,
          fontWeight: 'bold',
          color: '#ffffff'
        },
        emphasis: {
          scale: false
        },
        labelLine: {
          show: false
        },
        data: [
          { value: profitTrades, name: '盈利', itemStyle: { color: '#22c55e' } },
          { value: lossTrades, name: '亏损', itemStyle: { color: '#ef4444' } }
        ]
      }
    ]
  };

  const formatAddress = (addr: string) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="交易统计"
      width="max-w-[1152px]"
      loading={loading}
    >
      <div className="flex flex-col gap-8">
        {/* Header Extra Info */}
        <div className="flex items-center justify-between -mt-4 mb-0">
          <div className="px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600" />
            <span className="text-[#cccccc] text-base font-semibold">{formatAddress(address)}</span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTimeRangeOpen(v => !v);
              }}
              className="flex items-center gap-3 px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-xl text-[#c9d1d9] text-sm font-bold hover:border-[#3b82f6]/50 transition-all"
            >
              {timeRange}
              <ChevronDown className={`w-4 h-4 transition-transform ${timeRangeOpen ? 'rotate-180' : ''}`} />
            </button>
            {timeRangeOpen && (
              <div
                className="absolute right-0 mt-2 w-[120px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-30"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(['1周', '1月', '全部'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setTimeRange(opt);
                      setTimeRangeOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${
                      timeRange === opt ? 'bg-white/5 text-white' : 'text-[#c9d1d9] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="胜率"
            value={winRate}
            subStats={[
              { label: '已平仓盈亏（未扣除费用）', value: pnl, color: 'text-green-400' },
              { label: '扣除费用', value: fees, color: 'text-white' }
            ]}
          />
          <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden h-full">
            <span className="text-[#8b949e] text-caption font-medium z-10">交易次数</span>
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[80px] h-[80px]">
              <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} />
            </div>

            <div className="flex flex-col gap-1 z-10 mt-auto">
              <div className="flex items-center gap-2 text-caption font-medium">
                <span className="text-[#8b949e]">盈利</span>
                <span className="text-green-400 font-bold">{profitTrades}</span>
              </div>
              <div className="flex items-center gap-2 text-caption font-medium">
                <span className="text-[#8b949e]">亏损</span>
                <span className="text-red-400 font-bold">{lossTrades}</span>
              </div>
            </div>
          </div>
          <StatCard
            label="已实现盈亏"
            value="$-38,757.45"
            valueColor="text-red-400"
            subStats={[
              { label: '做多', value: '$-2,905.86', color: 'text-red-400' },
              { label: '做空', value: '$-35,851.59', color: 'text-red-400' }
            ]}
          />
          <StatCard
            label="总持仓时间"
            value="81"
            unit="小时"
            value2="34"
            unit2="分"
            subStats={[
              { label: '持仓区间', value: '2分 ~ 76小时 17分', color: 'text-white' },
              { label: '平均持仓时间', value: '8小时 10分', color: 'text-white' }
            ]}
          />
        </div>

        {/* Top Trades Section */}
        <div className="flex flex-col gap-4">
          <SectionTitle className="text-lg">十大最佳交易</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentTopTrades.map((trade, idx) => (
              <TradeCard key={idx} {...trade} />
            ))}
          </div>
        </div>

        {/* Performance Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-8 border-b border-[#30363d]">
            <button
              onClick={() => setActiveTab('asset')}
              className={`px-4 py-4 text-base font-bold transition-all border-b-2 -mb-[2px] ${activeTab === 'asset' ? 'text-white border-[#3b82f6]' : 'text-[#8b949e] border-transparent hover:text-white'}`}
            >
              按资产的表现
            </button>
            <button
              onClick={() => setActiveTab('position')}
              className={`px-4 py-4 text-base font-bold transition-all border-b-2 -mb-[2px] ${activeTab === 'position' ? 'text-white border-[#3b82f6]' : 'text-[#8b949e] border-transparent hover:text-white'}`}
            >
              按仓位的表现
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {activeTab === 'asset' ? (
              currentAssetPerformance.map((item, idx) => (
                <PerformanceCard key={idx} {...item} />
              ))
            ) : (
              currentPositionPerformance.map((item, idx) => (
                <PositionCard key={idx} {...item} />
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
