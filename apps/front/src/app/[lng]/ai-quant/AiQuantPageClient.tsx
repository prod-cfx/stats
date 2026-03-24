'use client'

import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { upsertStrategyDeployment } from '@/components/account/ai-quant-strategy-store'
import { listExchangeAccounts } from '@/components/account/exchange-account-store'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import {
  resolveBacktestRange,
  validateBacktestRange,
  type BacktestRangePreset,
} from '@/components/ai-quant/backtest-range'
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
import type { LlmCodegenSessionResponse } from '@/lib/api'
import { ApiError } from '@/lib/errors'

export interface QuantParams {
  exchange: 'binance' | 'okx'
  symbol: string
  buyWindowMin: number
  buyDropPct: number
  sellWindowMin: number
  sellRisePct: number
  positionPct: number
  backtestRangePreset: BacktestRangePreset
  backtestStart: string
  backtestEnd: string
}

const BASE_DEFAULT_PARAMS = {
  exchange: 'binance',
  symbol: 'BTCUSDT',
  buyWindowMin: 3,
  buyDropPct: 1,
  sellWindowMin: 15,
  sellRisePct: 2,
  positionPct: 10,
} as const

function normalizePreset(value: unknown): BacktestRangePreset {
  if (value === '7D' || value === '30D' || value === '90D' || value === '1Y' || value === 'CUSTOM') {
    return value
  }
  return '30D'
}

function buildDefaultParams(now = new Date()): QuantParams {
  const backtestRangePreset: BacktestRangePreset = '30D'
  const resolved = resolveBacktestRange({ preset: backtestRangePreset }, now)
  return {
    ...BASE_DEFAULT_PARAMS,
    backtestRangePreset,
    backtestStart: resolved.startAt,
    backtestEnd: resolved.endAt,
  }
}

function normalizeQuantParams(raw: Partial<QuantParams> | null | undefined, now = new Date()): QuantParams {
  const defaults = buildDefaultParams(now)
  const merged = { ...defaults, ...raw }
  const backtestRangePreset = normalizePreset(merged.backtestRangePreset)
  const resolved = resolveBacktestRange({
    preset: backtestRangePreset,
    startAt: merged.backtestStart,
    endAt: merged.backtestEnd,
  }, now)

  return {
    ...merged,
    backtestRangePreset,
    backtestStart: resolved.startAt,
    backtestEnd: resolved.endAt,
  }
}

const API_STORAGE_KEY = 'exchange_api_configs_v1'
const CONVERSATIONS_STORAGE_KEY = 'ai_quant_conversations_v1'
const INTENT_TTL_MS = 30 * 60 * 1000
const DEV_MOCK_EXECUTION_MODE = true

interface ConversationState {
  id: string
  title: string
  messages: QuantMessage[]
  params: QuantParams
  backtestResult: BacktestResult | null
  logicGraph: StrategyLogicGraph | null
  llmCodegenSessionId: string | null
  latestSignalMessage: string | null
  updatedAt: number
}

