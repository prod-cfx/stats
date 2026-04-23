import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import type { BacktestRangeInput } from '@/components/ai-quant/backtest-range'
import type { BacktestResult } from '@/components/ai-quant/BacktestSummaryCard'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { DisplayLogicGraph } from '@/components/ai-quant/display-logic-graph'
import type { StrategyLogicGraph } from '@/components/ai-quant/logic-graph-model'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import type {
  AccountAiQuantBacktestConfigDefaults,
  AccountAiQuantDeploymentExecutionConfig,
  AccountAiQuantDeploymentExecutionConstraints,
  AiQuantConversationLastBacktestRef,
  AccountAiQuantLeverageRange,
  AccountAiQuantPublishedStrategyConfig,
  AccountAiQuantSnapshotCompatibilityMetadata,
  AiQuantConversationResponse,
  LlmClarificationGate,
  LlmPublicationGate,
  LlmSemanticGraph,
  LlmSemanticGraphValidationReport,
  UserExchangeAccountStatus,
} from '@/lib/api'
import { readCanonicalDigest } from '@/components/ai-quant/canonical-confirmation'
import { buildDisplayLogicGraphFromCodegenSpec } from '@/components/ai-quant/display-logic-graph'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import { syncStrategyParamsFromCodegen } from '@/components/ai-quant/strategy-param-sync'

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
export const AI_QUANT_PERSISTED_SCHEMA_VERSION = 2
export const STALE_CONVERSATION_RECOVERY_MESSAGE_KEY = 'aiQuant.messages.staleConversationRecovered'

interface PersistedConversationEnvelope {
  version: string
  conversations: ConversationState[]
}

export interface ConversationState {
  id: string
  serverConversationId?: string | null
  schemaVersion: number
  title: string
  messages: QuantMessage[]
  params: QuantParams
  paramSchema: Record<string, unknown> | null
  paramValues: Record<string, unknown>
  backtestResult: BacktestResult | null
  logicGraph: StrategyLogicGraph | null
  displayLogicGraph: DisplayLogicGraph | null
  codegenSpecDesc: Record<string, unknown> | null
  semanticGraph: LlmSemanticGraph | null
  validationReport: LlmSemanticGraphValidationReport | null
  clarificationGate: LlmClarificationGate | null
  publicationGate: LlmPublicationGate | null
  pendingCanonicalDigest: string | null
  llmCodegenSessionId: string | null
  publishedStrategyInstanceId: string | null
  publishedSnapshotId: string | null
  publishedSnapshotParamValues: Record<string, unknown> | null
  publishedSnapshotStrategyConfig: AccountAiQuantPublishedStrategyConfig | null
  publishedSnapshotBacktestConfigDefaults: AccountAiQuantBacktestConfigDefaults | null
  publishedSnapshotDeploymentExecutionDefaults: AccountAiQuantDeploymentExecutionConfig | null
  publishedSnapshotDeploymentExecutionConstraints: AccountAiQuantDeploymentExecutionConstraints | null
  publishedSnapshotCompatibilityMetadata: AccountAiQuantSnapshotCompatibilityMetadata | null
  publishedScriptCode: string | null
  publishedScriptGraphVersion: number | null
  latestSignalMessage: string | null
  backtestExecutionConfigExplicit?: boolean
  backtestExecutionState: 'idle' | 'submitting' | 'running' | 'succeeded' | 'failed' | 'timeout'
  updatedAt: number
}

export type ConversationIntegrityIssue =
  | 'clarification_blocked'
  | 'digest_mismatch'
  | 'publication_mismatch'

export function normalizeClarificationGate(input: unknown): LlmClarificationGate | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const gate = input as Record<string, unknown>
  const items = Array.isArray(gate.items)
    ? gate.items
    : (Array.isArray(gate.pendingItems) ? gate.pendingItems : [])
  const summary = typeof gate.summary === 'string' && gate.summary.trim()
    ? gate.summary.trim()
    : null

  return {
    blocked: gate.blocked === true || items.length > 0,
    summary,
    items: items as LlmClarificationGate['items'],
    pendingItems: items as LlmClarificationGate['items'],
  }
}

type DisplayBlockType = DisplayLogicGraph['blocks'][number]['type']
type DisplayItemKind = DisplayLogicGraph['blocks'][number]['items'][number]['kind']

const VALID_DISPLAY_BLOCK_TYPES = new Set<DisplayBlockType>(['IF', 'AND_AT_THEN', 'OR_THEN', 'EXECUTE'])
const VALID_DISPLAY_ITEM_KINDS = new Set<DisplayItemKind>(['condition', 'action', 'execute'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeDisplayLogicGraphItem(item: unknown): DisplayLogicGraph['blocks'][number]['items'][number] | null {
  if (!isRecord(item)) {
    return null
  }

  const kind = typeof item.kind === 'string' ? item.kind : ''
  if (!VALID_DISPLAY_ITEM_KINDS.has(kind as DisplayItemKind)) {
    return null
  }

  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : ''
  const text = typeof item.text === 'string' && item.text.trim() ? item.text.trim() : ''
  if (!id || !text) {
    return null
  }

  if (kind === 'execute') {
    const key = typeof item.key === 'string' && item.key.trim() ? item.key.trim() : ''
    if (!key) {
      return null
    }
    const executeItem: DisplayLogicGraph['blocks'][number]['items'][number] = {
      kind: 'execute',
      id,
      key,
      text,
    }
    if (typeof item.value === 'string' && item.value.trim()) {
      executeItem.value = item.value.trim()
    }
    return executeItem
  }

  return {
    kind: kind as 'condition' | 'action',
    id,
    text,
  }
}

function normalizeDisplayLogicGraph(value: unknown): DisplayLogicGraph | null {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    return null
  }

  const blocks = value.blocks.map((block): DisplayLogicGraph['blocks'][number] | null => {
    if (!isRecord(block)) {
      return null
    }
    const type = typeof block.type === 'string' ? block.type : ''
    if (!VALID_DISPLAY_BLOCK_TYPES.has(type as DisplayBlockType)) {
      return null
    }
    if (!Array.isArray(block.items)) {
      return null
    }

    const items = block.items.map(normalizeDisplayLogicGraphItem)
    if (items.includes(null)) {
      return null
    }

    return {
      type: type as DisplayLogicGraph['blocks'][number]['type'],
      items: items as DisplayLogicGraph['blocks'][number]['items'],
    }
  })

  if (blocks.includes(null)) {
    return null
  }

  return {
    blocks: blocks as DisplayLogicGraph['blocks'],
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
])
export const BACKTEST_RANGE_PARAM_KEYS = [
  'backtestRangePreset',
  'backtestStart',
  'backtestEnd',
] as const
export const BACKTEST_RANGE_PARAM_KEY_SET = new Set<string>(BACKTEST_RANGE_PARAM_KEYS)
export const BACKTEST_EXECUTION_PARAM_KEYS = [
  'backtestInitialCash',
  'backtestLeverage',
  'backtestSlippageBps',
  'backtestFeeBps',
  'backtestPriceSource',
  'backtestAllowPartial',
] as const
export const BACKTEST_EXECUTION_PARAM_KEY_SET = new Set<string>(BACKTEST_EXECUTION_PARAM_KEYS)
export type BacktestExecutionPriceSource = 'open' | 'close' | 'mid'

export interface ResolvedBacktestExecutionConfig {
  initialCash: number
  leverage: number | null
  slippageBps: number
  feeBps: number
  priceSource: string
  allowPartial: boolean
  allowPartialValid: boolean
}

export const DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES = {
  backtestInitialCash: 10000,
  backtestLeverage: 1,
  backtestSlippageBps: 10,
  backtestFeeBps: 5,
  backtestPriceSource: 'close',
  backtestAllowPartial: true,
} as const

export function hasExplicitBacktestExecutionOverrides(values: Record<string, unknown>): boolean {
  return BACKTEST_EXECUTION_PARAM_KEYS.some(
    key => values[key] !== DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES[key],
  )
}

function parseBacktestExecutionNumber(
  value: unknown,
  _fallback: number,
): number {
  if (value === undefined || value === null) {
    return Number.NaN
  }
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    if (!value.trim()) {
      return Number.NaN
    }
    return Number(value)
  }
  return Number.NaN
}

