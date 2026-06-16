'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchStrategyPlazaTemplate } from '@/lib/api'
import { normalizeBacktestMarketType } from '../../backtest/[id]/backtest-result-presentation'
import { BacktestEquityChart } from '../../backtest/[id]/BacktestEquityChart'
import {
  AiAnalysisPanel,
  DecisionSummarySection,
  RiskCard,
  TradeDetailsSection,
} from '../../backtest/[id]/BacktestReportClient'
import { createOfficialBacktestReportData } from './official-backtest-report-data'

interface OfficialStrategyBacktestReportClientProps {
  lng: 'zh' | 'en' | string
  templateId: string
}

function formatPct(value: number | null, sign = false): string {
  if (value == null) return '--'
  const formatted = `${Number(value.toFixed(2)).toString()}%`
  return sign && value > 0 ? `+${formatted}` : formatted
}

function confidenceLabel(level: StrategyPlazaTemplate['officialBacktest']['confidence']['level']): string {
  if (level === 'high') return '高置信'
  if (level === 'medium') return '中置信'
  return '低置信'
}

export function OfficialStrategyBacktestReportClient({
  lng,
  templateId,
}: OfficialStrategyBacktestReportClientProps) {
  const [template, setTemplate] = useState<StrategyPlazaTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTemplate() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchStrategyPlazaTemplate(templateId)
        if (!cancelled) setTemplate(data)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error && loadError.message.trim() ? loadError.message : '获取官方回测报告失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTemplate()

    return () => {
      cancelled = true
    }
  }, [templateId])

  const report = useMemo(
    () => (template ? createOfficialBacktestReportData(template, lng) : null),
    [lng, template],
  )

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 py-8 md:px-8">
        <div className="h-9 w-28 animate-pulse rounded-full bg-[color:var(--cf-surface)]" />
        <div className="h-36 animate-pulse rounded-2xl bg-[color:var(--cf-surface)]" />
        <div className="h-[360px] animate-pulse rounded-2xl bg-[color:var(--cf-surface)]" />
      </main>
    )
  }

  if (error || !report) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 py-8 md:px-8">
        <Link href={`/${lng}/ai-quant/plaza`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs leading-5 font-semibold text-[color:var(--cf-text-strong)]">
          <ChevronLeft className="size-4" />
          返回策略广场
        </Link>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-[22px] text-red-500">
          {error ?? '官方回测报告不存在'}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 py-8 md:px-8">
      <Link href={`/${lng}/ai-quant/plaza`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs leading-5 font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]">
        <ChevronLeft className="size-4" />
        返回策略广场
      </Link>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600">
              官方样本回测 · {confidenceLabel(report.confidence.level)}
            </div>
            <h1 className="!text-3xl !leading-10 !font-semibold text-[color:var(--cf-text-strong)]">
              {report.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-[22px] text-[color:var(--cf-muted)]">
              {report.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--cf-muted)]">
              <span className="rounded-full border border-[color:var(--cf-border)] px-2.5 py-1 font-mono">{report.symbol}</span>
              <span className="rounded-full border border-[color:var(--cf-border)] px-2.5 py-1">{report.marketType}</span>
              <span className="rounded-full border border-[color:var(--cf-border)] px-2.5 py-1">{report.timeframe}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="收益" value={formatPct(report.metrics.returnPct, true)} tone={report.metrics.returnPct == null || report.metrics.returnPct >= 0 ? 'text-emerald-600' : 'text-red-500'} />
        <MetricCard label="胜率" value={formatPct(report.metrics.winRatePct)} />
        <MetricCard label="最大回撤" value={formatPct(report.metrics.maxDrawdownPct)} tone="text-red-500" />
        <MetricCard label="交易数" value={report.metrics.tradeCount == null ? '--' : String(report.metrics.tradeCount)} />
      </section>

      <BacktestEquityChart lng={lng} data={report.equitySeries} />

      {report.detailedReport && (
        <>
          <DecisionSummarySection
            confidence={report.detailedReport.confidence}
            strategyFit={report.detailedReport.strategyFit}
            marketCapabilityNotes={report.detailedReport.marketCapabilityNotes}
          />

          <AiAnalysisPanel lng={lng} insights={report.detailedReport.insights} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RiskCard
              title={lng === 'en' ? 'Max Drawdown Analysis' : '最大回撤分析'}
              data={report.detailedReport.maxDrawdownAnalysis.map(item => ({
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
                      ? item.value === 'Not recovered'
                        ? '未恢复'
                        : item.value.replace(' Days', ' 天')
                      : item.label === 'Drawdown Period' && item.value === '- ~ -'
                        ? '--'
                        : item.value,
              }))}
            />
            <RiskCard
              title={lng === 'en' ? 'Volatility & Sharpe' : '波动率与夏普'}
              data={report.detailedReport.volatilitySharpe.map(item => ({
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

          <TradeDetailsSection
            lng={lng}
            trades={report.detailedReport.trades}
            marketType={normalizeBacktestMarketType(report.marketType)}
          />
        </>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4">
          <h2 className="!text-base !leading-6 !font-semibold text-[color:var(--cf-text-strong)]">证据说明</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.evidenceRows.map(row => (
              <div key={row.label}>
                <dt className="text-xs text-[color:var(--cf-muted)]">{row.label}</dt>
                <dd className="mt-1 font-mono text-sm text-[color:var(--cf-text-strong)]">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-5 text-[color:var(--cf-muted)]">{report.disclaimer}</p>
        </div>

        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4">
          <h2 className="!text-base !leading-6 !font-semibold text-[color:var(--cf-text-strong)]">置信度</h2>
          <div className="mt-2 text-sm font-semibold text-[color:var(--cf-text-strong)]">{confidenceLabel(report.confidence.level)}</div>
          <ul className="mt-3 space-y-2 text-sm leading-[22px] text-[color:var(--cf-muted)]">
            {report.confidence.reasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value, tone = 'text-[color:var(--cf-text-strong)]' }: { label: string, value: string, tone?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3">
      <div className="text-xs text-[color:var(--cf-muted)]">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}
