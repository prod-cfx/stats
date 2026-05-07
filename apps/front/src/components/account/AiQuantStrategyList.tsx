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
  listAiQuantConversations,
  performAccountAiQuantStrategyAction,
} from '@/lib/api'
import { mapAccountStrategyListItemToRecord } from './ai-quant-strategy-api-adapter'
import { buildDynamicParamSummary } from './dynamic-param-summary'

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
  for (const item of items) {
    if (isHistory(item)) {
      history++
      continue
    }
    if (item.status === 'running') running++
    else if (item.status === 'stopped') stopped++
  }
  return { all: running + stopped, running, stopped, history }
}

const TAB_ORDER: StrategyFilterTabKey[] = ['all', 'running', 'stopped', 'history']

type StrategyListTranslation = (key: string, options?: { defaultValue?: string }) => string

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
    <div role="tablist" className="flex items-center gap-1 border-b border-[color:var(--cf-border)] px-1">
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
            className={`-mb-px flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'border-b-2 border-primary font-semibold text-[color:var(--cf-text-strong)]'
                : 'border-b-2 border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
            }`}
          >
            <span>{t(`aiQuant.filter.${key}`)}</span>
            <span className="rounded-full bg-[color:var(--cf-surface)] px-2 py-0.5 text-xs font-medium text-[color:var(--cf-muted)] border border-[color:var(--cf-border)]">
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
): string[] {
  return buildDynamicParamSummary(paramSchema, paramValues, 3)
}

export function buildPrimarySummary(
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>,
  t: (key: string) => string,
): string[] {
  if (item.paramSchema) {
    const dynamicSummary = buildParamSummary(item.paramSchema, item.paramValues)
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
    return t('aiQuant.actions.stopStrategy', { defaultValue: '停止策略' })
  }
  return t('aiQuant.actions.run')
}

export function AiQuantStrategyPrimarySummary({
  item,
  t,
  keyPrefix,
}: {
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>
  t: (key: string) => string
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

  const openStopDialog = (e: React.MouseEvent, item: AiQuantStrategyRecord) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return

    setError(null)
    setStopDialogStrategy(item)
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
          className="mt-6 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2.5 text-sm font-bold !text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          {t('aiQuant.createStrategy')}
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.myStrategies')}</h3>
        <span className="rounded-full bg-[color:var(--cf-surface)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--cf-muted)] border border-[color:var(--cf-border)]">
          {counts.all}
        </span>
      </div>

      <StrategyFilterTabs active={activeTab} counts={counts} onChange={setActiveTab} t={t} />

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
              className="group flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <Link href={`/${lng}/account/ai-quant/strategy/${item.id}`} className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[color:var(--cf-text-strong)] group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConfig.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--cf-muted)]">
                    <AiQuantStrategyPrimarySummary item={item} t={t} keyPrefix={item.id} />
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-4">
                <div className="hidden text-right text-xs text-[color:var(--cf-muted)] sm:block">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {t('aiQuant.updatedAt')}
                  </div>
                  <div className="mt-0.5">{fmtTime(item.updatedAt, lng)}</div>
                </div>

                {!isViewOnly && (
                  item.status === 'running' ? (
                    <button
                      type="button"
                      onClick={e => openStopDialog(e, item)}
                      disabled={pendingActionId === item.id}
                      className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                    >
                      <StopCircle className="h-3 w-3" />
                      {getStrategyRuntimeActionLabel(item.status, t)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={e => handleStatusChange(e, item.id, 'running')}
                      disabled={pendingActionId === item.id}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
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
                    className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    {accountDeleteDialog?.strategy.id === item.id && accountDeleteDialog.pending
                      ? t('aiQuant.deleting', { defaultValue: 'Deleting...' })
                      : t('aiQuant.actions.delete', { defaultValue: 'Delete' })}
                  </button>
                )}

                <Link
                  href={`/${lng}/account/ai-quant/strategy/${item.id}`}
                  className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)] transition group-hover:border-primary/30 group-hover:text-primary"
                >
                  {t('aiQuant.viewDetail')}
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