function resolveBacktestExecutionPriceSource(
  value: unknown,
  _fallback: BacktestExecutionPriceSource,
): string {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  return String(value)
}

function resolveBacktestAllowPartial(
  value: unknown,
  fallback: boolean,
): { value: boolean, valid: boolean } {
  if (value === undefined || value === null) {
    return { value: fallback, valid: false }
  }
  if (typeof value === 'boolean') {
    return { value, valid: true }
  }
  if (value === 'true') {
    return { value: true, valid: true }
  }
  if (value === 'false') {
    return { value: false, valid: true }
  }
  return { value: fallback, valid: false }
}

export function resolveBacktestExecutionConfig(
  values: Record<string, unknown>,
): ResolvedBacktestExecutionConfig {
  const allowPartial = resolveBacktestAllowPartial(
    values.backtestAllowPartial,
    DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestAllowPartial,
  )

  return {
    initialCash: parseBacktestExecutionNumber(
      values.backtestInitialCash,
      DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestInitialCash,
    ),
    leverage: (() => {
      const leverage = parseBacktestExecutionNumber(
        values.backtestLeverage,
        DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestLeverage,
      )
      return Number.isFinite(leverage) ? leverage : null
    })(),
    slippageBps: parseBacktestExecutionNumber(
      values.backtestSlippageBps,
      DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestSlippageBps,
    ),
    feeBps: parseBacktestExecutionNumber(
      values.backtestFeeBps,
      DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestFeeBps,
    ),
    priceSource: resolveBacktestExecutionPriceSource(
      values.backtestPriceSource,
      DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES.backtestPriceSource,
    ),
    allowPartial: allowPartial.value,
    allowPartialValid: allowPartial.valid,
  }
}

function normalizeLeverageRange(
  value: unknown,
): AccountAiQuantLeverageRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const min = typeof candidate.min === 'number' ? candidate.min : Number(candidate.min)
  const max = typeof candidate.max === 'number' ? candidate.max : Number(candidate.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    return null
  }
  return { min, max }
}

function normalizePublishedStrategyConfig(
  value: unknown,
): AccountAiQuantPublishedStrategyConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const marketType =
    typeof candidate.marketType === 'string'
      ? candidate.marketType.trim().toLowerCase()
      : ''
  return {
    exchange: typeof candidate.exchange === 'string' ? candidate.exchange : null,
    symbol: typeof candidate.symbol === 'string' ? candidate.symbol : null,
    ...(marketType === 'spot' || marketType === 'perp' ? { marketType } : {}),
    baseTimeframe:
      typeof candidate.baseTimeframe === 'string'
        ? candidate.baseTimeframe
        : typeof candidate.timeframe === 'string'
          ? candidate.timeframe
          : null,
    positionPct:
      typeof candidate.positionPct === 'number'
        ? candidate.positionPct
        : typeof candidate.positionPct === 'string'
          ? Number(candidate.positionPct)
          : null,
    strategyDeclaredLeverageRange: normalizeLeverageRange(candidate.strategyDeclaredLeverageRange),
  }
}

function normalizeBacktestConfigDefaults(
  value: unknown,
): AccountAiQuantBacktestConfigDefaults | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const initialCash = parseBacktestExecutionNumber(candidate.initialCash, 0)
  const leverage = parseBacktestExecutionNumber(candidate.leverage, 0)
  const slippageBps = parseBacktestExecutionNumber(candidate.slippageBps, 0)
  const feeBps = parseBacktestExecutionNumber(candidate.feeBps, 0)
  const priceSource =
    typeof candidate.priceSource === 'string' ? candidate.priceSource.trim() : null
  const allowPartial =
    typeof candidate.allowPartial === 'boolean'
      ? candidate.allowPartial
      : candidate.allowPartial === 'true'
        ? true
        : candidate.allowPartial === 'false'
          ? false
          : null
  const stateTimeframes = Array.isArray(candidate.stateTimeframes)
    ? candidate.stateTimeframes
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(item => item.length > 0)
    : null
  if (
    !Number.isFinite(initialCash)
    || !Number.isFinite(slippageBps)
    || !Number.isFinite(feeBps)
    || !priceSource
  ) {
    return null
  }
  return {
    initialCash,
    leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : null,
    slippageBps,
    feeBps,
    priceSource,
    allowPartial,
    ...(stateTimeframes ? { stateTimeframes } : {}),
  }
}

function normalizeDeploymentExecutionConfig(
  value: unknown,
): AccountAiQuantDeploymentExecutionConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const leverage = parseBacktestExecutionNumber(candidate.leverage, 0)
  return {
    leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : null,
    priceSource: typeof candidate.priceSource === 'string' ? candidate.priceSource.trim() : null,
    orderType: typeof candidate.orderType === 'string' ? candidate.orderType.trim() : null,
    timeInForce: typeof candidate.timeInForce === 'string' ? candidate.timeInForce.trim() : null,
  }
}

