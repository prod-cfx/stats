'use client'

import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { upsertStrategyDeployment } from '@/components/account/ai-quant-strategy-store'
import { listExchangeAccounts } from '@/components/account/exchange-account-store'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { buildLogicGraphFromPrompt } from '@/components/ai-quant/logic-graph-generator'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { useAuth } from '@/hooks/use-auth'
import {
  continueLlmCodegenSession,
  startLlmCodegenSession,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

export interface QuantParams {
  exchange: 'binance' | 'okx'
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

const API_STORAGE_KEY = 'exchange_api_configs_v1'
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
  const [apiReady, setApiReady] = useState({ binance: false, okx: false })
  const [selectedDeployExchange, setSelectedDeployExchange] = useState<'binance' | 'okx'>('binance')
  const [selectedDeployAccountId, setSelectedDeployAccountId] = useState('')
  const [exchangeAccounts, setExchangeAccounts] = useState(listExchangeAccounts())

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
      setConversations(parsed)
      setActiveConversationId(parsed[0].id)
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
    const syncApiReady = () => {
      const raw = localStorage.getItem(API_STORAGE_KEY)
      if (!raw) {
        setApiReady({ binance: false, okx: false })
        return
      }
      try {
        const parsed = JSON.parse(raw) as {
          binanceApiKey?: string
          binanceSecretKey?: string
          okxApiKey?: string
          okxSecretKey?: string
          okxPassphrase?: string
        }
        setApiReady({
          binance: Boolean(parsed.binanceApiKey && parsed.binanceSecretKey),
          okx: Boolean(parsed.okxApiKey && parsed.okxSecretKey && parsed.okxPassphrase),
        })
      } catch {
        // ignore invalid local data
      }
    }

    syncApiReady()
    window.addEventListener('focus', syncApiReady)
    window.addEventListener('storage', syncApiReady)
    return () => {
      window.removeEventListener('focus', syncApiReady)
      window.removeEventListener('storage', syncApiReady)
    }
  }, [])

  const apiConfigured = selectedDeployExchange === 'binance' ? apiReady.binance : apiReady.okx

  const canDeploy = useMemo(() => {
    if (!activeConversation?.backtestResult) return false
    return activeConversation.backtestResult.maxDrawdownPct <= 20
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
  }) => {
    const { conversationId, message, params: targetParams, sessionId, usePresetRules = false } = args
    if (!session?.userId) return
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return

    try {
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
        : {}

      const startNewSession = async () =>
        startLlmCodegenSession({
          userId: session.userId,
          initialMessage: trimmedMessage,
          ...checklistPayload,
        })

      const continueSession = async (id: string) =>
        continueLlmCodegenSession(id, {
          userId: session.userId,
          message: trimmedMessage,
          ...checklistPayload,
        })

      let activeSessionId = sessionId
      if (!activeSessionId) {
        const created = await startNewSession()
        activeSessionId = created.id
      }

      let continued
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
        continued = await continueSession(activeSessionId)
      }

      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        const nextVersion = (conv.logicGraph?.version || 0) + 1
        const shouldReuseCodegenSession = continued.status !== 'PUBLISHED' && continued.status !== 'REJECTED'
        const nextGraph = buildLogicGraphFromCodegenSpec(
          continued.specDesc ?? {},
          {
            exchange: targetParams.exchange,
            symbol: targetParams.symbol,
            positionPct: targetParams.positionPct,
          },
          nextVersion,
        )
        const replyContent = continued.assistantPrompt
          || (continued.status === 'PUBLISHED'
            ? t('aiQuant.messages.graphGenerated')
            : t('aiQuant.messages.graphRevise'))
        return {
          ...conv,
          llmCodegenSessionId: shouldReuseCodegenSession ? activeSessionId : null,
          logicGraph: nextGraph,
          backtestResult: null,
          messages: [
            ...conv.messages,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: replyContent,
            },
          ],
          updatedAt: Date.now(),
        }
      }))
    } catch {
      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        const nextVersion = (conv.logicGraph?.version || 0) + 1
        const fallbackGraph = buildLogicGraphFromPrompt(trimmedMessage, targetParams, nextVersion, t)
        return {
          ...conv,
          logicGraph: fallbackGraph,
          messages: [
            ...conv.messages,
            {
              id: `a-err-${Date.now()}`,
              role: 'assistant',
              content: t('common.error'),
            },
          ],
          updatedAt: Date.now(),
        }
      }))
    }
  }

  const onSend = async (input: string) => {
    if (!input.trim()) return
    const trimmedInput = input.trim()
    const currentConversationId = activeConversation.id
    const currentParams = activeConversation.params
    const currentSessionId = activeConversation.llmCodegenSessionId

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
    await requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: trimmedInput,
      params: currentParams,
      sessionId: currentSessionId,
      usePresetRules: false,
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
    const syncAccounts = () => setExchangeAccounts(listExchangeAccounts())
    syncAccounts()
    window.addEventListener('focus', syncAccounts)
    window.addEventListener('storage', syncAccounts)
    return () => {
      window.removeEventListener('focus', syncAccounts)
      window.removeEventListener('storage', syncAccounts)
    }
  }, [])

  useEffect(() => {
    setSelectedDeployExchange(activeConversation.params.exchange)
  }, [activeConversation.params.exchange])

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
        accounts={exchangeAccounts}
        selectedAccountId={selectedDeployAccountId}
        onSelectExchange={(nextExchange) => {
          setSelectedDeployExchange(nextExchange)
          setSelectedDeployAccountId('')
        }}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={() => {
          const account = exchangeAccounts.find(item => item.accountId === selectedDeployAccountId)
          if (!account || !activeConversation.backtestResult) return
          upsertStrategyDeployment({
            id: `stg-${activeConversation.id}`,
            name: activeConversation.title || 'AI策略',
            exchange: selectedDeployExchange,
            symbol: activeConversation.params.symbol,
            timeframe: `${activeConversation.params.buyWindowMin}m/${activeConversation.params.sellWindowMin}m`,
            positionPct: activeConversation.params.positionPct,
            accountId: account.accountId,
            accountName: account.accountName,
            metrics: {
              returnPct: activeConversation.backtestResult.totalReturnPct,
              maxDrawdownPct: activeConversation.backtestResult.maxDrawdownPct,
              winRatePct: activeConversation.backtestResult.winRatePct,
              tradeCount: activeConversation.backtestResult.tradeCount,
            },
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
        }}
        lng={lng}
      />
    </main>
  )
}
