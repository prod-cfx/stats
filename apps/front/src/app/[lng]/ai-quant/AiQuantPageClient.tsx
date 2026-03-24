'use client'

import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import type { LlmCodegenSessionResponse } from '@/lib/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { upsertStrategyDeployment } from '@/components/account/ai-quant-strategy-store'
import { listExchangeAccounts } from '@/components/account/exchange-account-store'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { buildBacktestPayload } from '@/components/ai-quant/backtest-payload-builder'
import type { BacktestRangeInput } from '@/components/ai-quant/backtest-range'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import {
  buildAutoAdvanceMessage,
  shouldAutoAdvanceOnConfirmation,
  resolveChecklistPayload,
} from '@/components/ai-quant/session-loop'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { useAuth } from '@/hooks/use-auth'
import {
  deployAccountAiQuantStrategy,
  continueLlmCodegenSession,
  getLlmCodegenSession,
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

const DEFAULT_PARAM_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['exchange', 'symbol', 'buyWindowMin', 'buyDropPct', 'sellWindowMin', 'sellRisePct', 'positionPct'],
  properties: {
    exchange: {
      type: 'string',
      title: 'Exchange',
      enum: ['binance', 'okx'],
    },
    symbol: {
      type: 'string',
      title: 'Symbol',
    },
    buyWindowMin: {
      type: 'number',
      title: 'Buy Window (min)',
      minimum: 1,
    },
    buyDropPct: {
      type: 'number',
      title: 'Buy Drop %',
      minimum: 0,
    },
    sellWindowMin: {
      type: 'number',
      title: 'Sell Window (min)',
      minimum: 1,
    },
    sellRisePct: {
      type: 'number',
      title: 'Sell Rise %',
      minimum: 0,
    },
    positionPct: {
      type: 'number',
      title: 'Position %',
      minimum: 1,
      maximum: 100,
    },
  },
}

const DEFAULT_PARAM_VALUES: Record<string, unknown> = { ...DEFAULT_PARAMS }

const API_STORAGE_KEY = 'exchange_api_configs_v1'
const CONVERSATIONS_STORAGE_KEY = 'ai_quant_conversations_v1'
const INTENT_TTL_MS = 30 * 60 * 1000
const DEV_MOCK_EXECUTION_MODE = true

interface ConversationState {
  id: string
  title: string
  messages: QuantMessage[]
  params: QuantParams
  paramSchema: Record<string, unknown> | null
  paramValues: Record<string, unknown>
  backtestResult: BacktestResult | null
  logicGraph: StrategyLogicGraph | null
  llmCodegenSessionId: string | null
  latestSignalMessage: string | null
  updatedAt: number
}

const CODEGEN_TERMINAL_STATUSES = new Set(['PUBLISHED', 'REJECTED'])
const CODEGEN_PROCESSING_STATUSES = new Set([
  'GENERATING',
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
])
const CODEGEN_RECOVERABLE_STATUSES = new Set([
  ...CODEGEN_TERMINAL_STATUSES,
  ...CODEGEN_PROCESSING_STATUSES,
  'CHECKLIST_GATE',
])

function isCodegenTerminalStatus(status: string): boolean {
  return CODEGEN_TERMINAL_STATUSES.has(status)
}

function isCodegenProcessingStatus(status: string): boolean {
  return CODEGEN_PROCESSING_STATUSES.has(status)
}

function isRecoverableCodegenStatus(status: string): boolean {
  return CODEGEN_RECOVERABLE_STATUSES.has(status)
}

function buildCodegenReplyContent(args: {
  response: LlmCodegenSessionResponse
  confirmGenerate: boolean
  publishedReply: string
  graphGeneratedMessage: string
  graphReviseMessage: string
}): string {
  const { response, confirmGenerate, publishedReply, graphGeneratedMessage, graphReviseMessage } = args
  if (response.assistantPrompt) {
    return response.assistantPrompt
  }
  if (response.status === 'PUBLISHED') {
    return publishedReply
  }
  if (response.status === 'CHECKLIST_GATE') {
    return confirmGenerate
      ? '已基于当前逻辑图继续生成，请查看最新结果。'
      : '逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。'
  }
  if (isCodegenProcessingStatus(response.status)) {
    return `策略代码仍在生成中（${response.status}），请稍候。`
  }
  if (response.status === 'REJECTED') {
    return response.rejectReason
      ? `基于当前逻辑图生成失败：${response.rejectReason}`
      : '基于当前逻辑图生成失败：后端未返回详细原因，请查看服务日志。'
  }
  return response.scriptCode ? graphGeneratedMessage : graphReviseMessage
}

function extractCodegenErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback
  }

  const details = error.details
  if (details && typeof details === 'object') {
    const record = details as Record<string, unknown>
    const directRejectReason = record.rejectReason
    if (typeof directRejectReason === 'string' && directRejectReason.trim()) {
      return directRejectReason.trim()
    }

    const data = record.data
    if (data && typeof data === 'object') {
      const nestedRejectReason = (data as Record<string, unknown>).rejectReason
      if (typeof nestedRejectReason === 'string' && nestedRejectReason.trim()) {
        return nestedRejectReason.trim()
      }
      const nestedMessage = (data as Record<string, unknown>).message
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage.trim()
      }
    }

    const detailMessage = record.message
    if (typeof detailMessage === 'string' && detailMessage.trim()) {
      return detailMessage.trim()
    }
  }

  if (error.message?.trim()) {
    return error.message.trim()
  }
  return fallback
}

function isTerminalSessionConflict(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false
  }

  if (error.code === 'codegen.session_terminal_status') {
    return true
  }

  if (error.message.includes('会话已终态') || error.message.includes('codegen.session_terminal_status')) {
    return true
  }

  const details = error.details
  if (!details || typeof details !== 'object') {
    return false
  }

  const detailRecord = details as Record<string, unknown>
  const nestedError = detailRecord.error
  if (!nestedError || typeof nestedError !== 'object') {
    return false
  }

  const nestedCode = (nestedError as Record<string, unknown>).code
  if (typeof nestedCode === 'string' && nestedCode === 'codegen.session_terminal_status') {
    return true
  }

  const nestedMessage = (nestedError as Record<string, unknown>).message
  if (typeof nestedMessage === 'string') {
    return nestedMessage.includes('会话已终态') || nestedMessage.includes('codegen.session_terminal_status')
  }

  return false
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

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeParamsFromValues(values: Record<string, unknown>, fallback: QuantParams): QuantParams {
  return {
    exchange: values.exchange === 'okx' ? 'okx' : 'binance',
    symbol: typeof values.symbol === 'string' && values.symbol.trim() ? values.symbol.trim() : fallback.symbol,
    buyWindowMin: normalizeNumber(values.buyWindowMin, fallback.buyWindowMin),
    buyDropPct: normalizeNumber(values.buyDropPct, fallback.buyDropPct),
    sellWindowMin: normalizeNumber(values.sellWindowMin, fallback.sellWindowMin),
    sellRisePct: normalizeNumber(values.sellRisePct, fallback.sellRisePct),
    positionPct: normalizeNumber(values.positionPct, fallback.positionPct),
  }
}

const VALID_RANGE_PRESETS = ['7D', '30D', '90D', '1Y', 'CUSTOM'] as const
type BacktestRangePresetValue = typeof VALID_RANGE_PRESETS[number]
const SCRIPT_CODE_BLOCK_REGEX = /```(?:javascript|js)?\n([\s\S]*?)```/i

function resolveBacktestRangeInput(values: Record<string, unknown>): BacktestRangeInput {
  const presetRaw = typeof values.backtestRangePreset === 'string'
    ? values.backtestRangePreset.toUpperCase()
    : '30D'
  const preset = (VALID_RANGE_PRESETS as readonly string[]).includes(presetRaw)
    ? presetRaw as BacktestRangePresetValue
    : '30D'
  if (preset !== 'CUSTOM') {
    return { preset }
  }

  return {
    preset: 'CUSTOM',
    startAt: typeof values.backtestStart === 'string' ? values.backtestStart : '',
    endAt: typeof values.backtestEnd === 'string' ? values.backtestEnd : '',
  }
}