function normalizeDeploymentExecutionConstraints(
  value: unknown,
): AccountAiQuantDeploymentExecutionConstraints | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  return {
    effectiveAllowedLeverageRange: normalizeLeverageRange(candidate.effectiveAllowedLeverageRange),
    exchangeAccountCapabilityMaxLeverage: parseBacktestExecutionNumber(candidate.exchangeAccountCapabilityMaxLeverage, 0),
    platformRiskMaxLeverage: parseBacktestExecutionNumber(candidate.platformRiskMaxLeverage, 0),
    strategyDeclaredLeverageRange: normalizeLeverageRange(candidate.strategyDeclaredLeverageRange),
    supportedPriceSources: Array.isArray(candidate.supportedPriceSources)
      ? candidate.supportedPriceSources.filter(item => typeof item === 'string')
      : null,
    supportedOrderTypes: Array.isArray(candidate.supportedOrderTypes)
      ? candidate.supportedOrderTypes.filter(item => typeof item === 'string')
      : null,
    supportedTimeInForce: Array.isArray(candidate.supportedTimeInForce)
      ? candidate.supportedTimeInForce.filter(item => typeof item === 'string')
      : null,
    constraintExplanation:
      typeof candidate.constraintExplanation === 'string' ? candidate.constraintExplanation : null,
  }
}

function normalizeSnapshotCompatibilityMetadata(
  value: unknown,
): AccountAiQuantSnapshotCompatibilityMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  return {
    isLegacySnapshot: candidate.isLegacySnapshot === true,
    missingBacktestConfigDefaults: candidate.missingBacktestConfigDefaults === true,
    missingDeploymentExecutionDefaults: candidate.missingDeploymentExecutionDefaults === true,
    missingDeploymentExecutionConstraints: candidate.missingDeploymentExecutionConstraints === true,
    requiresRepublishForBacktest: candidate.requiresRepublishForBacktest === true,
    requiresRepublishForDeploy: candidate.requiresRepublishForDeploy === true,
  }
}

export function normalizePublishedSnapshotParamValues(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const normalized = { ...(value as Record<string, unknown>) }
  const timeframe = typeof normalized.timeframe === 'string' ? normalized.timeframe.trim() : ''
  const baseTimeframe = typeof normalized.baseTimeframe === 'string' ? normalized.baseTimeframe.trim() : ''
  if (timeframe && !baseTimeframe) {
    normalized.baseTimeframe = timeframe
  }
  return normalized
}

function normalizeComparableParamValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeComparableParamValue(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, normalizeComparableParamValue(item)]),
    )
  }
  return value
}

export function requiresRepublishForPublishedSnapshot(input: {
  publishedSnapshotId: string | null
  publishedSnapshotParamValues: Record<string, unknown> | null
  publishedSnapshotCompatibilityMetadata?: AccountAiQuantSnapshotCompatibilityMetadata | null
  editableParamValues: Record<string, unknown>
}): boolean {
  const {
    publishedSnapshotId,
    publishedSnapshotParamValues,
    publishedSnapshotCompatibilityMetadata,
    editableParamValues,
  } = input

  if (!publishedSnapshotId) {
    return false
  }
  if (publishedSnapshotCompatibilityMetadata?.requiresRepublishForBacktest) {
    return true
  }
  if (!publishedSnapshotParamValues) {
    return true
  }

  for (const key of Object.keys(editableParamValues)) {
    if (BACKTEST_RANGE_PARAM_KEY_SET.has(key) || BACKTEST_EXECUTION_PARAM_KEY_SET.has(key)) {
      continue
    }
    if (!(key in publishedSnapshotParamValues)) {
      continue
    }

    const snapshotValue = normalizeComparableParamValue(publishedSnapshotParamValues[key])
    const editableValue = normalizeComparableParamValue(editableParamValues[key])
    if (JSON.stringify(snapshotValue ?? null) !== JSON.stringify(editableValue ?? null)) {
      return true
    }
  }

  return false
}

export interface EffectivePublishedBacktestInputs {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  marketType: 'spot' | 'perp'
  baseTimeframe: string
}

export function resolvePublishedBacktestMarketType(input: {
  publishedSnapshotId: string | null
  publishedSnapshotStrategyConfig: AccountAiQuantPublishedStrategyConfig | null
}): 'spot' | 'perp' | null {
  const {
    publishedSnapshotId,
    publishedSnapshotStrategyConfig,
  } = input
  if (!publishedSnapshotId || !publishedSnapshotStrategyConfig) {
    return null
  }

  return publishedSnapshotStrategyConfig.marketType ?? null
}

export function resolveEffectivePublishedBacktestInputs(input: {
  publishedSnapshotId: string | null
  publishedSnapshotStrategyConfig: AccountAiQuantPublishedStrategyConfig | null
}): EffectivePublishedBacktestInputs | null {
  const {
    publishedSnapshotId,
    publishedSnapshotStrategyConfig,
  } = input
  if (!publishedSnapshotId || !publishedSnapshotStrategyConfig) {
    return null
  }

  const exchange =
    publishedSnapshotStrategyConfig.exchange === 'okx'
      ? 'okx'
      : publishedSnapshotStrategyConfig.exchange === 'hyperliquid'
        ? 'hyperliquid'
        : publishedSnapshotStrategyConfig.exchange === 'binance'
          ? 'binance'
          : null
  const symbol =
    typeof publishedSnapshotStrategyConfig.symbol === 'string'
      ? publishedSnapshotStrategyConfig.symbol.trim()
      : ''
  const marketType = resolvePublishedBacktestMarketType(input)
  const baseTimeframe =
    typeof publishedSnapshotStrategyConfig.baseTimeframe === 'string'
      ? publishedSnapshotStrategyConfig.baseTimeframe.trim()
      : ''

  if (!exchange || !symbol || !marketType || !baseTimeframe) {
    return null
  }

  return {
    exchange,
    symbol,
    marketType,
    baseTimeframe,
  }
}

