'use client'

import type {
  BacktestReportMetrics,
  LiveBacktestReportInput,
  RiskItem,
  TradeRecord,
} from './backtest-report-data'
import type { BacktestJobResult } from '@/components/ai-quant/backtest-job-client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import React, { startTransition, useMemo, useState } from 'react'
import { getBacktestJobResult } from '@/components/ai-quant/backtest-job-client'
import { createBacktestReportDataFromLive } from './backtest-report-data'

interface BacktestReportProps {
  lng: string
  id: string
  symbol: string
  rangeDisplay: string
  metrics: BacktestReportMetrics | null
  report?: LiveBacktestReportInput | null
}

type DetailedReportState = 'idle' | 'loading' | 'ready' | 'error'

const LazyBacktestEquityChart = dynamic(
  () => import('./BacktestEquityChart').then(mod => mod.BacktestEquityChart),
  { ssr: false },
)

function mapDetailedReport(result: BacktestJobResult): LiveBacktestReportInput | null {
  if (!Array.isArray(result.equityCurve) || !Array.isArray(result.trades)) {
    return null
  }

  return {
    equityCurve: result.equityCurve,
    trades: result.trades.map(trade => ({
      id: trade.id,
      side: trade.side,
      exitTs: trade.exitTs,
      exitPrice: trade.exitPrice,
      returnPct: trade.returnPct,
    })),
  }
}

// --- 1. Strategy Conclusion Card ---
function StrategyConclusionCard({
  status,
  summary,
  onDeploy,
  lng,
}: {
  status: 'good' | 'warning' | 'danger'
  summary: string
  onDeploy: () => void
  lng: string
}) {
  const statusConfig = {
    good: {
      color: 'var(--cf-primary)',
      icon: '🟢',
      bgGlow: 'bg-[color:var(--cf-primary)]/10',
      border: 'border-[color:var(--cf-border)]',
      shadow: 'shadow-[0_0_10px_var(--cf-primary)]',
      btnClass: 'from-primary to-secondary bg-gradient-to-r text-white',
    },
    warning: {
      color: '#F5A623',
      icon: '🟡',
      bgGlow: 'bg-[#F5A623]/10',
      border: 'border-[color:var(--cf-border)]',
      shadow: 'shadow-[0_0_10px_#F5A623]',
      btnClass: 'bg-gradient-to-r from-[#F5A623] to-[#D48806] text-white',
    },
    danger: {
      color: '#FF4D4F',
      icon: '🔴',
      bgGlow: 'bg-[#FF4D4F]/10',
      border: 'border-[color:var(--cf-border)]',
      shadow: 'shadow-[0_0_10px_#FF4D4F]',
      btnClass: 'bg-gradient-to-r from-[#FF4D4F] to-[#CF1322] text-white',
    },
  }
  const config = statusConfig[status]

  return (
    <div
      className={`relative overflow-hidden border bg-[color:var(--cf-surface)] ${config.border} flex flex-col items-start justify-between gap-4 rounded-[16px] p-6 md:flex-row md:items-center`}
    >
      <div
        className={`absolute top-0 left-0 h-full w-32 ${config.bgGlow} pointer-events-none blur-3xl`}
      ></div>

      <div className="relative z-10 flex items-center gap-4">
        <div
          className={`h-3 w-3 rounded-full ${config.shadow}`}
          style={{ backgroundColor: config.color }}
        ></div>
        <h2 className="text-base font-medium text-[color:var(--cf-text)]">{summary}</h2>
      </div>

      <button
        type="button"
        onClick={onDeploy}
        className={`relative z-10 rounded-xl px-8 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 ${config.btnClass}`}
      >
        {lng === 'en' ? 'One-Click Deploy' : '一键部署'}
      </button>
    </div>
  )
}

