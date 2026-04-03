'use client'

import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import type { BacktestRangeInput } from '@/components/ai-quant/backtest-range'
import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import type { LlmCodegenSessionResponse } from '@/lib/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildAiQuantStageFallbackMessage,
  parseAiQuantErrorMeta,
} from '@/components/ai-quant/ai-quant-error-stage'
import { fetchBacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import {
  createBacktestJob,
  getBacktestJob,
  getBacktestJobResult,
} from '@/components/ai-quant/backtest-job-client'
import {
  buildBacktestPayload,
  isBacktestPayloadBuilderError,
} from '@/components/ai-quant/backtest-payload-builder'
import { checkBacktestSymbolSupport } from '@/components/ai-quant/backtest-symbol-support-client'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import {
  buildAutoAdvanceMessage,
  isStrategyModificationIntent,
  resolveChecklistPayload,
  shouldAutoAdvanceOnConfirmation,
} from '@/components/ai-quant/session-loop'
import {
  applyCapabilitiesToParamSchema,
  syncStrategyParamsFromCodegen,
} from '@/components/ai-quant/strategy-param-sync'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { useAuth } from '@/hooks/use-auth'
import {
  deployAccountAiQuantStrategy,
  continueLlmCodegenSession,
  fetchUserExchangeAccountStatuses,
  getLlmCodegenSession,
  startLlmCodegenSession,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

export interface QuantParams {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  baseTimeframe: string
  buyWindowMin: number
  buyDropPct: number
  sellWindowMin: number
  sellRisePct: number
  positionPct: number
}

const DEFAULT_PARAMS: QuantParams = {
  exchange: 'binance',
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  buyWindowMin: 3,
  buyDropPct: 1,
  sellWindowMin: 15,
  sellRisePct: 2,
  positionPct: 10,
}

const DEFAULT_PARAM_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: [
    'exchange',
    'symbol',
    'baseTimeframe',
    'buyWindowMin',
    'buyDropPct',
    'sellWindowMin',
    'sellRisePct',
    'positionPct',
  ],
  properties: {
    exchange: {
      type: 'string',
      title: 'Exchange',
      enum: ['binance', 'okx', 'hyperliquid'],
    },
    symbol: {
      type: 'string',
      title: 'Symbol',
      enum: [DEFAULT_PARAMS.symbol],
    },
    baseTimeframe: {
      type: 'string',
      title: 'Base Timeframe',
      enum: [DEFAULT_PARAMS.baseTimeframe],
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
const CAPABILITY_FAILED_MESSAGE_KEY = 'aiQuant.messages.backtestCapabilityLoadFailed'
const CAPABILITY_AUTO_CORRECTED_MESSAGE_KEY = 'aiQuant.messages.backtestCapabilityAutoCorrected'
const CAPABILITY_AUTO_RETRY_DELAY_MS = 15_000

const CONVERSATIONS_STORAGE_KEY = 'ai_quant_conversations_v1'
const INTENT_TTL_MS = 30 * 60 * 1000
const BACKTEST_JOB_POLL_INTERVAL_MS = 1500
const BACKTEST_JOB_TIMEOUT_MS = 60_000

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
  publishedStrategyInstanceId: string | null
  publishedScriptCode: string | null
  publishedScriptGraphVersion: number | null
  latestSignalMessage: string | null
  backtestExecutionState: 'idle' | 'submitting' | 'running' | 'succeeded' | 'failed' | 'timeout'
  updatedAt: number
}

type CapabilityState = 'loading' | 'ready' | 'failed'

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

function createDeployRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildCodegenReplyContent(args: {
  response: LlmCodegenSessionResponse
  confirmGenerate: boolean
  publishedReply: string
  graphGeneratedMessage: string
  graphReviseMessage: string
  checklistContinuedMessage: string
  checklistUpdatedMessage: string
  stillGeneratingPrefix: string
  rejectedPrefix: string
  rejectedWithoutReason: string
}): string {
  const {
    response,
    confirmGenerate,
    publishedReply,
    graphGeneratedMessage,
    graphReviseMessage,
    checklistContinuedMessage,
    checklistUpdatedMessage,
    stillGeneratingPrefix,
    rejectedPrefix,
    rejectedWithoutReason,
  } = args
  if (response.assistantPrompt) {
    return response.assistantPrompt
  }
  if (response.status === 'PUBLISHED') {
    if (response.rejectReason) {
      return `${rejectedPrefix}：${response.rejectReason}`
    }
    return publishedReply
  }
  if (response.status === 'CHECKLIST_GATE') {
    return confirmGenerate ? checklistContinuedMessage : checklistUpdatedMessage
  }
  if (isCodegenProcessingStatus(response.status)) {
    return `${stillGeneratingPrefix}（${response.status}）`
  }
  if (response.status === 'REJECTED') {
    return response.rejectReason
      ? `${rejectedPrefix}：${response.rejectReason}`
      : rejectedWithoutReason
  }
  return response.scriptCode ? graphGeneratedMessage : graphReviseMessage
}

export function resolvePublishedStrategyInstanceId(args: {
  response: LlmCodegenSessionResponse
  isStartingNewSession: boolean
}): string | null {
  const { response, isStartingNewSession } = args
  if (response.status === 'PUBLISHED' && !response.rejectReason) {
    return response.strategyInstanceId ?? null
  }
  if (isStartingNewSession || response.status === 'REJECTED') {
    return null
  }
  return null
}

function extractCodegenErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback
  }

  const details = error.details
  const meta = parseAiQuantErrorMeta(details)

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
  }

  if (meta.message) {
    return meta.message
  }

  if (error.message?.trim()) {
    return error.message.trim()
  }

  return buildAiQuantStageFallbackMessage(fallback, error.statusCode ?? 500, {
    ...meta,
    code: meta.code ?? error.code,
  })
}