function mergeSnapshotBoundParamValues(input: {
  currentValues: Record<string, unknown>
  snapshotParamValues: Record<string, unknown> | null
  snapshotBacktestConfigDefaults?: AccountAiQuantBacktestConfigDefaults | null
}): {
  paramValues: Record<string, unknown>
  explicit: boolean
} {
  const { currentValues, snapshotParamValues, snapshotBacktestConfigDefaults } = input
  const snapshotBacktestExecutionParamValues =
    snapshotBacktestConfigDefaults
      ? {
          backtestInitialCash: snapshotBacktestConfigDefaults.initialCash,
          ...(typeof snapshotBacktestConfigDefaults.leverage === 'number'
            ? { backtestLeverage: snapshotBacktestConfigDefaults.leverage }
            : {}),
          backtestSlippageBps: snapshotBacktestConfigDefaults.slippageBps,
          backtestFeeBps: snapshotBacktestConfigDefaults.feeBps,
          backtestPriceSource: snapshotBacktestConfigDefaults.priceSource,
          backtestAllowPartial: snapshotBacktestConfigDefaults.allowPartial,
        }
      : null

  if (!snapshotParamValues && !snapshotBacktestExecutionParamValues) {
    return {
      paramValues: currentValues,
      explicit: hasExplicitBacktestExecutionOverrides(currentValues),
    }
  }

  const nextValues = {
    ...currentValues,
    ...(snapshotBacktestExecutionParamValues ?? {}),
    ...(snapshotParamValues ?? {}),
  }

  return {
    paramValues: nextValues,
    explicit: BACKTEST_EXECUTION_PARAM_KEYS.every(key => nextValues[key] !== undefined),
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
    symbolProperty.enum = [currentSymbol]
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

function normalizeLastBacktestRef(
  value: unknown,
): AiQuantConversationLastBacktestRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.jobId !== 'string'
    || !candidate.jobId.trim()
    || typeof candidate.publishedSnapshotId !== 'string'
    || !candidate.publishedSnapshotId.trim()
    || typeof candidate.completedAt !== 'string'
    || !candidate.completedAt.trim()
    || !candidate.summary
    || typeof candidate.summary !== 'object'
    || Array.isArray(candidate.summary)
  ) {
    return null
  }

  const summary = candidate.summary as Record<string, unknown>
  if (
    typeof summary.maxDrawdownPct !== 'number'
    || typeof summary.totalReturnPct !== 'number'
    || typeof summary.winRatePct !== 'number'
    || typeof summary.tradeCount !== 'number'
  ) {
    return null
  }

  const config = normalizeLastBacktestConfig(candidate.config)
  if (!config) {
    return null
  }

  return {
    jobId: candidate.jobId.trim(),
    publishedSnapshotId: candidate.publishedSnapshotId.trim(),
    config,
    summary: {
      maxDrawdownPct: summary.maxDrawdownPct,
      totalReturnPct: summary.totalReturnPct,
      winRatePct: summary.winRatePct,
      tradeCount: summary.tradeCount,
      ...(typeof summary.openTradeCount === 'number' ? { openTradeCount: summary.openTradeCount } : {}),
      ...(typeof summary.openPnl === 'number' ? { openPnl: summary.openPnl } : {}),
      ...(summary.marketType === 'spot' || summary.marketType === 'perp'
        ? { marketType: summary.marketType }
        : {}),
    },
    completedAt: candidate.completedAt.trim(),
  }
}

function normalizeLastBacktestConfig(
  value: unknown,
): AiQuantConversationLastBacktestRef['config'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const range = normalizeLastBacktestRangeConfig(candidate.range)
  const execution = normalizeLastBacktestExecutionConfig(candidate.execution)

  if (!range || !execution) {
    return null
  }

  return { range, execution }
}

function normalizeLastBacktestRangeConfig(
  value: unknown,
): AiQuantConversationLastBacktestRef['config']['range'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const preset =
    typeof candidate.preset === 'string'
      ? candidate.preset.trim().toUpperCase()
      : ''

  if (
    preset !== '7D'
    && preset !== '30D'
    && preset !== '90D'
    && preset !== '1Y'
    && preset !== 'CUSTOM'
  ) {
    return null
  }

  if (preset !== 'CUSTOM') {
    return { preset }
  }

  const startAt =
    typeof candidate.startAt === 'string' && candidate.startAt.trim()
      ? candidate.startAt.trim()
      : ''
  const endAt =
    typeof candidate.endAt === 'string' && candidate.endAt.trim()
      ? candidate.endAt.trim()
      : ''

  if (!startAt || !endAt) {
    return null
  }

  return {
    preset,
    startAt,
    endAt,
  }
}

function normalizeLastBacktestExecutionConfig(
  value: unknown,
): AiQuantConversationLastBacktestRef['config']['execution'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const initialCash = parseBacktestExecutionNumber(candidate.initialCash, 0)
  const leverage = parseBacktestExecutionNumber(candidate.leverage, 0)
  const slippageBps = parseBacktestExecutionNumber(candidate.slippageBps, 0)
  const feeBps = parseBacktestExecutionNumber(candidate.feeBps, 0)
  const priceSource =
    typeof candidate.priceSource === 'string'
      ? candidate.priceSource.trim()
      : ''
  const allowPartial =
    typeof candidate.allowPartial === 'boolean'
      ? candidate.allowPartial
      : candidate.allowPartial === 'true'
        ? true
        : candidate.allowPartial === 'false'
          ? false
          : null

  if (
    !Number.isFinite(initialCash)
    || !Number.isFinite(slippageBps)
    || !Number.isFinite(feeBps)
    || (priceSource !== 'open' && priceSource !== 'close' && priceSource !== 'mid')
    || allowPartial === null
  ) {
    return null
  }

  return {
    initialCash,
    leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : null,
    slippageBps,
    feeBps,
    priceSource,
    allowPartial,
  }
}

function buildComparableBacktestConfig(
  values: Record<string, unknown>,
  defaults?: AccountAiQuantBacktestConfigDefaults | null,
): AiQuantConversationLastBacktestRef['config'] | null {
  const range = resolveBacktestRangeInput(values)
  const execution = resolveBacktestExecutionConfig({
    ...(defaults
      ? {
          backtestInitialCash: defaults.initialCash,
          ...(typeof defaults.leverage === 'number' ? { backtestLeverage: defaults.leverage } : {}),
          backtestSlippageBps: defaults.slippageBps,
          backtestFeeBps: defaults.feeBps,
          ...(typeof defaults.priceSource === 'string' ? { backtestPriceSource: defaults.priceSource } : {}),
          ...(typeof defaults.allowPartial === 'boolean' ? { backtestAllowPartial: defaults.allowPartial } : {}),
        }
      : {}),
    ...values,
  })
  if (
    execution.priceSource !== 'open'
    && execution.priceSource !== 'close'
    && execution.priceSource !== 'mid'
  ) {
    return null
  }

  return {
    range:
      range.preset === 'CUSTOM'
        ? {
            preset: 'CUSTOM',
            startAt: range.startAt ?? '',
            endAt: range.endAt ?? '',
          }
        : { preset: range.preset },
    execution: {
      initialCash: execution.initialCash,
      leverage: execution.leverage,
      slippageBps: execution.slippageBps,
      feeBps: execution.feeBps,
      priceSource: execution.priceSource,
      allowPartial: execution.allowPartial,
    },
  }
}

function doesBacktestConfigMatch(
  current: AiQuantConversationLastBacktestRef['config'],
  stored: AiQuantConversationLastBacktestRef['config'],
): boolean {
  if (current.range.preset !== stored.range.preset) {
    return false
  }
  if (current.range.preset === 'CUSTOM') {
    if (current.range.startAt !== stored.range.startAt || current.range.endAt !== stored.range.endAt) {
      return false
    }
  }

  return (
    current.execution.initialCash === stored.execution.initialCash
    && current.execution.leverage === stored.execution.leverage
    && current.execution.slippageBps === stored.execution.slippageBps
    && current.execution.feeBps === stored.execution.feeBps
    && current.execution.priceSource === stored.execution.priceSource
    && current.execution.allowPartial === stored.execution.allowPartial
  )
}

