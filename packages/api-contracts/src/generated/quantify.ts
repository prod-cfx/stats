import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

const SettingResponseDto = z
  .object({
    id: z.string(),
    key: z.string(),
    value: z.string(),
    type: z.string(),
    description: z.string(),
    category: z.string(),
    isSystem: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateSettingDto = z
  .object({
    key: z.string(),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.object({}).partial().passthrough(),
      z.array(z.any()),
    ]),
    type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isSystem: z.boolean().optional(),
  })
  .passthrough()
const UpdateSettingDto = z
  .object({
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.object({}).partial().passthrough(),
      z.array(z.any()),
    ]),
    type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isSystem: z.boolean().optional(),
  })
  .passthrough()
const BacktestExecutionConfigDto = z
  .object({
    slippageBps: z.number(),
    feeBps: z.number(),
    priceSource: z.enum(['open', 'close', 'mid']),
  })
  .passthrough()
const BacktestStrategyInputDto = z
  .object({
    id: z.string().optional(),
    protocolVersion: z.literal('v1'),
    publishedSnapshotId: z.string().optional(),
    params: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BacktestDataRangeDto = z.object({ fromTs: z.number(), toTs: z.number() }).passthrough()
const BacktestRequestedRangeInputDto = z
  .object({
    preset: z.enum(['7D', '30D', '90D', '1Y', 'CUSTOM']),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .passthrough()
const BacktestBarDto = z
  .object({
    symbol: z.string(),
    timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
    openTime: z.number(),
    closeTime: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  })
  .passthrough()
const RunBacktestDto = z
  .object({
    symbols: z.array(z.string()),
    baseTimeframe: z.enum([
      '1m',
      '3m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '6h',
      '8h',
      '12h',
      '1d',
      '1w',
    ]),
    stateTimeframes: z.array(
      z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
    ),
    initialCash: z.number(),
    leverage: z.number().optional(),
    allowPartial: z.boolean().optional(),
    conversationId: z.string().optional(),
    execution: BacktestExecutionConfigDto,
    strategy: BacktestStrategyInputDto,
    dataRange: BacktestDataRangeDto,
    requestedRangeInput: BacktestRequestedRangeInputDto.optional(),
    bars: z.array(BacktestBarDto).optional(),
  })
  .passthrough()
const BacktestJobSummaryDto = z
  .object({
    netProfit: z.number(),
    netProfitPct: z.number(),
    maxDrawdownPct: z.number(),
    winRate: z.number(),
    profitFactor: z.number().nullable(),
    totalTrades: z.number(),
    totalOpenTrades: z.number().optional(),
    openPnl: z.number().optional(),
  })
  .passthrough()
const BacktestEquityPointDto = z.object({ ts: z.number(), equity: z.number() }).passthrough()
const BacktestTradeRecordDto = z
  .object({
    id: z.string(),
    symbol: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    entryTs: z.number(),
    entryPrice: z.number(),
    exitTs: z.number(),
    exitPrice: z.number(),
    qty: z.number(),
    fee: z.number(),
    pnl: z.number(),
    returnPct: z.number(),
    reasonOpen: z.string().optional(),
    reasonOpenSource: z.string().optional(),
    reasonClose: z.string().optional(),
    reasonCloseSource: z.string().optional(),
    exitReason: z.string().optional(),
    exitSource: z.string().optional(),
  })
  .passthrough()
const BacktestTradeMarkerDto = z
  .object({
    symbol: z.string(),
    ts: z.number(),
    price: z.number(),
    kind: z.enum(['entry_long', 'entry_short', 'exit_long', 'exit_short']),
    tradeId: z.string(),
  })
  .passthrough()
const BacktestBySymbolDto = z
  .object({ symbol: z.string(), pnl: z.number(), trades: z.number(), winRate: z.number() })
  .passthrough()
const BacktestOpenPositionDto = z
  .object({
    symbol: z.string(),
    qty: z.number(),
    avgEntryPrice: z.number(),
    unrealizedPnl: z.number(),
  })
  .passthrough()
const BacktestPendingSignalDto = z
  .object({
    symbol: z.string(),
    ts: z.number(),
    deltaQty: z.number(),
    reason: z.string().optional(),
    reasonSource: z.string(),
  })
  .passthrough()
const BacktestReportResponseDto = z
  .object({
    summary: BacktestJobSummaryDto,
    equityCurve: z.array(BacktestEquityPointDto),
    trades: z.array(BacktestTradeRecordDto),
    markers: z.array(BacktestTradeMarkerDto),
    bySymbol: z.array(BacktestBySymbolDto),
    openPositions: z.array(BacktestOpenPositionDto).optional(),
    pendingSignals: z.array(BacktestPendingSignalDto).optional(),
  })
  .passthrough()
const BacktestJobErrorDetailsDto = z
  .object({
    code: z.string().optional(),
    message: z.string(),
    args: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BacktestJobRangeDto = z.object({ fromTs: z.number(), toTs: z.number() }).passthrough()
const BacktestJobInputSummaryDto = z
  .object({
    symbols: z.array(z.string()),
    baseTimeframe: z.string(),
    stateTimeframes: z.array(z.string()),
    initialCash: z.number(),
    leverage: z.number().nullish(),
    marketType: z.enum(['spot', 'perp']),
    dataRange: BacktestJobRangeDto,
    requestedRange: BacktestJobRangeDto,
    appliedRange: BacktestJobRangeDto.optional(),
    allowPartial: z.boolean(),
    isPartial: z.boolean(),
    strategyId: z.string(),
    strategyInstanceId: z.string().optional(),
    strategyTemplateId: z.string().optional(),
    snapshotId: z.string().optional(),
    snapshotHash: z.string().optional(),
    scriptHash: z.string().optional(),
    specHash: z.string().optional(),
  })
  .passthrough()
const BacktestJobResponseDto = z
  .object({
    id: z.string(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed']),
    createdAt: z.string(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    error: z.string().optional(),
    errorDetails: BacktestJobErrorDetailsDto.optional(),
    inputSummary: BacktestJobInputSummaryDto,
    resultSummary: BacktestJobSummaryDto.optional(),
  })
  .passthrough()
const BacktestCapabilitiesResponseDto = z
  .object({ allowedBaseTimeframes: z.array(z.string()) })
  .passthrough()
const CheckBacktestSymbolDto = z
  .object({
    exchange: z.enum(['binance', 'okx', 'hyperliquid']),
    marketType: z.enum(['spot', 'perp']),
    symbol: z.string(),
    baseTimeframe: z.enum([
      '1m',
      '3m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '6h',
      '8h',
      '12h',
      '1d',
      '1w',
    ]),
  })
  .passthrough()
const BacktestSymbolSupportResponseDto = z
  .object({
    status: z.enum(['supported', 'not_supported']),
    reasonCode: z.string().optional(),
    args: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BasePaginationResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(z.object({}).partial().passthrough()),
  })
  .passthrough()
const MarketSymbolDto = z
  .object({
    code: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    exchange: z.string(),
    type: z.string(),
    instrumentType: z.string(),
    status: z.string(),
    precisionPrice: z.number(),
    precisionQuantity: z.number(),
    tickSize: z.string().nullable(),
    lotSize: z.string().nullable(),
    isMarginEnabled: z.boolean(),
    updatedAt: z.string(),
  })
  .passthrough()
const MarketBarDto = z
  .object({
    time: z.string(),
    timeframe: z.string(),
    open: z.string(),
    high: z.string(),
    low: z.string(),
    close: z.string(),
    volume: z.string().nullable(),
    quoteVolume: z.string().nullable(),
    trades: z.number().nullable(),
    isFinal: z.boolean(),
    source: z.string().nullable(),
  })
  .passthrough()
const MarketQuoteDto = z
  .object({
    symbol: z.string(),
    lastPrice: z.string(),
    priceChange: z.string().nullable(),
    priceChangePercent: z.string().nullable(),
    openPrice: z.string().nullable(),
    highPrice: z.string().nullable(),
    lowPrice: z.string().nullable(),
    volume: z.string().nullable(),
    quoteVolume: z.string().nullable(),
    bidPrice: z.string().nullable(),
    bidQty: z.string().nullable(),
    askPrice: z.string().nullable(),
    askQty: z.string().nullable(),
    eventTime: z.string(),
    source: z.string().nullable(),
  })
  .passthrough()
const CreateMarketSymbolDto = z
  .object({
    code: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    exchange: z.string(),
    type: z.enum(['CRYPTO', 'STOCK', 'FOREX']),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    status: z.enum(['ACTIVE', 'DISABLED']),
    precisionPrice: z.number().gte(0),
    precisionQuantity: z.number().gte(0),
    tickSize: z.string().nullish(),
    lotSize: z.string().nullish(),
    isMarginEnabled: z.boolean(),
  })
  .passthrough()
const BaseResponseDto = z
  .object({ data: z.object({}).partial().passthrough(), message: z.string().optional() })
  .passthrough()
const UpdateMarketSymbolDto = z
  .object({
    baseAsset: z.string(),
    quoteAsset: z.string(),
    exchange: z.string(),
    type: z.enum(['CRYPTO', 'STOCK', 'FOREX']),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    status: z.enum(['ACTIVE', 'DISABLED']),
    precisionPrice: z.number().gte(0),
    precisionQuantity: z.number().gte(0),
    tickSize: z.string().nullable(),
    lotSize: z.string().nullable(),
    isMarginEnabled: z.boolean(),
  })
  .partial()
  .passthrough()
const IndicatorParamsResponseDto = z.object({ window: z.number() }).passthrough()
const IndicatorConfigResponseDto = z
  .object({
    id: z.string(),
    symbolId: z.string(),
    timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
    type: z.enum(['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO']),
    name: z.string(),
    params: IndicatorParamsResponseDto,
    isEnabled: z.boolean(),
    description: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const IndicatorParamsDto = z.object({ window: z.number() }).passthrough()
const CreateIndicatorConfigDto = z
  .object({
    symbolId: z.string().uuid(),
    timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
    type: z.enum(['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO']),
    name: z.string().max(64),
    params: IndicatorParamsDto,
    isEnabled: z.boolean().optional().default(true),
    description: z.string().max(255).optional(),
  })
  .passthrough()
const UpdateIndicatorConfigDto = z
  .object({
    symbolId: z.string().uuid(),
    timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
    type: z.enum(['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO']),
    name: z.string().max(64),
    params: IndicatorParamsDto,
    isEnabled: z.boolean(),
    description: z.string().max(255),
  })
  .partial()
  .passthrough()
const IndicatorConfigCacheReloadResponseDto = z.object({ success: z.boolean() }).passthrough()
const CreateStrategyAccountDto = z
  .object({
    userId: z.string(),
    strategyId: z.string(),
    strategyName: z.string().optional(),
    strategyVersion: z.string().optional(),
    baseCurrency: z.string(),
    initialBalance: z.string(),
  })
  .passthrough()
const StrategyAccountResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    strategyId: z.string(),
    strategyName: z.string().nullable(),
    strategyVersion: z.string().nullable(),
    baseCurrency: z.string(),
    initialBalance: z.string(),
    balance: z.string(),
    equity: z.string(),
    totalRealizedPnl: z.string(),
    totalUnrealizedPnl: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    latestDailyStat: z.object({}).partial().passthrough().nullable(),
  })
  .passthrough()
const MutateBalanceDto = z
  .object({
    userId: z.string(),
    amount: z.string(),
    referenceId: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough()
const LedgerEntryResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    positionId: z.string().nullable(),
    type: z.enum(['DEPOSIT', 'WITHDRAW', 'REALIZED_PNL', 'FEE', 'FUNDING_FEE', 'ADJUSTMENT']),
    amount: z.string(),
    balanceAfter: z.string(),
    referenceId: z.string().nullable(),
    description: z.string().nullable(),
    occurredAt: z.string(),
    meta: z.object({}).partial().passthrough().nullable(),
  })
  .passthrough()
const StrategyPnlDailyResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    date: z.string(),
    equityStart: z.string(),
    equityEnd: z.string(),
    realizedPnl: z.string(),
    unrealizedPnl: z.string(),
    deposits: z.string(),
    withdrawals: z.string(),
    maxDrawdown: z.string(),
  })
  .passthrough()
const GenerateDailyReportDto = z.object({ date: z.string() }).partial().passthrough()
const AccountStrategyMetricsDto = z
  .object({
    returnPct: z.number().nullable(),
    maxDrawdownPct: z.number().nullable(),
    winRatePct: z.number().nullable(),
    tradeCount: z.number().nullable(),
  })
  .partial()
  .passthrough()
const AccountStrategyListItemDto = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['running', 'stopped', 'draft']),
    exchange: z.string().nullish(),
    symbol: z.string().nullish(),
    timeframe: z.string().nullish(),
    positionPct: z.number().nullish(),
    paramSchema: z.object({}).partial().passthrough().nullish(),
    paramValues: z.object({}).partial().passthrough().nullish(),
    schemaVersion: z.string().nullish(),
    isSubscribed: z.boolean(),
    metrics: AccountStrategyMetricsDto,
    updatedAt: z.string(),
  })
  .passthrough()
const AccountStrategyEquityPointDto = z.object({ ts: z.string(), value: z.number() }).passthrough()
const AccountStrategyLeverageRangeDto = z.object({ min: z.number(), max: z.number() }).passthrough()
const AccountStrategyConsistencySummaryDto = z
  .object({
    isConsistent: z.boolean(),
    driftReasons: z.array(z.string()),
    consistencyScore: z.number().nullish(),
  })
  .passthrough()
const AccountStrategySnapshotDto = z
  .object({
    publishedSnapshotId: z.string().nullable(),
    snapshotHash: z.string().nullable(),
    exchange: z.string().nullable(),
    symbol: z.string().nullable(),
    timeframe: z.string().nullable(),
    positionPct: z.number().nullable(),
    paramSchema: z.object({}).partial().passthrough().nullable(),
    paramValues: z.object({}).partial().passthrough().nullable(),
    strategyConfig: z.object({}).partial().passthrough().nullable(),
    backtestConfigDefaults: z.object({}).partial().passthrough().nullable(),
    deploymentExecutionBaseline: z.object({}).partial().passthrough().nullable(),
    deploymentExecutionCurrent: z.object({}).partial().passthrough().nullable(),
    deploymentExecutionConstraints: z.object({}).partial().passthrough().nullable(),
    effectiveAllowedLeverageRange: AccountStrategyLeverageRangeDto.nullable(),
    compatibilityMetadata: z.object({}).partial().passthrough().nullable(),
    consistencySummary: AccountStrategyConsistencySummaryDto.nullable(),
    executionConfigVersion: z.number().nullable(),
    schemaVersion: z.string().nullable(),
    deployAccountName: z.string().nullable(),
    deployAt: z.string().nullable(),
  })
  .partial()
  .passthrough()
const AccountStrategyTimelineEventDto = z
  .object({
    at: z.string(),
    eventType: z.enum(['system', 'trade']),
    event: z.string(),
    note: z.string().nullish(),
  })
  .passthrough()
const AccountStrategyAccountOverviewDto = z
  .object({
    initialBalance: z.number().nullable(),
    totalEquity: z.number().nullable(),
    availableBalance: z.number().nullable(),
    totalPnl: z.number().nullable(),
    todayPnl: z.number().nullable(),
    baseCurrency: z.string().nullable(),
  })
  .partial()
  .passthrough()
const AccountStrategyPositionOverviewDto = z
  .object({
    openPositionsCount: z.number().nullable(),
    closedPositionsCount: z.number().nullable(),
    totalRealizedPnl: z.number().nullable(),
    totalUnrealizedPnl: z.number().nullable(),
  })
  .partial()
  .passthrough()
const AccountStrategyLatestOrderDto = z
  .object({
    executedAt: z.string(),
    side: z.string(),
    symbol: z.string(),
    price: z.number().nullish(),
    quantity: z.number().nullish(),
    fee: z.number().nullish(),
    feeCurrency: z.string().nullish(),
    orderId: z.string().nullish(),
  })
  .passthrough()
const RuntimeExecutionStateDto = z
  .object({
    executionSemanticKey: z.string(),
    status: z.enum(['ready', 'consumed', 'failed', 'cooldown']),
    failureFamily: z.enum(['binding', 'activation', 'execution', 'persistence']).nullish(),
    failureReason: z.string().nullish(),
    failureCode: z.string().nullish(),
    lastAttemptAt: z.string().datetime({ offset: true }).nullish(),
    consumedAt: z.string().datetime({ offset: true }).nullish(),
    cooldownUntil: z.string().datetime({ offset: true }).nullish(),
    publishedSnapshotId: z.string(),
    snapshotHash: z.string(),
  })
  .passthrough()
const AccountStrategyExecutionConfigDto = z
  .object({
    leverage: z.number().nullable(),
    priceSource: z.string().nullable(),
    orderType: z.string().nullable(),
    timeInForce: z.string().nullable(),
  })
  .partial()
  .passthrough()
const AccountStrategyDeploymentDto = z
  .object({
    exchangeAccountId: z.string().nullish(),
    exchangeAccountName: z.string().nullish(),
    executionConfig: AccountStrategyExecutionConfigDto,
    executionConfigVersion: z.number().nullish(),
    effectiveAllowedLeverageRange: AccountStrategyLeverageRangeDto.nullish(),
    driftFields: z.array(z.string()),
    reReadAtNextEligibleExecutionCycle: z.boolean(),
    updatedBy: z.string().nullish(),
  })
  .passthrough()
const AccountStrategyDetailResponseDto = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['running', 'stopped', 'draft']),
    exchange: z.string().nullish(),
    symbol: z.string().nullish(),
    timeframe: z.string().nullish(),
    positionPct: z.number().nullish(),
    paramSchema: z.object({}).partial().passthrough().nullish(),
    paramValues: z.object({}).partial().passthrough().nullish(),
    schemaVersion: z.string().nullish(),
    isSubscribed: z.boolean(),
    metrics: AccountStrategyMetricsDto,
    updatedAt: z.string(),
    totalPnl: z.number().nullish(),
    todayPnl: z.number().nullish(),
    equitySeries: z.array(AccountStrategyEquityPointDto),
    snapshot: AccountStrategySnapshotDto,
    timeline: z.array(AccountStrategyTimelineEventDto),
    accountOverview: AccountStrategyAccountOverviewDto,
    positionOverview: AccountStrategyPositionOverviewDto,
    latestOrders: z.array(AccountStrategyLatestOrderDto),
    runtimeExecutionStates: z.array(RuntimeExecutionStateDto),
    deployment: AccountStrategyDeploymentDto.nullish(),
  })
  .passthrough()