function isTerminalSessionConflict(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false
  }

  if (error.code === 'codegen.session_terminal_status') {
    return true
  }

  if (
    error.message.includes('会话已终态') ||
    error.message.includes('codegen.session_terminal_status')
  ) {
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
    return (
      nestedMessage.includes('会话已终态') ||
      nestedMessage.includes('codegen.session_terminal_status')
    )
  }

  return false
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeParamsFromValues(
  values: Record<string, unknown>,
  fallback: QuantParams,
): QuantParams {
  const exchange =
    values.exchange === 'okx'
      ? 'okx'
      : values.exchange === 'hyperliquid'
        ? 'hyperliquid'
        : 'binance'
  return {
    exchange,
    symbol:
      typeof values.symbol === 'string' && values.symbol.trim()
        ? values.symbol.trim()
        : fallback.symbol,
    baseTimeframe:
      typeof values.baseTimeframe === 'string' && values.baseTimeframe.trim()
        ? values.baseTimeframe.trim()
        : fallback.baseTimeframe,
    buyWindowMin: normalizeNumber(values.buyWindowMin, fallback.buyWindowMin),
    buyDropPct: normalizeNumber(values.buyDropPct, fallback.buyDropPct),
    sellWindowMin: normalizeNumber(values.sellWindowMin, fallback.sellWindowMin),
    sellRisePct: normalizeNumber(values.sellRisePct, fallback.sellRisePct),
    positionPct: normalizeNumber(values.positionPct, fallback.positionPct),
  }
}

function buildParamSchemaWithCapabilities(
  capabilities: BacktestCapabilities | null,
  currentSymbol = DEFAULT_PARAMS.symbol,
): Record<string, unknown> {
  const properties = (DEFAULT_PARAM_SCHEMA.properties ?? {}) as Record<string, unknown>
  const symbolProperty = {
    ...(properties.symbol as Record<string, unknown>),
  }
  const baseTimeframeProperty = {
    ...(properties.baseTimeframe as Record<string, unknown>),
  }

  if (capabilities) {
    symbolProperty.enum = [
      currentSymbol,
      ...capabilities.allowedSymbols.filter(item => item !== currentSymbol),
    ]
    baseTimeframeProperty.enum = capabilities.allowedBaseTimeframes
  } else {
    symbolProperty.enum = [currentSymbol]
    baseTimeframeProperty.enum = [DEFAULT_PARAMS.baseTimeframe]
  }

  return {
    ...DEFAULT_PARAM_SCHEMA,
    properties: {
      ...properties,
      symbol: symbolProperty,
      baseTimeframe: baseTimeframeProperty,
    },
  }
}

function normalizePublishedScriptCode(scriptCode: unknown): string | null {
  if (typeof scriptCode !== 'string') {
    return null
  }
  const normalized = scriptCode.trim()
  return normalized.length > 0 ? normalized : null
}

function resolveHydratedPublishedScriptCode(item: Partial<ConversationState>): string | null {
  const explicitScriptCode = normalizePublishedScriptCode(item.publishedScriptCode)
  if (explicitScriptCode) {
    return explicitScriptCode
  }
  if (item.logicGraph?.status !== 'confirmed') {
    return null
  }
  return normalizePublishedScriptCode(extractLatestScriptCode(item.messages ?? []))
}

function hasLatestPublishedCode(conversation: ConversationState | null | undefined): boolean {
  if (!conversation?.logicGraph) {
    return false
  }
  if (conversation.publishedScriptGraphVersion !== conversation.logicGraph.version) {
    return false
  }
  return normalizePublishedScriptCode(conversation.publishedScriptCode) !== null
}

function invalidateConversationPublication(
  conversation: ConversationState,
  options: {
    markGraphDraft?: boolean
  } = {},
): ConversationState {
  const { markGraphDraft = false } = options

  return {
    ...conversation,
    logicGraph:
      markGraphDraft && conversation.logicGraph
        ? { ...conversation.logicGraph, status: 'draft' }
        : conversation.logicGraph,
    publishedStrategyInstanceId: null,
    publishedScriptCode: null,
    publishedScriptGraphVersion: null,
    backtestResult: null,
    latestSignalMessage: null,
    backtestExecutionState: 'idle',
  }
}

const VALID_RANGE_PRESETS = ['7D', '30D', '90D', '1Y', 'CUSTOM'] as const
type BacktestRangePresetValue = (typeof VALID_RANGE_PRESETS)[number]
const SCRIPT_CODE_BLOCK_REGEX = /```(?:typescript|ts|javascript|js)?\r?\n([\s\S]*?)```/i
const TRANSIENT_BACKTEST_STATES = new Set<ConversationState['backtestExecutionState']>([
  'submitting',
  'running',
  'timeout',
])

function normalizeHydratedBacktestExecutionState(
  state: ConversationState['backtestExecutionState'] | undefined,
): ConversationState['backtestExecutionState'] {
  if (!state || TRANSIENT_BACKTEST_STATES.has(state)) {
    return 'idle'
  }
  return state
}

