import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import type { BacktestRangeInput } from '@/components/ai-quant/backtest-range'
import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import type {
  LlmClarificationGate,
  LlmPublicationGate,
  LlmSemanticGraph,
  LlmSemanticGraphValidationReport,
  UserExchangeAccountStatus,
} from '@/lib/api'

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

export const DEFAULT_PARAMS: QuantParams = {
  exchange: 'binance',
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  buyWindowMin: 3,
  buyDropPct: 1,
  sellWindowMin: 15,
  sellRisePct: 2,
  positionPct: 10,
}

export const DEFAULT_PARAM_SCHEMA: Record<string, unknown> = {
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

export const DEFAULT_PARAM_VALUES: Record<string, unknown> = { ...DEFAULT_PARAMS }
export const CONVERSATIONS_STORAGE_KEY = 'ai_quant_conversations_v1'

interface PersistedConversationEnvelope {
  version: string
  conversations: ConversationState[]
}

export interface ConversationState {
  id: string
  title: string
  messages: QuantMessage[]
  params: QuantParams
  paramSchema: Record<string, unknown> | null
  paramValues: Record<string, unknown>
  backtestResult: BacktestResult | null
  logicGraph: StrategyLogicGraph | null
  codegenSpecDesc: Record<string, unknown> | null
  semanticGraph: LlmSemanticGraph | null
  validationReport: LlmSemanticGraphValidationReport | null
  clarificationGate: LlmClarificationGate | null
  publicationGate: LlmPublicationGate | null
  pendingCanonicalDigest: string | null
  llmCodegenSessionId: string | null
  publishedStrategyInstanceId: string | null
  publishedSnapshotId: string | null
  publishedScriptCode: string | null
  publishedScriptGraphVersion: number | null
  latestSignalMessage: string | null
  backtestExecutionConfigExplicit?: boolean
  backtestExecutionState: 'idle' | 'submitting' | 'running' | 'succeeded' | 'failed' | 'timeout'
  updatedAt: number
}

export function normalizeClarificationGate(input: unknown): LlmClarificationGate | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const gate = input as Record<string, unknown>
  const items = Array.isArray(gate.items)
    ? gate.items
    : (Array.isArray(gate.pendingItems) ? gate.pendingItems : [])

  return {
    blocked: gate.blocked === true || items.length > 0,
    items: items as LlmClarificationGate['items'],
    pendingItems: items as LlmClarificationGate['items'],
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
const NON_STRATEGY_PARAM_KEYS = new Set([
  'backtestRangePreset',
  'backtestStart',
  'backtestEnd',
  'backtestInitialCash',
  'backtestLeverage',
  'backtestSlippageBps',
  'backtestFeeBps',
  'backtestPriceSource',
  'backtestAllowPartial',
])
export const BACKTEST_EXECUTION_PARAM_KEYS = [
  'backtestInitialCash',
  'backtestLeverage',
  'backtestSlippageBps',
  'backtestFeeBps',
  'backtestPriceSource',
  'backtestAllowPartial',
] as const
export const BACKTEST_EXECUTION_PARAM_KEY_SET = new Set<string>(BACKTEST_EXECUTION_PARAM_KEYS)
const LEGACY_IMPLICIT_BACKTEST_PARAM_VALUES = {
  backtestInitialCash: 10000,
  backtestLeverage: 1,
  backtestSlippageBps: 10,
  backtestFeeBps: 5,
  backtestPriceSource: 'close',
  backtestAllowPartial: true,
} as const

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function normalizeParamsFromValues(
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

export function buildParamSchemaWithCapabilities(
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

export function normalizePublishedScriptCode(scriptCode: unknown): string | null {
  if (typeof scriptCode !== 'string') {
    return null
  }
  const normalized = scriptCode.trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizePublishedSnapshotId(snapshotId: unknown): string | null {
  if (typeof snapshotId !== 'string') {
    return null
  }
  const normalized = snapshotId.trim()
  return normalized.length > 0 ? normalized : null
}

export function extractLatestScriptCode(messages: QuantMessage[]): string {
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

export function resolveHydratedPublishedScriptCode(item: Partial<ConversationState>): string | null {
  const explicitScriptCode = normalizePublishedScriptCode(item.publishedScriptCode)
  if (explicitScriptCode) {
    return explicitScriptCode
  }
  if (item.logicGraph?.status !== 'confirmed') {
    return null
  }
  return normalizePublishedScriptCode(extractLatestScriptCode(item.messages ?? []))
}

export function hasLatestPublishedCode(
  conversation: ConversationState | null | undefined,
): boolean {
  if (!conversation?.logicGraph) {
    return false
  }
  if (conversation.publishedScriptGraphVersion !== conversation.logicGraph.version) {
    return false
  }
  return typeof conversation.publishedSnapshotId === 'string'
    && conversation.publishedSnapshotId.trim().length > 0
}

export function invalidateConversationPublication(
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
    clarificationGate: null,
    publicationGate: null,
    publishedStrategyInstanceId: null,
    publishedSnapshotId: null,
    publishedScriptCode: null,
    publishedScriptGraphVersion: null,
    pendingCanonicalDigest: null,
    backtestResult: null,
    latestSignalMessage: null,
    backtestExecutionState: 'idle',
  }
}

export function normalizeHydratedBacktestExecutionState(
  state: ConversationState['backtestExecutionState'] | undefined,
): ConversationState['backtestExecutionState'] {
  if (!state || TRANSIENT_BACKTEST_STATES.has(state)) {
    return 'idle'
  }
  return state
}

export function resolveBacktestRangeInput(values: Record<string, unknown>): BacktestRangeInput {
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

export function shouldInvalidatePublicationForParamChange(key: string): boolean {
  return !NON_STRATEGY_PARAM_KEYS.has(key)
}

function stripBacktestExecutionParamValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const nextValues = { ...values }
  BACKTEST_EXECUTION_PARAM_KEYS.forEach((key) => {
    delete nextValues[key]
  })
  return nextValues
}

function hasLegacyImplicitBacktestExecutionConfig(
  values: Record<string, unknown>,
): boolean {
  return BACKTEST_EXECUTION_PARAM_KEYS.every(
    key => values[key] === LEGACY_IMPLICIT_BACKTEST_PARAM_VALUES[key],
  )
}

function normalizeHydratedBacktestExecutionConfig(input: {
  paramValues: Record<string, unknown>
  explicit: boolean
}): {
  paramValues: Record<string, unknown>
  explicit: boolean
} {
  if (input.explicit) {
    return input
  }

  if (!hasLegacyImplicitBacktestExecutionConfig(input.paramValues)) {
    return input
  }

  return {
    paramValues: stripBacktestExecutionParamValues(input.paramValues),
    explicit: false,
  }
}

export function buildBacktestSummaryResult(
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

export function mapExchangeStatusesToDeployAccounts(
  items: UserExchangeAccountStatus[],
): DeployExchangeAccount[] {
  return items
    .filter(item => item.isBound && typeof item.id === 'string' && item.id.trim().length > 0)
    .map(item => ({
      accountId: item.id as string,
      exchange: item.exchangeId,
      accountName: item.name?.trim() || item.exchangeId.toUpperCase(),
      apiKeyMask: item.maskedCredential?.trim() || '****',
      status: 'available' as const,
    }))
}

export function buildApiConfigHref(lng: 'zh' | 'en') {
  return `/${lng}/account?tab=ai-quant#exchange-api`
}

export function createConversation(translate: (key: string) => string, now = Date.now()): ConversationState {
  return {
    id: `conv-${now}-${Math.random().toString(16).slice(2, 8)}`,
    title: translate('aiQuant.newChat'),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: translate('aiQuant.messages.welcome'),
      },
    ],
    params: DEFAULT_PARAMS,
    paramSchema: buildParamSchemaWithCapabilities(null),
    paramValues: { ...DEFAULT_PARAM_VALUES },
    backtestResult: null,
    logicGraph: null,
    codegenSpecDesc: null,
    semanticGraph: null,
    validationReport: null,
    clarificationGate: null,
    publicationGate: null,
    pendingCanonicalDigest: null,
    llmCodegenSessionId: null,
    publishedStrategyInstanceId: null,
    publishedSnapshotId: null,
    publishedScriptCode: null,
    publishedScriptGraphVersion: null,
    latestSignalMessage: null,
    backtestExecutionConfigExplicit: false,
    backtestExecutionState: 'idle',
    updatedAt: now,
  }
}

export function hydrateConversation(item: Partial<ConversationState>): ConversationState {
  const baseParams =
    item.params && typeof item.params === 'object' && !Array.isArray(item.params)
      ? (item.params as unknown as Record<string, unknown>)
      : {}
  const storedValues =
    item.paramValues && typeof item.paramValues === 'object' && !Array.isArray(item.paramValues)
      ? item.paramValues
      : {}
  const nextParamValues = {
    ...DEFAULT_PARAM_VALUES,
    ...baseParams,
    ...storedValues,
  }
  const normalizedBacktestExecutionConfig = normalizeHydratedBacktestExecutionConfig({
    paramValues: nextParamValues,
    explicit: item.backtestExecutionConfigExplicit === true,
  })
  const fallbackParams =
    item.params && typeof item.params === 'object' && !Array.isArray(item.params)
      ? normalizeParamsFromValues(baseParams, DEFAULT_PARAMS)
      : DEFAULT_PARAMS
  const nextParams = normalizeParamsFromValues(
    normalizedBacktestExecutionConfig.paramValues,
    fallbackParams,
  )

  return {
    id: item.id ?? `conv-${Date.now()}`,
    title: item.title ?? '',
    messages: Array.isArray(item.messages) ? item.messages : [],
    params: nextParams,
    paramSchema: item.paramSchema ?? buildParamSchemaWithCapabilities(null, nextParams.symbol),
    paramValues: normalizedBacktestExecutionConfig.paramValues,
    backtestResult: item.backtestResult ?? null,
    logicGraph: item.logicGraph ?? null,
    codegenSpecDesc:
      item.codegenSpecDesc && typeof item.codegenSpecDesc === 'object' && !Array.isArray(item.codegenSpecDesc)
        ? item.codegenSpecDesc
        : null,
    semanticGraph:
      item.semanticGraph && typeof item.semanticGraph === 'object' && !Array.isArray(item.semanticGraph)
        ? item.semanticGraph
        : null,
    validationReport:
      item.validationReport
      && typeof item.validationReport === 'object'
      && !Array.isArray(item.validationReport)
        ? item.validationReport
        : null,
    clarificationGate: normalizeClarificationGate(item.clarificationGate),
    publicationGate:
      item.publicationGate && typeof item.publicationGate === 'object' && !Array.isArray(item.publicationGate)
        ? item.publicationGate as LlmPublicationGate
        : null,
    pendingCanonicalDigest:
      typeof item.pendingCanonicalDigest === 'string' && item.pendingCanonicalDigest.trim()
        ? item.pendingCanonicalDigest.trim()
        : null,
    llmCodegenSessionId: item.llmCodegenSessionId ?? null,
    publishedStrategyInstanceId: item.publishedStrategyInstanceId ?? null,
    publishedSnapshotId: normalizePublishedSnapshotId(item.publishedSnapshotId),
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
    backtestExecutionConfigExplicit: normalizedBacktestExecutionConfig.explicit,
    backtestExecutionState: normalizeHydratedBacktestExecutionState(item.backtestExecutionState),
    updatedAt: item.updatedAt ?? Date.now(),
  }
}

export function hydrateConversations(
  raw: string | null,
  translate: (key: string) => string,
): ConversationState[] {
  if (!raw) {
    return [createConversation(translate)]
  }

  try {
    const parsed = JSON.parse(raw) as ConversationState[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('invalid conversation payload')
    }
    return parsed.map(item => hydrateConversation(item))
  } catch {
    return [createConversation(translate)]
  }
}

function normalizeConversationStorageVersion(version: string): string {
  const normalized = version.trim()
  return normalized.length > 0 ? normalized : 'unknown'
}

export function serializePersistedConversations(
  conversations: ConversationState[],
  version: string,
): string {
  const envelope: PersistedConversationEnvelope = {
    version: normalizeConversationStorageVersion(version),
    conversations,
  }
  return JSON.stringify(envelope)
}

export function readPersistedConversations(input: {
  raw: string | null
  translate: (key: string) => string
  version: string
}): {
  conversations: ConversationState[]
  shouldPersist: boolean
} {
  const { raw, translate, version } = input
  const fallback = [createConversation(translate)]
  if (!raw) {
    return {
      conversations: fallback,
      shouldPersist: false,
    }
  }

  try {
    const parsed = JSON.parse(raw) as ConversationState[] | PersistedConversationEnvelope

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        throw new Error('empty legacy conversations')
      }
      return {
        conversations: parsed.map(item => hydrateConversation(item)),
        shouldPersist: true,
      }
    }

    const storedVersion =
      typeof parsed?.version === 'string'
        ? normalizeConversationStorageVersion(parsed.version)
        : null
    const normalizedVersion = normalizeConversationStorageVersion(version)
    const storedConversations = Array.isArray(parsed?.conversations)
      ? parsed.conversations
      : null

    if (!storedVersion || !storedConversations || storedConversations.length === 0) {
      throw new Error('invalid conversation envelope')
    }

    if (storedVersion !== normalizedVersion) {
      return {
        conversations: fallback,
        shouldPersist: true,
      }
    }

    return {
      conversations: storedConversations.map(item => hydrateConversation(item)),
      shouldPersist: false,
    }
  } catch {
    return {
      conversations: fallback,
      shouldPersist: true,
    }
  }
}