function restoreBacktestResultFromLastBacktestRef(input: {
  conversationPublishedSnapshotId: string | null
  lastBacktestRef: AiQuantConversationLastBacktestRef | null
  currentBacktestConfig: AiQuantConversationLastBacktestRef['config'] | null
  symbol: string
}): BacktestResult | null {
  const { conversationPublishedSnapshotId, lastBacktestRef, currentBacktestConfig, symbol } = input
  if (!lastBacktestRef || !conversationPublishedSnapshotId || !currentBacktestConfig) {
    return null
  }
  if (conversationPublishedSnapshotId !== lastBacktestRef.publishedSnapshotId) {
    return null
  }
  if (!doesBacktestConfigMatch(currentBacktestConfig, lastBacktestRef.config)) {
    return null
  }

  return {
    id: lastBacktestRef.jobId,
    symbol,
    maxDrawdownPct: lastBacktestRef.summary.maxDrawdownPct,
    totalReturnPct: lastBacktestRef.summary.totalReturnPct,
    winRatePct: lastBacktestRef.summary.winRatePct,
    tradeCount: lastBacktestRef.summary.tradeCount,
    ...(typeof lastBacktestRef.summary.openTradeCount === 'number'
      ? { openTradeCount: lastBacktestRef.summary.openTradeCount }
      : {}),
    ...(typeof lastBacktestRef.summary.openPnl === 'number'
      ? { openPnl: lastBacktestRef.summary.openPnl }
      : {}),
    ...(lastBacktestRef.summary.marketType ? { marketType: lastBacktestRef.summary.marketType } : {}),
  }
}

function normalizeCodegenSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string') {
    return null
  }
  const normalized = sessionId.trim()
  return normalized.length > 0 ? normalized : null
}

function hasExplicitSchemaVersionMismatch(item: Partial<ConversationState>): boolean {
  const schemaVersion = (item as { schemaVersion?: unknown }).schemaVersion
  return typeof schemaVersion === 'number' && schemaVersion !== AI_QUANT_PERSISTED_SCHEMA_VERSION
}

function hasPublicationArtifacts(conversation: ConversationState): boolean {
  return Boolean(
    conversation.publishedStrategyInstanceId
      || conversation.publishedSnapshotId
      || conversation.publishedSnapshotParamValues
      || conversation.publishedSnapshotStrategyConfig
      || conversation.publishedSnapshotBacktestConfigDefaults
      || conversation.publishedSnapshotDeploymentExecutionDefaults
      || conversation.publishedSnapshotDeploymentExecutionConstraints
      || conversation.publishedSnapshotCompatibilityMetadata
      || conversation.publishedScriptCode
      || conversation.publishedScriptGraphVersion !== null
      || conversation.backtestResult
      || conversation.latestSignalMessage,
  )
}

function clearPublicationArtifacts(conversation: ConversationState): ConversationState {
  return {
    ...conversation,
    publicationGate: null,
    publishedStrategyInstanceId: null,
    publishedSnapshotId: null,
    publishedSnapshotParamValues: null,
    publishedSnapshotStrategyConfig: null,
    publishedSnapshotBacktestConfigDefaults: null,
    publishedSnapshotDeploymentExecutionDefaults: null,
    publishedSnapshotDeploymentExecutionConstraints: null,
    publishedSnapshotCompatibilityMetadata: null,
    publishedScriptCode: null,
    publishedScriptGraphVersion: null,
    backtestResult: null,
    latestSignalMessage: null,
    backtestExecutionState: 'idle',
  }
}

function hasClarificationBlockedConflict(conversation: ConversationState): boolean {
  return conversation.clarificationGate?.blocked === true
    && Boolean(
      conversation.codegenSpecDesc
        || conversation.semanticGraph
        || conversation.validationReport
        || conversation.pendingCanonicalDigest
        || conversation.llmCodegenSessionId
        || hasPublicationArtifacts(conversation)
        || conversation.backtestExecutionState !== 'idle',
    )
}

function hasPublicationMismatch(conversation: ConversationState): boolean {
  if (!hasPublicationArtifacts(conversation)) {
    return false
  }
  if (conversation.logicGraph?.status !== 'confirmed') {
    return true
  }
  if (!conversation.publishedSnapshotId || !conversation.publishedScriptCode) {
    return true
  }
  return conversation.publishedScriptGraphVersion !== conversation.logicGraph.version
}

function hasDigestMismatch(conversation: ConversationState): boolean {
  if (conversation.clarificationGate?.blocked) {
    return false
  }
  const digestFromSpec = readCanonicalDigest(conversation.codegenSpecDesc)
  return Boolean(
    digestFromSpec
      && conversation.pendingCanonicalDigest
      && digestFromSpec !== conversation.pendingCanonicalDigest,
  )
}

export function collectConversationIntegrityIssues(
  conversation: ConversationState,
): ConversationIntegrityIssue[] {
  const issues: ConversationIntegrityIssue[] = []
  if (hasClarificationBlockedConflict(conversation)) {
    issues.push('clarification_blocked')
  }
  if (hasPublicationMismatch(conversation)) {
    issues.push('publication_mismatch')
  }
  if (hasDigestMismatch(conversation)) {
    issues.push('digest_mismatch')
  }
  return issues
}

export function hasConversationIntegrityIssues(conversation: ConversationState): boolean {
  return collectConversationIntegrityIssues(conversation).length > 0
}

function normalizeBlockedClarificationState(conversation: ConversationState): ConversationState {
  if (!hasClarificationBlockedConflict(conversation)) {
    return conversation
  }
  const clearedArtifacts = clearPublicationArtifacts(conversation)
  return {
    ...clearedArtifacts,
    codegenSpecDesc: null,
    semanticGraph: null,
    validationReport: null,
    clarificationGate: conversation.clarificationGate,
    publicationGate: conversation.publicationGate,
    pendingCanonicalDigest: null,
    llmCodegenSessionId: conversation.llmCodegenSessionId,
  }
}

function normalizePublicationState(conversation: ConversationState): ConversationState {
  if (!hasPublicationMismatch(conversation)) {
    return conversation
  }
  return clearPublicationArtifacts(conversation)
}

function normalizeDigestState(conversation: ConversationState): ConversationState {
  if (conversation.clarificationGate?.blocked) {
    return conversation
  }
  const digestFromSpec = readCanonicalDigest(conversation.codegenSpecDesc)
  if (!digestFromSpec) {
    return conversation
  }
  if (!conversation.pendingCanonicalDigest) {
    return {
      ...conversation,
      pendingCanonicalDigest: digestFromSpec,
    }
  }
  if (digestFromSpec === conversation.pendingCanonicalDigest) {
    return conversation
  }
  return {
    ...clearPublicationArtifacts(conversation),
    semanticGraph: null,
    validationReport: null,
    pendingCanonicalDigest: null,
    llmCodegenSessionId: null,
  }
}

