'use client'

import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type {
  ExistingStrategyPlazaRunResult,
  StrategyPlazaRunResult,
  StrategyPlazaTemplate,
} from '@/lib/api'
import { ArrowUp, Check, ChevronLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { StrategyPlaza } from '@/components/ai-quant/StrategyPlaza'
import { getSameOriginReturnHref } from '@/components/navigation/return-href'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
import { useAuth } from '@/hooks/use-auth'
import {
  createStrategyPlazaRunRequestId,
  fetchStrategyPlazaTemplates,
  runStrategyPlazaTemplate,
  startStrategyPlazaEditSession,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { STRATEGY_PLAZA_OKX_DEMO_BINDING_REQUIRED_ERROR_CODE } from './strategy-plaza-client-errors'

const INTENT_TTL_MS = 10 * 60 * 1000

function isExistingStrategyPlazaRunResult(
  result: StrategyPlazaRunResult,
): result is ExistingStrategyPlazaRunResult {
  return (
    !!result && typeof result === 'object' && 'result' in result && result.result === 'existing'
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.trim()) return error.message
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function GuestPlazaChatEntry({
  onRequireLogin,
}: {
  onRequireLogin: (intent: QuantReturnIntentInput) => void
}) {
  const { t } = useTranslation()
  const defaultDraft = '3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金'
  const [draft, setDraft] = useState('')

  const submitDraft = () => {
    onRequireLogin({ type: 'chat', draft: draft.trim() || defaultDraft })
  }

  return (
    <section
      data-testid="guest-plaza-chat-entry"
      className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="!text-base !leading-6 !font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.guestLanding.title')}
          </h2>
          <p className="!text-sm !leading-[22px] !font-normal text-[color:var(--cf-muted)]">
            {t('aiQuant.guestLanding.subtitle')}
          </p>
        </div>
      </div>

      <div className="group focus-within:border-primary/50 focus-within:ring-primary/20 hover:border-primary/30 relative mt-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-3 shadow-inner transition-colors focus-within:ring-1">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (draft.trim()) submitDraft()
            }
          }}
          placeholder={t('aiQuant.inputPlaceholder')}
          className="min-h-[88px] w-full resize-none bg-transparent !text-base !leading-[22px] !font-normal text-[color:var(--cf-text)] outline-none placeholder:text-[color:var(--cf-muted)] md:!text-sm"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDraft(defaultDraft)}
            className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-1.5 !text-xs !leading-5 !font-semibold text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-bg)] hover:text-[color:var(--cf-text)]"
          >
            {t('aiQuant.guestLanding.tryExample')}
          </button>
          <button
            type="button"
            data-testid="guest-plaza-chat-send"
            onClick={submitDraft}
            title={t('aiQuant.send')}
            aria-label={t('aiQuant.send')}
            className="bg-primary hover:bg-primary/90 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}

