'use client';

import ReactECharts from 'echarts-for-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import React, { useState } from 'react';
import { SectionTitle } from '@/components/ui/Typography';

interface WhaleTradingStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

export const WhaleTradingStatsModal = ({ isOpen, onClose, address }: WhaleTradingStatsModalProps) => {
  const [activeTab, setActiveTab] = useState('asset'); // 'asset' | 'position'
  const [timeRange, setTimeRange] = useState('1周');

  const donutOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: '{c}',
          fontSize: 24,
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
          { value: 5, name: '盈利', itemStyle: { color: '#22c55e' } },
          { value: 5, name: '亏损', itemStyle: { color: '#ef4444' } }
        ]
      }
    ]
  };

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[1152px] h-[90vh] bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex-none px-8 py-5 border-b border-[#30363d] flex items-center justify-between bg-[#161b22] sticky top-0 z-10">
            <div className="flex items-center gap-8">
              <SectionTitle className="text-2xl">交易统计</SectionTitle>
              <div className="px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600" />
                <span className="text-[#cccccc] text-base font-semibold">{formatAddress(address)}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative group">
                <button className="flex items-center gap-3 px-4 py-2 bg-[#30363d] border border-[#30363d] rounded-xl text-[#c9d1d9] text-sm font-bold hover:border-[#3b82f6]/50 transition-all">
                  {timeRange}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {/* Stats Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="胜率"
                value="50.00%"
                subStats={[
                  { label: '净盈亏', value: '$+3,975.55', color: 'text-green-400' },
                  { label: '费用', value: '$+42,733.00', color: 'text-white' }
                ]}
              />
              <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 relative">
                <span className="text-[#8b949e] text-sm font-medium">交易次数</span>
                <div className="h-[96px] w-full">
                  <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} />
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-green-400">盈利 5</span>
                  <span className="text-red-400">亏损 5</span>
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
            <div className="space-y-4">
              <SectionTitle className="text-lg">十大最佳交易</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {topTrades.map((trade, idx) => (
                  <TradeCard key={idx} {...trade} />
                ))}
              </div>
            </div>

            {/* Performance Tabs */}
            <div className="space-y-6">
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
                  assetPerformance.map((item, idx) => (
                    <PerformanceCard key={idx} {...item} />
                  ))
                ) : (
                  positionPerformance.map((item, idx) => (
                    <PositionCard key={idx} {...item} />
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

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
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4">
    <span className="text-[#8b949e] text-caption font-medium">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-h1 font-bold ${valueColor}`}>{value}</span>
      {unit && <span className="text-caption text-white font-medium">{unit}</span>}
      {value2 && <span className="text-h1 font-bold text-white ml-2">{value2}</span>}
      {unit2 && <span className="text-caption text-white font-medium">{unit2}</span>}
    </div>
    <div className="space-y-2 mt-auto">
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
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all group">
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
    <div className="flex flex-col">
      <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider mb-1">已实现盈亏</span>
      <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2`}>{pnl}</span>
    </div>
    <div className="flex justify-between items-center text-caption pt-2 border-t border-[#30363d]/50">
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
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all">
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
  <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all">
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
      <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h1 tracking-tight`}>{pnl}</span>
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