export function normalizeHydratedConversationState(
  conversation: ConversationState,
): ConversationState {
  const normalizedClarification = normalizeBlockedClarificationState(conversation)
  const normalizedPublication = normalizePublicationState(normalizedClarification)
  return normalizeDigestState(normalizedPublication)
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
  return !NON_STRATEGY_PARAM_KEYS.has(key) && !BACKTEST_EXECUTION_PARAM_KEY_SET.has(key)
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
    key => values[key] === DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES[key],
  )
}

function stripImplicitBacktestExecutionParamValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const nextValues = { ...values }
  BACKTEST_EXECUTION_PARAM_KEYS.forEach((key) => {
    if (nextValues[key] === DEFAULT_BACKTEST_EXECUTION_PARAM_VALUES[key]) {
      delete nextValues[key]
    }
  })
  return nextValues
}

function normalizeHydratedBacktestExecutionConfig(input: {
  paramValues: Record<string, unknown>
  explicit: boolean
  publishedSnapshotId: string | null
  publishedSnapshotParamValues: Record<string, unknown> | null
}): {
  paramValues: Record<string, unknown>
  explicit: boolean
} {
  if (input.publishedSnapshotId && !input.publishedSnapshotParamValues) {
    return {
      paramValues: stripImplicitBacktestExecutionParamValues(input.paramValues),
      explicit: false,
    }
  }

  if (input.explicit) {
    return input
  }

  if (input.publishedSnapshotId) {
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
    totalOpenTrades?: number
    openPnl?: number
  },
): BacktestResult {
  const winRatePct = summary.winRate <= 1 ? summary.winRate * 100 : summary.winRate
  return {
    ...previous,
    maxDrawdownPct: Number(summary.maxDrawdownPct.toFixed(2)),
    totalReturnPct: Number(summary.netProfitPct.toFixed(2)),
    winRatePct: Number(winRatePct.toFixed(2)),
    tradeCount: summary.totalTrades,
    openTradeCount: typeof summary.totalOpenTrades === 'number' ? summary.totalOpenTrades : previous.openTradeCount,
    openPnl: typeof summary.openPnl === 'number' ? Number(summary.openPnl.toFixed(2)) : previous.openPnl,
  }
}

export function isOpenOnlyBacktestResult(result: BacktestResult | null | undefined): boolean {
  if (!result) return false
  return result.tradeCount === 0 && (result.openTradeCount ?? 0) > 0
}

export function isDeployableBacktestResult(result: BacktestResult | null | undefined): boolean {
  if (!result) return false
  return (result.tradeCount > 0 || (result.openTradeCount ?? 0) > 0) && result.maxDrawdownPct <= 20
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
    serverConversationId: null,
    schemaVersion: AI_QUANT_PERSISTED_SCHEMA_VERSION,
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
    displayLogicGraph: null,
    codegenSpecDesc: null,
    semanticGraph: null,
    validationReport: null,
    clarificationGate: null,
    publicationGate: null,
    pendingCanonicalDigest: null,
    llmCodegenSessionId: null,
    publishedStrategyInstanceId: null,
    publishedSnapshotId: null,
    publishedSnapshotParamValues: null,
    publishedSnapshotStrategyConfig: null,
    publishedSnapshotBacktestConfigDefaults: null,
    publishedSnapshotDeploymentExecutionDefaults: null,
    publishedSnapshotDeploymentExecutionConstraints: null,
    publishedSnapshotCompatibilityMetadata: null,
    publishedScriptCode: null,
    publishedScriptGraphVersion: null,
    latestSignalMessage: null,
    backtestExecutionConfigExplicit: false,
    backtestExecutionState: 'idle',
    updatedAt: now,
  }
}

function buildServerTerminalCodegenReply(args: {
  response: AiQuantConversationResponse
  translate: (key: string, options?: Record<string, unknown>) => string
}): string | null {
  const { response, translate } = args
  const rejectedPrefix = translate('aiQuant.messages.generationFailedPrefix', {
    defaultValue: 'Failed to generate strategy from current logic graph',
  })
  const rejectedWithoutReason = translate('aiQuant.messages.generationFailedNoReason', {
    defaultValue:
      'Failed to generate strategy from current logic graph: backend did not return a detailed reason. Please check service logs.',
  })
  const reason = typeof response.rejectReason === 'string' ? response.rejectReason.trim() : ''

  const isTerminalFailure =
    response.status === 'CONSISTENCY_FAILED'
    || response.status === 'REJECTED'
    || response.publicationGate?.passed === false

  if (isTerminalFailure) {
    const stage =
      response.publicationGate?.passed === false
        ? 'PUBLICATION_GATE_BLOCKED'
        : response.status || 'UNKNOWN'
  const explanation =
    response.status === 'CONSISTENCY_FAILED'
      ? '脚本已生成，但没有通过一致性校验，因此不会发布，也不能进入回测。'
      : response.publicationGate?.passed === false
        ? '脚本已生成，但发布门校验没有通过，因此不会发布，也不能进入回测。'
        : '后端拒绝了当前策略生成结果，因此不会发布，也不能进入回测。'
  const humanizedReason = humanizeServerRejectReason(reason)
  return `${rejectedPrefix}（${stage}）\n说明：${explanation}\n后端返回：${reason || rejectedWithoutReason}${humanizedReason ? `\n规则解释：${humanizedReason}` : ''}`
  }

  if (response.status === 'PUBLISHED' && typeof response.scriptCode === 'string' && response.scriptCode.trim()) {
    return `${translate('aiQuant.messages.codeGeneratedBacktest', {
      defaultValue: 'Strategy code generated, ready to backtest.',
    })}\n\n${translate('aiQuant.messages.generatedCodeTitle', {
      defaultValue: 'Generated strategy code:',
    })}\n\`\`\`javascript\n${response.scriptCode}\n\`\`\``
  }

  return null
}

function humanizeServerRejectReason(reason: string): string | null {
  const trimmed = reason.trim()
  if (!trimmed) return null

  const missingRulePrefix = '脚本缺少关键规则映射:'
  const prefixIndex = trimmed.indexOf(missingRulePrefix)
  if (prefixIndex === -1) {
    return null
  }

  const rawMappings = trimmed.slice(prefixIndex + missingRulePrefix.length).trim()
    .split(/[|,]/)
    .map(item => item.trim())
    .filter(Boolean)

  if (rawMappings.length === 0) return null

  const ruleKeyMap: Record<string, string> = {
    'bollinger.bars_outside': '价格连续若干根 K 线位于布林带外',
    'bollinger.upper_break': '价格向上突破布林带上轨',
    'bollinger.lower_break': '价格向下突破布林带下轨',
    'bollinger.middle_revert': '价格回到布林带中轨',
  }
  const phaseMap: Record<string, string> = {
    entry: '入场规则',
    exit: '出场规则',
    risk: '风控规则',
  }
  const sideScopeMap: Record<string, string> = {
    long: '只作用于多头',
    short: '只作用于空头',
    both: '同时作用于多头和空头',
  }

  const parts = rawMappings.map((mapping) => {
    const [rawRuleKey, rawPhase, rawSideScope] = mapping.split(':').map(item => item.trim())
    if (!rawRuleKey) return null
    const ruleLabel = ruleKeyMap[rawRuleKey] ?? rawRuleKey
    const phaseLabel = phaseMap[rawPhase] ?? rawPhase
    const sideScopeLabel = sideScopeMap[rawSideScope] ?? rawSideScope
    return `${phaseLabel}“${ruleLabel}”没有在最终脚本里正确实现（${sideScopeLabel}）`
  }).filter((item): item is string => Boolean(item))

  return parts.length > 0 ? parts.join('；') : null
}