// --- 2. Core Metrics Grid ---
function MetricCard({
  title,
  value,
  trend,
}: {
  title: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  const colorClass =
    trend === 'up'
      ? 'text-[color:var(--cf-primary)]'
      : trend === 'down'
        ? 'text-[#FF4D4F]'
        : 'text-[color:var(--cf-text-strong)]'

  return (
    <div className="rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 backdrop-blur-sm transition-all duration-300 hover:bg-[color:var(--cf-surface-hover)]">
      <p className="text-sm font-medium text-[color:var(--cf-muted)]">{title}</p>
      <p className={`mt-2 text-[28px] font-bold tracking-tight md:text-[32px] ${colorClass}`}>
        {value}
      </p>
    </div>
  )
}

// --- 4. AI Analysis Panel ---
function AiAnalysisPanel({ lng, insights }: { lng: string; insights: string[] }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 transition-all duration-300">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <h3 className="text-base font-medium text-[color:var(--cf-text-strong)]">
            {lng === 'en' ? 'AI Insights' : 'AI 深度洞察'}
          </h3>
        </div>
        <button
          type="button"
          className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
        >
          {expanded ? (lng === 'en' ? 'Collapse' : '收起') : lng === 'en' ? 'Expand' : '展开'}
        </button>
      </div>

      {expanded && (
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-[color:var(--cf-text)]">
          {insights.map((insight, index) => (
            <li key={`${index}-${insight}`}>
              <p>{lng === 'en' ? insight : insight}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// --- 5. Risk Analysis ---
function RiskCard({ title, data }: { title: string; data: { label: string; value: string }[] }) {
  return (
    <div className="flex h-full flex-col rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 backdrop-blur-sm">
      <h3 className="mb-6 text-base font-medium text-[color:var(--cf-text-strong)]">{title}</h3>
      <div className="flex flex-1 flex-col justify-center space-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--cf-muted)]">{item.label}</span>
            <span className="font-medium text-[color:var(--cf-text-strong)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- 6. Trade Details Section ---
function TradeDetailsSection({ lng, trades }: { lng: string; trades: TradeRecord[] }) {
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all')
  const [expanded, setExpanded] = useState(false)

  const filteredTrades = trades.filter(t => {
    if (filter === 'profit') return t.isProfit
    if (filter === 'loss') return !t.isProfit
    return true
  })

  const displayTrades = expanded ? filteredTrades : filteredTrades.slice(0, 3)

  return (
    <div className="rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 backdrop-blur-sm">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h3 className="text-base font-medium text-[color:var(--cf-text-strong)]">
          {lng === 'en' ? 'Trade Details' : '交易明细'}
        </h3>
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-1">
          {(['all', 'profit', 'loss'] as const).map(f => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${
                filter === f
                  ? 'border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-hover)] font-medium text-[color:var(--cf-text-strong)] shadow-sm'
                  : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
              }`}
            >
              {f === 'all'
                ? lng === 'en'
                  ? 'All'
                  : '全部'
                : f === 'profit'
                  ? lng === 'en'
                    ? 'Profit'
                    : '盈利'
                  : lng === 'en'
                    ? 'Loss'
                    : '亏损'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)]">
              <th className="pb-3 font-normal">{lng === 'en' ? 'Time' : '时间'}</th>
              <th className="pb-3 font-normal">{lng === 'en' ? 'Direction' : '方向'}</th>
              <th className="pb-3 font-normal">{lng === 'en' ? 'Price' : '成交价'}</th>
              <th className="pb-3 text-right font-normal">{lng === 'en' ? 'Return' : '收益率'}</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map(trade => (
              <tr
                key={trade.id}
                className="border-b border-[color:var(--cf-border)] transition-colors last:border-0 hover:bg-[color:var(--cf-surface-hover)]"
              >
                <td className="py-3 text-[color:var(--cf-text)]">{trade.time}</td>
                <td className="py-3 text-[color:var(--cf-text)]">
                  {trade.type === 'buy-long'
                    ? lng === 'en'
                      ? 'Buy/Long'
                      : '买入/做多'
                    : lng === 'en'
                      ? 'Sell/Close'
                      : '卖出/平多'}
                </td>
                <td className="py-3 text-[color:var(--cf-text)]">${trade.price.toFixed(2)}</td>
                <td
                  className={`py-3 text-right font-medium ${trade.isProfit ? 'text-[color:var(--cf-primary)]' : 'text-[#FF4D4F]'}`}
                >
                  {`${trade.profitPct > 0 ? '+' : ''}${trade.profitPct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTrades.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex w-full items-center justify-center gap-1 py-2 text-xs text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
        >
          {expanded
            ? lng === 'en'
              ? 'Collapse Details'
              : '收起明细'
            : lng === 'en'
              ? `View More (${filteredTrades.length - 3})`
              : `查看更多 (${filteredTrades.length - 3})`}
        </button>
      )}
    </div>
  )
}

// --- Main Page Component ---
export function BacktestReportClient({
  lng,
  id,
  symbol,
  rangeDisplay,
  metrics,
  report = null,
}: BacktestReportProps) {
  const [detailedReport, setDetailedReport] = useState<LiveBacktestReportInput | null>(report)
  const [detailedReportState, setDetailedReportState] = useState<DetailedReportState>(() => {
    if (report) {
      return 'ready'
    }
    if (metrics) {
      return 'loading'
    }
    return 'idle'
  })

  React.useEffect(() => {
    if (report) {
      setDetailedReport(report)
      setDetailedReportState('ready')
      return
    }

    if (!metrics) {
      setDetailedReport(null)
      setDetailedReportState('idle')
      return
    }

    let cancelled = false
    setDetailedReport(null)
    setDetailedReportState('loading')

    void getBacktestJobResult(id)
      .then(result => {
        if (cancelled) {
          return
        }

        const nextReport = mapDetailedReport(result)
        startTransition(() => {
          setDetailedReport(nextReport)
          setDetailedReportState(nextReport ? 'ready' : 'error')
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        startTransition(() => {
          setDetailedReport(null)
          setDetailedReportState('error')
        })
      })

    return () => {
      cancelled = true
    }
  }, [id, metrics, report])

  const reportData = useMemo(() => {
    if (!metrics || !detailedReport) {
      return null
    }
    return createBacktestReportDataFromLive(id, metrics, detailedReport)
  }, [detailedReport, id, metrics])
  const hasReportData = metrics !== null && reportData !== null

  const handleDeploy = () => {}

  // Determine strategy status based on metrics
  let status: 'good' | 'warning' | 'danger' = 'warning'
  let summary =
    lng === 'en'
      ? 'Average performance, consider optimizing parameters before deploying.'
      : '表现一般，建议优化参数后再部署。'

  if (metrics && metrics.maxDrawdownPct <= 15 && metrics.totalReturnPct > 20) {
    status = 'good'
    summary =
      lng === 'en'
        ? 'Good performance, controllable risk and considerable return, recommended to deploy.'
        : '策略表现良好，风险可控且收益可观，建议部署。'
  } else if (metrics && (metrics.maxDrawdownPct > 30 || metrics.totalReturnPct < 0)) {
    status = 'danger'
    summary =
      lng === 'en'
        ? 'High risk or in loss, not recommended to deploy.'
        : '策略风险较高或处于亏损状态，不建议部署。'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">
            {lng === 'en' ? 'Backtest Analysis Report' : '回测分析报告'}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
            {symbol} · {rangeDisplay}
          </p>
        </div>
        <Link
          href={`/${lng}/ai-quant`}
          className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
        >
          {lng === 'en' ? 'Back to AI Quant' : '返回 AI量化'}
        </Link>
      </div>

      {/* 1. 策略结论区 */}
      <StrategyConclusionCard status={status} summary={summary} onDeploy={handleDeploy} lng={lng} />

      {/* 2. 核心指标卡 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          title={lng === 'en' ? 'Total Return' : '总收益'}
          value={
            metrics ? `${metrics.totalReturnPct > 0 ? '+' : ''}${metrics.totalReturnPct}%` : '--'
          }
          trend={metrics ? (metrics.totalReturnPct > 0 ? 'up' : 'down') : 'neutral'}
        />
        <MetricCard
          title={lng === 'en' ? 'Max Drawdown' : '最大回撤'}
          value={metrics ? `-${metrics.maxDrawdownPct}%` : '--'}
          trend="down"
        />
        <MetricCard
          title={lng === 'en' ? 'Win Rate' : '胜率'}
          value={metrics ? `${metrics.winRatePct}%` : '--'}
          trend="neutral"
        />
        <MetricCard
          title={lng === 'en' ? 'Trade Count' : '交易次数'}
          value={metrics ? `${metrics.tradeCount}` : '--'}
          trend="neutral"
        />
      </div>

      {hasReportData && reportData ? (
        <>
          {/* 3. 净值曲线图 */}
          <LazyBacktestEquityChart lng={lng} data={reportData.equitySeries} />

          {/* 4. AI 分析总结 */}
          <AiAnalysisPanel lng={lng} insights={reportData.insights} />

          {/* 5. 风险分析 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RiskCard
              title={lng === 'en' ? 'Max Drawdown Analysis' : '最大回撤分析'}
              data={reportData.maxDrawdownAnalysis.map(item => ({
                label:
                  lng === 'en'
                    ? item.label
                    : item.label === 'Max Drawdown'
                      ? '最大回撤幅度'
                      : item.label === 'Drawdown Period'
                        ? '回撤发生时间'
                        : '回撤恢复天数',
                value:
                  lng === 'en'
                    ? item.value
                    : item.label === 'Recovery Days'
                      ? item.value.replace(' Days', ' 天')
                      : item.value,
              }))}
            />
            <RiskCard
              title={lng === 'en' ? 'Volatility & Sharpe' : '波动率与夏普'}
              data={reportData.volatilitySharpe.map(item => ({
                label:
                  lng === 'en'
                    ? item.label
                    : item.label === 'Annualized Volatility'
                      ? '年化波动率'
                      : item.label === 'Sharpe Ratio'
                        ? '夏普比率 (Sharpe)'
                        : '索提诺比率 (Sortino)',
                value: item.value,
              }))}
            />
          </div>

          {/* 6. 交易明细 */}
          <TradeDetailsSection lng={lng} trades={reportData.trades} />
        </>
      ) : detailedReportState === 'loading' && metrics ? (
        <div className="rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 text-sm text-[color:var(--cf-muted)]">
          {lng === 'en' ? 'Loading detailed backtest report data...' : '正在加载详细回测数据...'}
        </div>
      ) : (
        <div className="rounded-[16px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 text-sm text-[color:var(--cf-muted)]">
          {lng === 'en'
            ? 'Backtest result data is unavailable. Please rerun the backtest and open the report again.'
            : '回测结果暂不可用，请重新执行回测后再打开该报告。'}
        </div>
      )}
    </div>
  )
}