const AccountStrategyActionDto = z
  .object({ userId: z.string().optional(), action: z.enum(['run', 'stop']) })
  .passthrough()
const AccountStrategyDeployDto = z
  .object({
    userId: z.string().optional(),
    name: z.string(),
    deployRequestId: z.string(),
    publishedSnapshotId: z.string(),
    exchange: z.enum(['binance', 'okx', 'hyperliquid']).optional(),
    symbol: z.string().optional(),
    timeframe: z.string().optional(),
    positionPct: z.number().optional(),
    exchangeAccountId: z.string().optional(),
    mode: z.enum(['TESTNET', 'LIVE']).optional(),
    userPerOrderMaxQuote: z.number().optional(),
    userDailyMaxQuote: z.number().optional(),
    userMaxRiskFraction: z.number().optional(),
    exchangeAccountName: z.string().optional(),
    deploymentExecutionConfig: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const AccountStrategyUpdateExecutionLeverageDto = z
  .object({ userId: z.string().optional(), leverage: z.number(), reason: z.string().optional() })
  .passthrough()
const CreateStrategyInstanceDto = z
  .object({
    strategyTemplateId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    llmModel: z.string(),
    mode: z.enum(['BACKTEST', 'PAPER', 'TESTNET', 'LIVE']).optional(),
    params: z.object({}).partial().passthrough().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdBy: z.string().optional(),
  })
  .passthrough()
const StrategyInstanceStatsDto = z
  .object({
    investedAmount: z.number(),
    currentValue: z.number(),
    totalPnl: z.number(),
    totalPnlRate: z.number(),
    todayPnl: z.number().optional(),
    todayPnlRate: z.number().optional(),
    openPositionsCount: z.number(),
    closedPositionsCount: z.number(),
    totalTradesCount: z.number(),
    winningTradesCount: z.number(),
    winRate: z.number().optional(),
    maxDrawdown: z.number().optional(),
    sharpeRatio: z.number().optional(),
    lastUpdatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const StrategyInstanceResponseDto = z
  .object({
    id: z.string(),
    strategyTemplateId: z.string(),
    strategyTemplateName: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    llmModel: z.string(),
    params: z.object({}).partial().passthrough().optional(),
    status: z.enum(['draft', 'running', 'paused', 'stopped']),
    mode: z.enum(['BACKTEST', 'PAPER', 'TESTNET', 'LIVE']),
    startedAt: z.string().datetime({ offset: true }).optional(),
    stoppedAt: z.string().datetime({ offset: true }).optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    stats: StrategyInstanceStatsDto.optional(),
  })
  .passthrough()
const SubscriberInfoDto = z
  .object({
    userId: z.string(),
    username: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(['active', 'paused', 'cancelled']),
    subscriptionAmount: z.number(),
    currentPositionAmount: z.number(),
    openPositionsCount: z.number(),
    exchangeAccountId: z.string().optional(),
    exchangeName: z.string().optional(),
    subscribedAt: z.string().datetime({ offset: true }),
    customParams: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const StrategyInstanceSubscriptionDetailsDto = z
  .object({
    strategyInstanceId: z.string(),
    strategyInstanceName: z.string(),
    strategyTemplateName: z.string(),
    totalSubscribers: z.number(),
    activeSubscribers: z.number(),
    pausedSubscribers: z.number(),
    cancelledSubscribers: z.number(),
    totalSubscriptionAmount: z.number(),
    totalCurrentPositionAmount: z.number(),
    averagePositionRatio: z.number(),
    totalOpenPositions: z.number(),
    subscribers: z.array(SubscriberInfoDto),
    totalSubscribersCount: z.number(),
    page: z.number(),
    limit: z.number(),
    lastUpdatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const UpdateStrategyInstanceDto = z
  .object({
    name: z.string(),
    description: z.string(),
    llmModel: z.string(),
    status: z.enum(['draft', 'running', 'paused', 'stopped']),
    mode: z.enum(['BACKTEST', 'PAPER', 'TESTNET', 'LIVE']),
    params: z.object({}).partial().passthrough(),
    metadata: z.object({}).partial().passthrough(),
    updatedBy: z.string(),
  })
  .partial()
  .passthrough()
const TestBarDto = z
  .object({
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
    timestamp: z.number().optional(),
  })
  .passthrough()
const TestStrategyInstanceDto = z
  .object({
    bars: z.array(TestBarDto),
    symbol: z.string(),
    timeframe: z.string(),
    indicators: z.object({}).partial().passthrough(),
    currentPrice: z.number(),
    currentQty: z.number(),
    equity: z.number(),
    multiLegData: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough()
const TestStrategyInstanceResultDto = z
  .object({
    scriptResult: z.object({}).partial().passthrough(),
    filledPrompt: z.string().optional(),
  })
  .passthrough()
const StrategyInstancePublicResponseDto = z
  .object({
    id: z.string(),
    strategyTemplateId: z.string(),
    strategyTemplateName: z.string().optional(),
    strategyTemplateDescription: z.string().optional(),
    name: z.string(),
    description: z.string().nullish(),
    llmModel: z.string(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    isSubscribed: z.boolean().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    stats: StrategyInstanceStatsDto.optional(),
  })
  .passthrough()
const StrategyInstanceSignalPublicResponseDto = z
  .object({
    id: z.string(),
    symbolCode: z.string().nullish(),
    signalType: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT']),
    direction: z.enum(['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT']),
    entryPrice: z.string().nullish(),
    positionSizeQuote: z.string().nullish(),
    aiReasoning: z.string().nullish(),
    publishedAt: z.string(),
  })
  .passthrough()
const RecordTradeDto = z
  .object({
    userStrategyAccountId: z.string(),
    symbol: z.string(),
    market: z.string().optional(),
    side: z.enum(['BUY', 'SELL']),
    positionSide: z.enum(['LONG', 'SHORT']),
    price: z.string(),
    quantity: z.string(),
    fee: z.string().optional().default('0'),
    feeCurrency: z.string().optional(),
    leverage: z.string().optional(),
    orderId: z.string().optional(),
    externalTradeId: z.string().optional(),
    provider: z.string().optional(),
    executedAt: z.string(),
    metadata: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const TradeResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    positionId: z.string().nullable(),
    symbol: z.string(),
    side: z.enum(['BUY', 'SELL']),
    positionSide: z.enum(['LONG', 'SHORT']),
    price: z.string(),
    quantity: z.string(),
    fee: z.string(),
    feeCurrency: z.string().nullable(),
    orderId: z.string().nullable(),
    externalTradeId: z.string().nullable(),
    provider: z.string().nullable(),
    executedAt: z.string(),
  })
  .passthrough()
const QuoteInputDto = z
  .object({
    symbol: z.string(),
    price: z.string(),
    source: z.string().optional(),
    eventTime: z.string().optional(),
  })
  .passthrough()
const QuotesUpdateDto = z.object({ quotes: z.array(QuoteInputDto) }).passthrough()
const QuotesUpdateResponseDto = z
  .object({ updatedPositions: z.number(), updatedAccounts: z.number() })
  .passthrough()
const PositionResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    symbol: z.string(),
    positionSide: z.enum(['LONG', 'SHORT']),
    leverage: z.string().nullable(),
    quantity: z.string(),
    avgEntryPrice: z.string(),
    realizedPnl: z.string(),
    unrealizedPnl: z.string(),
    status: z.enum(['OPEN', 'CLOSED']),
    openedAt: z.string(),
    closedAt: z.string().nullable(),
    exchangeId: z.string().optional(),
    marketType: z.string().optional(),
  })
  .passthrough()
const TriggerPositionSyncDto = z
  .object({
    userId: z.string(),
    userStrategyAccountId: z.string(),
    exchangeId: z.enum(['binance', 'okx', 'hyperliquid']),
    marketType: z.enum(['spot', 'perp']),
  })
  .passthrough()
const PositionSyncResultDto = z
  .object({
    userId: z.string(),
    exchangeId: z.string(),
    marketType: z.string(),
    success: z.boolean(),
    syncedAt: z.string().datetime({ offset: true }),
    exchangePositions: z.number(),
    localPositions: z.number(),
    differences: z.array(z.object({}).partial().passthrough()),
    errors: z.array(z.string()).optional(),
  })
  .passthrough()
const ClosePositionDto = z
  .object({
    userId: z.string(),
    userStrategyAccountId: z.string(),
    positionId: z.string(),
    quantity: z.string(),
    exchangeId: z.enum(['binance', 'okx', 'hyperliquid']),
    marketType: z.enum(['spot', 'perp']),
    note: z.string().optional(),
  })
  .passthrough()
const ClosePositionResponseDto = z
  .object({
    success: z.boolean(),
    orderId: z.string(),
    positionId: z.string(),
    filledQuantity: z.string(),
    averagePrice: z.string().optional(),
    message: z.string(),
  })
  .passthrough()
const TradingSignalResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string().nullish(),
    strategyInstanceId: z.string().nullish(),
    llmStrategyId: z.string().nullish(),
    llmStrategyInstanceId: z.string().nullish(),
    symbolId: z.string(),
    symbolCode: z.string().nullish(),
    sourceType: z.enum(['AI_GENERATED', 'MANUAL', 'SYSTEM']),
    signalType: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT']),
    direction: z.enum(['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT']),
    confidence: z.string().nullish(),
    entryPrice: z.string().nullish(),
    targetPrice: z.string().nullish(),
    stopLoss: z.string().nullish(),
    takeProfit: z.string().nullish(),
    positionSizeQuote: z.string().nullish(),
    positionSizeRatio: z.string().nullish(),
    aiModel: z.string().nullish(),
    aiReasoning: z.string().nullish(),
    aiRawResponse: z.object({}).partial().passthrough().nullish(),
    marketContext: z.object({}).partial().passthrough().nullish(),
    metadata: z.object({}).partial().passthrough().nullish(),
    status: z.enum(['PENDING', 'EXECUTED', 'PARTIAL', 'EXPIRED', 'CANCELLED', 'FAILED']),
    publishedAt: z.string(),
    expiresAt: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const StrategyLegDefinitionDto = z
  .object({
    id: z.string(),
    symbol: z.string(),
    role: z.enum(['primary', 'hedge', 'context']),
    description: z.string().max(200).optional(),
  })
  .passthrough()
const StrategyExecutionConfigDto = z
  .object({
    timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
    cooldownMinutes: z.number().gte(1).lte(1440).optional(),
  })
  .passthrough()
const StrategyTemplateResponseDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    legs: z.array(StrategyLegDefinitionDto).optional(),
    execution: StrategyExecutionConfigDto.optional(),
    dataRequirements: z.record(z.array(z.string())).optional(),
    llmModel: z.string(),
    promptTemplate: z.string(),
    script: z.string().nullish(),
    paramsSchema: z.object({}).partial().passthrough(),
    defaultParams: z.object({}).partial().passthrough().optional(),
    rulesJson: z.object({}).partial().passthrough().optional(),
    requiredFields: z.array(z.string()),
    rulesVersion: z.number(),
    status: z.enum(['draft', 'testing', 'live', 'disabled']),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    lastGenerationSummary: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateStrategyTemplateDto = z
  .object({
    createdBy: z.string().optional(),
    name: z.string().max(100),
    description: z.string().max(500),
    legs: z.array(StrategyLegDefinitionDto),
    execution: StrategyExecutionConfigDto,
    dataRequirements: z.record(z.array(z.string())),
    llmModel: z.string(),
    promptTemplate: z.string().max(20000),
    script: z.string().max(100000),
    paramsSchema: z.object({}).partial().passthrough(),
    defaultParams: z.object({}).partial().passthrough().optional(),
    requiredFields: z.array(z.string()).optional(),
    metadata: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const UpdateStrategyTemplateDto = z
  .object({
    updatedBy: z.string(),
    name: z.string().max(100),
    description: z.string().max(500),
    legs: z.array(StrategyLegDefinitionDto),
    execution: StrategyExecutionConfigDto,
    dataRequirements: z.record(z.array(z.string())),
    llmModel: z.string().max(100),
    promptTemplate: z.string().max(20000),
    script: z.string().max(100000).nullable(),
    paramsSchema: z.object({}).partial().passthrough().nullable(),
    defaultParams: z.object({}).partial().passthrough().nullable(),
    requiredFields: z.array(z.string()),
    status: z.enum(['draft', 'testing', 'live', 'disabled']),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough()
const LlmStrategyResponseDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.enum(['draft', 'live', 'archived']),
    systemPrompt: z.string().nullish(),
    initialPromptTemplate: z.string().nullish(),
    allowedSymbols: z.array(z.string()).optional(),
    allowedTimeframes: z.array(z.string()).optional(),
    riskConfig: z.object({}).partial().passthrough().nullish(),
    createdBy: z.string(),
    updatedBy: z.string(),
    metadata: z.object({}).partial().passthrough().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateLlmStrategyDto = z
  .object({
    name: z.string().max(100),
    description: z.string().max(1000),
    systemPrompt: z.string().max(10000).optional(),
    initialPromptTemplate: z.string().max(10000).optional(),
    allowedSymbols: z.array(z.string()).optional(),
    allowedTimeframes: z.array(z.string()).optional(),
    riskConfig: z.object({}).partial().passthrough().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdBy: z.string().optional(),
  })
  .passthrough()
const UpdateLlmStrategyDto = z
  .object({
    name: z.string().max(100),
    description: z.string().max(1000),
    status: z.enum(['draft', 'live', 'archived']),
    systemPrompt: z.string().max(10000),
    initialPromptTemplate: z.string().max(10000),
    allowedSymbols: z.array(z.string()).nullable(),
    allowedTimeframes: z.array(z.string()).nullable(),
    riskConfig: z.object({}).partial().passthrough().nullable(),
    metadata: z.object({}).partial().passthrough().nullable(),
    updatedBy: z.string(),
  })
  .partial()
  .passthrough()
const LlmStrategyInstanceResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string(),
    name: z.string(),
    status: z.enum(['running', 'paused', 'stopped']),
    mode: z.enum(['LIVE', 'PAPER', 'BACKTEST']),
    llmModel: z.string(),
    scheduleCron: z.string().nullish(),
    maxToolCallsPerRun: z.number().nullish(),
    maxRunsPerHour: z.number().nullish(),
    cooldownSeconds: z.number().nullish(),
    configOverrides: z.object({}).partial().passthrough().nullish(),
    createdBy: z.string(),
    updatedBy: z.string(),
    metadata: z.object({}).partial().passthrough().nullish(),
    lastRunAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateLlmStrategyInstanceDto = z
  .object({
    strategyId: z.string(),
    name: z.string().max(100),
    mode: z.enum(['LIVE', 'PAPER', 'BACKTEST']),
    llmModel: z.string().max(100),
    scheduleCron: z.string().max(100).optional(),
    maxToolCallsPerRun: z.number().gte(1).lte(100).optional(),
    maxRunsPerHour: z.number().gte(1).lte(60).optional(),
    cooldownSeconds: z.number().gte(0).lte(86400).optional(),
    configOverrides: z.object({}).partial().passthrough().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdBy: z.string().optional(),
  })
  .passthrough()
const UpdateLlmStrategyInstanceDto = z
  .object({
    name: z.string().max(100),
    status: z.enum(['running', 'paused', 'stopped']),
    mode: z.enum(['LIVE', 'PAPER', 'BACKTEST']),
    llmModel: z.string().max(100),
    scheduleCron: z.string().max(100),
    maxToolCallsPerRun: z.number().gte(1).lte(100).nullable(),
    maxRunsPerHour: z.number().gte(1).lte(60).nullable(),
    cooldownSeconds: z.number().gte(0).lte(86400).nullable(),
    configOverrides: z.object({}).partial().passthrough().nullable(),
    metadata: z.object({}).partial().passthrough().nullable(),
    updatedBy: z.string(),
  })
  .partial()
  .passthrough()
const LlmStrategyRunResponseDto = z
  .object({
    id: z.string(),
    strategyInstanceId: z.string(),
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }).nullish(),
    status: z.enum(['success', 'failed', 'skipped']),
    reason: z.string().nullish(),
    toolCallsCount: z.number().nullish(),
    llmModel: z.string().nullish(),
    rawDialogSnapshot: z.object({}).partial().passthrough().nullish(),
    generatedSignalId: z.string().nullish(),
    generatedSignal: TradingSignalResponseDto.nullish(),
    errorMessage: z.string().nullish(),
    metadata: z.object({}).partial().passthrough().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const LlmStrategyInstancePublicResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string(),
    strategyName: z.string(),
    strategyDescription: z.string().nullish(),
    name: z.string(),
    description: z.string().nullish(),
    status: z.enum(['running', 'paused', 'stopped']),
    mode: z.enum(['LIVE', 'PAPER', 'BACKTEST']),
    llmModel: z.string(),
    lastRunAt: z.string().datetime({ offset: true }).nullish(),
    isSubscribed: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const AiQuantConversationMessageDto = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string() })
  .passthrough()
const AiQuantConversationLastBacktestRangeDto = z
  .object({
    preset: z.enum(['7D', '30D', '90D', '1Y', 'CUSTOM']),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .passthrough()
const AiQuantConversationLastBacktestExecutionDto = z
  .object({
    initialCash: z.number(),
    leverage: z.number().nullish(),
    slippageBps: z.number(),
    feeBps: z.number(),
    priceSource: z.enum(['open', 'close', 'mid']),
    allowPartial: z.boolean(),
  })
  .passthrough()
const AiQuantConversationLastBacktestConfigDto = z
  .object({
    range: AiQuantConversationLastBacktestRangeDto,
    execution: AiQuantConversationLastBacktestExecutionDto,
  })
  .passthrough()
const AiQuantConversationLastBacktestSummaryDto = z
  .object({
    maxDrawdownPct: z.number(),
    totalReturnPct: z.number(),
    winRatePct: z.number(),
    tradeCount: z.number(),
    openTradeCount: z.number().optional(),
    openPnl: z.number().optional(),
    marketType: z.enum(['spot', 'perp']).optional(),
  })
  .passthrough()
const AiQuantConversationLastBacktestRefDto = z
  .object({
    jobId: z.string(),
    publishedSnapshotId: z.string(),
    config: AiQuantConversationLastBacktestConfigDto,
    summary: AiQuantConversationLastBacktestSummaryDto,
    completedAt: z.string(),
  })
  .passthrough()
const AiQuantConversationResponseDto = z
  .object({
    id: z.string(),
    activeCodegenSessionId: z.string().optional(),
    conversationTitle: z.string().optional(),
    conversationMessages: z.array(AiQuantConversationMessageDto).optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    backtestDraftConfig: AiQuantConversationLastBacktestConfigDto.nullish(),
    lastBacktestRef: AiQuantConversationLastBacktestRefDto.nullish(),
    canonicalDigest: z.string().optional(),
    specDesc: z.object({}).partial().passthrough().optional(),
    semanticGraph: z.object({}).partial().passthrough().optional(),
    validationReport: z.object({}).partial().passthrough().optional(),
    clarificationGate: z.object({}).partial().passthrough().optional(),
    publicationGate: z.object({}).partial().passthrough().optional(),
    scriptCode: z.string().optional(),
    publishedSnapshotId: z.string().optional(),
    publishedSnapshotParamValues: z.object({}).partial().passthrough().optional(),
    publishedSnapshotStrategyConfig: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotBacktestConfigDefaults: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotDeploymentExecutionDefaults: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotDeploymentExecutionConstraints: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotCompatibilityMetadata: z.object({}).partial().passthrough().nullish(),
    strategyInstanceId: z.string().optional(),
    rejectReason: z.string().optional(),
  })
  .passthrough()
const CodegenGuideConfigDto = z
  .object({
    symbolExample: z.string(),
    timeframeExample: z.string(),
    entryRuleExample: z.string(),
    exitRuleExample: z.string(),
    riskRuleExample: z.string(),
  })
  .partial()
  .passthrough()
const StartCodegenSessionDto = z
  .object({ userId: z.string(), initialMessage: z.string(), guideConfig: CodegenGuideConfigDto })
  .partial()
  .passthrough()
const CodegenConversationMessageDto = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string() })
  .passthrough()
const StrategyClarificationItemDto = z
  .object({
    key: z.string(),
    reason: z.enum([
      'missing_entry_rules',
      'missing_exit_rules',
      'missing_stop_loss_rule',
      'missing_take_profit_rule',
      'missing_action_uniqueness',
      'missing_side_scope',
      'direction_ambiguous',
      'ambiguous_risk_effect',
      'ambiguous_condition_basis',
      'missing_exchange',
      'missing_symbol',
      'missing_timeframe',
      'missing_market_type',
      'missing_position_pct',
      'missing_position_mode',
      'conflicting_market_scope',
      'invalid_spot_short_combo',
      'grid_params_missing',
      'ambiguous_state_gate',
      'atomic_semantic_fork',
    ]),
    field: z.string(),
    blocking: z.boolean(),
    allowedAnswers: z.array(z.string()).optional(),
    ruleId: z.string().optional(),
    question: z.string(),
    status: z.enum(['pending', 'answered']),
    answer: z.string().optional(),
  })
  .passthrough()
const StrategyClarificationStateDto = z
  .object({
    status: z.enum(['CLEAR', 'NEEDS_CLARIFICATION']),
    items: z.array(StrategyClarificationItemDto),
  })
  .passthrough()
const StrategyClarificationGateDto = z
  .object({
    blocked: z.boolean(),
    summary: z.string().nullish(),
    items: z.array(StrategyClarificationItemDto),
    pendingItems: z.array(StrategyClarificationItemDto),
  })
  .passthrough()
const PublicationGateMismatchDto = z
  .object({ field: z.string(), expected: z.string(), actual: z.string(), reason: z.string() })
  .passthrough()
const PublicationGateDto = z
  .object({ passed: z.boolean(), blockingMismatches: z.array(PublicationGateMismatchDto) })
  .passthrough()
const CodegenSessionResponseDto = z
  .object({
    id: z.string(),
    conversationId: z.string().nullish(),
    conversationTitle: z.string().optional(),
    conversationMessages: z.array(CodegenConversationMessageDto).optional(),
    status: z.enum([
      'DRAFTING',
      'CONFIRM_GATE',
      'GENERATING',
      'VALIDATING_STATIC',
      'VALIDATING_RUNTIME',
      'VALIDATING_OUTPUT',
      'VALIDATING_CONSISTENCY',
      'PUBLISHED',
      'CONSISTENCY_FAILED',
      'REJECTED',
    ]),
    missingFields: z.array(z.string()).optional(),
    scriptCode: z.string().nullish(),
    publishedSnapshotId: z.string().nullish(),
    publishedSnapshotParamValues: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotStrategyConfig: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotBacktestConfigDefaults: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotDeploymentExecutionDefaults: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotDeploymentExecutionConstraints: z.object({}).partial().passthrough().nullish(),
    publishedSnapshotCompatibilityMetadata: z.object({}).partial().passthrough().nullish(),
    consistencyReport: z.object({}).partial().passthrough().nullish(),
    specDesc: z.object({}).partial().passthrough().nullish(),
    canonicalDigest: z.string().nullish(),
    semanticGraph: z.object({}).partial().passthrough().nullish(),
    validationReport: z.object({}).partial().passthrough().nullish(),
    strategyInstanceId: z.string().nullish(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    clarificationState: StrategyClarificationStateDto.nullish(),
    clarificationGate: StrategyClarificationGateDto,
    publicationGate: PublicationGateDto.nullish(),
    rejectReason: z.string().nullish(),
    assistantPrompt: z.string().optional(),
  })
  .passthrough()
const ContinueCodegenSessionDto = z
  .object({
    userId: z.string().optional(),
    message: z.string(),
    clarificationAnswers: z.record(z.string()).optional(),
    guideConfig: CodegenGuideConfigDto.optional(),
    confirmGenerate: z.boolean().optional(),
    confirmedCanonicalDigest: z.string().optional(),
    providerCode: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().gte(0).lte(2).optional(),
    maxTokens: z.number().gte(1).lte(4000).optional(),
  })
  .passthrough()
const TestLlmCodegenEngineDto = z
  .object({
    userId: z.string(),
    message: z.string(),
    semanticState: z.object({}).partial().passthrough().optional(),
    canonicalSpec: z.object({}).partial().passthrough().optional(),
    providerCode: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().gte(0).lte(2).optional(),
    maxTokens: z.number().gte(1).lte(4000).optional(),
  })
  .passthrough()
const LlmCodegenEngineTestResponseDto = z
  .object({
    providerCode: z.string(),
    model: z.string(),
    scriptCode: z.string(),
    staticPassed: z.boolean(),
    runtimePassed: z.boolean(),
    outputPassed: z.boolean(),
    rejectReason: z.string().optional(),
  })
  .passthrough()
const CreateExchangeAccountDto = z
  .object({
    userId: z.string(),
    userEmail: z.string().optional(),
    exchangeId: z.enum(['binance', 'okx', 'hyperliquid']),
    name: z.string().max(64).optional(),
    isTestnet: z.boolean().optional().default(false),
    marketType: z.enum(['spot', 'perp']).optional().default('spot'),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    passphrase: z.string().optional(),
    mainWalletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional(),
    agentPrivateKey: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  })
  .passthrough()
const ExchangeAccountResponseDto = z
  .object({
    id: z.string().nullish(),
    exchangeId: z.enum(['binance', 'okx', 'hyperliquid']),
    isBound: z.boolean(),
    name: z.string().nullish(),
    maskedCredential: z.string().nullish(),
    isTestnet: z.boolean().nullish().default(false),
    lastValidatedAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }).nullish(),
  })
  .passthrough()
const CreateSubscriptionDto = z
  .object({
    userId: z.string(),
    strategyInstanceId: z.string(),
    exchangeAccountId: z.string().optional(),
    customParams: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const SubscriptionStatus = z.enum(['active', 'paused', 'cancelled'])
const SubscriptionResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    strategyInstanceId: z.string(),
    strategyInstanceName: z.string(),
    strategyDescription: z.string(),
    status: SubscriptionStatus,
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string().nullish(),
    exchangeName: z.string().nullish(),
    subscribedAt: z.string().datetime({ offset: true }),
    unsubscribedAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const UpdateSubscriptionDto = z
  .object({
    userId: z.string(),
    status: z.enum(['active', 'paused', 'cancelled']).optional(),
    exchangeAccountId: z.string().nullish(),
    customParams: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough()
const CreateLlmSubscriptionDto = z
  .object({
    userId: z.string(),
    llmStrategyInstanceId: z.string(),
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string(),
  })
  .passthrough()
const LlmSubscriptionResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    llmStrategyInstanceId: z.string(),
    llmStrategyInstanceName: z.string(),
    llmStrategyName: z.string(),
    llmStrategyDescription: z.string().nullish(),
    status: z.enum(['active', 'paused', 'cancelled']),
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string().nullish(),
    exchangeId: z.string().nullish(),
    exchangeName: z.string().nullish(),
    subscribedAt: z.string().datetime({ offset: true }),
    unsubscribedAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const UpdateLlmSubscriptionDto = z
  .object({
    userId: z.string(),
    status: z.enum(['active', 'paused', 'cancelled']).optional(),
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string().nullish(),
  })
  .passthrough()
const StrategyTemplateListQueryDto = z
  .object({
    page: z.number().gte(1).default(1),
    limit: z.number().gte(1).lte(100).default(20),
    status: z.enum(['draft', 'testing', 'live', 'disabled']),
    keyword: z.string().max(100),
    orderBy: z.string(),
    onlyDraft: z.boolean(),
  })
  .partial()
  .passthrough()
const LlmStrategyListQueryDto = z
  .object({
    page: z.number().gte(1).default(1),
    limit: z.number().gte(1).lte(100).default(20),
    status: z.enum(['draft', 'live', 'archived']),
    keyword: z.string(),
    orderBy: z.string(),
  })
  .partial()
  .passthrough()
const LlmStrategyInstanceListQueryDto = z
  .object({
    page: z.number().gte(1).default(1),
    limit: z.number().gte(1).lte(100).default(20),
    status: z.enum(['running', 'paused', 'stopped']),
    strategyId: z.string(),
    orderBy: z.string(),
  })
  .partial()
  .passthrough()
const LlmStrategyRunsListQueryDto = z
  .object({ page: z.number().gte(1).default(1), limit: z.number().gte(1).lte(100).default(20) })
  .partial()
  .passthrough()

export const schemas = {
  SettingResponseDto,
  CreateSettingDto,
  UpdateSettingDto,
  BacktestExecutionConfigDto,
  BacktestStrategyInputDto,
  BacktestDataRangeDto,
  BacktestRequestedRangeInputDto,
  BacktestBarDto,
  RunBacktestDto,
  BacktestJobSummaryDto,
  BacktestEquityPointDto,
  BacktestTradeRecordDto,
  BacktestTradeMarkerDto,
  BacktestBySymbolDto,
  BacktestOpenPositionDto,
  BacktestPendingSignalDto,
  BacktestReportResponseDto,
  BacktestJobErrorDetailsDto,
  BacktestJobRangeDto,
  BacktestJobInputSummaryDto,
  BacktestJobResponseDto,
  BacktestCapabilitiesResponseDto,
  CheckBacktestSymbolDto,
  BacktestSymbolSupportResponseDto,
  BasePaginationResponseDto,
  MarketSymbolDto,
  MarketBarDto,
  MarketQuoteDto,
  CreateMarketSymbolDto,
  BaseResponseDto,
  UpdateMarketSymbolDto,
  IndicatorParamsResponseDto,
  IndicatorConfigResponseDto,
  IndicatorParamsDto,
  CreateIndicatorConfigDto,
  UpdateIndicatorConfigDto,
  IndicatorConfigCacheReloadResponseDto,
  CreateStrategyAccountDto,
  StrategyAccountResponseDto,
  MutateBalanceDto,
  LedgerEntryResponseDto,
  StrategyPnlDailyResponseDto,
  GenerateDailyReportDto,
  AccountStrategyMetricsDto,
  AccountStrategyListItemDto,
  AccountStrategyEquityPointDto,
  AccountStrategyLeverageRangeDto,
  AccountStrategyConsistencySummaryDto,
  AccountStrategySnapshotDto,
  AccountStrategyTimelineEventDto,
  AccountStrategyAccountOverviewDto,
  AccountStrategyPositionOverviewDto,
  AccountStrategyLatestOrderDto,
  RuntimeExecutionStateDto,
  AccountStrategyExecutionConfigDto,
  AccountStrategyDeploymentDto,
  AccountStrategyDetailResponseDto,
  AccountStrategyActionDto,
  AccountStrategyDeployDto,
  AccountStrategyUpdateExecutionLeverageDto,
  CreateStrategyInstanceDto,
  StrategyInstanceStatsDto,
  StrategyInstanceResponseDto,
  SubscriberInfoDto,
  StrategyInstanceSubscriptionDetailsDto,
  UpdateStrategyInstanceDto,
  TestBarDto,
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
  StrategyInstancePublicResponseDto,
  StrategyInstanceSignalPublicResponseDto,
  RecordTradeDto,
  TradeResponseDto,
  QuoteInputDto,
  QuotesUpdateDto,
  QuotesUpdateResponseDto,
  PositionResponseDto,
  TriggerPositionSyncDto,
  PositionSyncResultDto,
  ClosePositionDto,
  ClosePositionResponseDto,
  TradingSignalResponseDto,
  StrategyLegDefinitionDto,
  StrategyExecutionConfigDto,
  StrategyTemplateResponseDto,
  CreateStrategyTemplateDto,
  UpdateStrategyTemplateDto,
  LlmStrategyResponseDto,
  CreateLlmStrategyDto,
  UpdateLlmStrategyDto,
  LlmStrategyInstanceResponseDto,
  CreateLlmStrategyInstanceDto,
  UpdateLlmStrategyInstanceDto,
  LlmStrategyRunResponseDto,
  LlmStrategyInstancePublicResponseDto,
  AiQuantConversationMessageDto,
  AiQuantConversationLastBacktestRangeDto,
  AiQuantConversationLastBacktestExecutionDto,
  AiQuantConversationLastBacktestConfigDto,
  AiQuantConversationLastBacktestSummaryDto,
  AiQuantConversationLastBacktestRefDto,
  AiQuantConversationResponseDto,
  CodegenGuideConfigDto,
  StartCodegenSessionDto,
  CodegenConversationMessageDto,
  StrategyClarificationItemDto,
  StrategyClarificationStateDto,
  StrategyClarificationGateDto,
  PublicationGateMismatchDto,
  PublicationGateDto,
  CodegenSessionResponseDto,
  ContinueCodegenSessionDto,
  TestLlmCodegenEngineDto,
  LlmCodegenEngineTestResponseDto,
  CreateExchangeAccountDto,
  ExchangeAccountResponseDto,
  CreateSubscriptionDto,
  SubscriptionStatus,
  SubscriptionResponseDto,
  UpdateSubscriptionDto,
  CreateLlmSubscriptionDto,
  LlmSubscriptionResponseDto,
  UpdateLlmSubscriptionDto,
  StrategyTemplateListQueryDto,
  LlmStrategyListQueryDto,
  LlmStrategyInstanceListQueryDto,
  LlmStrategyRunsListQueryDto,
}

const AccountStrategyDetailTransportEnvelope = z
  .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
  .passthrough()

const endpoints = makeApi([
  {
    method: 'get',
    path: '/account/ai-quant/conversations',
    alias: 'AccountAiQuantConversationsController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: z.array(AiQuantConversationResponseDto),
  },
  {
    method: 'delete',
    path: '/account/ai-quant/conversations/:id',
    alias: 'AccountAiQuantConversationsController_remove',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/account/ai-quant/strategies',
    alias: 'AccountStrategyViewController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['running', 'stopped', 'draft']).optional(),
      },
      {
        name: 'subscribedOnly',
        type: 'Query',
        schema: z.boolean().optional(),
      },
      {
        name: 'excludeDraft',
        type: 'Query',
        schema: z.boolean().optional(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AccountStrategyListItemDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/account/ai-quant/strategies/:id',
    alias: 'AccountStrategyViewController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/account/ai-quant/strategies/:id',
    alias: 'AccountStrategyViewController_remove',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/account/ai-quant/strategies/:id/actions',
    alias: 'AccountStrategyViewController_action',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AccountStrategyActionDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/account/ai-quant/strategies/:id/execution/leverage',
    alias: 'AccountStrategyViewController_updateDeploymentLeverage',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AccountStrategyUpdateExecutionLeverageDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/account/ai-quant/strategies/deploy',
    alias: 'AccountStrategyViewController_deploy',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AccountStrategyDeployDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/account/ai-quant/strategies/deploy-requests/:deployRequestId/result',
    alias: 'AccountStrategyViewController_deployResult',
    requestFormat: 'json',
    parameters: [
      {
        name: 'deployRequestId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/accounts/strategy-accounts',
    alias: 'AccountsController_createAccount',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateStrategyAccountDto,
      },
    ],
    response: StrategyAccountResponseDto,
  },
  {
    method: 'get',
    path: '/accounts/strategy-accounts',
    alias: 'AccountsController_listAccounts',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'strategyId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'withDailyStats',
        type: 'Query',
        schema: z.boolean().optional(),
      },
      {
        name: 'onlyActive',
        type: 'Query',
        schema: z.boolean().optional(),
      },
      {
        name: 'baseCurrency',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyAccountResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/accounts/strategy-accounts/:accountId',
    alias: 'AccountsController_getAccountDetail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'accountId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'withDailyStats',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: StrategyAccountResponseDto,
  },
  {
    method: 'get',
    path: '/accounts/strategy-accounts/:accountId/daily-pnl',
    alias: 'AccountsController_listDailyPnl',
    requestFormat: 'json',
    parameters: [
      {
        name: 'accountId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'lastDays',
        type: 'Query',
        schema: z.number().gte(1).lte(365).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyPnlDailyResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/accounts/strategy-accounts/:accountId/deposit',
    alias: 'AccountsController_deposit',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: MutateBalanceDto,
      },
      {
        name: 'accountId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyAccountResponseDto,
  },
  {
    method: 'get',
    path: '/accounts/strategy-accounts/:accountId/ledger',
    alias: 'AccountsController_listLedger',
    requestFormat: 'json',
    parameters: [
      {
        name: 'accountId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'type',
        type: 'Query',
        schema: z
          .enum(['DEPOSIT', 'WITHDRAW', 'REALIZED_PNL', 'FEE', 'FUNDING_FEE', 'ADJUSTMENT'])
          .optional(),
      },
      {
        name: 'start',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'end',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'includeSystemOnly',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LedgerEntryResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/accounts/strategy-accounts/:accountId/withdraw',
    alias: 'AccountsController_withdraw',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: MutateBalanceDto,
      },
      {
        name: 'accountId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyAccountResponseDto,
  },
  {
    method: 'post',
    path: '/accounts/strategy-accounts/reports/daily',
    alias: 'AccountsController_generateDailyReport',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ date: z.string() }).partial().passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/backtesting/capabilities',
    alias: 'BacktestingController_getCapabilities',
    requestFormat: 'json',
    parameters: [
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: BacktestCapabilitiesResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/backtesting/jobs',
    alias: 'BacktestingController_createJob',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: RunBacktestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: BacktestJobResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/backtesting/jobs/:id',
    alias: 'BacktestingController_getJob',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: BacktestJobResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/backtesting/jobs/:id/result',
    alias: 'BacktestingController_getJobResult',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: BacktestReportResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/backtesting/run',
    alias: 'BacktestingController_run',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: RunBacktestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: BacktestReportResponseDto,
  },
  {
    method: 'post',
    path: '/backtesting/symbols/check',
    alias: 'BacktestingController_checkSymbolSupport',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CheckBacktestSymbolDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: BacktestSymbolSupportResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/exchange-accounts',
    alias: 'ExchangeAccountsController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateExchangeAccountDto,
      },
    ],
    response: z
      .object({ data: ExchangeAccountResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/exchange-accounts',
    alias: 'ExchangeAccountsController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: z.array(ExchangeAccountResponseDto), message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/exchange-accounts/:exchangeId',
    alias: 'ExchangeAccountsController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'exchangeId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.object({ data: z.null(), message: z.string().optional() }).passthrough(),
  },
  {
    method: 'get',
    path: '/health',
    alias: 'HealthController_health',
    requestFormat: 'json',
    response: z
      .object({
        data: z
          .object({
            service: z.string(),
            status: z.enum(['ok', 'degraded', 'down']),
            timestamp: z.string(),
          })
          .partial()
          .passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/internal/indicators/series',
    alias: 'InternalIndicatorsController_getSeries',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/internal/indicators/snapshot',
    alias: 'InternalIndicatorsController_getSnapshot',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'post',
    path: '/llm-strategy-codegen/engine/test',
    alias: 'LiveLlmStrategyCodegenController_testEngine',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: TestLlmCodegenEngineDto,
      },
      {
        name: 'x-engine-test-token',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: LlmCodegenEngineTestResponseDto,
  },
  {
    method: 'post',
    path: '/llm-strategy-codegen/sessions',
    alias: 'LiveLlmStrategyCodegenController_startSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: StartCodegenSessionDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: CodegenSessionResponseDto,
  },
  {
    method: 'get',
    path: '/llm-strategy-codegen/sessions/:id',
    alias: 'LiveLlmStrategyCodegenController_getSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: CodegenSessionResponseDto,
  },
  {
    method: 'post',
    path: '/llm-strategy-codegen/sessions/:id/messages',
    alias: 'LiveLlmStrategyCodegenController_continueSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: ContinueCodegenSessionDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-user-id',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: CodegenSessionResponseDto,
  },
  {
    method: 'get',
    path: '/llm-strategy-instances',
    alias: 'LiveLlmStrategyInstancesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'llmModel',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'strategyId',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmStrategyInstancePublicResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/llm-strategy-instances/:id',
    alias: 'LiveLlmStrategyInstancesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: LlmStrategyInstancePublicResponseDto,
  },
  {
    method: 'get',
    path: '/llm-strategy-instances/:id/signals',
    alias: 'LiveLlmStrategyInstancesController_listSignals',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(TradingSignalResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/llm-strategy-subscriptions',
    alias: 'LlmStrategySubscriptionsController_subscribe',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateLlmSubscriptionDto,
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: 'get',
    path: '/llm-strategy-subscriptions',
    alias: 'LlmStrategySubscriptionsController_listMySubscriptions',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['active', 'paused', 'cancelled']).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmSubscriptionResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/llm-strategy-subscriptions/:subscriptionId',
    alias: 'LlmStrategySubscriptionsController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: 'patch',
    path: '/llm-strategy-subscriptions/:subscriptionId',
    alias: 'LlmStrategySubscriptionsController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateLlmSubscriptionDto,
      },
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: 'delete',
    path: '/llm-strategy-subscriptions/:subscriptionId',
    alias: 'LlmStrategySubscriptionsController_cancel',
    requestFormat: 'json',
    parameters: [
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/market/bars',
    alias: 'MarketDataController_getBars',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(1000).optional().default(500),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'timeframe',
        type: 'Query',
        schema: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
      },
      {
        name: 'start',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'end',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'provider',
        type: 'Query',
        schema: z.enum(['BINANCE', 'OKX', 'HYPERLIQUID']).optional(),
      },
    ],
    response: z.array(MarketBarDto),
  },
  {
    method: 'get',
    path: '/market/quote',
    alias: 'MarketDataController_getQuote',
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: MarketQuoteDto,
  },
  {
    method: 'get',
    path: '/market/stream/ticker',
    alias: 'MarketDataController_streamTicker',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/market/symbols',
    alias: 'MarketDataController_listSymbols',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'type',
        type: 'Query',
        schema: z.enum(['CRYPTO', 'STOCK', 'FOREX']).optional(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['ACTIVE', 'DISABLED']).optional(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']).optional(),
      },
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(MarketSymbolDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/ops/indicator-configs',
    alias: 'OpsIndicatorConfigsController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'symbolCode',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'timeframe',
        type: 'Query',
        schema: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
      },
      {
        name: 'type',
        type: 'Query',
        schema: z.enum(['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO']).optional(),
      },
      {
        name: 'isEnabled',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(IndicatorConfigResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/ops/indicator-configs',
    alias: 'OpsIndicatorConfigsController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateIndicatorConfigDto,
      },
    ],
    response: IndicatorConfigResponseDto,
  },
  {
    method: 'patch',
    path: '/ops/indicator-configs/:id',
    alias: 'OpsIndicatorConfigsController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateIndicatorConfigDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: IndicatorConfigResponseDto,
  },
  {
    method: 'delete',
    path: '/ops/indicator-configs/:id',
    alias: 'OpsIndicatorConfigsController_remove',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'patch',
    path: '/ops/indicator-configs/reload/cache',
    alias: 'OpsIndicatorConfigsController_reloadCache',
    requestFormat: 'json',
    response: z.object({ success: z.boolean() }).passthrough(),
  },
  {
    method: 'get',
    path: '/ops/llm-strategies',
    alias: 'OpsLlmStrategiesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['draft', 'live', 'archived']).optional(),
      },
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'orderBy',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmStrategyResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/ops/llm-strategies',
    alias: 'OpsLlmStrategiesController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `创建LLM策略请求体`,
        type: 'Body',
        schema: CreateLlmStrategyDto,
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: 'get',
    path: '/ops/llm-strategies/:id',
    alias: 'OpsLlmStrategiesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: 'put',
    path: '/ops/llm-strategies/:id',
    alias: 'OpsLlmStrategiesController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `更新LLM策略请求体`,
        type: 'Body',
        schema: UpdateLlmStrategyDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: 'delete',
    path: '/ops/llm-strategies/:id',
    alias: 'OpsLlmStrategiesController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/ops/llm-strategy-instances',
    alias: 'OpsLlmStrategyInstancesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['running', 'paused', 'stopped']).optional(),
      },
      {
        name: 'strategyId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'orderBy',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmStrategyInstanceResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/ops/llm-strategy-instances',
    alias: 'OpsLlmStrategyInstancesController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `创建LLM策略实例请求体`,
        type: 'Body',
        schema: CreateLlmStrategyInstanceDto,
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: 'get',
    path: '/ops/llm-strategy-instances/:id',
    alias: 'OpsLlmStrategyInstancesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: 'put',
    path: '/ops/llm-strategy-instances/:id',
    alias: 'OpsLlmStrategyInstancesController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `更新LLM策略实例请求体`,
        type: 'Body',
        schema: UpdateLlmStrategyInstanceDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: 'delete',
    path: '/ops/llm-strategy-instances/:id',
    alias: 'OpsLlmStrategyInstancesController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/ops/llm-strategy-instances/:id/runs',
    alias: 'OpsLlmStrategyInstancesController_listRuns',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
    ],
    response: z.array(LlmStrategyRunResponseDto),
  },
  {
    method: 'get',
    path: '/ops/llm-strategy-instances/:id/test-log/stream',
    alias: 'OpsLlmStrategyInstancesController_streamTestLogs',
    description: `通过 Server-Sent Events 实时推送指定实例的测试日志，仅包含当前 operatorId 触发的测试记录。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'operatorId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/ops/llm-strategy-instances/:id/test-run',
    alias: 'OpsLlmStrategyInstancesController_testRun',
    description: `立即触发一次针对指定 LLM 策略实例的完整分析流程，用于联调和验证，不考虑 scheduleCron、冷却时间和每小时运行次数限制。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'operatorId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: LlmStrategyRunResponseDto,
  },
  {
    method: 'get',
    path: '/ops/llm-strategy-instances/runs/:runId',
    alias: 'OpsLlmStrategyInstancesController_getRunDetail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'runId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: LlmStrategyRunResponseDto,
  },
  {
    method: 'post',
    path: '/ops/market-symbols',
    alias: 'OpsMarketSymbolsController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateMarketSymbolDto,
      },
    ],
    response: BaseResponseDto.and(z.object({ data: MarketSymbolDto }).partial().passthrough()),
  },
  {
    method: 'put',
    path: '/ops/market-symbols/:code',
    alias: 'OpsMarketSymbolsController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateMarketSymbolDto,
      },
      {
        name: 'code',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(z.object({ data: MarketSymbolDto }).partial().passthrough()),
  },
  {
    method: 'get',
    path: '/ops/settings',
    alias: 'OpsSettingsController_getAllSettings',
    requestFormat: 'json',
    parameters: [
      {
        name: 'category',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: z.array(SettingResponseDto), message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'post',
    path: '/ops/settings',
    alias: 'OpsSettingsController_createSetting',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateSettingDto,
      },
    ],
    response: z.object({ data: SettingResponseDto, message: z.string() }).partial().passthrough(),
  },
  {
    method: 'put',
    path: '/ops/settings/:key',
    alias: 'OpsSettingsController_updateSetting',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateSettingDto,
      },
      {
        name: 'key',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.object({ data: SettingResponseDto, message: z.string() }).partial().passthrough(),
  },
  {
    method: 'patch',
    path: '/ops/settings/reload',
    alias: 'OpsSettingsController_reloadSettings',
    requestFormat: 'json',
    response: z
      .object({
        data: z.object({ success: z.boolean() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'post',
    path: '/ops/strategy-instances',
    alias: 'OpsStrategyInstancesController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateStrategyInstanceDto,
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: 'get',
    path: '/ops/strategy-instances',
    alias: 'OpsStrategyInstancesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'strategyTemplateId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['draft', 'running', 'paused', 'stopped']).optional(),
      },
      {
        name: 'mode',
        type: 'Query',
        schema: z.enum(['BACKTEST', 'PAPER', 'TESTNET', 'LIVE']).optional(),
      },
      {
        name: 'llmModel',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'includeStats',
        type: 'Query',
        schema: z.boolean().optional().default(true),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyInstanceResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/ops/strategy-instances/:id',
    alias: 'OpsStrategyInstancesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: 'patch',
    path: '/ops/strategy-instances/:id',
    alias: 'OpsStrategyInstancesController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateStrategyInstanceDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: 'delete',
    path: '/ops/strategy-instances/:id',
    alias: 'OpsStrategyInstancesController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/ops/strategy-instances/:id/generate-signal',
    alias: 'OpsStrategyInstancesController_generateSignal',
    description: `手动触发指定策略实例的信号生成流程。会根据当前市场数据执行策略脚本、调用 AI 并生成真实交易信号。用于测试或紧急情况下手动触发信号生成。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.object({ message: z.string(), instanceId: z.string() }).partial().passthrough(),
  },
  {
    method: 'get',
    path: '/ops/strategy-instances/:id/subscriptions',
    alias: 'OpsStrategyInstancesController_getSubscriptionDetails',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
    ],
    response: StrategyInstanceSubscriptionDetailsDto,
  },
  {
    method: 'post',
    path: '/ops/strategy-instances/:id/test-run',
    alias: 'OpsStrategyInstancesController_testRun',
    description: `根据传入的市场数据执行关联策略模板的脚本，返回脚本结果及填充后的 Prompt，用于本地调试。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: TestStrategyInstanceDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: TestStrategyInstanceResultDto,
  },
  {
    method: 'get',
    path: '/ops/strategy-instances/:id/test-run/prefill',
    alias: 'OpsStrategyInstancesController_buildTestPayload',
    description: `根据策略模板的 legs 和 dataRequirements，从行情表中拉取最近一段 K 线数据，按 multiLegData 结构返回，方便调用方快速填充调试参数。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: TestStrategyInstanceDto,
  },
  {
    method: 'get',
    path: '/ops/strategy-templates',
    alias: 'OpsStrategyTemplatesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['draft', 'testing', 'live', 'disabled']).optional(),
      },
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().max(100).optional(),
      },
      {
        name: 'orderBy',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'onlyDraft',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyTemplateResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/ops/strategy-templates',
    alias: 'OpsStrategyTemplatesController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `创建策略模板请求体`,
        type: 'Body',
        schema: CreateStrategyTemplateDto,
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: 'get',
    path: '/ops/strategy-templates/:id',
    alias: 'OpsStrategyTemplatesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: 'put',
    path: '/ops/strategy-templates/:id',
    alias: 'OpsStrategyTemplatesController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `更新策略模板请求体`,
        type: 'Body',
        schema: UpdateStrategyTemplateDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: 'delete',
    path: '/ops/strategy-templates/:id',
    alias: 'OpsStrategyTemplatesController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/ops/strategy-templates/:id/generate-script',
    alias: 'OpsStrategyTemplatesController_generateScript',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.object({ script: z.string() }).partial().passthrough(),
  },
  {
    method: 'post',
    path: '/ops/strategy-templates/validate-script',
    alias: 'OpsStrategyTemplatesController_validateScript',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        description: `脚本验证请求`,
        type: 'Body',
        schema: z.object({ script: z.string() }).passthrough(),
      },
    ],
    response: z
      .object({ valid: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()) })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/ops/trading-signals',
    alias: 'OpsTradingSignalsController_list',
    requestFormat: 'json',
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(TradingSignalResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/positions/close',
    alias: 'PositionsController_closePosition',
    description: `用户通过市价单主动平仓（支持全平或部分平仓）`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: ClosePositionDto,
      },
    ],
    response: ClosePositionResponseDto,
  },
  {
    method: 'post',
    path: '/positions/fills',
    alias: 'PositionsController_recordTrade',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: RecordTradeDto,
      },
    ],
    response: TradeResponseDto,
  },
  {
    method: 'get',
    path: '/positions/history',
    alias: 'PositionsController_listHistoricalPositions',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'accountId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'positionSide',
        type: 'Query',
        schema: z.enum(['LONG', 'SHORT']).optional(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['OPEN', 'CLOSED']).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(PositionResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/positions/open',
    alias: 'PositionsController_listOpenPositions',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'accountId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'positionSide',
        type: 'Query',
        schema: z.enum(['LONG', 'SHORT']).optional(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['OPEN', 'CLOSED']).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(PositionResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/positions/quotes',
    alias: 'PositionsController_applyQuotes',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: QuotesUpdateDto,
      },
    ],
    response: QuotesUpdateResponseDto,
  },
  {
    method: 'post',
    path: '/positions/sync',
    alias: 'PositionsController_triggerPositionSync',
    description: `从交易所获取实际仓位并与本地数据对比同步。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: TriggerPositionSyncDto,
      },
    ],
    response: PositionSyncResultDto,
  },
  {
    method: 'post',
    path: '/positions/sync/all',
    alias: 'PositionsController_syncAllPositions',
    requestFormat: 'json',
    response: z.array(PositionSyncResultDto),
  },
  {
    method: 'get',
    path: '/strategy-instances',
    alias: 'LiveStrategyInstancesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'llmModel',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'strategyTemplateId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'includeStats',
        type: 'Query',
        schema: z.boolean().optional().default(true),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyInstancePublicResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/strategy-instances/:id',
    alias: 'LiveStrategyInstancesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: StrategyInstancePublicResponseDto,
  },
  {
    method: 'get',
    path: '/strategy-instances/:id/signals',
    alias: 'LiveStrategyInstancesController_listSignals',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyInstanceSignalPublicResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/strategy-subscriptions',
    alias: 'StrategySubscriptionsController_subscribe',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateSubscriptionDto,
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: 'get',
    path: '/strategy-subscriptions',
    alias: 'StrategySubscriptionsController_listMySubscriptions',
    requestFormat: 'json',
    parameters: [
      {
        name: 'page',
        type: 'Query',
        schema: z.number().gte(1).optional().default(1),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().gte(1).lte(100).optional().default(20),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'status',
        type: 'Query',
        schema: z.enum(['active', 'paused', 'cancelled']).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(SubscriptionResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/strategy-subscriptions/:subscriptionId',
    alias: 'StrategySubscriptionsController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: 'patch',
    path: '/strategy-subscriptions/:subscriptionId',
    alias: 'StrategySubscriptionsController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateSubscriptionDto,
      },
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: 'delete',
    path: '/strategy-subscriptions/:subscriptionId',
    alias: 'StrategySubscriptionsController_cancel',
    requestFormat: 'json',
    parameters: [
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'userId',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
])

export const aiQuantifyClient = new Zodios('/api/v1', endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options)
}
