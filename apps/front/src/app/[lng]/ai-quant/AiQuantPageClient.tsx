'use client'

import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { upsertStrategyDeployment } from '@/components/account/ai-quant-strategy-store'
import { listExchangeAccounts } from '@/components/account/exchange-account-store'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { buildLogicGraphFromPrompt } from '@/components/ai-quant/logic-graph-generator'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { StrategyPlaza } from '@/components/ai-quant/StrategyPlaza'
import { useAuth } from '@/hooks/use-auth'

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

const INITIAL_MESSAGES: QuantMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      '告诉我你的交易想法，我会帮你生成策略并回测。回测最大回撤需要 <= 20% 才能一键部署。',
  },
]

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
  updatedAt: number
}

function createConversation(): ConversationState {
  const now = Date.now()
  return {
    id: `conv-${now}-${Math.random().toString(16).slice(2, 8)}`,
    title: '新对话',
    messages: INITIAL_MESSAGES,
    params: DEFAULT_PARAMS,
    backtestResult: null,
    logicGraph: null,
    updatedAt: now,
  }
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
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { session, isLoading } = useAuth()

  const [conversations, setConversations] = useState<ConversationState[]>([createConversation()])
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
  const graphConfirmed = activeConversation.logicGraph?.status === 'confirmed'

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

  const onSend = (input: string) => {
    if (!input.trim()) return

    updateActiveConversation(curr => {
      const nextVersion = (curr.logicGraph?.version || 0) + 1
      const draftGraph = buildLogicGraphFromPrompt(input, curr.params, nextVersion)
      const nextMessages: QuantMessage[] = [
        ...curr.messages,
        { id: `u-${Date.now()}`, role: 'user', content: input },
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content:
            '我已把你的自然语言转换为逻辑图。请先确认逻辑图，再开始回测。',
        },
      ]

      const derivedTitle = curr.title === '新对话' ? input.trim().slice(0, 16) || '新对话' : curr.title
      return {
        ...curr,
        title: derivedTitle,
        messages: nextMessages,
        logicGraph: draftGraph,
        backtestResult: null,
        updatedAt: Date.now(),
      }
    })
  }

  const onEditStrategy = (
    _strategyId: string,
    preset: Partial<QuantParams>,
    presetName: string,
    fromLoginIntent = false,
  ) => {
    updateActiveConversation(curr => ({
      ...curr,
      params: { ...curr.params, ...preset },
      logicGraph: buildLogicGraphFromPrompt(
        `${presetName}：${preset.buyWindowMin || curr.params.buyWindowMin}分钟跌${preset.buyDropPct || curr.params.buyDropPct}%买入`,
        { ...curr.params, ...preset },
        (curr.logicGraph?.version || 0) + 1,
      ),
      backtestResult: null,
      messages: [
        ...curr.messages,
        {
          id: `pick-${Date.now()}`,
          role: 'assistant',
          content: fromLoginIntent
            ? `已恢复你登录前选择的「${presetName}」，已导入参数。告诉我你想优化哪一项。`
            : `已应用推荐策略「${presetName}」，已生成逻辑图，请先确认再回测。`,
        },
      ],
      updatedAt: Date.now(),
    }))
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
    updateActiveConversation(curr => ({
      ...curr,
      params: { ...curr.params, ...preset },
      logicGraph: buildLogicGraphFromPrompt(
        `${presetName}，请生成策略逻辑图`,
        { ...curr.params, ...preset },
        (curr.logicGraph?.version || 0) + 1,
      ),
      backtestResult: null,
      messages: [
        ...curr.messages,
        {
          id: `run-pick-${Date.now()}`,
          role: 'assistant',
          content: fromLoginIntent
            ? `已恢复你登录前的“运行 ${presetName}”请求。请先确认逻辑图，再开始回测。`
            : `已应用「${presetName}」。请先确认逻辑图，再开始回测。`,
        },
      ],
      updatedAt: Date.now(),
    }))
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
            content: '请先确认上方逻辑图，再进行回测。',
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
              ? `本次回测最大回撤 ${result.maxDrawdownPct}%（达标），可以部署。`
              : `本次回测最大回撤 ${result.maxDrawdownPct}%（未达标）。建议继续对话优化参数后再回测。`,
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
            content: '你登录前选择的策略已不可用，请重新选择策略。',
          },
        ],
      }))
      return
    }

    if (intent.type === 'edit') {
      onEditStrategy(preset.id, preset.params, preset.name, true)
      return
    }

    onRunStrategy(preset.id, preset.params, preset.name, true)
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

  const showRecommendedStrategies = compactMode

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">AI量化</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">对话创建策略、回测评估，达标后再一键部署。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${lng}/ai-quant/plaza`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            策略广场
          </Link>
          <Link
            href={`/${lng}/account?tab=ai-quant#exchange-api`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            配置交易所 API
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
                      content: '逻辑图已确认，现在可以开始回测。',
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
                      content: '好的，请在对话框继续描述你要修改的条件。',
                    },
                  ],
                  updatedAt: Date.now(),
                }))
              }}
            />
          )}

          {showRecommendedStrategies && (
            <StrategyPlaza
              onRunStrategy={onRunStrategy}
              onEditStrategy={onEditStrategy}
              subtitle="首次对话可先从推荐策略开始，也可以继续在上面对话自定义。"
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
                  content: '建议先降低单笔仓位或调整买卖阈值，再重新回测。',
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
                content: `部署成功：${selectedDeployExchange.toUpperCase()} / ${account.accountName}。可在个人中心查看运行状态。`,
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
