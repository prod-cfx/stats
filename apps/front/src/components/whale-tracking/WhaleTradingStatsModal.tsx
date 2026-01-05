'use client';

import ReactECharts from 'echarts-for-react';
import { ChevronDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const TradeCard = ({ asset, side, time, pnl, duration, icon }: TradeCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all group h-full">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <img src={icon} alt={asset} className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-body truncate">{asset}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${side === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
          </span>
        </div>
        <span className="text-[#8b949e] text-caption font-medium whitespace-nowrap flex-shrink-0">{time}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider mb-1">{t('whaleTracking.modal.realizedPnl')}</span>
        <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2`}>{pnl}</span>
      </div>
      <div className="flex justify-between items-center text-caption pt-2 border-t border-[#30363d]/50 mt-auto">
        <span className="text-[#8b949e] font-medium">{t('whaleTracking.modal.duration')}</span>
        <span className="text-white font-semibold">{duration}</span>
      </div>
    </div>
  );
};

interface PerformanceCardProps {
  asset: string;
  trades: number;
  pnl: string;
  netPnl: string;
  fees: string;
  icon: string;
}

const PerformanceCard = ({ asset, trades, pnl, netPnl, fees, icon }: PerformanceCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all h-full">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 flex items-center justify-center">
            <img src={icon} alt={asset} className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-body">{asset}</span>
        </div>
        <span className="text-[#8b949e] text-caption font-bold bg-[#161b22] px-2 py-1 rounded">{t('whaleTracking.modal.tradesCount', { count: trades })}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider mb-1">{t('whaleTracking.modal.realizedPnl')}</span>
        <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2`}>{pnl}</span>
      </div>
      <div className="space-y-2 pt-2 border-t border-[#30363d]/50">
        <div className="flex justify-between items-center text-caption font-medium">
          <span className="text-[#8b949e]">{t('whaleTracking.modal.netPnl')}</span>
          <span className={`font-bold ${netPnl.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{netPnl}</span>
        </div>
        <div className="flex justify-between items-center text-caption font-medium">
          <span className="text-[#8b949e]">{t('whaleTracking.modal.fees')}</span>
          <span className="text-white font-bold">{fees}</span>
        </div>
      </div>
    </div>
  );
};

interface PositionCardProps {
  asset: string;
  side: 'Long' | 'Short';
  time: string;
  pnl: string;
  size: string;
  fees: string;
  icon: string;
}

const PositionCard = ({ asset, side, time, pnl, size, fees, icon }: PositionCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3b82f6]/50 transition-all h-full">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 flex items-center justify-center">
            <img src={icon} alt={asset} className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-body">{asset}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${side === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
          </span>
        </div>
        <span className="text-[#8b949e] text-caption font-medium">{time}</span>
      </div>
      <div className="flex flex-col py-1">
        <span className={`${pnl.includes('+') ? 'text-green-400' : 'text-red-400'} font-bold text-h2 tracking-tight`}>{pnl}</span>
      </div>
      <div className="space-y-2 pt-2 border-t border-[#30363d]/50 mt-auto">
        <div className="flex justify-between items-center text-caption font-medium">
          <span className="text-[#8b949e]">{t('whaleTracking.modal.size')}</span>
          <span className="text-white font-bold">{size}</span>
        </div>
        <div className="flex justify-between items-center text-caption font-medium">
          <span className="text-[#8b949e]">{t('whaleTracking.modal.fees')}</span>
          <span className="text-white font-bold">{fees}</span>
        </div>
      </div>
    </div>
  );
};

const ASSET_POOL: Array<{ asset: string; icon: string }> = [
  { asset: 'BTC', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/btc.png' },
  { asset: 'ETH', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/eth.png' },
  { asset: 'SOL', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/sol.png' },
  { asset: 'DOGE', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/doge.png' },
  { asset: 'LINK', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/link.png' },
  { asset: 'XRP', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/xrp.png' },
  { asset: 'ADA', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/ada.png' },
  { asset: 'AVAX', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/avax.png' },
  { asset: 'ATOM', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/atom.png' },
  { asset: 'APT', icon: 'https://cdn.jsdelivr.net/gh/clowwindy/crypto-icons@master/32/color/apt.png' },
  { asset: 'PENDLE', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=pendle' },
  { asset: 'ONDO', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ondo' },
  { asset: 'TIA', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=tia' },
  { asset: 'ENA', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=ena' },
  { asset: 'FARTCOIN', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=fart' },
  { asset: 'MET', icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=met' },
];

export const WhaleTradingStatsModal = ({ isOpen, onClose, address }: WhaleTradingStatsModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'asset' | 'position'>('asset');
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | 'all'>('1w');
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
    const now = Date.now();
    const windowMs = timeRange === '1w'
      ? 7 * 24 * 60 * 60 * 1000
      : timeRange === '1m'
        ? 30 * 24 * 60 * 60 * 1000
        : 365 * 24 * 60 * 60 * 1000;

    // deterministic RNG per timeRange (avoid re-render random jump)
    const mulberry32 = (seed: number) => {
      return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const seed = timeRange === '1w' ? 17 : (timeRange === '1m' ? 31 : 365);
    const rnd = mulberry32(seed);
    const randInt = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
    const randFloat = (min: number, max: number) => rnd() * (max - min) + min;

    const formatCurrency = (amount: number) => {
      const sign = amount >= 0 ? '+' : '-';
      const formatted = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `$${sign}${formatted}`;
    };

    const formatRelativeTime = (ts: number) => {
      const diffMs = Math.max(0, now - ts);
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 60) return t('whaleTracking.time.minutesAgo', { count: Math.max(1, minutes) });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('whaleTracking.time.hoursAgo', { count: hours });
      const days = Math.floor(hours / 24);
      if (days < 7) return t('whaleTracking.time.daysAgo', { count: days });
      if (days < 30) return t('whaleTracking.time.weeksAgo', { count: Math.floor(days / 7) });
      // months are approximate but derived from actual date diff window, not hard-coded offsets
      return t('whaleTracking.time.monthsAgo', { count: Math.max(1, Math.floor(days / 30)) });
    };

    const pickAsset = (used: Set<string>) => {
      // try a few times to reduce duplicates, then fallback
      for (let i = 0; i < 10; i++) {
        const candidate = ASSET_POOL[randInt(0, ASSET_POOL.length - 1)];
        if (!used.has(candidate.asset)) {
          used.add(candidate.asset);
          return candidate;
        }
      }
      const candidate = ASSET_POOL[randInt(0, ASSET_POOL.length - 1)];
      used.add(candidate.asset);
      return candidate;
    };

    // Generate independent datasets per timeRange (avoid slice on a shared constant list)
    const usedTopAssets = new Set<string>();
    const currentTopTradesGenerated: TradeCardProps[] = Array.from({ length: 10 }).map((_, idx) => {
      const { asset, icon } = pickAsset(usedTopAssets);
      const side: TradeCardProps['side'] = rnd() > 0.55 ? 'Short' : 'Long';
      const ts = now - Math.floor(rnd() * windowMs);
      const durationMin = randInt(2, timeRange === '1w' ? 360 : (timeRange === '1m' ? 24 * 60 * 5 : 24 * 60 * 20));
      const durH = Math.floor(durationMin / 60);
      const durM = durationMin % 60;
      const duration = t('whaleTracking.time.duration', { hours: durH, minutes: durM });

      // make pnl scale by range so "全部" has larger numbers, but still realistic
      const baseScale = timeRange === '1w' ? 1 : (timeRange === '1m' ? 4 : 12);
      const pnlAbs = randFloat(50, 80000) * baseScale * (1 + idx * 0.08);
      const pnlSigned = (rnd() > 0.25 ? 1 : -1) * pnlAbs;

      return {
        asset,
        side,
        icon,
        time: formatRelativeTime(ts),
        pnl: formatCurrency(pnlSigned),
        duration,
      };
    });

    const usedPerfAssets = new Set<string>();
    const currentAssetPerformanceGenerated: PerformanceCardProps[] = Array.from({ length: timeRange === '1w' ? 4 : (timeRange === '1m' ? 6 : 8) }).map(() => {
      // This block is only used for mock display; sizing is based on timeRange.
      const { asset, icon } = pickAsset(usedPerfAssets);
      const baseScale = timeRange === '1w' ? 1 : (timeRange === '1m' ? 4 : 12);
      const trades = randInt(1, 6) * baseScale;
      const pnl = randFloat(-90000, 150000) * baseScale;
      const fee = Math.abs(pnl) * randFloat(0.01, 0.08);
      const net = pnl - fee;
      return {
        asset,
        icon,
        trades,
        pnl: formatCurrency(pnl),
        netPnl: formatCurrency(net),
        fees: formatCurrency(fee),
      };
    });

    const usedPosAssets = new Set<string>();
    const currentPositionPerformanceGenerated: PositionCardProps[] = Array.from({ length: timeRange === '1w' ? 8 : (timeRange === '1m' ? 10 : 12) }).map(() => {
      const { asset, icon } = pickAsset(usedPosAssets);
      const side: PositionCardProps['side'] = rnd() > 0.55 ? 'Short' : 'Long';
      const ts = now - Math.floor(rnd() * windowMs);
      const baseScale = timeRange === '1w' ? 1 : (timeRange === '1m' ? 3.5 : 10);
      const pnl = randFloat(-40000, 60000) * baseScale;
      const fee = Math.abs(pnl) * randFloat(0.005, 0.03);
      const sizeNum = randFloat(20, 5000);
      const size = `${sizeNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${asset}`;
      return {
        asset,
        icon,
        side,
        time: formatRelativeTime(ts),
        pnl: formatCurrency(pnl),
        fees: formatCurrency(fee),
        size,
      };
    });

    const profitCount = currentTopTradesGenerated.filter(t => t.pnl.includes('$+')).length;
    const lossCount = currentTopTradesGenerated.length - profitCount;
    const total = currentTopTradesGenerated.length;
    const wr = total > 0 ? ((profitCount / total) * 100).toFixed(2) : '0.00';

    // summary stats are derived from generated lists (avoid lying with unrelated numbers)
    const pnlSum = currentTopTradesGenerated.reduce((acc, t) => {
      const n = Number.parseFloat(t.pnl.replace(/[$,]/g, ''));
      return acc + n;
    }, 0);
    const feesSum = currentPositionPerformanceGenerated.reduce((acc, p) => {
      const n = Number.parseFloat(p.fees.replace(/[$,]/g, ''));
      return acc + n;
    }, 0);

    return {
      profitTrades: profitCount,
      lossTrades: lossCount,
      totalTrades: total,
      winRate: `${wr}%`,
      pnl: formatCurrency(pnlSum),
      fees: formatCurrency(feesSum),
      currentTopTrades: currentTopTradesGenerated,
      currentAssetPerformance: currentAssetPerformanceGenerated,
      currentPositionPerformance: currentPositionPerformanceGenerated,
    };
  }, [timeRange, t]);

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

  const donutOption = useMemo(() => ({
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
          { value: profitTrades, name: t('whaleTracking.modal.profit'), itemStyle: { color: '#22c55e' } },
          { value: lossTrades, name: t('whaleTracking.modal.loss'), itemStyle: { color: '#ef4444' } }
        ]
      }
    ]
  }), [lossTrades, profitTrades, t, totalTrades]);

  const formatAddress = (addr: string) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('whaleTracking.modal.title')}
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
              {t(`whaleTracking.modal.timeRange.${timeRange}`)}
              <ChevronDown className={`w-4 h-4 transition-transform ${timeRangeOpen ? 'rotate-180' : ''}`} />
            </button>
            {timeRangeOpen && (
              <div
                className="absolute right-0 mt-2 w-[120px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-30"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(['1w', '1m', 'all'] as const).map((opt) => (
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
                    {t(`whaleTracking.modal.timeRange.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label={t('whaleTracking.modal.winRate')}
            value={winRate}
            subStats={[
              { label: t('whaleTracking.modal.closedPnlBeforeFees'), value: pnl, color: 'text-green-400' },
              { label: t('whaleTracking.modal.feesDeducted'), value: fees, color: 'text-white' }
            ]}
          />
          <div className="bg-[#0d1117]/50 border border-[#30363d] rounded-xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden h-full">
            <span className="text-[#8b949e] text-caption font-medium z-10">{t('whaleTracking.modal.tradeCount')}</span>
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[80px] h-[80px]">
              <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} />
            </div>

            <div className="flex flex-col gap-1 z-10 mt-auto">
              <div className="flex items-center gap-2 text-caption font-medium">
                <span className="text-[#8b949e]">{t('whaleTracking.modal.profit')}</span>
                <span className="text-green-400 font-bold">{profitTrades}</span>
              </div>
              <div className="flex items-center gap-2 text-caption font-medium">
                <span className="text-[#8b949e]">{t('whaleTracking.modal.loss')}</span>
                <span className="text-red-400 font-bold">{lossTrades}</span>
              </div>
            </div>
          </div>
          <StatCard
            label={t('whaleTracking.modal.realizedPnl')}
            value="$-38,757.45"
            valueColor="text-red-400"
            subStats={[
              { label: t('whaleTracking.side.long'), value: '$-2,905.86', color: 'text-red-400' },
              { label: t('whaleTracking.side.short'), value: '$-35,851.59', color: 'text-red-400' }
            ]}
          />
          <StatCard
            label={t('whaleTracking.modal.totalHoldTime')}
            value="81"
            unit={t('whaleTracking.modal.hours')}
            value2="34"
            unit2={t('whaleTracking.modal.minutes')}
            subStats={[
              { label: t('whaleTracking.modal.holdRange'), value: t('whaleTracking.modal.holdRangeValue'), color: 'text-white' },
              { label: t('whaleTracking.modal.avgHoldTime'), value: t('whaleTracking.modal.avgHoldTimeValue'), color: 'text-white' }
            ]}
          />
        </div>

        {/* Top Trades Section */}
        <div className="flex flex-col gap-4">
          <SectionTitle className="text-lg">{t('whaleTracking.modal.topTrades')}</SectionTitle>
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
              {t('whaleTracking.modal.byAsset')}
            </button>
            <button
              onClick={() => setActiveTab('position')}
              className={`px-4 py-4 text-base font-bold transition-all border-b-2 -mb-[2px] ${activeTab === 'position' ? 'text-white border-[#3b82f6]' : 'text-[#8b949e] border-transparent hover:text-white'}`}
            >
              {t('whaleTracking.modal.byPosition')}
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
