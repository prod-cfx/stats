'use client'

import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyPlazaTemplate } from '@/lib/api'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { StrategyPlaza } from '@/components/ai-quant/StrategyPlaza'
import { useAuth } from '@/hooks/use-auth'
import {
  createStrategyPlazaRunRequestId,
  fetchStrategyPlazaTemplates,
  runStrategyPlazaTemplate,
  startStrategyPlazaEditSession,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

const OKX_DEMO_API_KEY_REQUIRED_CODE = 'strategy_plaza.okx_demo_api_key_required'
const INTENT_TTL_MS = 10 * 60 * 1000

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.trim()) return error.message
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export function AiQuantPlazaPageClient() {
  const { t } = useTranslation()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { session, isLoading } = useAuth()
  const [templates, setTemplates] = useState<StrategyPlazaTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'run' | 'edit' | null>(null)
  const resumingIntentKeyRef = useRef<string | null>(null)

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}`)
  }

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
          setLoadError(getErrorMessage(error, '获取策略广场模板失败'))
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false)
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
    }
  }, [])

  const runTemplate = async (templateId: string) => {
    if (!session) {
      goLoginWithIntent({ type: 'plaza-run', templateId })
      return
    }
    if (runningTemplateId) return

    setRunningTemplateId(templateId)
    setPendingAction('run')
    setActionError(null)
    try {
      const strategy = await runStrategyPlazaTemplate(templateId, createStrategyPlazaRunRequestId())
      router.push(`/${lng}/account/ai-quant/strategy/${strategy.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === OKX_DEMO_API_KEY_REQUIRED_CODE) {
        setIntent({ type: 'plaza-run', templateId })
        router.push(`/${lng}/account?tab=ai-quant&redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}#exchange-api`)
        return
      }
      setActionError(getErrorMessage(error, '运行策略广场模板失败'))
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
      const editSession = await startStrategyPlazaEditSession(templateId)
      setIntent({ type: 'plaza-chat-session', sessionId: editSession.sessionId })
      router.push(`/${lng}/ai-quant`)
    } catch (error) {
      setActionError(getErrorMessage(error, '创建策略广场编辑会话失败'))
    } finally {
      setRunningTemplateId(null)
      setPendingAction(null)
    }
  }

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
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.plaza')}</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.plazaSubtitle')}</p>
        </div>
        <Link
          href={`/${lng}/ai-quant`}
          className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          {t('aiQuant.title')}
        </Link>
      </div>

      {!isLoading && !session && (
        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 text-sm text-[color:var(--cf-muted)]">
          登录后可以一键运行或编辑策略模板，未登录也可以先浏览策略广场。
        </div>
      )}

      <StrategyPlaza
        templates={templates}
        loading={loadingTemplates}
        error={loadError}
        actionError={actionError}
        pendingTemplateId={runningTemplateId}
        pendingAction={pendingAction}
        subtitle={t('aiQuant.strategyPlazaSubtitle')}
        onRunStrategy={runTemplate}
        onEditStrategy={editTemplate}
      />
    </main>
  )
}
