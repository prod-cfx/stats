'use client'

import type { AiQuantStrategyRecord, AiQuantStrategyViewState } from './ai-quant-strategy-store'
import type { AiQuantDeletionDialogKind } from '@/components/ai-quant/AiQuantDeletionDialog'
import { Activity, Clock, MoreHorizontal, Play, PlayCircle, StopCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiQuantDeletionDialog } from '@/components/ai-quant/AiQuantDeletionDialog'
import { StopRunningStrategyDialog } from '@/components/ai-quant/StopRunningStrategyDialog'
import { useAuth } from '@/hooks/use-auth'
import {
  deleteAccountAiQuantStrategy,
  fetchAccountAiQuantStrategies,
  fetchAccountAiQuantStrategyDetail,
  listAiQuantConversations,
  performAccountAiQuantStrategyAction,
} from '@/lib/api'
import { mapAccountStrategyDetailToRecord, mapAccountStrategyListItemToRecord } from './ai-quant-strategy-api-adapter'
import { buildDynamicParamRows } from './dynamic-param-summary'

export const STRATEGY_LIST_FETCH_LIMIT = 100

export type StrategyFilterTabKey = 'all' | 'running' | 'stopped' | 'history'

export interface StrategyFilterCounts {
  all: number
  running: number
  stopped: number
  history: number
}

function isHistory(item: Pick<AiQuantStrategyRecord, 'viewOnlyAt'>): boolean {
  return item.viewOnlyAt != null
}

export function filterStrategiesByTab(
  items: AiQuantStrategyRecord[],
  tab: StrategyFilterTabKey,
): AiQuantStrategyRecord[] {
  switch (tab) {
    case 'all':
      return items.filter(item => !isHistory(item))
    case 'running':
      return items.filter(item => !isHistory(item) && item.status === 'running')
    case 'stopped':
      return items.filter(item => !isHistory(item) && item.status === 'stopped')
    case 'history':
      return items.filter(isHistory)
    default: {
      const _exhaustive: never = tab
      void _exhaustive
      return []
    }
  }
}

export function computeTabCounts(items: AiQuantStrategyRecord[]): StrategyFilterCounts {
  let running = 0
  let stopped = 0
  let history = 0
  let active = 0
  for (const item of items) {
    if (isHistory(item)) {
      history++
      continue
    }
    active++
    if (item.status === 'running') running++
    else if (item.status === 'stopped') stopped++
  }
  return { all: active, running, stopped, history }
}

const TAB_ORDER: StrategyFilterTabKey[] = ['all', 'running', 'stopped', 'history']

type StrategyListTranslation = (key: string, options?: { defaultValue?: string }) => string

function formatPct(value: number, signed = false) {
  const normalized = Number.isFinite(value) ? value : 0
  const formatted = Number(normalized.toFixed(2)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: normalized % 1 === 0 ? 0 : 1,
  })
  return `${signed && normalized > 0 ? '+' : ''}${formatted}%`
}