interface BacktestFeedbackState {
  type: 'error' | 'success'
  message: string
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
    symbol: params.symbol,
    startAt: params.backtestStart,
    endAt: params.backtestEnd,
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
      params: buildDefaultParams(),
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
  const [backtestFeedback, setBacktestFeedback] = useState<BacktestFeedbackState | null>(null)
  const [backtestConfirmOpen, setBacktestConfirmOpen] = useState(false)
  const backtestSummaryRef = useRef<HTMLDivElement | null>(null)
  const backtestConfirmDialogRef = useRef<HTMLDivElement | null>(null)
  const backtestConfirmSubmitRef = useRef<HTMLButtonElement | null>(null)
  const backtestConfirmTriggerRef = useRef<HTMLElement | null>(null)

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
    if (!activeConversation?.backtestResult) return
    backtestSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeConversation?.backtestResult?.id])

  const closeBacktestConfirm = () => {
    setBacktestConfirmOpen(false)
    backtestConfirmTriggerRef.current?.focus()
  }

  useEffect(() => {
    if (!backtestConfirmOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      backtestConfirmSubmitRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeBacktestConfirm()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = backtestConfirmDialogRef.current
      if (!dialog) return
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !active || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !active || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [backtestConfirmOpen])

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
        params: normalizeQuantParams(item.params),
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
      const checklistPayload = resolveChecklistPayload({
        usePresetRules,
        confirmGenerate,
        message: trimmedMessage,
        sessionId,
        graph: currentConversation?.logicGraph,
        params: targetParams,
      })

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
        } else {
          continued = created
        }
      } else {
        try {
          continued = await continueSession(activeSessionId)
          continued = await advanceConfirmGenerate(activeSessionId, continued)
        } catch (error) {
          const isTerminalSessionError = error instanceof ApiError
            && error.statusCode === 409
            && error.message.includes('会话已终态')
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
            } else {
              continued = recreated
            }
          }
        }
      }

      applyCodegenResponseToConversation(continued)
    } catch (error) {
      if (activeSessionId && error instanceof ApiError && (error.statusCode ?? 0) >= 500) {
        try {
          const recovered = await getLlmCodegenSession(activeSessionId, session.userId)
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

  const executeBacktest = () => {
    if (!graphConfirmed && !mockExecutionMode) {
      const message = t('aiQuant.messages.graphGuard')
      setBacktestFeedback({ type: 'error', message })
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `graph-guard-${Date.now()}`,
            role: 'assistant',
            content: message,
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }
    const validation = validateBacktestRange({
      preset: activeConversation.params.backtestRangePreset,
      startAt: activeConversation.params.backtestStart,
      endAt: activeConversation.params.backtestEnd,
    })
    if (!validation.ok) {
      const errorKeyByReason: Record<string, string> = {
        missing_range: 'aiQuant.messages.backtestRangeMissing',
        start_after_end: 'aiQuant.messages.backtestRangeOrderInvalid',
        range_too_large: 'aiQuant.messages.backtestRangeTooLarge',
      }
      const message = t(errorKeyByReason[validation.reason] ?? 'aiQuant.messages.backtestRangeOrderInvalid')
      setBacktestFeedback({ type: 'error', message })
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `range-guard-${Date.now()}`,
            role: 'assistant',
            content: message,
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    const normalizedRange = resolveBacktestRange({
      preset: activeConversation.params.backtestRangePreset,
      startAt: activeConversation.params.backtestStart,
      endAt: activeConversation.params.backtestEnd,
    })
    const normalizedParams = {
      ...activeConversation.params,
      backtestStart: normalizedRange.startAt,
      backtestEnd: normalizedRange.endAt,
    }

    const result = runBacktestWithParams(normalizedParams)
    const resultMessage = result.maxDrawdownPct <= 20
      ? t('aiQuant.messages.backtestSuccess', { drawdown: result.maxDrawdownPct })
      : t('aiQuant.messages.backtestFail', { drawdown: result.maxDrawdownPct })
    setBacktestFeedback({ type: 'success', message: resultMessage })
    updateActiveConversation(curr => ({
      ...curr,
      params: normalizedParams,
      backtestResult: result,
      messages: [
        ...curr.messages,
        {
          id: `bt-${Date.now()}`,
          role: 'assistant',
          content: resultMessage,
        },
      ],
      updatedAt: Date.now(),
    }))
  }

  const onRunBacktest = () => {
    setBacktestFeedback(null)
    backtestConfirmTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setBacktestConfirmOpen(true)
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
          {backtestFeedback && (
            <section
              className={`rounded-2xl border px-4 py-3 text-sm ${
                backtestFeedback.type === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}
              role="status"
              aria-live="polite"
              data-testid="backtest-feedback"
            >
              {backtestFeedback.message}
            </section>
          )}

          <QuantChatPanel
            messages={activeConversation.messages}
            params={activeConversation.params}
            compactMode={compactMode}
            onParamsChange={nextParams => updateActiveConversation(curr => ({ ...curr, params: nextParams, updatedAt: Date.now() }))}
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={graphConfirmed || mockExecutionMode}
          />

          {backtestConfirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="backtest-confirm-title"
              data-testid="backtest-confirm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeBacktestConfirm()
                }
              }}
            >
              <section ref={backtestConfirmDialogRef} className="w-full max-w-md rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-2xl">
                <h3 id="backtest-confirm-title" className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.backtestConfirmTitle')}</h3>
                <p className="mt-2 text-xs text-[color:var(--cf-muted)]">
                  {activeConversation.params.symbol}
                  {' · '}
                  {formatBacktestRange(activeConversation.params.backtestStart, activeConversation.params.backtestEnd)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.backtestConfirmContext', {
                    exchange: activeConversation.params.exchange.toUpperCase(),
                    position: activeConversation.params.positionPct,
                  })}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]"
                    onClick={closeBacktestConfirm}
                    data-testid="backtest-confirm-cancel"
                  >
                    {t('aiQuant.deployDialog.cancel')}
                  </button>
                  <button
                    type="button"
                    ref={backtestConfirmSubmitRef}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      closeBacktestConfirm()
                      executeBacktest()
                    }}
                    data-testid="backtest-confirm-submit"
                  >
                    {t('aiQuant.backtestConfirmSubmit')}
                  </button>
                </div>
              </section>
            </div>
          )}

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
            <div ref={backtestSummaryRef} data-testid="backtest-summary-anchor">
              <BacktestSummaryCard
                result={activeConversation.backtestResult}
                canDeploy={canDeploy}
                drawdownLimited={!mockExecutionMode}
                onOpenFullScreen={() => {
                  const search = new URLSearchParams({
                    symbol: activeConversation.backtestResult!.symbol ?? activeConversation.params.symbol,
                    startAt: activeConversation.backtestResult!.startAt ?? activeConversation.params.backtestStart,
                    endAt: activeConversation.backtestResult!.endAt ?? activeConversation.params.backtestEnd,
                  })
                  router.push(`/${lng}/ai-quant/backtest/${activeConversation.backtestResult!.id}?${search.toString()}`)
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
            </div>
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
          } catch {
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
            }
          }
        }}
        lng={lng}
      />
    </main>
  )
}
