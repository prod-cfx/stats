'use client';

import ReactECharts from 'echarts-for-react';
import { Info } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserFillsResponse, UserPortfolioResponse } from '@/lib/api';
import { useTheme } from '@/components/providers/ThemeProvider';

// 后端 API 数据类型
interface SnapshotPerpDto {
  accountValue: number;
  totalMarginUsed: number;
  totalPositionValue: number;
  withdrawable: number;
  marginUsagePercent: number;
  leverageRatio: number;
  unrealizedPnl: number;
  roi: number;
}

interface SnapshotSpotDto {
  totalValue: number;
  balances: Array<{ coin: string; total: number; hold: number; value: number; sharePercent: number }>;
}

interface SnapshotTotalDto {
  accountValue: number;
  perpPercent: number;
  spotPercent: number;
}

interface TraderSnapshotResponse {
  perp: SnapshotPerpDto;
  spot: SnapshotSpotDto;
  total: SnapshotTotalDto;
}

interface ProfileSummaryProps {
  snapshot: TraderSnapshotResponse;
  fills: UserFillsResponse;
  portfolio: UserPortfolioResponse;
}

interface ChartDataPoint {
  value: number;
  name: string;
  itemStyle?: {
    color?: string;
  };
}

interface SummaryCardProps {
  label: string;
  value?: string;
  subText?: ReactNode;
  isPerformance?: boolean;
  chartData?: ChartDataPoint[];
  stats?: { label: string; value: string; sub: string; subVal: string }[];
  performanceData?: {
    winRateLabel: string;
    filledOrdersCount: number;
    closeCount: number;
    maxDrawdown: string;
  };
}