function resolveBacktestRangeInput(values: Record<string, unknown>): BacktestRangeInput {
  const presetRaw =
    typeof values.backtestRangePreset === 'string'
      ? values.backtestRangePreset.toUpperCase()
      : '30D'
  const preset = (VALID_RANGE_PRESETS as readonly string[]).includes(presetRaw)
    ? (presetRaw as BacktestRangePresetValue)
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

function buildBacktestSummaryResult(
  previous: BacktestResult,
  summary: {
    netProfitPct: number
    maxDrawdownPct: number
    winRate: number
    totalTrades: number
  },
): BacktestResult {
  const winRatePct = summary.winRate <= 1 ? summary.winRate * 100 : summary.winRate
  return {
    ...previous,
    maxDrawdownPct: Number(summary.maxDrawdownPct.toFixed(2)),
    totalReturnPct: Number(summary.netProfitPct.toFixed(2)),
    winRatePct: Number(winRatePct.toFixed(2)),
    tradeCount: summary.totalTrades,
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
      paramSchema: buildParamSchemaWithCapabilities(null),
      paramValues: { ...DEFAULT_PARAM_VALUES },
      backtestResult: null,
      logicGraph: null,
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: now,
    }
  }

  // Initialize state lazily to avoid hydration mismatch if possible,
  // but here we need to read from localStorage which is a side effect.
  // We'll start with a default and update in useEffect.
  const [conversations, setConversations] = useState<ConversationState[]>(() => [
    createConversation(),
  ])
  const [activeConversationId, setActiveConversationId] = useState<string>('')
  const [deployOpen, setDeployOpen] = useState(false)
  const [deployRequestId, setDeployRequestId] = useState<string | null>(null)
  const [deploySubmitting, setDeploySubmitting] = useState(false)
  const [selectedDeployExchange, setSelectedDeployExchange] =
    useState<QuantParams['exchange']>('binance')
  const [selectedDeployAccountId, setSelectedDeployAccountId] = useState('')
  const [exchangeAccounts, setExchangeAccounts] = useState<DeployExchangeAccount[]>([])
  const [backtestCapabilityState, setBacktestCapabilityState] = useState<CapabilityState>('loading')
  const [backtestCapabilities, setBacktestCapabilities] = useState<BacktestCapabilities | null>(
    null,
  )
  const [backtestCapabilityRetryNonce, setBacktestCapabilityRetryNonce] = useState(0)
  const [codegenBusyConversationIds, setCodegenBusyConversationIds] = useState<string[]>([])
  const isMountedRef = useRef(true)
  const activeConversationIdRef = useRef('')
  const previousActiveConversationIdRef = useRef<string>('')
  const backtestRunTokenRef = useRef(new Map<string, number>())
  const backtestRunMutexRef = useRef(new Set<string>())
  const backtestSummarySyncRef = useRef(new Set<string>())
  const codegenRequestMutexRef = useRef(new Set<string>())

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
      const normalized = parsed.map(item => {
        const nextParamValues = item.paramValues ?? { ...(item.params ?? DEFAULT_PARAMS) }
        const nextParams = item.params
          ? normalizeParamsFromValues(nextParamValues, item.params)
          : normalizeParamsFromValues(nextParamValues, DEFAULT_PARAMS)

        return {
          ...item,
          paramSchema:
            item.paramSchema ?? buildParamSchemaWithCapabilities(null, nextParams.symbol),
          paramValues: nextParamValues,
          params: nextParams,
          llmCodegenSessionId: item.llmCodegenSessionId ?? null,
          publishedStrategyInstanceId: item.publishedStrategyInstanceId ?? null,
          publishedScriptCode: resolveHydratedPublishedScriptCode(item),
          publishedScriptGraphVersion: (() => {
            if (typeof item.publishedScriptGraphVersion === 'number') {
              return item.publishedScriptGraphVersion
            }
            const hydratedScriptCode = resolveHydratedPublishedScriptCode(item)
            if (hydratedScriptCode && item.logicGraph?.status === 'confirmed') {
              return item.logicGraph.version
            }
            return null
          })(),
          latestSignalMessage: item.latestSignalMessage ?? null,
          backtestExecutionState: normalizeHydratedBacktestExecutionState(
            item.backtestExecutionState,
          ),
        }
      })
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
    if (!session?.userId) return

    const controller = new AbortController()
    setBacktestCapabilityState('loading')

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    void fetchBacktestCapabilities({ signal: controller.signal })
      .then(capabilities => {
        if (controller.signal.aborted) return
        const allowedBaseTimeframes = capabilities.allowedBaseTimeframes

        setBacktestCapabilities(capabilities)
        setBacktestCapabilityState('ready')
        setConversations(prev =>
          prev.map(conv => {
            const currentSymbol =
              typeof conv.paramValues.symbol === 'string'
                ? conv.paramValues.symbol
                : conv.params.symbol
            const currentBaseTimeframe =
              typeof conv.paramValues.baseTimeframe === 'string'
                ? conv.paramValues.baseTimeframe
                : conv.params.baseTimeframe
            const nextBaseTimeframe = allowedBaseTimeframes.includes(currentBaseTimeframe)
              ? currentBaseTimeframe
              : allowedBaseTimeframes[0]
            const corrected = nextBaseTimeframe !== currentBaseTimeframe
            const nextValues = {
              ...conv.paramValues,
              symbol: currentSymbol,
              baseTimeframe: nextBaseTimeframe,
            }
            const nextMessages = corrected
              ? [
                  ...conv.messages,
                  {
                    id: `capability-correct-${Date.now()}-${conv.id}`,
                    role: 'assistant' as const,
                    content: CAPABILITY_AUTO_CORRECTED_MESSAGE_KEY,
                  },
                ]
              : conv.messages
            return {
              ...conv,
              paramSchema:
                applyCapabilitiesToParamSchema(conv.paramSchema, capabilities) ??
                buildParamSchemaWithCapabilities(capabilities, currentSymbol),
              paramValues: nextValues,
              params: normalizeParamsFromValues(nextValues, conv.params),
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          }),
        )
      })
      .catch(error => {
        if (controller.signal.aborted) return
        setBacktestCapabilities(null)
        setBacktestCapabilityState('failed')
        setConversations(prev =>
          prev.map(conv => {
            const alreadyAppended = conv.messages.some(
              msg => msg.content === CAPABILITY_FAILED_MESSAGE_KEY,
            )
            if (alreadyAppended) return conv
            return {
              ...conv,
              paramSchema:
                applyCapabilitiesToParamSchema(conv.paramSchema, null) ??
                buildParamSchemaWithCapabilities(
                  null,
                  typeof conv.paramValues.symbol === 'string'
                    ? conv.paramValues.symbol
                    : conv.params.symbol,
                ),
              messages: [
                ...conv.messages,
                {
                  id: `capability-failed-${Date.now()}-${conv.id}`,
                  role: 'assistant',
                  content: CAPABILITY_FAILED_MESSAGE_KEY,
                },
              ],
              updatedAt: Date.now(),
            }
          }),
        )

        if (
          error instanceof ApiError &&
          (error.statusCode === 502 ||
            error.statusCode === 503 ||
            error.statusCode === 504 ||
            error.code === 'API_TIMEOUT')
        ) {
          retryTimer = globalThis.setTimeout(() => {
            if (!controller.signal.aborted) {
              setBacktestCapabilityRetryNonce(prev => prev + 1)
            }
          }, CAPABILITY_AUTO_RETRY_DELAY_MS)
        }
      })

    return () => {
      controller.abort()
      if (retryTimer) {
        globalThis.clearTimeout(retryTimer)
      }
    }
  }, [session?.userId, backtestCapabilityRetryNonce])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    const previousId = previousActiveConversationIdRef.current
    if (
      previousId &&
      previousId !== activeConversationId &&
      backtestRunMutexRef.current.has(previousId)
    ) {
      backtestRunTokenRef.current.set(
        previousId,
        (backtestRunTokenRef.current.get(previousId) ?? 0) + 1,
      )
      backtestRunMutexRef.current.delete(previousId)
      setConversations(prev =>
        prev.map(conv =>
          conv.id === previousId
            ? { ...conv, backtestExecutionState: 'idle', updatedAt: Date.now() }
            : conv,
        ),
      )
    }
    previousActiveConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      backtestRunTokenRef.current.clear()
      backtestRunMutexRef.current.clear()
      backtestSummarySyncRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const cachedBacktest = activeConversation?.backtestResult
    if (!activeConversation || !cachedBacktest?.id) {
      return
    }

    const syncKey = `${activeConversation.id}:${cachedBacktest.id}`
    if (backtestSummarySyncRef.current.has(syncKey)) {
      return
    }
    backtestSummarySyncRef.current.add(syncKey)

    void (async () => {
      try {
        const report = await getBacktestJobResult(cachedBacktest.id)
        const summary = report?.summary
        if (!summary || !isMountedRef.current) {
          return
        }

        updateConversationById(activeConversation.id, curr => {
          if (curr.backtestResult?.id !== cachedBacktest.id) {
            return curr
          }
          return {
            ...curr,
            backtestResult: buildBacktestSummaryResult(curr.backtestResult, summary),
            updatedAt: Date.now(),
          }
        })
      } catch {
        backtestSummarySyncRef.current.delete(syncKey)
      }
    })()
  }, [activeConversation])

  const apiConfigured = useMemo(
    () =>
      exchangeAccounts.some(
        item => item.exchange === selectedDeployExchange && item.status === 'available',
      ),
    [exchangeAccounts, selectedDeployExchange],
  )
  const deployAccounts = useMemo(() => exchangeAccounts, [exchangeAccounts])

  const canDeploy = useMemo(() => {
    if (!activeConversation?.backtestResult) return false
    return activeConversation.backtestResult.maxDrawdownPct <= 20
  }, [activeConversation?.backtestResult])
  const graphConfirmed = activeConversation?.logicGraph?.status === 'confirmed'
  const codegenBusy = activeConversation
    ? codegenBusyConversationIds.includes(activeConversation.id)
    : false
  const canRunBacktest = useMemo(() => {
    if (!activeConversation) return false
    if (backtestCapabilityState !== 'ready') return false
    if (!graphConfirmed) return false
    if (codegenBusy) return false
    if (!hasLatestPublishedCode(activeConversation)) return false
    return (
      activeConversation.backtestExecutionState !== 'submitting' &&
      activeConversation.backtestExecutionState !== 'running'
    )
  }, [activeConversation, backtestCapabilityState, codegenBusy, graphConfirmed])

  const compactMode = useMemo(() => {
    if (!activeConversation) return true
    return !activeConversation.messages.some(x => x.role === 'user')
  }, [activeConversation])

  const callingMessage = (elapsedSec: number) =>
    t('aiQuant.messages.calling', {
      seconds: elapsedSec,
      defaultValue: `Calling... (${elapsedSec}s)`,
    })

  function updateActiveConversation(updater: (curr: ConversationState) => ConversationState) {
    if (!activeConversation) return
    setConversations(prev =>
      prev.map(conv => (conv.id === activeConversation.id ? updater(conv) : conv)),
    )
  }
  function updateConversationById(
    conversationId: string,
    updater: (curr: ConversationState) => ConversationState,
  ) {
    setConversations(prev => prev.map(conv => (conv.id === conversationId ? updater(conv) : conv)))
  }
  function setConversationBacktestExecutionState(
    conversationId: string,
    state: ConversationState['backtestExecutionState'],
  ) {
    updateConversationById(conversationId, curr => ({
      ...curr,
      backtestExecutionState: state,
      updatedAt: Date.now(),
    }))
  }

  const requestBackendGraphGeneration = async (args: {
    conversationId: string
    message: string
    params: QuantParams
    sessionId: string | null
    usePresetRules?: boolean
    confirmGenerate?: boolean
  }) => {
    const {
      conversationId,
      message,
      params: targetParams,
      sessionId,
      usePresetRules = false,
      confirmGenerate = false,
    } = args
    if (!session?.userId) return
    if (codegenRequestMutexRef.current.has(conversationId)) return
    codegenRequestMutexRef.current.add(conversationId)
    setCodegenBusyConversationIds(prev =>
      prev.includes(conversationId) ? prev : [...prev, conversationId],
    )
    let activeSessionId = sessionId
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      codegenRequestMutexRef.current.delete(conversationId)
      setCodegenBusyConversationIds(prev => prev.filter(id => id !== conversationId))
      return
    }
    const loadingMessageId = `a-loading-${Date.now()}`
    const startedAt = Date.now()

    setConversations(prev =>
      prev.map(conv => {
        if (conv.id !== conversationId) return conv
        return {
          ...conv,
          publishedStrategyInstanceId: activeSessionId ? conv.publishedStrategyInstanceId : null,
          messages: [
            ...conv.messages,
            {
              id: loadingMessageId,
              role: 'assistant',
              content: callingMessage(0),
            },
          ],
          updatedAt: Date.now(),
        }
      }),
    )

    const loadingTimer = window.setInterval(() => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id !== conversationId) return conv
          return {
            ...conv,
            messages: conv.messages.map(msg =>
              msg.id === loadingMessageId ? { ...msg, content: callingMessage(elapsedSec) } : msg,
            ),
          }
        }),
      )
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
        current = await getLlmCodegenSession(id)
        if (isCodegenTerminalStatus(current.status) || current.status === 'CHECKLIST_GATE') {
          return current
        }
      }

      return current
    }

    const applyCodegenResponseToConversation = (
      response: Awaited<ReturnType<typeof continueLlmCodegenSession>>,
    ) => {
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id !== conversationId) return conv
          const nextVersion = (conv.logicGraph?.version || 0) + 1
          const shouldReuseCodegenSession = !isCodegenTerminalStatus(response.status)
          const shouldUpdateGraph =
            (response.status === 'CHECKLIST_GATE' || response.status === 'PUBLISHED') &&
            Boolean(response.specDesc)
          const syncResult = shouldUpdateGraph
            ? syncStrategyParamsFromCodegen({
                spec: response.specDesc,
                fallback: {
                  exchange: targetParams.exchange,
                  symbol: targetParams.symbol,
                  baseTimeframe: targetParams.baseTimeframe,
                  positionPct: targetParams.positionPct,
                },
                currentValues: conv.paramValues,
                capabilities: backtestCapabilities,
                contextText: trimmedMessage,
              })
            : null
          const nextParamValues = syncResult?.paramValues ?? conv.paramValues
          const nextParamSchema = shouldUpdateGraph
            ? applyCapabilitiesToParamSchema(syncResult?.paramSchema, backtestCapabilities)
            : conv.paramSchema
          const nextParams = syncResult
            ? normalizeParamsFromValues(nextParamValues, conv.params)
            : conv.params
          const nextGraphStatus =
            response.status === 'PUBLISHED' || confirmGenerate ? 'confirmed' : 'draft'
          const nextGraph = shouldUpdateGraph
            ? buildLogicGraphFromCodegenSpec(
                response.specDesc,
                {
                  exchange: syncResult?.normalized.exchange ?? targetParams.exchange,
                  symbol: syncResult?.normalized.symbol ?? targetParams.symbol,
                  baseTimeframe: syncResult?.normalized.baseTimeframe ?? targetParams.baseTimeframe,
                  positionPct: syncResult?.normalized.positionPct ?? targetParams.positionPct,
                  executionTags: syncResult?.executionTags ?? [],
                },
                nextVersion,
                nextGraphStatus,
              )
            : conv.logicGraph
          const nextPublishedScriptCode = (() => {
            if (response.status === 'PUBLISHED' && !response.rejectReason) {
              const responseScriptCode = normalizePublishedScriptCode(response.scriptCode)
              if (responseScriptCode) {
                return responseScriptCode
              }
              if (!shouldUpdateGraph) {
                return conv.publishedScriptCode
              }
              return null
            }
            if (shouldUpdateGraph) {
              return null
            }
            return conv.publishedScriptCode
          })()
          const nextPublishedScriptGraphVersion = nextPublishedScriptCode
            ? (nextGraph?.version ?? conv.publishedScriptGraphVersion)
            : null
          const publishedReply = response.scriptCode
            ? `${
                confirmGenerate
                  ? t('aiQuant.messages.codeGeneratedBacktest', {
                      defaultValue: 'Strategy code generated, ready to backtest.',
                    })
                  : t('aiQuant.messages.graphGenerated')
              }\n\n${t('aiQuant.messages.generatedCodeTitle', { defaultValue: 'Generated strategy code:' })}\n\`\`\`javascript\n${response.scriptCode}\n\`\`\``
            : confirmGenerate
              ? t('aiQuant.messages.codeGeneratedBacktest', {
                  defaultValue: 'Strategy code generated, ready to backtest.',
                })
              : t('aiQuant.messages.graphGenerated')
          const replyContent = buildCodegenReplyContent({
            response,
            confirmGenerate,
            publishedReply,
            graphGeneratedMessage: t('aiQuant.messages.graphGenerated'),
            graphReviseMessage: t('aiQuant.messages.graphRevise'),
            checklistContinuedMessage: t('aiQuant.messages.checklistContinued', {
              defaultValue:
                'Continued generation based on current logic graph. Please review the latest result.',
            }),
            checklistUpdatedMessage: t('aiQuant.messages.checklistUpdated', {
              defaultValue:
                'Logic graph updated. Please confirm it before I generate strategy code.',
            }),
            stillGeneratingPrefix: t('aiQuant.messages.stillGenerating', {
              defaultValue: 'Strategy code is still generating, please wait',
            }),
            rejectedPrefix: t('aiQuant.messages.generationFailedPrefix', {
              defaultValue: 'Failed to generate strategy from current logic graph',
            }),
            rejectedWithoutReason: t('aiQuant.messages.generationFailedNoReason', {
              defaultValue:
                'Failed to generate strategy from current logic graph: backend did not return a detailed reason. Please check service logs.',
            }),
          })
          return {
            ...conv,
            llmCodegenSessionId: shouldReuseCodegenSession ? activeSessionId : null,
            publishedStrategyInstanceId: resolvePublishedStrategyInstanceId({
              response,
              isStartingNewSession: !activeSessionId,
            }),
            publishedScriptCode: nextPublishedScriptCode,
            publishedScriptGraphVersion: nextPublishedScriptGraphVersion,
            params: nextParams,
            paramSchema: nextParamSchema,
            paramValues: nextParamValues,
            logicGraph: nextGraph,
            backtestResult: null,
            latestSignalMessage: null,
            messages: [
              ...conv.messages.map(msg =>
                msg.id === loadingMessageId ? { ...msg, content: replyContent } : msg,
              ),
            ],
            updatedAt: Date.now(),
          }
        }),
      )
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
        const errorMessage =
          checklistResult.error.code === 'MISSING_REQUIRED_PARAMS'
            ? t('aiQuant.messages.missingRequiredParams', {
                keys: checklistResult.error.missingKeys.join(', '),
                defaultValue: `Missing required parameters: ${checklistResult.error.missingKeys.join(', ')}`,
              })
            : t('aiQuant.messages.invalidParams', {
                details: Object.entries(checklistResult.error.fieldErrors ?? {})
                  .map(([key, reason]) => `${key}(${reason})`)
                  .join(', '),
                defaultValue: `Parameter validation failed: ${Object.entries(
                  checklistResult.error.fieldErrors ?? {},
                )
                  .map(([key, reason]) => `${key}(${reason})`)
                  .join(', ')}`,
              })
        setConversations(prev =>
          prev.map(conv => {
            if (conv.id !== conversationId) return conv
            return {
              ...conv,
              latestSignalMessage: null,
              messages: [
                ...conv.messages.map(msg =>
                  msg.id === loadingMessageId ? { ...msg, content: errorMessage } : msg,
                ),
              ],
              updatedAt: Date.now(),
            }
          }),
        )
        return
      }
      const checklistPayload = checklistResult

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

      const advanceConfirmGenerate = async (
        id: string,
        initial: Awaited<ReturnType<typeof continueSession>>,
      ) => {
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
            recovered = await getLlmCodegenSession(activeSessionId)
          } catch {
            recovered = null
          }

          if (recovered && (recovered.status === 'PUBLISHED' || recovered.status === 'REJECTED')) {
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
          let recovered = await getLlmCodegenSession(activeSessionId)
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
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id !== conversationId) return conv
          return {
            ...conv,
            latestSignalMessage: null,
            messages: [
              ...conv.messages.map(msg =>
                msg.id === loadingMessageId ? { ...msg, content: message } : msg,
              ),
            ],
            updatedAt: Date.now(),
          }
        }),
      )
    } finally {
      codegenRequestMutexRef.current.delete(conversationId)
      setCodegenBusyConversationIds(prev => prev.filter(id => id !== conversationId))
      window.clearInterval(loadingTimer)
    }
  }

  const onSend = async (input: string) => {
    if (!input.trim()) return
    const trimmedInput = input.trim()
    const isRevisionMessage = isStrategyModificationIntent(trimmedInput)
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

      const derivedTitle =
        curr.title === t('aiQuant.newChat')
          ? trimmedInput.slice(0, 16) || t('aiQuant.newChat')
          : curr.title
      const nextConversation = {
        ...curr,
        title: derivedTitle,
        messages: nextMessages,
        backtestResult: null,
        latestSignalMessage: null,
        updatedAt: Date.now(),
      }

      return isRevisionMessage
        ? invalidateConversationPublication(nextConversation, { markGraphDraft: true })
        : nextConversation
    })

    const confirmPattern =
      /^(?:确认逻辑图|\/confirm|确认|可以|好的?|行|ok|okay|yes|同意|没问题)[。.!！?？\s]*$/i
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
    const conversationId = activeConversation.id
    if (backtestRunMutexRef.current.has(conversationId)) {
      return
    }
    backtestRunMutexRef.current.add(conversationId)

    if (backtestCapabilityState !== 'ready' || !backtestCapabilities) {
      backtestRunMutexRef.current.delete(conversationId)
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `capability-guard-${Date.now()}`,
            role: 'assistant',
            content: CAPABILITY_FAILED_MESSAGE_KEY,
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    if (
      activeConversation.backtestExecutionState === 'submitting' ||
      activeConversation.backtestExecutionState === 'running'
    ) {
      backtestRunMutexRef.current.delete(conversationId)
      return
    }

    if (!canRunBacktest) {
      backtestRunMutexRef.current.delete(conversationId)
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `backtest-guard-${Date.now()}`,
            role: 'assistant',
            content: !graphConfirmed
              ? t('aiQuant.messages.graphGuard')
              : t('aiQuant.messages.codegenGuard', {
                  defaultValue: 'Please generate strategy code before running backtest.',
                }),
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    let payload: ReturnType<typeof buildBacktestPayload>
    try {
      payload = buildBacktestPayload({
        symbol: activeConversation.params.symbol,
        baseTimeframe: activeConversation.params.baseTimeframe,
        capabilities: backtestCapabilities,
        stateTimeframes: [activeConversation.params.baseTimeframe],
        initialCash: 10000,
        leverage: 1,
        execution: {
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
        },
        strategy: {
          id:
            activeConversation.publishedStrategyInstanceId ??
            activeConversation.llmCodegenSessionId ??
            `mock-${Date.now()}`,
          scriptCode: activeConversation.publishedScriptCode ?? '',
          params: activeConversation.paramValues,
        },
        range: resolveBacktestRangeInput(activeConversation.paramValues),
        allowPartial: true,
      })
    } catch (error) {
      backtestRunMutexRef.current.delete(conversationId)
      const message = (() => {
        if (!isBacktestPayloadBuilderError(error)) {
          return t('aiQuant.messages.backtestPayloadInvalid', { reason: 'unknown_error' })
        }

        switch (error.code) {
          case 'missing_range':
            return t('aiQuant.messages.backtestRangeMissing')
          case 'start_after_end':
            return t('aiQuant.messages.backtestRangeOrderInvalid')
          case 'range_too_large':
            return t('aiQuant.messages.backtestRangeTooLarge')
          case 'missing_script_code':
            return t('aiQuant.messages.backtestMissingScriptCode')
          case 'missing_symbol':
          default:
            return t('aiQuant.messages.backtestPayloadInvalid', { reason: error.code })
        }
      })()
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

    const runToken = (backtestRunTokenRef.current.get(conversationId) ?? 0) + 1
    backtestRunTokenRef.current.set(conversationId, runToken)
    const backtestMessageId = `bt-${Date.now()}`
    const updateBacktestMessage = (content: string) => {
      updateConversationById(conversationId, curr => {
        const hasBacktestMessage = curr.messages.some(message => message.id === backtestMessageId)
        return {
          ...curr,
          messages: hasBacktestMessage
            ? curr.messages.map(message =>
                message.id === backtestMessageId ? { ...message, content } : message,
              )
            : [
                ...curr.messages,
                {
                  id: backtestMessageId,
                  role: 'assistant',
                  content,
                },
              ],
          updatedAt: Date.now(),
        }
      })
    }
    const toFailureMessage = (reason: string) =>
      t('aiQuant.messages.backtestPayloadInvalid', { reason })
    const canContinue = () =>
      isMountedRef.current &&
      backtestRunTokenRef.current.get(conversationId) === runToken &&
      activeConversationIdRef.current === conversationId

    setConversationBacktestExecutionState(conversationId, 'submitting')
    updateConversationById(conversationId, curr => ({
      ...curr,
      backtestResult: null,
      messages: [
        ...curr.messages,
        {
          id: backtestMessageId,
          role: 'assistant',
          content: t('aiQuant.messages.backtestRunning', {
            defaultValue: '正在回测中，请稍后...',
          }),
        },
      ],
      updatedAt: Date.now(),
    }))

    void (async () => {
      try {
        const support = await checkBacktestSymbolSupport({
          exchange: activeConversation.params.exchange,
          symbol: payload.symbols[0],
        })
        if (!canContinue()) {
          return
        }
        if (support.status === 'not_supported') {
          setConversationBacktestExecutionState(conversationId, 'failed')
          updateBacktestMessage(toFailureMessage('symbol_not_supported'))
          return
        }

        const createdJob = await createBacktestJob(payload)
        if (!canContinue()) {
          return
        }
        setConversationBacktestExecutionState(conversationId, 'running')

        const deadline = Date.now() + BACKTEST_JOB_TIMEOUT_MS
        let latestJob = createdJob

        while (latestJob.status === 'queued' || latestJob.status === 'running') {
          if (!canContinue()) {
            return
          }
          if (Date.now() >= deadline) {
            setConversationBacktestExecutionState(conversationId, 'timeout')
            updateBacktestMessage(toFailureMessage('timeout'))
            return
          }
          await new Promise(resolve => window.setTimeout(resolve, BACKTEST_JOB_POLL_INTERVAL_MS))
          if (!canContinue()) {
            return
          }
          latestJob = await getBacktestJob(createdJob.id)
        }

        if (!canContinue()) {
          return
        }
        if (latestJob.status === 'failed') {
          setConversationBacktestExecutionState(conversationId, 'failed')
          updateBacktestMessage(toFailureMessage(latestJob.error ?? 'job_failed'))
          return
        }

        const jobResult = await getBacktestJobResult(createdJob.id)
        if (!canContinue()) {
          return
        }
        const summary = jobResult.summary
        const winRatePct = summary.winRate <= 1 ? summary.winRate * 100 : summary.winRate
        const result: BacktestResult = {
          id: createdJob.id,
          maxDrawdownPct: Number(summary.maxDrawdownPct.toFixed(2)),
          totalReturnPct: Number(summary.netProfitPct.toFixed(2)),
          winRatePct: Number(winRatePct.toFixed(2)),
          tradeCount: summary.totalTrades,
          symbol: payload.symbols[0],
          startAt: new Date(payload.dataRange.fromTs).toISOString(),
          endAt: new Date(payload.dataRange.toTs).toISOString(),
        }

        setConversationBacktestExecutionState(conversationId, 'succeeded')
        updateConversationById(conversationId, curr => ({
          ...curr,
          backtestResult: result,
          messages: curr.messages.map(message =>
            message.id === backtestMessageId
              ? {
                  ...message,
                  content:
                    result.maxDrawdownPct <= 20
                      ? t('aiQuant.messages.backtestSuccess', { drawdown: result.maxDrawdownPct })
                      : t('aiQuant.messages.backtestFail', { drawdown: result.maxDrawdownPct }),
                }
              : message,
          ),
          updatedAt: Date.now(),
        }))
      } catch (error) {
        if (!canContinue()) {
          return
        }
        setConversationBacktestExecutionState(conversationId, 'failed')
        const message =
          error instanceof ApiError
            ? error.message?.trim() || toFailureMessage('unknown_error')
            : toFailureMessage('unknown_error')
        updateBacktestMessage(message)
      } finally {
        backtestRunMutexRef.current.delete(conversationId)
      }
    })()
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
      onEditStrategy(
        preset.id,
        preset.params,
        t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }),
        true,
      )
      return
    }

    onRunStrategy(
      preset.id,
      preset.params,
      t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }),
      true,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, session])

  useEffect(() => {
    if (!session?.userId) {
      setExchangeAccounts([])
      return
    }

    let cancelled = false
    const syncAccounts = async () => {
      try {
        const items = await fetchUserExchangeAccountStatuses()
        if (cancelled) return
        setExchangeAccounts(
          items
            .filter(
              item => item.isBound && typeof item.id === 'string' && item.id.trim().length > 0,
            )
            .map(item => ({
              accountId: item.id as string,
              exchange: item.exchangeId,
              accountName: item.name?.trim() || item.exchangeId.toUpperCase(),
              apiKeyMask: item.maskedCredential?.trim() || '****',
              status: 'available' as const,
            })),
        )
      } catch {
        if (!cancelled) {
          setExchangeAccounts([])
        }
      }
    }

    const handleFocus = () => {
      void syncAccounts()
    }
    const handleStorage = () => {
      void syncAccounts()
    }

    void syncAccounts()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
    }
  }, [session?.userId])

  useEffect(() => {
    setSelectedDeployExchange(activeConversation.params.exchange)
  }, [activeConversation.params.exchange])

  useEffect(() => {
    if (!deployOpen) return
    const availableAccounts = deployAccounts.filter(
      item => item.exchange === selectedDeployExchange && item.status === 'available',
    )
    const stillValid = availableAccounts.some(item => item.accountId === selectedDeployAccountId)
    if (stillValid) return
    setSelectedDeployAccountId(availableAccounts[0]?.accountId ?? '')
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
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.title')}
          </h1>
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

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
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
            setConversations(prev =>
              prev.map(conv => (conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv)),
            )
          }}
          onDelete={id => {
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

        <div className="min-w-0 space-y-4">
          <QuantChatPanel
            key={activeConversation.id}
            messages={activeConversation.messages}
            paramSchema={activeConversation.paramSchema}
            paramValues={activeConversation.paramValues}
            compactMode={compactMode}
            onParamChange={(key, value) =>
              updateActiveConversation(curr => {
                const nextValues = { ...curr.paramValues, [key]: value }
                return {
                  ...curr,
                  paramValues: nextValues,
                  params: normalizeParamsFromValues(nextValues, curr.params),
                  updatedAt: Date.now(),
                }
              })
            }
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={canRunBacktest}
          />

          {activeConversation.logicGraph && (
            <LogicGraphPreview
              graph={activeConversation.logicGraph}
              confirmDisabled={codegenBusy || activeConversation.logicGraph.status === 'confirmed'}
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
                  message: t('aiQuant.messages.confirmGenerate', {
                    defaultValue: 'Confirm code generation',
                  }),
                  params: currentParams,
                  sessionId: currentSessionId,
                  usePresetRules: false,
                  confirmGenerate: true,
                })
              }}
              onRevise={() => {
                updateActiveConversation(curr => ({
                  ...invalidateConversationPublication(curr, { markGraphDraft: true }),
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
              drawdownLimited
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
                  ...invalidateConversationPublication(curr, { markGraphDraft: true }),
                  messages: [...curr.messages, optimizeMessage],
                  updatedAt: Date.now(),
                }))
              }}
              onDeploy={() => {
                setDeployRequestId(createDeployRequestId())
                setDeployOpen(true)
              }}
            />
          )}
        </div>
      </div>

      <DeployDialog
        open={deployOpen}
        onClose={() => {
          if (deploySubmitting) {
            return
          }
          setDeployOpen(false)
          setDeployRequestId(null)
        }}
        canDeploy={canDeploy}
        deploySubmitting={deploySubmitting}
        apiConfigured={apiConfigured}
        exchange={selectedDeployExchange}
        accounts={deployAccounts}
        selectedAccountId={selectedDeployAccountId}
        onSelectExchange={nextExchange => {
          if (nextExchange !== 'binance' && nextExchange !== 'okx') {
            return
          }
          setSelectedDeployExchange(nextExchange)
          setSelectedDeployAccountId('')
        }}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={async () => {
          if (deploySubmitting) {
            return
          }
          const account = deployAccounts.find(item => item.accountId === selectedDeployAccountId)
          if (!account || !activeConversation.backtestResult || !session?.userId) return

          const strategyName =
            activeConversation.title ||
            t('aiQuant.defaultStrategyName', { defaultValue: 'AI Strategy' })
          const timeframe = `${activeConversation.params.buyWindowMin}m/${activeConversation.params.sellWindowMin}m`
          const requestId = deployRequestId ?? createDeployRequestId()
          if (!deployRequestId) {
            setDeployRequestId(requestId)
          }

          try {
            setDeploySubmitting(true)
            await deployAccountAiQuantStrategy({
              userId: session.userId,
              name: strategyName,
              deployRequestId: requestId,
              exchange: selectedDeployExchange,
              symbol: activeConversation.params.symbol,
              timeframe,
              positionPct: activeConversation.params.positionPct,
              strategyInstanceId: activeConversation.publishedStrategyInstanceId ?? undefined,
              exchangeAccountId: account.accountId,
              exchangeAccountName: account.accountName,
            })
            setDeployOpen(false)
            setDeployRequestId(null)
            updateActiveConversation(curr => ({
              ...curr,
              messages: [
                ...curr.messages,
                {
                  id: `deploy-ok-${Date.now()}`,
                  role: 'assistant',
                  content: t('aiQuant.messages.deploySuccess', {
                    exchange: selectedDeployExchange.toUpperCase(),
                    account: account.accountName,
                  }),
                },
              ],
              updatedAt: Date.now(),
            }))
          } catch (error) {
            const deployErrorMessage = extractCodegenErrorMessage(
              error,
              t('aiQuant.messages.deployFailedFallback', {
                defaultValue: 'Strategy deployment failed. Please try again later.',
              }),
            )
            updateActiveConversation(curr => ({
              ...curr,
              messages: [
                ...curr.messages,
                {
                  id: `deploy-fail-${Date.now()}`,
                  role: 'assistant',
                  content: t('aiQuant.messages.deployFailedWithReason', {
                    reason: deployErrorMessage,
                    defaultValue: `Strategy deployment failed: ${deployErrorMessage}`,
                  }),
                },
              ],
              updatedAt: Date.now(),
            }))
            throw error instanceof ApiError
              ? error
              : new ApiError(deployErrorMessage, 'AI_QUANT_DEPLOY_FAILED', 500, { error })
          } finally {
            setDeploySubmitting(false)
          }
        }}
        lng={lng}
      />
    </main>
  )
}