function formatMetricNumber(value: number) {
  if (!Number.isFinite(value)) return '--'
  return Number(value.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function computeMetricSummary(items: AiQuantStrategyRecord[]) {
  const activeItems = items.filter(item => !isHistory(item))
  const averageReturnPct = activeItems.length
    ? activeItems.reduce((sum, item) => sum + item.metrics.returnPct, 0) / activeItems.length
    : 0
  const averageWinRate = activeItems.length
    ? activeItems.reduce((sum, item) => sum + item.metrics.winRatePct, 0) / activeItems.length
    : 0

  return { averageReturnPct, averageWinRate }
}

function StrategyFilterTabs({
  active,
  counts,
  onChange,
  t,
}: {
  active: StrategyFilterTabKey
  counts: StrategyFilterCounts
  onChange: (next: StrategyFilterTabKey) => void
  t: StrategyListTranslation
}) {
  return (
    <div role="tablist" className="cf-strategy-filter-tabs no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-1">
      {TAB_ORDER.map((key) => {
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`strategy-filter-tab-${key}`}
            data-active={isActive ? 'true' : 'false'}
            data-count={counts[key]}
            onClick={() => onChange(key)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${
              isActive
                ? 'bg-[color:var(--cf-surface)] font-semibold text-[color:var(--cf-text-strong)] shadow-sm'
                : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
            }`}
          >
            <span>{t(`aiQuant.filter.${key}`)}</span>
            <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-0.5 text-xs font-medium text-[color:var(--cf-muted)]">
              {counts[key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function fmtTime(ts: string, lng: string) {
  const date = new Date(ts)
  return date.toLocaleString(lng === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildParamSummary(
  paramSchema: Record<string, unknown> | null,
  paramValues: Record<string, unknown> | null,
  t?: StrategyListTranslation,
): string[] {
  return buildDynamicParamRows(paramSchema, paramValues)
    .slice(0, 3)
    .map(row => `${formatParamSummaryLabel(row.key, row.label, t)}: ${formatParamSummaryValue(row.key, row.value, t)}`)
}

function formatParamSummaryLabel(key: string, fallback: string, t?: StrategyListTranslation) {
  if (!t) return fallback
  const translationKey = `aiQuant.paramLabels.${key}`
  const translated = t(translationKey, { defaultValue: fallback })
  return translated === translationKey ? fallback : translated
}

function formatParamSummaryValue(key: string, value: string, t?: StrategyListTranslation) {
  if (!t || key !== 'marketType') return value
  const translationKey = `aiQuant.detail.marketTypes.${value}`
  const translated = t(translationKey, { defaultValue: value })
  return translated === translationKey ? value : translated
}

export function buildPrimarySummary(
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>,
  t: StrategyListTranslation,
): string[] {
  if (item.paramSchema) {
    const dynamicSummary = buildParamSummary(item.paramSchema, item.paramValues, t)
    return dynamicSummary.length ? dynamicSummary : [t('aiQuant.paramSummaryEmpty')]
  }

  return [
    item.exchange.toUpperCase(),
    item.symbol,
    item.timeframe,
    `${t('aiQuant.position')} ${item.positionPct}%`,
  ]
}

export function getStrategyRuntimeActionLabel(
  status: AiQuantStrategyViewState,
  t: StrategyListTranslation,
): string {
  if (status === 'running') {
    return t('aiQuant.actions.stopStrategy')
  }
  return t('aiQuant.actions.run')
}

export function AiQuantStrategyPrimarySummary({
  item,
  t,
  keyPrefix,
}: {
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>
  t: StrategyListTranslation
  keyPrefix: string
}) {
  const entries = buildPrimarySummary(item, t)

  return (
    <>
      {entries.map((entry, idx) => (
        <div key={`${keyPrefix}-param-${idx}`} className="contents">
          {idx > 0 && <span>/</span>}
          <span className={idx === 0 ? 'font-medium text-[color:var(--cf-text)]' : undefined}>
            {entry}
          </span>
        </div>
      ))}
    </>
  )
}

interface AccountDeleteDialogState {
  strategy: AiQuantStrategyRecord
  kind: AiQuantDeletionDialogKind
  conversation: { title: string } | null
  deleteStoppedStrategy: boolean
  pending: boolean
  errorMessage: string | null
}

export function AiQuantStrategyList({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const router = useRouter()
  const [strategies, setStrategies] = useState<AiQuantStrategyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [stopDialogStrategy, setStopDialogStrategy] = useState<AiQuantStrategyRecord | null>(null)
  const [accountDeleteDialog, setAccountDeleteDialog] = useState<AccountDeleteDialogState | null>(null)
  const [activeTab, setActiveTab] = useState<StrategyFilterTabKey>('all')
  const counts = useMemo(() => computeTabCounts(strategies), [strategies])
  const filteredStrategies = useMemo(
    () => filterStrategiesByTab(strategies, activeTab),
    [strategies, activeTab],
  )
  const metricSummary = useMemo(() => computeMetricSummary(strategies), [strategies])

  const loadStrategies = useCallback(async () => {
    if (!session) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchAccountAiQuantStrategies({
        userId: session.userId,
        page: 1,
        limit: STRATEGY_LIST_FETCH_LIMIT,
      })
      setStrategies(response.items.map(mapAccountStrategyListItemToRecord))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiQuant.errors.listLoadFailed', { defaultValue: 'Failed to load strategy list' }))
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadStrategies()
  }, [loadStrategies])

  const handleStatusChange = async (e: React.MouseEvent, id: string, status: 'running' | 'stopped') => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return
    setPendingActionId(id)
    try {
      await performAccountAiQuantStrategyAction(id, {
        userId: session.userId,
        action: status === 'running' ? 'run' : 'stop',
      })
      await loadStrategies()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiQuant.errors.statusUpdateFailed', { defaultValue: 'Failed to update strategy status' }))
    } finally {
      setPendingActionId(null)
    }
  }

  const openStopDialog = async (e: React.MouseEvent, item: AiQuantStrategyRecord) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return

    setError(null)
    setPendingActionId(item.id)
    try {
      const detail = await fetchAccountAiQuantStrategyDetail(item.id, session.userId)
      setStopDialogStrategy(mapAccountStrategyDetailToRecord(detail))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiQuant.errors.statusUpdateFailed', { defaultValue: 'Failed to update strategy status' }))
    } finally {
      setPendingActionId(null)
    }
  }

  const handleStopDialogAction = async (action: 'stop' | 'liquidate_and_stop') => {
    if (!session || !stopDialogStrategy) return

    setPendingActionId(stopDialogStrategy.id)
    setError(null)
    try {
      await performAccountAiQuantStrategyAction(stopDialogStrategy.id, {
        userId: session.userId,
        action,
      })
      setStopDialogStrategy(null)
      await loadStrategies()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiQuant.errors.statusUpdateFailed', { defaultValue: 'Failed to update strategy status' }))
    } finally {
      setPendingActionId(null)
    }
  }

  const openDeleteDialog = async (e: React.MouseEvent, item: AiQuantStrategyRecord) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return

    setError(null)

    if (item.status === 'running') {
      setAccountDeleteDialog({
        strategy: item,
        kind: 'running',
        conversation: null,
        deleteStoppedStrategy: false,
        pending: false,
        errorMessage: null,
      })
      return
    }

    setAccountDeleteDialog({
      strategy: item,
      kind: 'loading',
      conversation: null,
      deleteStoppedStrategy: false,
      pending: false,
      errorMessage: null,
    })

    if (item.hasActiveConversation === true) {
      try {
        const conversations = await listAiQuantConversations()
        const matched = conversations.find(c => c.strategyInstanceId === item.id) ?? null
        const title = matched?.conversationTitle?.trim() || matched?.id || ''
        setAccountDeleteDialog(curr => curr && curr.strategy.id === item.id
          ? {
              ...curr,
              kind: 'with-conversation',
              conversation: matched ? { title: title || matched.id } : null,
            }
          : curr)
      } catch (err) {
        setAccountDeleteDialog(curr => curr && curr.strategy.id === item.id
          ? {
              ...curr,
              kind: 'unknown',
              errorMessage: err instanceof Error && err.message.trim()
                ? err.message
                : t('aiQuant.errors.conversationLookupFailed', { defaultValue: '无法获取关联会话信息' }),
            }
          : curr)
      }
      return
    }

    setAccountDeleteDialog(curr => curr && curr.strategy.id === item.id
      ? { ...curr, kind: 'no-conversation', conversation: null }
      : curr)
  }

  const closeDeleteDialog = () => {
    setAccountDeleteDialog(curr => (curr && curr.pending ? curr : null))
  }

  const performDelete = async (deleteStoppedStrategy: boolean) => {
    if (!session || !accountDeleteDialog) return
    // 不再使用 window.confirm 二次确认。复选框 + dialog 内的红色警告文本
    // 已经构成明确的破坏性意图标识，再叠原生 confirm 既破坏 a11y/i18n
    // 也让自动化测试/截图测试不可靠。
    const strategyId = accountDeleteDialog.strategy.id
    setAccountDeleteDialog(curr => curr ? { ...curr, pending: true, errorMessage: null } : curr)
    try {
      await deleteAccountAiQuantStrategy(strategyId, session.userId, { deleteStoppedStrategy })
      setAccountDeleteDialog(null)
      await loadStrategies()
    } catch (err) {
      setAccountDeleteDialog(curr => curr
        ? {
            ...curr,
            pending: false,
            errorMessage: err instanceof Error && err.message.trim()
              ? err.message
              : t('aiQuant.errors.deleteFailed', { defaultValue: 'Failed to delete strategy' }),
          }
        : curr)
    }
  }

  const STATUS_CONFIG: Record<AiQuantStrategyViewState, { label: string; className: string; icon: React.ElementType }> = {
    running: {
      label: t('aiQuant.status.running'),
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
      icon: PlayCircle,
    },
    stopped: {
      label: t('aiQuant.status.stopped'),
      className: 'bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-slate-400',
      icon: StopCircle,
    },
    draft: {
      label: t('aiQuant.status.draft'),
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
      icon: MoreHorizontal,
    },
  }

  if (strategies.length === 0) {
    if (isLoading) {
      return (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 text-sm text-[color:var(--cf-muted)]">
          {t('common.loading')}
        </section>
      )
    }

    if (error) {
      return (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadStrategies()}
            className="mt-3 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300"
          >
            {t('common.retry')}
          </button>
        </section>
      )
    }

    return (
      <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--cf-surface)]">
          <Activity className="h-8 w-8 text-[color:var(--cf-muted)]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.noStrategies')}</h3>
        <p className="mt-2 max-w-sm text-sm text-[color:var(--cf-muted)]">
          {t('aiQuant.noStrategiesDesc')}
        </p>
        <Link
          href={`/${lng}/ai-quant`}
          className="cf-primary-cta mt-6 rounded-xl px-6 py-2.5 text-sm font-bold !text-white transition-transform hover:scale-105 active:scale-95"
        >
          {t('aiQuant.createStrategy')}
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('aiQuant.filter.running'), value: counts.running, tone: 'text-emerald-500' },
          { label: t('aiQuant.filter.stopped'), value: counts.stopped, tone: 'text-[color:var(--cf-text-strong)]' },
          {
            label: t('aiQuant.consoleAvgReturn', { defaultValue: '平均收益' }),
            value: formatPct(metricSummary.averageReturnPct, true),
            tone: metricSummary.averageReturnPct >= 0 ? 'text-emerald-500' : 'text-red-500',
          },
          {
            label: t('aiQuant.consoleAvgWinRate', { defaultValue: '平均胜率' }),
            value: formatPct(metricSummary.averageWinRate),
            tone: 'text-[color:var(--cf-text-strong)]',
          },
        ].map(item => (
          <div
            key={item.label}
            className="cf-ai-overview-card rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4"
          >
            <p className="text-xs font-medium text-[color:var(--cf-muted)]">{item.label}</p>
            <p className={`mt-2 text-xl font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.myStrategies')}</h3>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
            {t('aiQuant.consoleListHint', { defaultValue: '查看策略状态、表现指标和最近执行入口。' })}
          </p>
        </div>
        <StrategyFilterTabs active={activeTab} counts={counts} onChange={setActiveTab} t={t} />
      </div>

      {strategies.length >= STRATEGY_LIST_FETCH_LIMIT && (
        <div
          data-testid="strategy-filter-cap-hint"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"
        >
          {t('aiQuant.filter.capHint', {
            defaultValue: `仅显示最近 ${STRATEGY_LIST_FETCH_LIMIT} 条策略，更早的请通过分页查询。`,
          })}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {filteredStrategies.length === 0 ? (
        <div
          data-testid="strategy-filter-empty"
          className="rounded-xl border border-dashed border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-8 text-center text-sm text-[color:var(--cf-muted)]"
        >
          {t('aiQuant.filter.emptyForTab', { defaultValue: '当前分类下暂无策略' })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStrategies.map(item => {
            const statusConfig = STATUS_CONFIG[item.status]
            const StatusIcon = statusConfig.icon
            // viewOnlyAt 非空即只读：Run/Stop/Delete 全部隐藏，仅留「查看详情」入口。
            // running + viewOnlyAt 这种异常组合也走只读分支；用户进入详情后自行处理 running。
            const isViewOnly = Boolean(item.viewOnlyAt)

            return (
              <div
                key={item.id}
                className="cf-ai-strategy-card group rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <Link href={`/${lng}/account/ai-quant/strategy/${item.id}`} className="block min-w-0">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-[color:var(--cf-text-strong)] transition-colors group-hover:text-primary">
                            {item.name}
                          </h4>
                          <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[color:var(--cf-muted)]">
                            <Clock className="h-3 w-3" />
                            <span>{t('aiQuant.updatedAt')}</span>
                            <span>{fmtTime(item.updatedAt, lng)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[color:var(--cf-muted)]">
                          <AiQuantStrategyPrimarySummary item={item} t={t} keyPrefix={item.id} />
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:justify-end">

                      {!isViewOnly && (
                        item.status === 'running' ? (
                          <button
                            type="button"
                            onClick={e => { void openStopDialog(e, item) }}
                            disabled={pendingActionId === item.id}
                            className="cf-ai-action-button cf-ai-action-danger flex min-h-10 min-w-[104px] items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 text-xs font-semibold text-red-500 transition hover:border-red-500/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                          >
                            <StopCircle className="h-3 w-3" />
                            {getStrategyRuntimeActionLabel(item.status, t)}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={e => handleStatusChange(e, item.id, 'running')}
                            disabled={pendingActionId === item.id}
                            className="cf-ai-action-button cf-ai-action-success flex min-h-10 min-w-[72px] items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] px-3 text-xs font-semibold text-emerald-500 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            {t('aiQuant.actions.run')}
                          </button>
                        )
                      )}

                      {!isViewOnly && (
                        <button
                        type="button"
                        onClick={e => { void openDeleteDialog(e, item) }}
                        disabled={accountDeleteDialog?.strategy.id === item.id && accountDeleteDialog.pending}
                        className="cf-ai-action-button cf-ai-action-danger-muted flex min-h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-transparent px-3 text-xs font-semibold text-red-500 transition hover:border-red-500/35 hover:bg-red-500/[0.06] disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        {accountDeleteDialog?.strategy.id === item.id && accountDeleteDialog.pending
                            ? t('aiQuant.actions.deleting')
                            : t('aiQuant.actions.delete')}
                        </button>
                      )}

                      <Link
                        href={`/${lng}/account/ai-quant/strategy/${item.id}`}
                        className="cf-ai-action-button cf-ai-action-neutral inline-flex min-h-10 min-w-[96px] items-center justify-center rounded-md border border-[color:var(--cf-border)] bg-transparent px-3 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-bg)] group-hover:border-primary/30 group-hover:text-primary"
                      >
                        {t('aiQuant.viewDetail')}
                      </Link>
                      </div>
                    </div>

                  <Link
                    href={`/${lng}/account/ai-quant/strategy/${item.id}`}
                    className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4"
                  >
                      {[
                        {
                          label: t('aiQuant.totalReturn', { defaultValue: '收益' }),
                          value: formatPct(item.metrics.returnPct, true),
                          tone: item.metrics.returnPct >= 0 ? 'text-emerald-500' : 'text-red-500',
                        },
                        {
                          label: t('aiQuant.maxDrawdown', { defaultValue: '回撤' }),
                          value: formatPct(item.metrics.maxDrawdownPct),
                          tone: 'text-[color:var(--cf-text-strong)]',
                        },
                        {
                          label: t('aiQuant.winRate', { defaultValue: '胜率' }),
                          value: formatPct(item.metrics.winRatePct),
                          tone: 'text-[color:var(--cf-text-strong)]',
                        },
                        {
                          label: t('aiQuant.tradeCount', { defaultValue: '交易' }),
                          value: formatMetricNumber(item.metrics.tradeCount),
                          tone: 'text-[color:var(--cf-text-strong)]',
                        },
                      ].map(metric => (
                        <div
                          key={metric.label}
                          className="cf-ai-metric-cell min-h-[64px] rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2.5"
                        >
                          <div className="text-[11px] text-[color:var(--cf-muted)]">{metric.label}</div>
                          <div className={`mt-1 text-sm font-semibold tabular-nums ${metric.tone}`}>{metric.value}</div>
                        </div>
                      ))}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <StopRunningStrategyDialog
        open={stopDialogStrategy !== null}
        strategy={stopDialogStrategy}
        pending={stopDialogStrategy !== null && pendingActionId === stopDialogStrategy.id}
        errorMessage={error}
        onStopOnly={() => {
          void handleStopDialogAction('stop')
        }}
        onLiquidateAndStop={() => {
          void handleStopDialogAction('liquidate_and_stop')
        }}
        onCancel={() => {
          if (pendingActionId) return
          setStopDialogStrategy(null)
        }}
      />

      <AiQuantDeletionDialog
        open={accountDeleteDialog !== null}
        kind={accountDeleteDialog?.kind ?? 'loading'}
        pending={accountDeleteDialog?.pending ?? false}
        errorMessage={accountDeleteDialog?.errorMessage ?? null}
        conversation={accountDeleteDialog?.conversation ?? null}
        strategy={accountDeleteDialog
          ? { name: accountDeleteDialog.strategy.name, id: accountDeleteDialog.strategy.id }
          : undefined}
        deleteStoppedStrategy={accountDeleteDialog?.deleteStoppedStrategy ?? false}
        onToggleDeleteStoppedStrategy={(next) => {
          setAccountDeleteDialog(curr => curr ? { ...curr, deleteStoppedStrategy: next } : curr)
        }}
        onConfirm={() => {
          if (!accountDeleteDialog) return
          if (accountDeleteDialog.kind === 'with-conversation') {
            void performDelete(accountDeleteDialog.deleteStoppedStrategy)
          } else if (accountDeleteDialog.kind === 'no-conversation') {
            void performDelete(true)
          }
        }}
        onKeepAsViewOnly={() => {
          if (!accountDeleteDialog || accountDeleteDialog.kind !== 'no-conversation') return
          void performDelete(false)
        }}
        onGoToRunningStrategy={() => {
          if (!accountDeleteDialog) return
          const strategyId = accountDeleteDialog.strategy.id
          setAccountDeleteDialog(null)
          router.push(`/${lng}/account/ai-quant/strategy/${strategyId}`)
        }}
        onClose={closeDeleteDialog}
      />
    </section>
  )
}