const SummaryCard = ({ label, value, subText, isPerformance, chartData, performanceData }: SummaryCardProps) => {
  const { t } = useTranslation();
  const chartOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'pie',
        radius: ['60%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { scale: false },
        labelLine: { show: false },
        data: chartData || []
      }
    ]
  };

  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-4 md:p-5 flex flex-col gap-3 md:gap-4 relative min-h-[140px] md:min-h-[160px]">
      <div className="text-[color:var(--cf-muted)] text-xs md:text-label font-medium">{label}</div>
      {isPerformance ? (
        <div className="flex flex-col gap-3 md:gap-4 mt-auto">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-[color:var(--cf-muted)] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.winRate')}</span>
              <span className="text-[color:var(--cf-text-strong)] text-xl md:text-h2 font-bold">{performanceData?.winRateLabel ?? '0.00 %'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[color:var(--cf-muted)] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.maxDrawdown')}</span>
              <span className="text-[color:var(--cf-text-strong)] text-xl md:text-h2 font-bold">
                {performanceData?.maxDrawdown ?? '0.00 %'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[color:var(--cf-muted)] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.filledOrders')}</span>
              <span className="text-[color:var(--cf-text-strong)] text-sm md:text-body font-bold ml-auto">{performanceData?.filledOrdersCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[color:var(--cf-muted)] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.closes')}</span>
              <span className="text-[color:var(--cf-text-strong)] text-sm md:text-body font-bold ml-auto">{performanceData?.closeCount ?? 0}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-2 md:gap-2.5 flex-1 min-w-0">
            <div className="text-[color:var(--cf-text-strong)] text-xl md:text-h2 font-bold tracking-tight truncate">{value}</div>
            <div className="w-full">{subText}</div>
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 flex-none ml-2 md:ml-4">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export const ProfileSummary = ({ snapshot, fills, portfolio }: ProfileSummaryProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme()

  // 格式化金额
  const formatAmount = (value: number): string => {
    if (value >= 1000000) {
      return `$ ${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$ ${(value / 1000).toFixed(2)}K`;
    }
    return `$ ${value.toFixed(2)}`;
  };

  // 账户价值数据
  const totalAccountValue = snapshot.total.accountValue;
  const perpAccountValue = snapshot.perp.accountValue;
  const spotAccountValue = snapshot.spot.totalValue;

  // 可用保证金数据
  const withdrawable = snapshot.perp.withdrawable ?? 0;
  const marginUsagePercent = snapshot.perp.marginUsagePercent ?? 0;
  const availablePercent = Number.isFinite(marginUsagePercent) ? 100 - marginUsagePercent : 100;
  const availableSliceColor = theme === 'dark' ? '#3a3a3a' : '#e2e8f0'

  // 总持仓价值数据
  const totalPositionValue = snapshot.perp.totalPositionValue;
  const leverageRatio = snapshot.perp.leverageRatio;

  // 胜率统计（使用 useMemo 避免每次渲染重新计算）
  const { closeCount, winRateLabel } = useMemo(() => {
    const closedFills = fills.fills.filter(fill => fill.direction.includes('Close'));
    const count = closedFills.length;
    const winCount = closedFills.filter(fill => fill.closedPnl > 0).length;
    const winRate = count === 0 ? 0 : (winCount / count) * 100;
    return {
      closeCount: count,
      winRateLabel: `${winRate.toFixed(2)} %`,
    };
  }, [fills]);

  // 计算最大回撤
  const maxDrawdown = useMemo(() => {
    if (!portfolio?.allTime?.pnlHistory || portfolio.allTime.pnlHistory.length === 0) {
      return 0;
    }

    let peak = -Infinity;
    let maxDD = 0;

    for (const point of portfolio.allTime.pnlHistory) {
      if (point.value > peak) {
        peak = point.value;
      } else if (peak > -Infinity) {
        const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
        maxDD = Math.max(maxDD, drawdown);
      }
    }

    return maxDD;
  }, [portfolio]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        label={t('whaleTracking.profile.summary.accountValue')}
        value={formatAmount(totalAccountValue)}
        chartData={[
          { value: perpAccountValue, name: t('whaleTracking.profile.summary.perpetual'), itemStyle: { color: '#5470c6' } },
          { value: spotAccountValue, name: t('whaleTracking.profile.summary.spot'), itemStyle: { color: '#91cc75' } }
        ]}
        subText={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] md:text-caption text-[color:var(--cf-muted)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5470c6]" />
              <span className="truncate">{t('whaleTracking.profile.summary.perpetual')}</span>
              <span className="text-[color:var(--cf-text)] ml-auto">{formatAmount(perpAccountValue)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-caption text-[color:var(--cf-muted)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#91cc75]" />
              <span className="truncate">{t('whaleTracking.profile.summary.spot')}</span>
              <span className="text-[color:var(--cf-text)] ml-auto">{formatAmount(spotAccountValue)}</span>
            </div>
          </div>
        }
      />
      <SummaryCard
        label={t('whaleTracking.profile.summary.availableMargin')}
        value={formatAmount(withdrawable)}
        chartData={[
          { value: marginUsagePercent, name: t('whaleTracking.profile.summary.used'), itemStyle: { color: '#fac858' } },
          { value: availablePercent, name: t('whaleTracking.profile.summary.available'), itemStyle: { color: availableSliceColor } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-[10px] md:text-caption text-[color:var(--cf-muted)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span className="truncate">{t('whaleTracking.profile.summary.withdrawable')}</span>
            <span className="text-[color:var(--cf-text)] ml-auto">{availablePercent.toFixed(2)} %</span>
          </div>
        }
      />
      <SummaryCard
        label={t('whaleTracking.profile.summary.totalPositionValue')}
        value={formatAmount(totalPositionValue)}
        chartData={[
          { value: 100, name: t('whaleTracking.profile.summary.shortExposure'), itemStyle: { color: '#fac858' } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-[10px] md:text-caption text-[color:var(--cf-muted)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span className="truncate">{t('whaleTracking.profile.summary.leverageRatio')}</span>
            <Info className="w-2.5 h-2.5 md:w-3 md:h-3 text-[color:var(--cf-muted)]" />
            <span className="text-[color:var(--cf-text)] ml-auto">{leverageRatio.toFixed(2)}x</span>
          </div>
        }
      />
      <SummaryCard
        label={t('whaleTracking.profile.summary.performanceWeek')}
        isPerformance
        performanceData={{
          winRateLabel,
          filledOrdersCount: fills.fills.length,
          closeCount,
          maxDrawdown: `${maxDrawdown.toFixed(2)} %`
        }}
      />
    </div>
  );
};
