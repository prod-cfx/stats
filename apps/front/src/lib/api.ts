import type { schemas } from '@ai/api-contracts'
import type { StrategyInstanceStatus } from '@ai/shared'
import type { ZodTypeAny } from 'zod'
import { validateId } from './api-client'
export {
  continueLlmCodegenSession,
  deleteAccountAiQuantStrategy,
  deleteAiQuantConversation,
  deployAccountAiQuantStrategy,
  fetchAccountAiQuantDeployResult,
  fetchAccountAiQuantStrategies,
  fetchAccountAiQuantStrategyDetail,
  getLlmCodegenSession,
  listAiQuantConversations,
  performAccountAiQuantStrategyAction,
  startLlmCodegenSession,
  updateAccountAiQuantStrategyLeverage,
  updateAiQuantConversationBacktestDraft,
} from './api-ai-quant-domain'
export {
  fetchProfile,
  getTelegramLoginConfigRequest,
  login,
  registerAccount,
  requestPasswordReset,
  sendVerificationCode,
  type TelegramLoginConfigResponse,
  verifyPasswordReset,
} from './api-auth-domain'
export {
  deleteUserExchangeAccount,
  fetchUserExchangeAccountStatuses,
  upsertUserExchangeAccount,
} from './api-exchange-accounts-domain'
export {
  type AggregatedLiquidationSummary,
  type AggregatedOrderbookLevel,
  type AggregatedOrderbookQueryType,
  type AggregatedOrderbookResponse,
  type AggregatedOrderbookVenueDetail,
  type AggregatedVolumeApiItem,
  type AggregatedVolumeApiResponse,
  type CryptoStockQuoteLatest,
  type ExchangeLiquidationResponse,
  type ExchangeLongShortRatioApiItem,
  type ExchangeLongShortTimeRange,
  fetchAggregatedLiquidationSummary,
  fetchAggregatedOpenInterest,
  type FetchAggregatedOpenInterestQuery,
  fetchAggregatedOrderbook,
  type FetchAggregatedOrderbookParams,
  fetchAggregatedVolume,
  type FetchAggregatedVolumeQuery,
  fetchCryptoStockQuotesLatest,
  fetchExchangeLiquidation,
  fetchExchangeLongShortRatio,
  type FetchExchangeLongShortRatioQuery,
  fetchHistoricalPositions,
  fetchKlineData,
  type FetchKlineDataParams,
  fetchLongShortRatio,
  fetchMarketDataCatalogItems,
  fetchOpenPositions,
  fetchPredictionMarkets,
  type FetchPredictionMarketsParams,
  fetchTicker,
  type KlineBar,
  type OpenInterestApiItem,
  type PositionResponse,
  type PositionsQueryParams,
  type PredictionMarketCardResponse,
  type TickerData,
} from './api-market-domain'
export {
  fetchRealtimeWhaleAlerts,
  type FetchRealtimeWhaleAlertsParams,
  fetchTraderDiscoverTags,
  type FetchTraderDiscoverTagsQuery,
  fetchTraderFullData,
  type FetchTraderFullDataQuery,
  fetchTraderOpenOrders,
  type FetchTraderOpenOrdersQuery,
  fetchTraderPositions,
  type FetchTraderPositionsQuery,
  fetchTraderSnapshot,
  type FetchTraderSnapshotQuery,
  fetchUserFills,
  type FetchUserFillsQuery,
  fetchUserPortfolio,
  type FetchUserPortfolioQuery,
  fetchWhaleAddressPerformance,
  type FetchWhaleAddressPerformanceQuery,
  fetchWhaleHoldings,
  type FetchWhaleHoldingsQuery,
  fetchWhaleTrackingDiscover,
  fetchWhaleTradesRealtime,
  type FetchWhaleTradesRealtimeParams,
  type RealtimeWhaleAlertItem,
  type TraderDiscoverTagsResponse,
  type TraderOpenOrdersResponse,
  type TraderPositionsResponse,
  type TraderSnapshotResponse,
  type WhaleAddressPerformanceResponse,
  type WhaleDiscoverResponse,
  type WhaleDiscoverTraderAiTag,
  type WhaleHoldingApiItem,
  type WhaleTradeDto,
} from './api-whale-domain'
export {
  BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
  BACKTEST_REQUEST_TIMEOUT_MS,
  type BacktestCapabilities,
  type BacktestJob,
  type BacktestJobPhase,
  type BacktestJobResult,
  type BacktestSymbolSupportCheckInput,
  type BacktestSymbolSupportCheckPayload,
  createBacktestJob,
  type CreateBacktestJobPayload,
  fetchBacktestCapabilities,
  type FetchBacktestCapabilitiesOptions,
  getBacktestJob,
  getBacktestJobResult,
  postBacktestSymbolSupportCheck,
} from './backtesting-api'