export function createRecoveryConversation(
  translate: (key: string) => string,
  now = Date.now(),
): ConversationState {
  const conversation = createConversation(translate, now)
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: `recovery-${now}`,
        role: 'assistant',
        content: translate(STALE_CONVERSATION_RECOVERY_MESSAGE_KEY),
      },
    ],
    updatedAt: now,
  }
}

export function createConversationFromServerConversation(
  response: AiQuantConversationResponse,
  translate: (key: string) => string,
): ConversationState {
  const seed = createConversation(translate)
  const snapshotStrategyConfig = normalizePublishedStrategyConfig(response.publishedSnapshotStrategyConfig)
  const snapshotBacktestConfigDefaults = normalizeBacktestConfigDefaults(
    response.publishedSnapshotBacktestConfigDefaults,
  )
  const snapshotDeploymentExecutionDefaults = normalizeDeploymentExecutionConfig(
    response.publishedSnapshotDeploymentExecutionDefaults,
  )
  const snapshotDeploymentExecutionConstraints = normalizeDeploymentExecutionConstraints(
    response.publishedSnapshotDeploymentExecutionConstraints,
  )
  const snapshotCompatibilityMetadata = normalizeSnapshotCompatibilityMetadata(
    response.publishedSnapshotCompatibilityMetadata,
  )
  const normalizedClarificationGate = normalizeClarificationGate(response.clarificationGate)
  const syncResult = response.specDesc
    ? syncStrategyParamsFromCodegen({
        spec: response.specDesc,
        fallback: {
          exchange: seed.params.exchange,
          symbol: seed.params.symbol,
          baseTimeframe: seed.params.baseTimeframe,
          positionPct: seed.params.positionPct,
        },
        currentValues: seed.paramValues,
        capabilities: null,
      })
    : null
  const snapshotParamValues = normalizePublishedSnapshotParamValues(response.publishedSnapshotParamValues)
  const mergedSnapshotParamValues = mergeSnapshotBoundParamValues({
    currentValues: syncResult?.paramValues ?? seed.paramValues,
    snapshotParamValues,
    snapshotBacktestConfigDefaults,
  })
  const nextParamValues = mergedSnapshotParamValues.paramValues
  const nextParams = normalizeParamsFromValues(nextParamValues, seed.params)
  const publishedSnapshotId = normalizePublishedSnapshotId(response.publishedSnapshotId)
  const effectivePublishedBacktestInputs = resolveEffectivePublishedBacktestInputs({
    publishedSnapshotId,
    publishedSnapshotStrategyConfig: snapshotStrategyConfig,
  })
  const restoredBacktestSymbol = effectivePublishedBacktestInputs?.symbol
    ?? (typeof snapshotStrategyConfig?.symbol === 'string' && snapshotStrategyConfig.symbol.trim()
      ? snapshotStrategyConfig.symbol.trim()
      : nextParams.symbol)
  const lastBacktestRef = normalizeLastBacktestRef(response.lastBacktestRef)
  const restoredBacktestResult = restoreBacktestResultFromLastBacktestRef({
    conversationPublishedSnapshotId: publishedSnapshotId,
    lastBacktestRef,
    currentBacktestConfig: buildComparableBacktestConfig(nextParamValues, snapshotBacktestConfigDefaults),
    symbol: restoredBacktestSymbol,
  })
  const graphVersion =
    typeof response.semanticGraph?.version === 'number' && Number.isFinite(response.semanticGraph.version)
      ? response.semanticGraph.version
      : 1
  const graphFallbackMeta = {
    exchange: syncResult?.normalized.exchange ?? nextParams.exchange,
    symbol: syncResult?.normalized.symbol ?? nextParams.symbol,
    baseTimeframe: syncResult?.normalized.baseTimeframe ?? nextParams.baseTimeframe,
    positionPct: syncResult?.normalized.positionPct ?? nextParams.positionPct,
    executionTags: syncResult?.executionTags ?? [],
  }
  const logicGraph = response.specDesc
    ? buildLogicGraphFromCodegenSpec(
        response.specDesc,
        graphFallbackMeta,
        graphVersion,
        response.status === 'PUBLISHED'
        || response.status === 'CONSISTENCY_FAILED'
        || response.status === 'REJECTED'
        || response.publicationGate?.passed === false
          ? 'confirmed'
          : 'draft',
      )
    : null
  const displayLogicGraph = response.specDesc
    ? normalizeDisplayLogicGraph(buildDisplayLogicGraphFromCodegenSpec({
        specDesc: response.specDesc,
        fallbackMeta: graphFallbackMeta,
      }))
    : null
  const responseMessages = response.conversationMessages?.length
    ? response.conversationMessages.map((message, index) => ({
        id: `${response.id}-msg-${index}`,
        role: message.role,
        content: message.content,
      }))
    : seed.messages
  const derivedReply = buildServerTerminalCodegenReply({ response, translate })
  const messages =
    derivedReply
    && !responseMessages.some(
      message => message.role === 'assistant' && message.content.trim() === derivedReply.trim(),
    )
      ? [
          ...responseMessages,
          {
            id: `${response.id}-derived-terminal-reply`,
            role: 'assistant' as const,
            content: derivedReply,
          },
        ]
      : responseMessages
  const updatedAt = response.updatedAt ? Date.parse(response.updatedAt) : Date.now()

  return {
    ...seed,
    id: response.id,
    serverConversationId: response.id,
    title: response.conversationTitle?.trim() || seed.title,
    messages,
    params: nextParams,
    paramSchema: syncResult?.paramSchema ?? seed.paramSchema,
    paramValues: nextParamValues,
    logicGraph,
    displayLogicGraph,
    codegenSpecDesc: response.specDesc ?? null,
    semanticGraph: response.semanticGraph ?? null,
    validationReport: response.validationReport ?? null,
    clarificationGate: normalizedClarificationGate,
    publicationGate: response.publicationGate ?? null,
    pendingCanonicalDigest:
      normalizedClarificationGate?.blocked
        ? null
        : (response.canonicalDigest ?? null),
    llmCodegenSessionId: response.activeCodegenSessionId ?? null,
    publishedStrategyInstanceId: response.strategyInstanceId ?? null,
    publishedSnapshotId,
    publishedSnapshotParamValues: snapshotParamValues,
    publishedSnapshotStrategyConfig: snapshotStrategyConfig,
    publishedSnapshotBacktestConfigDefaults: snapshotBacktestConfigDefaults,
    publishedSnapshotDeploymentExecutionDefaults: snapshotDeploymentExecutionDefaults,
    publishedSnapshotDeploymentExecutionConstraints: snapshotDeploymentExecutionConstraints,
    publishedSnapshotCompatibilityMetadata: snapshotCompatibilityMetadata,
    publishedScriptCode: response.scriptCode ?? null,
    publishedScriptGraphVersion:
      response.scriptCode && logicGraph?.status === 'confirmed'
        ? logicGraph.version
        : null,
    backtestResult: restoredBacktestResult,
    backtestExecutionConfigExplicit: mergedSnapshotParamValues.explicit,
    updatedAt,
  }
}

