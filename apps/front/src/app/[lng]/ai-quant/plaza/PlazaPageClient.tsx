'use client'

import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyPlazaTemplate } from '@/lib/api'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { setIntent } from '@/components/ai-quant/intent-storage'
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
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null)

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}`)
  }

  useEffect(() => {
    let cancelled = false

    async function loadTemplates() {
      setLoadingTemplates(true)
      setTemplateError(null)
      try {
        const data = await fetchStrategyPlazaTemplates()
        if (!cancelled) setTemplates(data)
      } catch (error) {
        if (!cancelled) {
          setTemplateError(getErrorMessage(error, '获取策略广场模板失败'))
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
    setTemplateError(null)
    try {
      const strategy = await runStrategyPlazaTemplate(templateId, createStrategyPlazaRunRequestId())
      router.push(`/${lng}/account/ai-quant/strategy/${strategy.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === OKX_DEMO_API_KEY_REQUIRED_CODE) {
        setIntent({ type: 'plaza-run', templateId })
        router.push(`/${lng}/account?tab=ai-quant#exchange-api`)
        return
      }
      setTemplateError(getErrorMessage(error, '运行策略广场模板失败'))
    } finally {
      setRunningTemplateId(null)
    }
  }

  const editTemplate = async (templateId: string) => {
    if (!session) {
      goLoginWithIntent({ type: 'plaza-edit', templateId })
      return
    }
    if (runningTemplateId) return

    setRunningTemplateId(templateId)
    setTemplateError(null)
    try {
      const editSession = await startStrategyPlazaEditSession(templateId)
      setIntent({ type: 'chat', draft: editSession.initialMessage })
      router.push(`/${lng}/ai-quant`)
    } catch (error) {
      setTemplateError(getErrorMessage(error, '创建策略广场编辑会话失败'))
    } finally {
      setRunningTemplateId(null)
    }
  }

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
        error={templateError}
        subtitle={t('aiQuant.strategyPlazaSubtitle')}
        onRunStrategy={runTemplate}
        onEditStrategy={editTemplate}
      />
    </main>
  )
}
