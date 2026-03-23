'use client'

import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { useAuth } from '@/hooks/use-auth'
import {
  deployAccountAiQuantStrategy,
  continueLlmCodegenSession,
  fetchUserExchangeAccountStatuses,
  startLlmCodegenSession,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

export interface QuantParams {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  buyWindowMin: number
  buyDropPct: number
  sellWindowMin: number
  sellRisePct: number
  positionPct: number
}

const DEFAULT_PARAMS: QuantParams = {
  exchange: 'binance',
  symbol: 'BTCUSDT',
  buyWindowMin: 3,
  buyDropPct: 1,
  sellWindowMin: 15,
  sellRisePct: 2,
  positionPct: 10,
}

const CONVERSATIONS_STORAGE_KEY = 'ai_quant_conversations_v1'
const INTENT_TTL_MS = 30 * 60 * 1000

interface ConversationState {
  id: string
  title: string
  messages: QuantMessage[]
  params: QuantParams
  backtestResult: BacktestResult | null
  logicGraph: StrategyLogicGraph | null
  llmCodegenSessionId: string | null
  updatedAt: number
}

function inferChecklistFromGraph(
  graph: StrategyLogicGraph | null | undefined,
): {
  entryRules?: string[]
  exitRules?: string[]
} {
  if (!graph) return {}

  const entryRules: string[] = []
  const exitRules: string[] = []

  for (const node of graph.trigger) {
    const id = node.id.toLowerCase()
    if (id.includes('entry') || id.includes('buy')) {
      entryRules.push(node.operator)
      continue
    }
    if (id.includes('exit') || id.includes('sell')) {
      exitRules.push(node.operator)
    }
  }

  const dedupe = (items: string[]) => Array.from(new Set(items.map(x => x.trim()).filter(Boolean)))
  const normalizedEntry = dedupe(entryRules)
  const normalizedExit = dedupe(exitRules)

  return {
    entryRules: normalizedEntry.length > 0 ? normalizedEntry : undefined,
    exitRules: normalizedExit.length > 0 ? normalizedExit : undefined,
  }
}

function isStrategyModificationIntent(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (!text) return false
  return /改|修改|调整|替换|变更|优化|调参|把.+改为|update|change|revise/i.test(text)
}

function getMockBacktest(params: QuantParams): BacktestResult {
  const score = params.buyDropPct + params.sellRisePct + params.positionPct / 10 + (params.exchange === 'okx' ? 1 : 0)
  const maxDrawdownPct = Number(Math.max(8, Math.min(35, 28 - score)).toFixed(2))
  const totalReturnPct = Number((score * 1.8 - maxDrawdownPct * 0.4).toFixed(2))
  const winRatePct = Number(Math.max(25, Math.min(78, 42 + score * 2.2)).toFixed(2))
  const tradeCount = Math.max(8, Math.round(15 + score))

  return {
    id: String(Date.now()),
    maxDrawdownPct,
    totalReturnPct,
    winRatePct,
    tradeCount,
  }
}

export function AiQuantPageClient() {
  const { t } = useTranslation()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { session, isLoading } = useAuth()

  const createConversation = (): ConversationState => {
    const now = Date.now()
    return {
      id: `conv-${now}-${Math.random().toString(16).slice(2, 8)}`,
      title: t('aiQuant.newChat'),
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: t('aiQuant.messages.welcome'),
        },
      ],
      params: DEFAULT_PARAMS,
      backtestResult: null,
      logicGraph: null,
      llmCodegenSessionId: null,
      updatedAt: now,
    }
  }

  // Initialize state lazily to avoid hydration mismatch if possible, 
  // but here we need to read from localStorage which is a side effect.
  // We'll start with a default and update in useEffect.
  const [conversations, setConversations] = useState<ConversationState[]>(() => [createConversation()])
  const [activeConversationId, setActiveConversationId] = useState<string>('')
  const [deployOpen, setDeployOpen] = useState(false)
  const [selectedDeployExchange, setSelectedDeployExchange] = useState<'binance' | 'okx' | 'hyperliquid'>('binance')
  const [selectedDeployAccountId, setSelectedDeployAccountId] = useState('')
  const [exchangeAccounts, setExchangeAccounts] = useState<DeployExchangeAccount[]>([])

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return conversations[0]
    return conversations.find(x => x.id === activeConversationId) || conversations[0]
  }, [activeConversationId, conversations])

  useEffect(() => {
    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].id)
    }
  }, [activeConversationId, conversations])

  useEffect(() => {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY)
    if (!raw) {
      const seed = createConversation()
      setConversations([seed])
      setActiveConversationId(seed.id)
      return
    }
    try {
      const parsed = JSON.parse(raw) as ConversationState[]
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('invalid')
      const normalized = parsed.map(item => ({
        ...item,
        llmCodegenSessionId: item.llmCodegenSessionId ?? null,
      }))
      setConversations(normalized)
      setActiveConversationId(normalized[0].id)
    } catch {
      const seed = createConversation()
      setConversations([seed])
      setActiveConversationId(seed.id)
      localStorage.removeItem(CONVERSATIONS_STORAGE_KEY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!conversations.length) return
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    if (!session) {
      setExchangeAccounts([])
      return
    }

    let cancelled = false
    const loadExchangeAccounts = async () => {
      try {
        const statuses = await fetchUserExchangeAccountStatuses()
        if (cancelled) return
        setExchangeAccounts(
          statuses
            .filter(item => item.isBound && item.id)
            .map(item => ({
              accountId: item.id!,
              exchange: item.exchangeId,
              accountName: item.name?.trim() || `${item.exchangeId} testnet account`,
              apiKeyMask: item.maskedCredential?.trim() || '已绑定',
              status: 'available' as const,
            })),
        )
      } catch {
        if (!cancelled) {
          setExchangeAccounts([])
        }
      }
    }

    void loadExchangeAccounts()
    window.addEventListener('focus', loadExchangeAccounts)
    return () => {
      cancelled = true
      window.removeEventListener('focus', loadExchangeAccounts)
    }
  }, [session])

  const apiConfigured = useMemo(
    () => exchangeAccounts.some(item => item.exchange === selectedDeployExchange && item.status === 'available'),
    [exchangeAccounts, selectedDeployExchange],
  )
  const deployAccounts = exchangeAccounts

  const canDeploy = useMemo(() => {
    return Boolean(activeConversation?.backtestResult)
  }, [activeConversation?.backtestResult])
  const graphConfirmed = activeConversation?.logicGraph?.status === 'confirmed'

  const compactMode = useMemo(() => {
    if (!activeConversation) return true
    return !activeConversation.messages.some(x => x.role === 'user')
  }, [activeConversation])

  const updateActiveConversation = (updater: (curr: ConversationState) => ConversationState) => {
    if (!activeConversation) return
    setConversations(prev =>
      prev.map(conv => (conv.id === activeConversation.id ? updater(conv) : conv)),
    )
  }

  const requestBackendGraphGeneration = async (args: {
    conversationId: string
    message: string
    params: QuantParams
    sessionId: string | null
    usePresetRules?: boolean
    confirmGenerate?: boolean
  }) => {
    const { conversationId, message, params: targetParams, sessionId, usePresetRules = false, confirmGenerate = false } = args
    if (!session?.userId) return
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return
    const loadingMessageId = `a-loading-${Date.now()}`
    const startedAt = Date.now()

    setConversations(prev => prev.map((conv) => {
      if (conv.id !== conversationId) return conv
      return {
        ...conv,
        messages: [
          ...conv.messages,
          {
            id: loadingMessageId,
            role: 'assistant',
            content: '正在调用中（0s）',
          },
        ],
        updatedAt: Date.now(),
      }
    }))

    const loadingTimer = window.setInterval(() => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        return {
          ...conv,
          messages: conv.messages.map(msg =>
            msg.id === loadingMessageId
              ? { ...msg, content: `正在调用中（${elapsedSec}s）` }
              : msg,
          ),
        }
      }))
    }, 1000)

    try {
      const graphChecklist = inferChecklistFromGraph(
        conversations.find(conv => conv.id === conversationId)?.logicGraph,
      )
      const shouldReuseGraphChecklist = Boolean(sessionId) || isStrategyModificationIntent(trimmedMessage)
      const checklistPayload = usePresetRules
        ? {
            symbols: [targetParams.symbol],
            timeframes: [`${targetParams.buyWindowMin}m`, `${targetParams.sellWindowMin}m`],
            entryRules: [`${targetParams.buyWindowMin}m 内下跌 ${targetParams.buyDropPct}%`],
            exitRules: [`${targetParams.sellWindowMin}m 内上涨 ${targetParams.sellRisePct}%`],
            riskRules: {
              positionPct: targetParams.positionPct,
              maxDrawdownPct: 20,
            },
          }
        : (shouldReuseGraphChecklist ? graphChecklist : {})

    const startNewSession = async () =>
        startLlmCodegenSession({
          initialMessage: trimmedMessage,
          ...checklistPayload,
        })

      const continueSession = async (id: string) =>
        continueLlmCodegenSession(id, {
          message: trimmedMessage,
          confirmGenerate,
          ...checklistPayload,
        })

      let activeSessionId = sessionId
      let continued
      if (!activeSessionId) {
        const created = await startNewSession()
        activeSessionId = created.id
        continued = created
      } else {
        try {
          continued = await continueSession(activeSessionId)
        } catch (error) {
          const isTerminalSessionError = error instanceof ApiError
            && error.statusCode === 409
            && error.message.includes('会话已终态')
          if (!isTerminalSessionError) {
            throw error
          }
          const recreated = await startNewSession()
          activeSessionId = recreated.id
          continued = recreated
        }
      }

      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        const nextVersion = (conv.logicGraph?.version || 0) + 1
        const shouldReuseCodegenSession = continued.status !== 'PUBLISHED' && continued.status !== 'REJECTED'
        const shouldUpdateGraph = (continued.status === 'CHECKLIST_GATE' || continued.status === 'PUBLISHED')
          && Boolean(continued.specDesc)
        const nextGraph = shouldUpdateGraph
          ? buildLogicGraphFromCodegenSpec(
              continued.specDesc,
              {
                exchange: targetParams.exchange,
                symbol: targetParams.symbol,
                positionPct: targetParams.positionPct,
              },
              nextVersion,
            )
          : conv.logicGraph
        const publishedReply = continued.scriptCode
          ? `${t('aiQuant.messages.graphGenerated')}\n\n已生成策略代码：\n\`\`\`javascript\n${continued.scriptCode}\n\`\`\``
          : t('aiQuant.messages.graphGenerated')
        const replyContent = continued.assistantPrompt
          || (continued.status === 'PUBLISHED'
            ? publishedReply
            : continued.status === 'CHECKLIST_GATE'
              ? '逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。'
            : continued.status === 'REJECTED'
              ? (continued.rejectReason
                  ? `生成失败：${continued.rejectReason}`
                  : t('common.error'))
              : t('aiQuant.messages.graphRevise'))
        return {
          ...conv,
          llmCodegenSessionId: shouldReuseCodegenSession ? activeSessionId : null,
          logicGraph: nextGraph,
          backtestResult: null,
          messages: [
            ...conv.messages.map(msg =>
              msg.id === loadingMessageId
                ? { ...msg, content: replyContent }
                : msg,
            ),
          ],
          updatedAt: Date.now(),
        }
      }))
    } catch {
      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        return {
          ...conv,
          messages: [
            ...conv.messages.map(msg =>
              msg.id === loadingMessageId
                ? { ...msg, content: t('common.error') }
                : msg,
            ),
          ],
          updatedAt: Date.now(),
        }
      }))
    } finally {
      window.clearInterval(loadingTimer)
    }
  }

  const onSend = async (input: string) => {
    if (!input.trim()) return
    const trimmedInput = input.trim()
    const currentConversationId = activeConversation.id
    const currentParams = activeConversation.params
    const currentSessionId = activeConversation.llmCodegenSessionId
    const currentGraphStatus = activeConversation.logicGraph?.status

    updateActiveConversation(curr => {
      const nextMessages: QuantMessage[] = [
        ...curr.messages,
        { id: `u-${Date.now()}`, role: 'user', content: trimmedInput },
      ]

      const derivedTitle = curr.title === t('aiQuant.newChat')
        ? trimmedInput.slice(0, 16) || t('aiQuant.newChat')
        : curr.title
      return {
        ...curr,
        title: derivedTitle,
        messages: nextMessages,
        backtestResult: null,
        updatedAt: Date.now(),
      }
    })

    const confirmPattern = /^(?:确认逻辑图|\/confirm|确认|可以|好的?|行|ok|okay|yes|同意|没问题)[。.!！?？\s]*$/i
    if (currentGraphStatus === 'draft' && confirmPattern.test(trimmedInput)) {
      updateActiveConversation(curr => ({
        ...curr,
        logicGraph: curr.logicGraph ? { ...curr.logicGraph, status: 'confirmed' } : null,
        messages: [
          ...curr.messages,
          {
            id: `graph-confirm-by-chat-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.graphConfirmed'),
          },
        ],
        updatedAt: Date.now(),
      }))
      await requestBackendGraphGeneration({
        conversationId: currentConversationId,
        message: trimmedInput,
        params: currentParams,
        sessionId: currentSessionId,
        usePresetRules: false,
        confirmGenerate: true,
      })
      return
    }

    await requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: trimmedInput,
      params: currentParams,
      sessionId: currentSessionId,
      usePresetRules: false,
      confirmGenerate: false,
    })
  }

  const onEditStrategy = (
    _strategyId: string,
    preset: Partial<QuantParams>,
    presetName: string,
    fromLoginIntent = false,
  ) => {
    if (!activeConversation) return
    const nextParams = { ...activeConversation.params, ...preset }
    const currentConversationId = activeConversation.id
    const currentSessionId = activeConversation.llmCodegenSessionId
    const prompt = `${presetName}：${nextParams.buyWindowMin}m drop ${nextParams.buyDropPct}% buy`

    updateActiveConversation(curr => ({
      ...curr,
      params: nextParams,
      backtestResult: null,
      messages: [
        ...curr.messages,
        {
          id: `pick-${Date.now()}`,
          role: 'assistant',
          content: fromLoginIntent
            ? t('aiQuant.messages.restorePreset', { name: presetName })
            : t('aiQuant.messages.applyPreset', { name: presetName }),
        },
      ],
      updatedAt: Date.now(),
    }))

    void requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: prompt,
      params: nextParams,
      sessionId: currentSessionId,
      usePresetRules: true,
    })
  }

  const runBacktestWithParams = (targetParams: QuantParams) => {
    const result = getMockBacktest(targetParams)
    return result
  }

  const onRunStrategy = (
    _strategyId: string,
    preset: Partial<QuantParams>,
    presetName: string,
    fromLoginIntent = false,
  ) => {
    if (!activeConversation) return
    const nextParams = { ...activeConversation.params, ...preset }
    const currentConversationId = activeConversation.id
    const currentSessionId = activeConversation.llmCodegenSessionId
    const prompt = `${presetName}, generate logic graph`

    updateActiveConversation(curr => ({
      ...curr,
      params: nextParams,
      backtestResult: null,
      messages: [
        ...curr.messages,
        {
          id: `run-pick-${Date.now()}`,
          role: 'assistant',
          content: fromLoginIntent
            ? t('aiQuant.messages.restoreRun', { name: presetName })
            : t('aiQuant.messages.applyRun', { name: presetName }),
        },
      ],
      updatedAt: Date.now(),
    }))

    void requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: prompt,
      params: nextParams,
      sessionId: currentSessionId,
      usePresetRules: true,
    })
  }

  const onRunBacktest = () => {
    if (!graphConfirmed) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `graph-guard-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.graphGuard'),
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }
    const result = runBacktestWithParams(activeConversation.params)
    updateActiveConversation(curr => ({
      ...curr,
      backtestResult: result,
      messages: [
        ...curr.messages,
        {
          id: `bt-${Date.now()}`,
          role: 'assistant',
          content:
            result.maxDrawdownPct <= 20
              ? t('aiQuant.messages.backtestSuccess', { drawdown: result.maxDrawdownPct })
              : t('aiQuant.messages.backtestFail', { drawdown: result.maxDrawdownPct }),
        },
      ],
      updatedAt: Date.now(),
    }))
  }

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant`)}`)
  }

  useEffect(() => {
    if (!session || !activeConversation) return
    const intent = getIntent(INTENT_TTL_MS)
    if (!intent) return

    clearIntent()

    if (intent.type === 'chat') {
      onSend(intent.draft)
      return
    }

    const preset = findPresetById(intent.strategyId)
    if (!preset) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `intent-miss-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.intentMiss'),
          },
        ],
      }))
      return
    }

    if (intent.type === 'edit') {
      onEditStrategy(preset.id, preset.params, t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }), true)
      return
    }

    onRunStrategy(preset.id, preset.params, t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, session])

  useEffect(() => {
    setSelectedDeployExchange(activeConversation.params.exchange)
  }, [activeConversation.params.exchange])

  useEffect(() => {
    if (!deployOpen) return
    if (selectedDeployAccountId) return
    const firstAvailable = deployAccounts.find(
      item => item.exchange === selectedDeployExchange && item.status === 'available',
    )
    if (firstAvailable) {
      setSelectedDeployAccountId(firstAvailable.accountId)
    }
  }, [deployAccounts, deployOpen, selectedDeployAccountId, selectedDeployExchange])

  if (isLoading) {
    return <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8" />
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8">
        <GuestAiQuantLanding onRequireLogin={goLoginWithIntent} />
      </main>
    )
  }

  if (!activeConversation) return null

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.title')}</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${lng}/ai-quant/plaza`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            {t('aiQuant.plaza')}
          </Link>
          <Link
            href={`/${lng}/account?tab=ai-quant#exchange-api`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            {t('aiQuant.configApi')}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <ConversationSidebar
          items={conversations.map(x => ({ id: x.id, title: x.title, updatedAt: x.updatedAt }))}
          activeId={activeConversation.id}
          onCreate={() => {
            const next = createConversation()
            setConversations(prev => [next, ...prev])
            setActiveConversationId(next.id)
          }}
          onSwitch={setActiveConversationId}
          onRename={(id, title) => {
            setConversations(prev => prev.map(conv => (conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv)))
          }}
          onDelete={(id) => {
            setConversations(prev => {
              const next = prev.filter(conv => conv.id !== id)
              if (next.length === 0) {
                const seed = createConversation()
                setActiveConversationId(seed.id)
                return [seed]
              }
              if (id === activeConversation.id) setActiveConversationId(next[0].id)
              return next
            })
          }}
        />

        <div className="space-y-4">
          <QuantChatPanel
            messages={activeConversation.messages}
            params={activeConversation.params}
            compactMode={compactMode}
            onParamsChange={nextParams => updateActiveConversation(curr => ({ ...curr, params: nextParams, updatedAt: Date.now() }))}
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={graphConfirmed}
          />

          {activeConversation.logicGraph && (
            <LogicGraphPreview
              graph={activeConversation.logicGraph}
              onConfirm={() => {
                const currentConversationId = activeConversation.id
                const currentParams = activeConversation.params
                const currentSessionId = activeConversation.llmCodegenSessionId
                updateActiveConversation(curr => ({
                  ...curr,
                  logicGraph: curr.logicGraph ? { ...curr.logicGraph, status: 'confirmed' } : null,
                  messages: [
                    ...curr.messages,
                    {
                      id: `graph-confirm-${Date.now()}`,
                      role: 'assistant',
                      content: t('aiQuant.messages.graphConfirmed'),
                    },
                  ],
                  updatedAt: Date.now(),
                }))
                void requestBackendGraphGeneration({
                  conversationId: currentConversationId,
                  message: '确认生成代码',
                  params: currentParams,
                  sessionId: currentSessionId,
                  usePresetRules: false,
                  confirmGenerate: true,
                })
              }}
              onRevise={() => {
                updateActiveConversation(curr => ({
                  ...curr,
                  messages: [
                    ...curr.messages,
                    {
                      id: `graph-revise-${Date.now()}`,
                      role: 'assistant',
                      content: t('aiQuant.messages.graphRevise'),
                    },
                  ],
                  updatedAt: Date.now(),
                }))
              }}
            />
          )}

          {activeConversation.backtestResult && (
            <BacktestSummaryCard
              result={activeConversation.backtestResult}
              canDeploy={canDeploy}
              drawdownLimited={false}
              onOpenFullScreen={() =>
                router.push(`/${lng}/ai-quant/backtest/${activeConversation.backtestResult!.id}`)
              }
              onOptimize={() => {
                const optimizeMessage: QuantMessage = {
                  id: `opt-${Date.now()}`,
                  role: 'assistant',
                  content: t('aiQuant.messages.optimizeHint'),
                }
                updateActiveConversation(curr => ({
                  ...curr,
                  messages: [...curr.messages, optimizeMessage],
                  updatedAt: Date.now(),
                }))
              }}
              onDeploy={() => setDeployOpen(true)}
            />
          )}
        </div>
      </div>

      <DeployDialog
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        canDeploy={canDeploy}
        apiConfigured={apiConfigured}
        exchange={selectedDeployExchange}
        accounts={deployAccounts}
        selectedAccountId={selectedDeployAccountId}
        onSelectExchange={(nextExchange) => {
          setSelectedDeployExchange(nextExchange)
          setSelectedDeployAccountId('')
        }}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={async () => {
          const account = deployAccounts.find(item => item.accountId === selectedDeployAccountId)
          if (!account || !activeConversation.backtestResult || !session) return

          const strategyName = activeConversation.title || 'AI策略'
          const timeframe = `${activeConversation.params.buyWindowMin}m/${activeConversation.params.sellWindowMin}m`

          try {
            await deployAccountAiQuantStrategy({
              name: strategyName,
              exchange: selectedDeployExchange,
              symbol: activeConversation.params.symbol,
              timeframe,
              positionPct: activeConversation.params.positionPct,
              exchangeAccountId: account.accountId,
              exchangeAccountName: account.accountName,
            })
            setDeployOpen(false)
            updateActiveConversation(curr => ({
              ...curr,
              messages: [
                ...curr.messages,
                {
                  id: `deploy-ok-${Date.now()}`,
                  role: 'assistant',
                  content: t('aiQuant.messages.deploySuccess', { exchange: selectedDeployExchange.toUpperCase(), account: account.accountName }),
                },
              ],
              updatedAt: Date.now(),
            }))
          } catch (error) {
            const message = error instanceof ApiError ? error.message : '部署失败，请检查账户绑定与后端执行链路'
            updateActiveConversation(curr => ({
              ...curr,
              messages: [
                ...curr.messages,
                {
                  id: `deploy-failed-${Date.now()}`,
                  role: 'assistant',
                  content: message,
                },
              ],
              updatedAt: Date.now(),
            }))
          }
        }}
        lng={lng}
      />
    </main>
  )
}