function extractLatestScriptCode(messages: QuantMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    const match = SCRIPT_CODE_BLOCK_REGEX.exec(message.content)
    if (match?.[1]?.trim()) {
      return match[1].trim()
    }
  }
  return ''
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
      paramSchema: DEFAULT_PARAM_SCHEMA,
      paramValues: { ...DEFAULT_PARAM_VALUES },
      backtestResult: null,
      logicGraph: null,
      llmCodegenSessionId: null,
      latestSignalMessage: null,
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
      const normalized = parsed.map(item => ({
        ...item,
        paramSchema: item.paramSchema ?? DEFAULT_PARAM_SCHEMA,
        paramValues: item.paramValues ?? { ...(item.params ?? DEFAULT_PARAMS) },
        params: item.params
          ? normalizeParamsFromValues(item.paramValues ?? item.params, item.params)
          : normalizeParamsFromValues(item.paramValues ?? DEFAULT_PARAM_VALUES, DEFAULT_PARAMS),
        llmCodegenSessionId: item.llmCodegenSessionId ?? null,
        latestSignalMessage: item.latestSignalMessage ?? null,
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
  const mockExecutionMode = DEV_MOCK_EXECUTION_MODE
  const deployAccounts = useMemo(() => {
    if (exchangeAccounts.length > 0) return exchangeAccounts
    if (!mockExecutionMode) return exchangeAccounts
    return [
      {
        accountId: 'mock-binance',
        exchange: 'binance' as const,
        accountName: 'Mock Binance Account',
        apiKeyMask: 'MOCK',
        status: 'available' as const,
      },
      {
        accountId: 'mock-okx',
        exchange: 'okx' as const,
        accountName: 'Mock OKX Account',
        apiKeyMask: 'MOCK',
        status: 'available' as const,
      },
    ]
  }, [exchangeAccounts, mockExecutionMode])

  const canDeploy = useMemo(() => {
    if (!activeConversation?.backtestResult) return false
    if (mockExecutionMode) return true
    return activeConversation.backtestResult.maxDrawdownPct <= 20
  }, [activeConversation?.backtestResult, mockExecutionMode])
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
    let activeSessionId = sessionId
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

    const resolveProcessingSession = async (
      id: string,
      initial: LlmCodegenSessionResponse,
    ): Promise<LlmCodegenSessionResponse> => {
      if (!isCodegenProcessingStatus(initial.status)) {
        return initial
      }

      let current = initial
      const deadline = Date.now() + 120_000
      while (isCodegenProcessingStatus(current.status) && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 1500))
        current = await getLlmCodegenSession(id, session.userId)
        if (isCodegenTerminalStatus(current.status) || current.status === 'CHECKLIST_GATE') {
          return current
        }
      }

      return current
    }

    const applyCodegenResponseToConversation = (response: Awaited<ReturnType<typeof continueLlmCodegenSession>>) => {
      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        const nextVersion = (conv.logicGraph?.version || 0) + 1
        const shouldReuseCodegenSession = !isCodegenTerminalStatus(response.status)
        const shouldUpdateGraph = (response.status === 'CHECKLIST_GATE' || response.status === 'PUBLISHED')
          && Boolean(response.specDesc)
        const nextGraph = shouldUpdateGraph
          ? buildLogicGraphFromCodegenSpec(
              response.specDesc,
              {
                exchange: targetParams.exchange,
                symbol: targetParams.symbol,
                positionPct: targetParams.positionPct,
              },
              nextVersion,
            )
          : conv.logicGraph
        const publishedReply = response.scriptCode
          ? `${t('aiQuant.messages.graphGenerated')}\n\n已生成策略代码：\n\`\`\`javascript\n${response.scriptCode}\n\`\`\``
          : t('aiQuant.messages.graphGenerated')
        const replyContent = buildCodegenReplyContent({
          response,
          confirmGenerate,
          publishedReply,
          graphGeneratedMessage: t('aiQuant.messages.graphGenerated'),
          graphReviseMessage: t('aiQuant.messages.graphRevise'),
        })
        return {
          ...conv,
          llmCodegenSessionId: shouldReuseCodegenSession ? activeSessionId : null,
          logicGraph: nextGraph,
          backtestResult: null,
          latestSignalMessage: null,
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
    }

    try {
      const currentConversation = conversations.find(conv => conv.id === conversationId)
      const checklistResult = resolveChecklistPayload({
        usePresetRules,
        confirmGenerate,
        message: trimmedMessage,
        sessionId,
        graph: currentConversation?.logicGraph,
        params: targetParams,
        paramSchema: currentConversation?.paramSchema ?? null,
        paramValues: currentConversation?.paramValues ?? null,
      })
      if ('error' in checklistResult) {
        const errorMessage = checklistResult.error.code === 'MISSING_REQUIRED_PARAMS'
          ? `参数不完整，请补充必填字段：${checklistResult.error.missingKeys.join(', ')}`
          : `参数校验失败，请修正：${Object.entries(checklistResult.error.fieldErrors ?? {})
            .map(([key, reason]) => `${key}(${reason})`)
            .join(', ')}`
        setConversations(prev => prev.map((conv) => {
          if (conv.id !== conversationId) return conv
          return {
            ...conv,
            latestSignalMessage: null,
            messages: [
              ...conv.messages.map(msg =>
                msg.id === loadingMessageId
                  ? { ...msg, content: errorMessage }
                  : msg,
              ),
            ],
            updatedAt: Date.now(),
          }
        }))
        return
      }
      const checklistPayload = checklistResult

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
          confirmGenerate,
          ...checklistPayload,
        })

      const advanceConfirmGenerate = async (id: string, initial: Awaited<ReturnType<typeof continueSession>>) => {
        if (!confirmGenerate) {
          return initial
        }
        let current = initial
        let attempts = 0
        while (current.status === 'CHECKLIST_GATE' && attempts < 2) {
          current = await continueSession(id)
          attempts += 1
        }
        return current
      }

      let continued
      if (!activeSessionId) {
        const created = await startNewSession()
        activeSessionId = created.id
        if (confirmGenerate) {
          continued = await continueSession(activeSessionId)
          continued = await advanceConfirmGenerate(activeSessionId, continued)
          continued = await resolveProcessingSession(activeSessionId, continued)
        } else {
          continued = created
        }
      } else {
        try {
          continued = await continueSession(activeSessionId)
          continued = await advanceConfirmGenerate(activeSessionId, continued)
          continued = await resolveProcessingSession(activeSessionId, continued)
        } catch (error) {
          const isTerminalSessionError = isTerminalSessionConflict(error)
          if (!isTerminalSessionError) {
            throw error
          }

          let recovered: Awaited<ReturnType<typeof continueSession>> | null = null
          try {
            recovered = await getLlmCodegenSession(activeSessionId, session.userId)
          } catch {
            recovered = null
          }

          if (recovered && (
            recovered.status === 'PUBLISHED'
            || recovered.status === 'REJECTED'
          )) {
            continued = recovered
          } else {
            const recreated = await startNewSession()
            activeSessionId = recreated.id
            if (confirmGenerate) {
              continued = await continueSession(activeSessionId)
              continued = await advanceConfirmGenerate(activeSessionId, continued)
              continued = await resolveProcessingSession(activeSessionId, continued)
            } else {
              continued = recreated
            }
          }
        }
      }

      applyCodegenResponseToConversation(continued)
    } catch (error) {
      if (activeSessionId) {
        try {
          let recovered = await getLlmCodegenSession(activeSessionId, session.userId)
          recovered = await resolveProcessingSession(activeSessionId, recovered)
          if (isRecoverableCodegenStatus(recovered.status)) {
            applyCodegenResponseToConversation(recovered)
            return
          }
        } catch {
          // keep original error branch
        }
      }
      const message = extractCodegenErrorMessage(error, t('common.error'))
      setConversations(prev => prev.map((conv) => {
        if (conv.id !== conversationId) return conv
        return {
          ...conv,
          latestSignalMessage: null,
          messages: [
            ...conv.messages.map(msg =>
              msg.id === loadingMessageId
                ? { ...msg, content: message }
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
    const lastAssistantMessage = [...activeConversation.messages]
      .reverse()
      .find(msg => msg.role === 'assistant')?.content
    const autoAdvance = shouldAutoAdvanceOnConfirmation({
      userMessage: trimmedInput,
      lastAssistantMessage,
      hasLogicGraph: Boolean(activeConversation.logicGraph),
    })

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
        latestSignalMessage: null,
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

    if (autoAdvance) {
      await requestBackendGraphGeneration({
        conversationId: currentConversationId,
        message: buildAutoAdvanceMessage(lastAssistantMessage),
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
      paramValues: { ...curr.paramValues, ...nextParams },
      backtestResult: null,
      latestSignalMessage: null,
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

  const runBacktestWithParams = (
    targetParams: QuantParams,
    paramValues: Record<string, unknown>,
    messages: QuantMessage[],
    strategyId: string | null,
  ) => {
    const payload = buildBacktestPayload({
      symbol: targetParams.symbol,
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: {
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
      },
      strategy: {
        id: strategyId ?? `mock-${Date.now()}`,
        scriptCode: extractLatestScriptCode(messages),
        params: paramValues,
      },
      range: resolveBacktestRangeInput(paramValues),
    })

    const result = getMockBacktest(targetParams)
    return {
      ...result,
      symbol: payload.symbols[0],
      startAt: new Date(payload.dataRange.fromTs).toISOString(),
      endAt: new Date(payload.dataRange.toTs).toISOString(),
    }
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
      paramValues: { ...curr.paramValues, ...nextParams },
      backtestResult: null,
      latestSignalMessage: null,
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
    if (!graphConfirmed && !mockExecutionMode) {
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
    let result: BacktestResult
    try {
      result = runBacktestWithParams(
        activeConversation.params,
        activeConversation.paramValues,
        activeConversation.messages,
        activeConversation.llmCodegenSessionId,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error'
      const message = reason === 'start_after_end'
        ? t('aiQuant.messages.backtestRangeOrderInvalid')
        : reason === 'missing_script_code'
          ? '策略代码为空，请先确认并生成策略代码。'
          : `回测参数无效：${reason}`
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `bt-invalid-${Date.now()}`,
            role: 'assistant',
            content: message,
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

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
            paramSchema={activeConversation.paramSchema}
            paramValues={activeConversation.paramValues}
            compactMode={compactMode}
            onParamChange={(key, value) => updateActiveConversation((curr) => {
              const nextValues = { ...curr.paramValues, [key]: value }
              return {
                ...curr,
                paramValues: nextValues,
                params: normalizeParamsFromValues(nextValues, curr.params),
                updatedAt: Date.now(),
              }
            })}
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={graphConfirmed || mockExecutionMode}
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

          {activeConversation.latestSignalMessage && (
            <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold text-emerald-300">MOCK SIGNAL</p>
              <p className="mt-2 text-sm text-emerald-100">{activeConversation.latestSignalMessage}</p>
            </section>
          )}

          {activeConversation.backtestResult && (
            <BacktestSummaryCard
              result={activeConversation.backtestResult}
              canDeploy={canDeploy}
              drawdownLimited={!mockExecutionMode}
              onOpenFullScreen={() => {
                const currentBacktest = activeConversation.backtestResult
                if (!currentBacktest) {
                  return
                }
                const search = new URLSearchParams()
                search.set('symbol', currentBacktest.symbol ?? activeConversation.params.symbol)
                if (currentBacktest.startAt) {
                  search.set('startAt', currentBacktest.startAt)
                }
                if (currentBacktest.endAt) {
                  search.set('endAt', currentBacktest.endAt)
                }
                router.push(`/${lng}/ai-quant/backtest/${currentBacktest.id}?${search.toString()}`)
              }}
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
        apiConfigured={apiConfigured || mockExecutionMode}
        exchange={selectedDeployExchange}
        accounts={deployAccounts}
        selectedAccountId={selectedDeployAccountId}
        onSelectExchange={(nextExchange) => {
          if (nextExchange !== 'binance' && nextExchange !== 'okx') {
            return
          }
          setSelectedDeployExchange(nextExchange)
          setSelectedDeployAccountId('')
        }}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={async () => {
          const account = deployAccounts.find(item => item.accountId === selectedDeployAccountId)
          if (!account || !activeConversation.backtestResult || !session?.userId) return

          const strategyName = activeConversation.title || 'AI策略'
          const timeframe = `${activeConversation.params.buyWindowMin}m/${activeConversation.params.sellWindowMin}m`

          try {
            await deployAccountAiQuantStrategy({
              userId: session.userId,
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
            // 后端部署失败时，在本地 mock 模式下保留可演示能力，但明确这是本地模拟
            if (mockExecutionMode) {
              upsertStrategyDeployment({
                id: `stg-${activeConversation.id}`,
                name: strategyName,
                exchange: selectedDeployExchange,
                symbol: activeConversation.params.symbol,
                timeframe,
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
                    id: `deploy-mock-${Date.now()}`,
                    role: 'assistant',
                    content: `模拟部署成功（仅本地数据）：${selectedDeployExchange.toUpperCase()} / ${account.accountName}。`,
                  },
                ],
                updatedAt: Date.now(),
              }))
              return
            }

            const deployErrorMessage = extractCodegenErrorMessage(error, '策略部署失败，请稍后重试。')
            updateActiveConversation(curr => ({
              ...curr,
              messages: [
                ...curr.messages,
                {
                  id: `deploy-fail-${Date.now()}`,
                  role: 'assistant',
                  content: `策略部署失败：${deployErrorMessage}`,
                },
              ],
              updatedAt: Date.now(),
            }))
            throw error instanceof ApiError
              ? error
              : new ApiError(deployErrorMessage, 'AI_QUANT_DEPLOY_FAILED', 500, { error })
          }
        }}
        lng={lng}
      />
    </main>
  )
}