// Re-export types for external use
export type {
  TraderFullDataResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from './hyperliquid-api'

type Infer<T extends ZodTypeAny> = T['_output']

export type CreateExchangeAccountPayload = Infer<typeof schemas.CreateExchangeConfigDto>
export type ExchangeAccountResponse = Infer<typeof schemas.ExchangeConfigResponseDto>
export type UserExchangeId = 'binance' | 'okx' | 'hyperliquid'

export interface UserExchangeAccountStatus {
  id: string | null
  exchangeId: UserExchangeId
  isBound: boolean
  name: string | null
  maskedCredential: string | null
  isTestnet: boolean | null
  lastValidatedAt: string | Date | null
  createdAt: string | Date | null
}

export interface UpsertUserExchangeAccountPayload {
  exchangeId: UserExchangeId
  name?: string
  isTestnet?: boolean
  marketType?: 'spot' | 'perp'
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  mainWalletAddress?: string
  agentPrivateKey?: string
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

export type AccountAiQuantStrategyApiState = Extract<StrategyInstanceStatus, 'running' | 'stopped' | 'draft'>
export type AccountAiQuantStrategyAction = 'run' | 'stop'

export interface AccountAiQuantStrategyMetrics {
  returnPct: number | null
  maxDrawdownPct: number | null
  winRatePct: number | null
  tradeCount: number | null
}

export type AccountAiQuantParamSchema = Record<string, unknown>
export type AccountAiQuantParamValues = Record<string, unknown>

export interface AccountAiQuantLeverageRange {
  min: number
  max: number
}

export interface AccountAiQuantPublishedStrategyConfig {
  exchange: string | null
  symbol: string | null
  marketType?: 'spot' | 'perp' | null
  baseTimeframe: string | null
  positionPct: number | null
  strategyDeclaredLeverageRange?: AccountAiQuantLeverageRange | null
}

export interface AccountAiQuantBacktestConfigDefaults {
  initialCash: number | null
  leverage: number | null
  slippageBps: number | null
  feeBps: number | null
  priceSource: string | null
  allowPartial: boolean | null
  stateTimeframes?: string[] | null
}

export interface AccountAiQuantDeploymentExecutionConfig {
  leverage?: number | null
  priceSource?: string | null
  orderType?: string | null
  timeInForce?: string | null
}

export interface AccountAiQuantDeploymentExecutionConstraints {
  effectiveAllowedLeverageRange?: AccountAiQuantLeverageRange | null
  exchangeAccountCapabilityMaxLeverage?: number | null
  platformRiskMaxLeverage?: number | null
  strategyDeclaredLeverageRange?: AccountAiQuantLeverageRange | null
  supportedPriceSources?: string[] | null
  supportedOrderTypes?: string[] | null
  supportedTimeInForce?: string[] | null
  constraintExplanation?: string | null
}

export interface AccountAiQuantSnapshotCompatibilityMetadata {
  isLegacySnapshot: boolean
  missingBacktestConfigDefaults: boolean
  missingDeploymentExecutionDefaults: boolean
  missingDeploymentExecutionConstraints: boolean
  requiresRepublishForBacktest: boolean
  requiresRepublishForDeploy: boolean
  invalidBinding?: boolean | null
}

export interface AiQuantBacktestRangeConfig {
  preset: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'
  startAt?: string
  endAt?: string
}

export interface AiQuantBacktestExecutionConfig {
  initialCash: number
  leverage: number | null
  slippageBps: number
  feeBps: number
  priceSource: 'open' | 'close' | 'mid'
  allowPartial: boolean
}

export interface AiQuantBacktestDraftConfig {
  range: AiQuantBacktestRangeConfig
  execution: AiQuantBacktestExecutionConfig
}

export interface AccountAiQuantConsistencySummary {
  isConsistent: boolean
  driftReasons: string[]
  consistencyScore?: number | null
}

export interface AccountAiQuantRuntimeExecutionState {
  executionSemanticKey: string
  status: string
  failureFamily: 'binding' | 'activation' | 'execution' | 'persistence' | null
  failureReason: string | null
  failureCode: string | null
  lastAttemptAt: string | null
  consumedAt: string | null
  cooldownUntil: string | null
  publishedSnapshotId: string
  snapshotHash: string
}

export interface AccountAiQuantStrategyListItem {
  id: string
  name: string
  status: AccountAiQuantStrategyApiState
  exchange: string | null
  symbol: string | null
  timeframe: string | null
  positionPct: number | null
  isSubscribed: boolean
  paramSchema: AccountAiQuantParamSchema | null
  paramValues: AccountAiQuantParamValues | null
  schemaVersion: string | null
  metrics: AccountAiQuantStrategyMetrics
  updatedAt: string
}

export interface AccountAiQuantStrategyEquityPoint {
  ts: string
  value: number
}

export interface AccountAiQuantStrategyTimelineEvent {
  at: string
  eventType: 'system' | 'trade'
  event: string
  note?: string | null
}

export interface AccountAiQuantStrategySnapshot {
  exchange: string | null
  symbol: string | null
  timeframe: string | null
  positionPct: number | null
  publishedSnapshotId: string | null
  snapshotHash: string | null
  paramSchema: AccountAiQuantParamSchema | null
  paramValues: AccountAiQuantParamValues | null
  schemaVersion: string | null
  deployAccountName?: string | null
  deployAt?: string | null
  strategyConfig?: AccountAiQuantPublishedStrategyConfig | null
  backtestConfigDefaults?: AccountAiQuantBacktestConfigDefaults | null
  deploymentExecutionBaseline?: AccountAiQuantDeploymentExecutionConfig | null
  deploymentExecutionCurrent?: AccountAiQuantDeploymentExecutionConfig | null
  deploymentExecutionConstraints?: AccountAiQuantDeploymentExecutionConstraints | null
  effectiveAllowedLeverageRange?: AccountAiQuantLeverageRange | null
  compatibilityMetadata?: AccountAiQuantSnapshotCompatibilityMetadata | null
  consistencySummary?: AccountAiQuantConsistencySummary | null
  ruleSummary?: {
    rules?: Array<{
      id?: string | null
      phase?: string | null
      conditionKey?: string | null
      operator?: string | null
      value?: number | null
      actions?: string[]
    }>
    executionPolicy?: Record<string, unknown> | null
  } | null
  executionConfigVersion?: number | null
}

export interface AccountAiQuantStrategyDetail extends AccountAiQuantStrategyListItem {
  totalPnl: number | null
  todayPnl: number | null
  equitySeries: AccountAiQuantStrategyEquityPoint[]
  equitySeriesSource?: 'account' | 'backtest'
  snapshot: AccountAiQuantStrategySnapshot
  timeline: AccountAiQuantStrategyTimelineEvent[]
  runtimeExecutionStates: AccountAiQuantRuntimeExecutionState[]
  accountOverview: {
    initialBalance: number | null
    totalEquity: number | null
    availableBalance: number | null
    totalPnl: number | null
    todayPnl: number | null
    baseCurrency: string | null
  }
  positionOverview: {
    openPositionsCount: number | null
    closedPositionsCount: number | null
    totalRealizedPnl: number | null
    totalUnrealizedPnl: number | null
  }
  latestOrders: Array<{
    executedAt: string
    side: string
    symbol: string
    price: number | null
    quantity: number | null
    fee: number | null
    feeCurrency: string | null
    orderId: string | null
  }>
}

export interface AccountAiQuantDeployPayload {
  userId: string
  name: string
  deployRequestId: string
  publishedSnapshotId: string
  exchange?: 'binance' | 'okx' | 'hyperliquid'
  symbol?: string
  timeframe?: string
  positionPct?: number
  exchangeAccountId?: string
  exchangeAccountName?: string
  deploymentExecutionConfig?: AccountAiQuantDeploymentExecutionConfig
}

export interface AccountAiQuantUpdateLeveragePayload {
  userId: string
  leverage: number
}

// NOTE: StrategyInstanceSignalPublicResponseDto does not exist in contracts
// Using a generic type until the DTO is added
export type TradingSignalResponse = Record<string, unknown>

// NOTE: All LLM strategy and subscription controller methods do not exist in current backend
// These functions are stubs that will be implemented when the backend controllers are added

export interface LlmStrategyInstanceSignalsQuery {
  page?: number
  limit?: number
}

export interface UserLlmStrategyInstanceResponse {
  id: string
  name: string
  description?: string | null
  strategyId: string
  strategyName?: string | null
  strategyDescription?: string | null
  llmModel: string
  createdAt?: string | null
  isSubscribed?: boolean
}

export interface LlmCodegenSessionResponse {
  id: string
  conversationId?: string | null
  conversationTitle?: string
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  status: string
  createdAt?: string
  updatedAt?: string
  missingFields?: string[]
  scriptCode?: string | null
  publishedSnapshotId?: string | null
  publishedSnapshotParamValues?: Record<string, unknown> | null
  canonicalDigest?: string | null
  consistencyReport?: Record<string, unknown> | null
  specDesc?: Record<string, unknown> | null
  semanticGraph?: LlmSemanticGraph | null
  validationReport?: LlmSemanticGraphValidationReport | null
  strategyInstanceId?: string | null
  rejectReason?: string | null
  assistantPrompt?: string
  clarificationGate?: LlmClarificationGate | null
  publicationGate?: LlmPublicationGate | null
  publishedSnapshotStrategyConfig?: AccountAiQuantPublishedStrategyConfig | null
  publishedSnapshotBacktestConfigDefaults?: AccountAiQuantBacktestConfigDefaults | null
  publishedSnapshotDeploymentExecutionDefaults?: AccountAiQuantDeploymentExecutionConfig | null
  publishedSnapshotDeploymentExecutionConstraints?: AccountAiQuantDeploymentExecutionConstraints | null
  publishedSnapshotCompatibilityMetadata?: AccountAiQuantSnapshotCompatibilityMetadata | null
}

export interface AiQuantConversationLastBacktestRef {
  jobId: string
  publishedSnapshotId: string
  config: AiQuantBacktestDraftConfig
  summary: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
    openTradeCount?: number
    openPnl?: number
    marketType?: 'spot' | 'perp'
  }
  completedAt: string
}

export interface AiQuantConversationResponse {
  id: string
  conversationTitle?: string
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  activeCodegenSessionId?: string | null
  status?: string
  createdAt?: string
  updatedAt?: string
  backtestDraftConfig?: AiQuantBacktestDraftConfig | null
  scriptCode?: string | null
  publishedSnapshotId?: string | null
  publishedSnapshotParamValues?: Record<string, unknown> | null
  canonicalDigest?: string | null
  consistencyReport?: Record<string, unknown> | null
  specDesc?: Record<string, unknown> | null
  semanticGraph?: LlmSemanticGraph | null
  validationReport?: LlmSemanticGraphValidationReport | null
  strategyInstanceId?: string | null
  rejectReason?: string | null
  clarificationGate?: LlmClarificationGate | null
  publicationGate?: LlmPublicationGate | null
  publishedSnapshotStrategyConfig?: AccountAiQuantPublishedStrategyConfig | null
  publishedSnapshotBacktestConfigDefaults?: AccountAiQuantBacktestConfigDefaults | null
  publishedSnapshotDeploymentExecutionDefaults?: AccountAiQuantDeploymentExecutionConfig | null
  publishedSnapshotDeploymentExecutionConstraints?: AccountAiQuantDeploymentExecutionConstraints | null
  publishedSnapshotCompatibilityMetadata?: AccountAiQuantSnapshotCompatibilityMetadata | null
  lastBacktestRef?: AiQuantConversationLastBacktestRef | null
}

export interface LlmClarificationGateItem {
  key: string
  field: string
  reason: string
  question: string
  allowedAnswers?: string[]
  blocking: true
  status: 'pending' | 'answered'
  answer?: string
}

export interface LlmClarificationGate {
  blocked: boolean
  summary?: string | null
  items: LlmClarificationGateItem[]
  pendingItems?: LlmClarificationGateItem[]
}

export interface LlmPublicationGateMismatch {
  field: string
  expected: string
  actual: string
  reason: string
}

export interface LlmPublicationGate {
  passed: boolean
  blockingMismatches: LlmPublicationGateMismatch[]
}

export interface LlmSemanticGraphNode {
  id: string
  phase: 'entry' | 'exit' | 'risk'
  kind: string
  params: Record<string, unknown>
}

export interface LlmSemanticGraphAction {
  id: string
  kind: string
  sizePct: number
}

export interface LlmSemanticGraphRisk {
  id: string
  kind: string
  valuePct: number
  effect: string
}

export interface LlmSemanticGraph {
  version: number
  market: {
    symbol: string
    primaryTimeframe: string
  }
  nodes: LlmSemanticGraphNode[]
  actions: LlmSemanticGraphAction[]
  risk: LlmSemanticGraphRisk[]
}

export interface LlmSemanticGraphValidationError {
  code: string
  message: string
  nodeId?: string
}

export interface LlmSemanticGraphValidationReport {
  ok: boolean
  errors: LlmSemanticGraphValidationError[]
}

export interface StartLlmCodegenSessionPayload {
  initialMessage?: string
}

export interface ContinueLlmCodegenSessionPayload {
  message: string
  confirmGenerate?: boolean
  confirmedCanonicalDigest?: string
  clarificationAnswers?: Record<string, string>
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export async function fetchLlmStrategyInstances(query?: {
  page?: number
  limit?: number
  llmModel?: string
  strategyId?: string
}): Promise<PaginatedResponse<UserLlmStrategyInstanceResponse>> {
  return {
    total: 0,
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    items: [],
  }
}

export async function fetchLlmStrategyInstanceDetail(
  id: string,
): Promise<UserLlmStrategyInstanceResponse | null> {
  validateId(id, 'llm strategy instance ID')
  return null
}

export async function fetchLlmStrategyInstanceSignals(
  id: string,
  query: LlmStrategyInstanceSignalsQuery = {},
): Promise<PaginatedResponse<Record<string, unknown>>> {
  validateId(id, 'llm strategy instance ID')
  return {
    total: 0,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    items: [],
  }
}

export interface CreateLlmSubscriptionPayload {
  llmStrategyInstanceId: string
  customParams?: Record<string, unknown>
  exchangeAccountId?: string
}

export interface LlmSubscriptionResponse {
  id: string
  llmStrategyInstanceId: string
  status: 'active' | 'paused' | 'cancelled'
  createdAt: string
}

export async function createLlmSubscription(
  _payload: CreateLlmSubscriptionPayload,
): Promise<LlmSubscriptionResponse | null> {
  return null
}

export async function fetchMyLlmSubscriptions(query?: {
  page?: number
  limit?: number
  status?: 'active' | 'paused' | 'cancelled'
}): Promise<PaginatedResponse<LlmSubscriptionResponse>> {
  return {
    total: 0,
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    items: [],
  }
}

export async function fetchLlmSubscriptionDetail(
  subscriptionId: string,
): Promise<LlmSubscriptionResponse | null> {
  validateId(subscriptionId, 'llm subscription ID')
  return null
}

export async function updateLlmSubscription(
  subscriptionId: string,
  _payload: {
    status?: 'active' | 'paused' | 'cancelled'
    customParams?: Record<string, unknown> | null
    exchangeAccountId?: string | null
  },
): Promise<LlmSubscriptionResponse | null> {
  validateId(subscriptionId, 'llm subscription ID')
  return null
}

export async function cancelLlmSubscription(subscriptionId: string): Promise<void> {
  validateId(subscriptionId, 'llm subscription ID')
}