export function AiQuantPlazaPageClient() {
  const { t } = useTranslation()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { openAuth } = useAuthSheet()
  const { session, isLoading } = useAuth()
  const defaultReturnHref = `/${lng}/account?tab=ai-quant`
  const plazaReturnHref = `/${lng}/ai-quant/plaza`
  const strategyDetailHref = (strategyId: string) =>
    `/${lng}/account/ai-quant/strategy/${strategyId}?from=${encodeURIComponent(plazaReturnHref)}`
  const [returnHref, setReturnHref] = useState(defaultReturnHref)
  const [templates, setTemplates] = useState<StrategyPlazaTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'run' | 'edit' | null>(null)
  const [existingStrategy, setExistingStrategy] = useState<
    ExistingStrategyPlazaRunResult['strategy'] | null
  >(null)
  const resumingIntentKeyRef = useRef<string | null>(null)

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    openAuth({ lng, redirect: `/${lng}/ai-quant/plaza` })
  }

  const goLoginWithChatIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    openAuth({ lng, redirect: `/${lng}/ai-quant` })
  }

  useEffect(() => {
    setReturnHref(getSameOriginReturnHref(defaultReturnHref))
  }, [defaultReturnHref])

  useEffect(() => {
    let cancelled = false

    async function loadTemplates() {
      setLoadingTemplates(true)
      setLoadError(null)
      try {
        const data = await fetchStrategyPlazaTemplates()
        if (!cancelled) setTemplates(data)
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error, t('aiQuant.plazaPage.loadFailed')))
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false)
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
    }
  }, [t])

  const runTemplate = async (templateId: string) => {
    if (!session) {
      goLoginWithIntent({ type: 'plaza-run', templateId })
      return
    }
    if (runningTemplateId) return

    setRunningTemplateId(templateId)
    setPendingAction('run')
    setActionError(null)
    setExistingStrategy(null)
    try {
      const strategy = await runStrategyPlazaTemplate(templateId, createStrategyPlazaRunRequestId())
      if (isExistingStrategyPlazaRunResult(strategy)) {
        setExistingStrategy(strategy.strategy)
        return
      }
      router.push(strategyDetailHref(strategy.id))
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === STRATEGY_PLAZA_OKX_DEMO_BINDING_REQUIRED_ERROR_CODE
      ) {
        setIntent({ type: 'plaza-run', templateId })
        router.push(
          `/${lng}/account?tab=settings&redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}#exchange-api`,
        )
        return
      }
      setActionError(getErrorMessage(error, t('aiQuant.plazaPage.runFailed')))
    } finally {
      setRunningTemplateId(null)
      setPendingAction(null)
    }
  }

  const editTemplate = async (templateId: string) => {
    if (!session) {
      goLoginWithIntent({ type: 'plaza-edit', templateId })
      return
    }
    if (runningTemplateId) return

    setRunningTemplateId(templateId)
    setPendingAction('edit')
    setActionError(null)
    try {
      const editSession = await startStrategyPlazaEditSession(templateId, lng)
      setIntent({ type: 'plaza-chat-session', sessionId: editSession.sessionId })
      router.push(`/${lng}/ai-quant`)
    } catch (error) {
      setActionError(getErrorMessage(error, t('aiQuant.plazaPage.editSessionFailed')))
    } finally {
      setRunningTemplateId(null)
      setPendingAction(null)
    }
  }

  const openStrategyReport = (templateId: string) => {
    router.push(`/${lng}/ai-quant/plaza/${encodeURIComponent(templateId)}`)
  }

  const closeExistingStrategyDialog = () => {
    setExistingStrategy(null)
  }

  const openExistingStrategyDetail = () => {
    if (!existingStrategy) return
    router.push(strategyDetailHref(existingStrategy.id))
  }

  const existingStrategyStatusLabel =
    existingStrategy?.status === 'running'
      ? t('aiQuant.strategyPlazaExisting.statusRunning', { defaultValue: '运行中' })
      : existingStrategy?.status === 'stopped'
        ? t('aiQuant.strategyPlazaExisting.statusStopped', { defaultValue: '已停止' })
        : t('aiQuant.strategyPlazaExisting.statusDraft', { defaultValue: '草稿' })

  useEffect(() => {
    if (isLoading || !session) return

    const intent = getIntent(INTENT_TTL_MS)
    if (!intent || (intent.type !== 'plaza-run' && intent.type !== 'plaza-edit')) return

    const intentKey = `${intent.type}:${intent.templateId}`
    if (resumingIntentKeyRef.current === intentKey) return
    resumingIntentKeyRef.current = intentKey
    clearIntent()

    if (intent.type === 'plaza-run') {
      void runTemplate(intent.templateId)
      return
    }

    void editTemplate(intent.templateId)
  })

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 py-8 md:px-8">
      <Link
        href={returnHref}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs leading-5 font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>{t('aiQuant.plazaPage.back')}</span>
      </Link>

      <div>
        <div>
          <h1 className="!text-3xl !leading-10 !font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.plaza')}
          </h1>
          <p className="mt-1 text-sm leading-[22px] text-[color:var(--cf-muted)]">
            {t('aiQuant.guestLanding.plazaSubtitle')}
          </p>
        </div>
      </div>

      {!isLoading && !session && <GuestPlazaChatEntry onRequireLogin={goLoginWithChatIntent} />}

      <StrategyPlaza
        templates={templates}
        loading={loadingTemplates}
        error={loadError}
        actionError={actionError}
        pendingTemplateId={runningTemplateId}
        pendingAction={pendingAction}
        onRunStrategy={runTemplate}
        onEditStrategy={editTemplate}
        onOpenStrategyReport={openStrategyReport}
        showHotRail={isLoading || Boolean(session)}
      />

      {existingStrategy && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          role="dialog"
        >
          <div className="w-full max-w-[420px] rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-4 shadow-2xl shadow-slate-950/20 sm:px-5">
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <h2 className="!text-[15px] !leading-[22px] !font-semibold text-[color:var(--cf-text-strong)]">
                  {t('aiQuant.strategyPlazaExisting.title', { defaultValue: '已存在相同策略' })}
                </h2>
                <p className="mt-2 !text-sm !leading-[22px] !font-normal text-[color:var(--cf-muted)]">
                  {t('aiQuant.strategyPlazaExisting.description', {
                    defaultValue: '这个策略模板已经创建过，系统只保留一个相同模板策略。',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-muted)] px-3 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm leading-[22px] !font-semibold text-[color:var(--cf-text-strong)]">
                    {existingStrategy.name}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--cf-muted)]">
                    {[existingStrategy.symbol, existingStrategy.timeframe]
                      .filter(Boolean)
                      .join(' / ')}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs leading-4 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {existingStrategyStatusLabel}
                </span>
              </div>
              <p className="mt-3 !text-xs !leading-5 text-[color:var(--cf-muted)]">
                {t('aiQuant.strategyPlazaExisting.hint', {
                  defaultValue: '再次运行会跳转到这个已有策略详情，不会重复创建。',
                })}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="inline-flex min-h-9 min-w-[108px] items-center justify-center rounded-full bg-gradient-to-r from-[#7C3AED] to-[#B414F4] px-3.5 py-1.5 !text-xs !leading-5 !font-semibold text-white shadow-sm transition hover:brightness-105"
                type="button"
                onClick={openExistingStrategyDetail}
              >
                {t('aiQuant.strategyPlazaExisting.viewDetail', { defaultValue: '查看策略详情' })}
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 !text-xs !leading-5 !font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
                type="button"
                onClick={closeExistingStrategyDialog}
              >
                {t('aiQuant.strategyPlazaExisting.close', { defaultValue: '关闭' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