function hadPersistedCodegenArtifacts(item: Partial<ConversationState>): boolean {
  return Boolean(
    item.codegenSpecDesc
      || item.semanticGraph
      || item.validationReport
      || item.pendingCanonicalDigest
      || item.llmCodegenSessionId
      || item.publishedStrategyInstanceId
      || item.publishedSnapshotId
      || item.publishedSnapshotStrategyConfig
      || item.publishedSnapshotBacktestConfigDefaults
      || item.publishedSnapshotDeploymentExecutionDefaults
      || item.publishedSnapshotDeploymentExecutionConstraints
      || item.publishedSnapshotCompatibilityMetadata
      || item.publishedScriptCode
      || typeof item.publishedScriptGraphVersion === 'number'
      || item.publicationGate,
  )
}

export function shouldResetIrrecoverableHydratedConversation(
  item: Partial<ConversationState>,
  conversation: ConversationState,
): boolean {
  if (!hadPersistedCodegenArtifacts(item)) {
    return false
  }
  return Boolean(
    !conversation.logicGraph
      && !conversation.semanticGraph
      && !conversation.validationReport
      && !conversation.pendingCanonicalDigest
      && !conversation.llmCodegenSessionId
      && !conversation.publicationGate
      && !hasPublicationArtifacts(conversation),
  )
}

export function hydrateConversation(item: Partial<ConversationState>): ConversationState {
  const serverConversationId =
    typeof item.serverConversationId === 'string' && item.serverConversationId.trim()
      ? item.serverConversationId.trim()
      : null
  const publishedSnapshotId = normalizePublishedSnapshotId(item.publishedSnapshotId)
  const publishedSnapshotStrategyConfig = normalizePublishedStrategyConfig(item.publishedSnapshotStrategyConfig)
  const publishedSnapshotBacktestConfigDefaults = normalizeBacktestConfigDefaults(
    item.publishedSnapshotBacktestConfigDefaults,
  )
  const publishedSnapshotDeploymentExecutionDefaults = normalizeDeploymentExecutionConfig(
    item.publishedSnapshotDeploymentExecutionDefaults,
  )
  const publishedSnapshotDeploymentExecutionConstraints = normalizeDeploymentExecutionConstraints(
    item.publishedSnapshotDeploymentExecutionConstraints,
  )
  const publishedSnapshotCompatibilityMetadata = normalizeSnapshotCompatibilityMetadata(
    item.publishedSnapshotCompatibilityMetadata,
  )
  const publishedSnapshotParamValues = normalizePublishedSnapshotParamValues(item.publishedSnapshotParamValues)
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
    publishedSnapshotId,
    publishedSnapshotParamValues,
  })
  const fallbackParams =
    item.params && typeof item.params === 'object' && !Array.isArray(item.params)
      ? normalizeParamsFromValues(baseParams, DEFAULT_PARAMS)
      : DEFAULT_PARAMS
  const nextParams = normalizeParamsFromValues(
    normalizedBacktestExecutionConfig.paramValues,
    fallbackParams,
  )

  return normalizeHydratedConversationState({
    id: item.id ?? `conv-${Date.now()}`,
    serverConversationId,
    schemaVersion: AI_QUANT_PERSISTED_SCHEMA_VERSION,
    title: item.title ?? '',
    messages: Array.isArray(item.messages) ? item.messages : [],
    params: nextParams,
    paramSchema: item.paramSchema ?? buildParamSchemaWithCapabilities(null, nextParams.symbol),
    paramValues: normalizedBacktestExecutionConfig.paramValues,
    backtestResult: item.backtestResult ?? null,
    logicGraph: item.logicGraph ?? null,
    displayLogicGraph: normalizeDisplayLogicGraph(item.displayLogicGraph),
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
    llmCodegenSessionId: normalizeCodegenSessionId(item.llmCodegenSessionId),
    publishedStrategyInstanceId: item.publishedStrategyInstanceId ?? null,
    publishedSnapshotId,
    publishedSnapshotParamValues,
    publishedSnapshotStrategyConfig,
    publishedSnapshotBacktestConfigDefaults,
    publishedSnapshotDeploymentExecutionDefaults,
    publishedSnapshotDeploymentExecutionConstraints,
    publishedSnapshotCompatibilityMetadata,
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
  })
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
    const compatible = parsed.filter(item => !hasExplicitSchemaVersionMismatch(item))
    if (compatible.length === 0) {
      throw new Error('invalid conversation payload')
    }
    return compatible.map((item, index) => {
      const hydrated = hydrateConversation(item)
      if (!shouldResetIrrecoverableHydratedConversation(item, hydrated)) {
        return hydrated
      }
      return createRecoveryConversation(translate, hydrated.updatedAt || Date.now() + index)
    })
  } catch {
    return [createConversation(translate)]
  }
}

function restoreHydratedConversationList(
  items: Partial<ConversationState>[],
  translate: (key: string) => string,
): ConversationState[] {
  return items.map((item, index) => {
    const hydrated = hydrateConversation(item)
    if (!shouldResetIrrecoverableHydratedConversation(item, hydrated)) {
      return hydrated
    }
    return createRecoveryConversation(translate, hydrated.updatedAt || Date.now() + index)
  })
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
    conversations: conversations.map((conversation) => {
      if (
        conversation.backtestExecutionConfigExplicit
        || (typeof conversation.publishedSnapshotId === 'string' && conversation.publishedSnapshotId.trim().length > 0)
      ) {
        return conversation
      }
      return {
        ...conversation,
        paramValues: stripImplicitBacktestExecutionParamValues(conversation.paramValues),
      }
    }),
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
        conversations: restoreHydratedConversationList(parsed, translate),
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
      conversations: restoreHydratedConversationList(storedConversations, translate),
      shouldPersist: false,
    }
  } catch {
    return {
      conversations: fallback,
      shouldPersist: true,
    }
  }
}
