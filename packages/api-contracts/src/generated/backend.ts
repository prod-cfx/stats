import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

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
  .passthrough();
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
    type: z.enum(["string", "number", "boolean", "json"]).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isSystem: z.boolean().optional(),
  })
  .passthrough();
const UpdateSettingDto = z
  .object({
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.object({}).partial().passthrough(),
      z.array(z.any()),
    ]),
    type: z.enum(["string", "number", "boolean", "json"]).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isSystem: z.boolean().optional(),
  })
  .passthrough();
const SendVerificationCodeRequestDto = z
  .object({
    email: z.string(),
    purpose: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"]),
  })
  .passthrough();
const RegisterRequestDto = z
  .object({
    email: z.string(),
    password: z.string(),
    nickname: z.string().optional(),
  })
  .passthrough();
const UserProfileResponseDto = z
  .object({
    id: z.string(),
    email: z.string(),
    nickname: z.string().nullish(),
    avatarUrl: z.string().optional(),
    emailVerified: z.boolean(),
    isGuest: z.boolean(),
    roles: z.array(z.string()),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const AuthResponseDto = z
  .object({ accessToken: z.string(), user: UserProfileResponseDto })
  .passthrough();
const LoginRequestDto = z
  .object({ email: z.string(), password: z.string() })
  .passthrough();
const PasswordResetRequestDto = z.object({ email: z.string() }).passthrough();
const VerifyPasswordResetRequestDto = z
  .object({
    email: z.string(),
    code: z.string(),
    newPassword: z.string().min(6),
  })
  .passthrough();
const VerifyEmailRequestDto = z
  .object({
    email: z.string(),
    code: z.string(),
    updateUserStatus: z.boolean().optional().default(true),
  })
  .passthrough();
const ResendVerificationRequestDto = z
  .object({ email: z.string() })
  .passthrough();
const Function = z.object({}).partial().passthrough();
const UserStrategyAccountResponseDto = z
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
  .passthrough();
const BasePaginationResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(z.object({}).partial().passthrough()),
  })
  .passthrough();
const LedgerEntryResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    positionId: z.string().nullable(),
    type: z.enum([
      "DEPOSIT",
      "WITHDRAW",
      "REALIZED_PNL",
      "FEE",
      "FUNDING_FEE",
      "ADJUSTMENT",
    ]),
    amount: z.string(),
    balanceAfter: z.string(),
    referenceId: z.string().nullable(),
    description: z.string().nullable(),
    occurredAt: z.string(),
    meta: z.object({}).partial().passthrough().nullable(),
  })
  .passthrough();
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
  .passthrough();
const TradeResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    positionId: z.string().nullable(),
    symbol: z.string(),
    side: z.enum(["BUY", "SELL"]),
    positionSide: z.enum(["LONG", "SHORT"]),
    price: z.string(),
    quantity: z.string(),
    fee: z.string(),
    feeCurrency: z.string().nullable(),
    orderId: z.string().nullable(),
    externalTradeId: z.string().nullable(),
    provider: z.string().nullable(),
    executedAt: z.string(),
  })
  .passthrough();
const PositionResponseDto = z
  .object({
    id: z.string(),
    userStrategyAccountId: z.string(),
    symbol: z.string(),
    positionSide: z.enum(["LONG", "SHORT"]),
    leverage: z.string().nullable(),
    quantity: z.string(),
    avgEntryPrice: z.string(),
    realizedPnl: z.string(),
    unrealizedPnl: z.string(),
    status: z.enum(["OPEN", "CLOSED"]),
    openedAt: z.string(),
    closedAt: z.string().nullable(),
    exchangeId: z.string().optional(),
    marketType: z.string().optional(),
  })
  .passthrough();
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
  .passthrough();
const ClosePositionDto = z
  .object({
    userStrategyAccountId: z.string(),
    positionId: z.string(),
    quantity: z.string(),
    exchangeId: z.enum(["binance", "okx", "hyperliquid"]),
    marketType: z.enum(["spot", "perp"]),
    note: z.string().optional(),
  })
  .passthrough();
const ClosePositionResponseDto = z
  .object({
    success: z.boolean(),
    orderId: z.string(),
    positionId: z.string(),
    filledQuantity: z.string(),
    averagePrice: z.string().optional(),
    message: z.string(),
  })
  .passthrough();
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
  .passthrough();
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
  })
  .passthrough();
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
  .passthrough();
const AdminCreateMarketSymbolDto = z
  .object({
    code: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    exchange: z.string(),
    type: z.enum(["CRYPTO", "STOCK", "FOREX"]),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    status: z.enum(["ACTIVE", "DISABLED"]),
    precisionPrice: z.number().gte(0),
    precisionQuantity: z.number().gte(0),
    tickSize: z.string().nullish(),
    lotSize: z.string().nullish(),
    isMarginEnabled: z.boolean(),
  })
  .passthrough();
const BaseResponseDto = z
  .object({
    data: z.object({}).partial().passthrough(),
    message: z.string().optional(),
  })
  .passthrough();
const AdminUpdateMarketSymbolDto = z
  .object({
    baseAsset: z.string(),
    quoteAsset: z.string(),
    exchange: z.string(),
    type: z.enum(["CRYPTO", "STOCK", "FOREX"]),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    status: z.enum(["ACTIVE", "DISABLED"]),
    precisionPrice: z.number().gte(0),
    precisionQuantity: z.number().gte(0),
    tickSize: z.string().nullable(),
    lotSize: z.string().nullable(),
    isMarginEnabled: z.boolean(),
  })
  .partial()
  .passthrough();
const TradingSignalResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string().nullish(),
    strategyInstanceId: z.string().nullish(),
    llmStrategyId: z.string().nullish(),
    llmStrategyInstanceId: z.string().nullish(),
    symbolId: z.string(),
    symbolCode: z.string().nullish(),
    sourceType: z.enum(["AI_GENERATED", "MANUAL", "SYSTEM"]),
    signalType: z.enum(["ENTRY", "EXIT", "ADJUSTMENT", "ALERT"]),
    direction: z.enum(["BUY", "SELL", "CLOSE_LONG", "CLOSE_SHORT"]),
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
    status: z.enum([
      "PENDING",
      "EXECUTED",
      "PARTIAL",
      "EXPIRED",
      "CANCELLED",
      "FAILED",
    ]),
    publishedAt: z.string(),
    expiresAt: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
const StrategyLegDefinitionDto = z
  .object({
    id: z.string(),
    symbol: z.string(),
    role: z.enum(["primary", "hedge", "context"]),
    description: z.string().max(200).optional(),
  })
  .passthrough();
const StrategyExecutionConfigDto = z
  .object({
    timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]),
    cooldownMinutes: z.number().gte(1).lte(1440).optional(),
  })
  .passthrough();
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
    status: z.enum(["draft", "testing", "live", "disabled"]),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    lastGenerationSummary: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateStrategyTemplateDto = z
  .object({
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
  .passthrough();
const UpdateStrategyTemplateDto = z
  .object({
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
    status: z.enum(["draft", "testing", "live", "disabled"]),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough();
const LlmStrategyResponseDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "live", "archived"]),
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
  .passthrough();
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
  })
  .passthrough();
const UpdateLlmStrategyDto = z
  .object({
    name: z.string().max(100),
    description: z.string().max(1000),
    status: z.enum(["draft", "live", "archived"]),
    systemPrompt: z.string().max(10000),
    initialPromptTemplate: z.string().max(10000),
    allowedSymbols: z.array(z.string()).nullable(),
    allowedTimeframes: z.array(z.string()).nullable(),
    riskConfig: z.object({}).partial().passthrough().nullable(),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough();
const LlmStrategyInstanceResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string(),
    name: z.string(),
    status: z.enum(["running", "paused", "stopped"]),
    mode: z.enum(["LIVE", "PAPER", "BACKTEST"]),
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
  .passthrough();
const CreateLlmStrategyInstanceDto = z
  .object({
    strategyId: z.string(),
    name: z.string().max(100),
    mode: z.enum(["LIVE", "PAPER", "BACKTEST"]),
    llmModel: z.string().max(100),
    scheduleCron: z.string().max(100).optional(),
    maxToolCallsPerRun: z.number().gte(1).lte(100).optional(),
    maxRunsPerHour: z.number().gte(1).lte(60).optional(),
    cooldownSeconds: z.number().gte(0).lte(86400).optional(),
    configOverrides: z.object({}).partial().passthrough().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
const UpdateLlmStrategyInstanceDto = z
  .object({
    name: z.string().max(100),
    status: z.enum(["running", "paused", "stopped"]),
    mode: z.enum(["LIVE", "PAPER", "BACKTEST"]),
    llmModel: z.string().max(100),
    scheduleCron: z.string().max(100),
    maxToolCallsPerRun: z.number().gte(1).lte(100).nullable(),
    maxRunsPerHour: z.number().gte(1).lte(60).nullable(),
    cooldownSeconds: z.number().gte(0).lte(86400).nullable(),
    configOverrides: z.object({}).partial().passthrough().nullable(),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough();
const LlmStrategyRunResponseDto = z
  .object({
    id: z.string(),
    strategyInstanceId: z.string(),
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }).nullish(),
    status: z.enum(["success", "failed", "skipped"]),
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
  .passthrough();
const UserLlmStrategyInstanceResponseDto = z
  .object({
    id: z.string(),
    strategyId: z.string(),
    strategyName: z.string(),
    strategyDescription: z.string().nullish(),
    name: z.string(),
    description: z.string().nullish(),
    status: z.enum(["running", "paused", "stopped"]),
    mode: z.enum(["LIVE", "PAPER", "BACKTEST"]),
    llmModel: z.string(),
    lastRunAt: z.string().datetime({ offset: true }).nullish(),
    isSubscribed: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateStrategyInstanceDto = z
  .object({
    strategyTemplateId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    llmModel: z.string(),
    mode: z.enum(["BACKTEST", "PAPER", "TESTNET", "LIVE"]).optional(),
    params: z.object({}).partial().passthrough().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
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
  .passthrough();
const StrategyInstanceResponseDto = z
  .object({
    id: z.string(),
    strategyTemplateId: z.string(),
    strategyTemplateName: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    llmModel: z.string(),
    params: z.object({}).partial().passthrough().optional(),
    status: z.enum(["draft", "running", "paused", "stopped"]),
    mode: z.enum(["BACKTEST", "PAPER", "TESTNET", "LIVE"]),
    startedAt: z.string().datetime({ offset: true }).optional(),
    stoppedAt: z.string().datetime({ offset: true }).optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    stats: StrategyInstanceStatsDto.optional(),
  })
  .passthrough();
const SubscriberInfoDto = z
  .object({
    userId: z.string(),
    username: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(["active", "paused", "cancelled"]),
    subscriptionAmount: z.number(),
    currentPositionAmount: z.number(),
    openPositionsCount: z.number(),
    exchangeAccountId: z.string().optional(),
    exchangeName: z.string().optional(),
    subscribedAt: z.string().datetime({ offset: true }),
    customParams: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
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
    currentPage: z.number(),
    pageSize: z.number(),
    lastUpdatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const UpdateStrategyInstanceDto = z
  .object({
    name: z.string(),
    description: z.string(),
    llmModel: z.string(),
    status: z.enum(["draft", "running", "paused", "stopped"]),
    mode: z.enum(["BACKTEST", "PAPER", "TESTNET", "LIVE"]),
    params: z.object({}).partial().passthrough(),
    metadata: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough();
const TestBarDto = z
  .object({
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
    timestamp: z.number().optional(),
  })
  .passthrough();
const TestStrategyInstanceDto = z
  .object({
    bars: z.array(TestBarDto),
    symbol: z.string(),
    timeframe: z.string(),
    indicators: z.object({}).partial().passthrough(),
    currentPrice: z.number(),
    multiLegData: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough();
const TestStrategyInstanceResultDto = z
  .object({
    scriptResult: z.object({}).partial().passthrough(),
    filledPrompt: z.string().optional(),
  })
  .passthrough();
const UserStrategyInstanceResponseDto = z
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
  .passthrough();
const StrategyInstanceSignalPublicResponseDto = z
  .object({
    id: z.string(),
    symbolCode: z.string().nullish(),
    signalType: z.enum(["ENTRY", "EXIT", "ADJUSTMENT", "ALERT"]),
    direction: z.enum(["BUY", "SELL", "CLOSE_LONG", "CLOSE_SHORT"]),
    entryPrice: z.string().nullish(),
    positionSizeQuote: z.string().nullish(),
    aiReasoning: z.string().nullish(),
    publishedAt: z.string(),
  })
  .passthrough();
const CreateExchangeAccountDto = z
  .object({
    exchangeId: z.enum(["binance", "okx", "hyperliquid"]),
    name: z.string().max(64).optional(),
    isTestnet: z.boolean().optional().default(false),
    marketType: z.enum(["spot", "perp"]).optional().default("spot"),
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
  .passthrough();
const ExchangeAccountResponseDto = z
  .object({
    id: z.string(),
    exchangeId: z.enum(["binance", "okx", "hyperliquid"]),
    name: z.string().optional(),
    isTestnet: z.boolean().default(false),
    lastValidatedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateSubscriptionDto = z
  .object({
    strategyInstanceId: z.string(),
    exchangeAccountId: z.string().optional(),
    customParams: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
const SubscriptionStatus = z.enum(["active", "paused", "cancelled"]);
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
  .passthrough();
const UpdateSubscriptionDto = z
  .object({
    status: z.enum(["active", "paused", "cancelled"]),
    exchangeAccountId: z.string().nullable(),
    customParams: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough();
const CreateLlmSubscriptionDto = z
  .object({
    llmStrategyInstanceId: z.string(),
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string(),
  })
  .passthrough();
const LlmSubscriptionResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    llmStrategyInstanceId: z.string(),
    llmStrategyInstanceName: z.string(),
    llmStrategyName: z.string(),
    llmStrategyDescription: z.string().nullish(),
    status: z.enum(["active", "paused", "cancelled"]),
    customParams: z.object({}).partial().passthrough().nullish(),
    exchangeAccountId: z.string().nullish(),
    exchangeId: z.string().nullish(),
    exchangeName: z.string().nullish(),
    subscribedAt: z.string().datetime({ offset: true }),
    unsubscribedAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const UpdateLlmSubscriptionDto = z
  .object({
    status: z.enum(["active", "paused", "cancelled"]),
    customParams: z.object({}).partial().passthrough().nullable(),
    exchangeAccountId: z.string().nullable(),
  })
  .partial()
  .passthrough();
const AdminLoginDto = z
  .object({ username: z.string(), password: z.string() })
  .passthrough();
const AdminProfileDto = z
  .object({
    id: z.string(),
    username: z.string(),
    email: z.string().nullish(),
    nickName: z.string().nullish(),
    isFrozen: z.boolean(),
    menuPermissions: z.array(z.string()),
  })
  .passthrough();
const AdminAuthResponseDto = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresIn: z.string().optional(),
    admin: AdminProfileDto,
  })
  .passthrough();
const AdminRefreshDto = z.object({ refreshToken: z.string() }).passthrough();
const AdminRegisterDto = z
  .object({
    username: z.string(),
    password: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    roleCodes: z.array(z.string()).optional(),
  })
  .passthrough();
const AdminAssignedRoleDto = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullish(),
  })
  .passthrough();
const AdminUserDto = z
  .object({
    id: z.string(),
    username: z.string(),
    nickName: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    phone: z.string().nullable(),
    isFrozen: z.boolean(),
    roles: z.array(AdminAssignedRoleDto).default([]),
  })
  .passthrough();
const AdminMenuPermissionDto = z
  .object({
    id: z.string(),
    parentId: z.string().nullish(),
    name: z.string(),
    route: z.string().nullish(),
    icon: z.string().nullish(),
    sortOrder: z.number(),
    code: z.string().nullable(),
    type: z.enum(["DIRECTORY", "MENU", "FEATURE"]),
    children: z.array(z.object({}).partial().passthrough()).optional(),
  })
  .passthrough();
const AdminUserInfoDto = z
  .object({
    id: z.string(),
    username: z.string(),
    nickName: z.string().nullish(),
    headPic: z.string().nullish(),
    menus: z.array(AdminMenuPermissionDto),
    menuPermissions: z.array(z.string()),
    featurePermissions: z.array(z.string()),
    apiPermissions: z.array(z.string()),
  })
  .passthrough();
const CreateAdminUserDto = z
  .object({
    username: z.string(),
    password: z.string(),
    nickName: z.string().max(50).optional(),
    email: z.string().optional(),
    avatarUrl: z.string().optional(),
    phone: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
  })
  .passthrough();
const UpdateAdminUserDto = z
  .object({
    nickName: z.string().max(50),
    email: z.string(),
    avatarUrl: z.string(),
    phone: z.string(),
    isFrozen: z.boolean(),
    roleIds: z.array(z.string()),
  })
  .partial()
  .passthrough();
const CreateAdminRoleDto = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    menuPermissions: z.array(z.string()).optional(),
    featurePermissions: z.array(z.string()).optional(),
    apiPermissions: z.array(z.string()).optional(),
  })
  .passthrough();
const UpdateAdminRoleDto = z
  .object({
    name: z.string(),
    description: z.string(),
    menuPermissions: z.array(z.string()),
    featurePermissions: z.array(z.string()),
    apiPermissions: z.array(z.string()),
  })
  .partial()
  .passthrough();
const CreateAdminMenuDto = z
  .object({
    parentId: z.string().optional(),
    type: z.string(),
    title: z.string(),
    icon: z.string().optional(),
    code: z.string().optional(),
    path: z.string().optional(),
    description: z.string().optional(),
    i18nKey: z.string().optional(),
    sort: z.number().optional().default(0),
    isShow: z.boolean().optional().default(true),
  })
  .passthrough();
const UpdateAdminMenuDto = z
  .object({
    parentId: z.string(),
    type: z.string(),
    title: z.string(),
    icon: z.string(),
    code: z.string(),
    path: z.string(),
    description: z.string(),
    i18nKey: z.string(),
    sort: z.number(),
    isShow: z.boolean(),
  })
  .partial()
  .passthrough();
const StrategyTemplateListQueryDto = z
  .object({
    page: z.number().gte(1),
    limit: z.number().gte(1).lte(100),
    status: z.enum(["draft", "testing", "live", "disabled"]).optional(),
    keyword: z.string().max(100).optional(),
    orderBy: z.string().optional(),
    onlyDraft: z.boolean().optional(),
  })
  .passthrough();
const LlmStrategyListQueryDto = z
  .object({
    page: z.number().gte(1),
    limit: z.number().gte(1).lte(100),
    status: z.enum(["draft", "live", "archived"]).optional(),
    keyword: z.string().optional(),
    orderBy: z.string().optional(),
  })
  .passthrough();
const LlmStrategyInstanceListQueryDto = z
  .object({
    page: z.number().gte(1),
    limit: z.number().gte(1).lte(100),
    status: z.enum(["running", "paused", "stopped"]).optional(),
    strategyId: z.string().optional(),
    orderBy: z.string().optional(),
  })
  .passthrough();
const LlmStrategyRunsListQueryDto = z
  .object({ limit: z.number().gte(1).lte(100) })
  .partial()
  .passthrough();

export const schemas = {
  SettingResponseDto,
  CreateSettingDto,
  UpdateSettingDto,
  SendVerificationCodeRequestDto,
  RegisterRequestDto,
  UserProfileResponseDto,
  AuthResponseDto,
  LoginRequestDto,
  PasswordResetRequestDto,
  VerifyPasswordResetRequestDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  Function,
  UserStrategyAccountResponseDto,
  BasePaginationResponseDto,
  LedgerEntryResponseDto,
  StrategyPnlDailyResponseDto,
  TradeResponseDto,
  PositionResponseDto,
  PositionSyncResultDto,
  ClosePositionDto,
  ClosePositionResponseDto,
  MarketSymbolDto,
  MarketBarDto,
  MarketQuoteDto,
  AdminCreateMarketSymbolDto,
  BaseResponseDto,
  AdminUpdateMarketSymbolDto,
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
  UserLlmStrategyInstanceResponseDto,
  CreateStrategyInstanceDto,
  StrategyInstanceStatsDto,
  StrategyInstanceResponseDto,
  SubscriberInfoDto,
  StrategyInstanceSubscriptionDetailsDto,
  UpdateStrategyInstanceDto,
  TestBarDto,
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
  UserStrategyInstanceResponseDto,
  StrategyInstanceSignalPublicResponseDto,
  CreateExchangeAccountDto,
  ExchangeAccountResponseDto,
  CreateSubscriptionDto,
  SubscriptionStatus,
  SubscriptionResponseDto,
  UpdateSubscriptionDto,
  CreateLlmSubscriptionDto,
  LlmSubscriptionResponseDto,
  UpdateLlmSubscriptionDto,
  AdminLoginDto,
  AdminProfileDto,
  AdminAuthResponseDto,
  AdminRefreshDto,
  AdminRegisterDto,
  AdminAssignedRoleDto,
  AdminUserDto,
  AdminMenuPermissionDto,
  AdminUserInfoDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  CreateAdminRoleDto,
  UpdateAdminRoleDto,
  CreateAdminMenuDto,
  UpdateAdminMenuDto,
  StrategyTemplateListQueryDto,
  LlmStrategyListQueryDto,
  LlmStrategyInstanceListQueryDto,
  LlmStrategyRunsListQueryDto,
};

const endpoints = makeApi([
  {
    method: "post",
    path: "/accounts/user-strategy",
    alias: "AccountsController_createAccount",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: UserStrategyAccountResponseDto,
  },
  {
    method: "get",
    path: "/accounts/user-strategy",
    alias: "AccountsController_listAccounts",
    requestFormat: "json",
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(UserStrategyAccountResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/accounts/user-strategy/:accountId",
    alias: "AccountsController_getAccountDetail",
    requestFormat: "json",
    parameters: [
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: UserStrategyAccountResponseDto,
  },
  {
    method: "get",
    path: "/accounts/user-strategy/:accountId/daily-pnl",
    alias: "AccountsController_listDailyPnl",
    requestFormat: "json",
    parameters: [
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyPnlDailyResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/accounts/user-strategy/:accountId/deposit",
    alias: "AccountsController_deposit",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: UserStrategyAccountResponseDto,
  },
  {
    method: "get",
    path: "/accounts/user-strategy/:accountId/ledger",
    alias: "AccountsController_listLedger",
    requestFormat: "json",
    parameters: [
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LedgerEntryResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/accounts/user-strategy/:accountId/withdraw",
    alias: "AccountsController_withdraw",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: UserStrategyAccountResponseDto,
  },
  {
    method: "post",
    path: "/accounts/user-strategy/reports/daily",
    alias: "AccountsController_generateDailyReport",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/auth/login",
    alias: "AdminAuthController_login",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminLoginDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: "get",
    path: "/admin/auth/me",
    alias: "AdminAuthController_me",
    requestFormat: "json",
    response: AdminProfileDto,
  },
  {
    method: "post",
    path: "/admin/auth/refresh",
    alias: "AdminAuthController_refresh",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ refreshToken: z.string() }).passthrough(),
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: "post",
    path: "/admin/auth/register",
    alias: "AdminAuthController_register",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminRegisterDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: "get",
    path: "/admin/indicator-configs",
    alias: "AdminIndicatorConfigsController_list",
    requestFormat: "json",
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(z.object({}).partial().passthrough()) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/indicator-configs",
    alias: "AdminIndicatorConfigsController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "patch",
    path: "/admin/indicator-configs/:id",
    alias: "AdminIndicatorConfigsController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "delete",
    path: "/admin/indicator-configs/:id",
    alias: "AdminIndicatorConfigsController_remove",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "patch",
    path: "/admin/indicator-configs/reload/cache",
    alias: "AdminIndicatorConfigsController_reloadCache",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/llm-strategies",
    alias: "AdminLlmStrategiesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1).optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100).optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["draft", "live", "archived"]).optional(),
      },
      {
        name: "keyword",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "orderBy",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmStrategyResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/llm-strategies",
    alias: "AdminLlmStrategiesController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `创建LLM策略请求体`,
        type: "Body",
        schema: CreateLlmStrategyDto,
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: "get",
    path: "/admin/llm-strategies/:id",
    alias: "AdminLlmStrategiesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: "put",
    path: "/admin/llm-strategies/:id",
    alias: "AdminLlmStrategiesController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `更新LLM策略请求体`,
        type: "Body",
        schema: UpdateLlmStrategyDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyResponseDto,
  },
  {
    method: "delete",
    path: "/admin/llm-strategies/:id",
    alias: "AdminLlmStrategiesController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/llm-strategy-instances",
    alias: "AdminLlmStrategyInstancesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1).optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100).optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["running", "paused", "stopped"]).optional(),
      },
      {
        name: "strategyId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "orderBy",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmStrategyInstanceResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/llm-strategy-instances",
    alias: "AdminLlmStrategyInstancesController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `创建LLM策略实例请求体`,
        type: "Body",
        schema: CreateLlmStrategyInstanceDto,
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: "get",
    path: "/admin/llm-strategy-instances/:id",
    alias: "AdminLlmStrategyInstancesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: "put",
    path: "/admin/llm-strategy-instances/:id",
    alias: "AdminLlmStrategyInstancesController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `更新LLM策略实例请求体`,
        type: "Body",
        schema: UpdateLlmStrategyInstanceDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyInstanceResponseDto,
  },
  {
    method: "delete",
    path: "/admin/llm-strategy-instances/:id",
    alias: "AdminLlmStrategyInstancesController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/llm-strategy-instances/:id/runs",
    alias: "AdminLlmStrategyInstancesController_listRuns",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100).optional(),
      },
    ],
    response: z.array(LlmStrategyRunResponseDto),
  },
  {
    method: "get",
    path: "/admin/llm-strategy-instances/:id/test-log/stream",
    alias: "AdminLlmStrategyInstancesController_streamTestLogs",
    description: `通过 Server-Sent Events 实时推送指定实例的管理员测试日志，仅包含当前登录管理员自身触发的测试记录。`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/llm-strategy-instances/:id/test-run",
    alias: "AdminLlmStrategyInstancesController_testRun",
    description: `立即触发一次针对指定 LLM 策略实例的完整分析流程，用于在后台进行联调和验证，不考虑 scheduleCron、冷却时间和每小时运行次数限制。`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyRunResponseDto,
  },
  {
    method: "get",
    path: "/admin/llm-strategy-instances/runs/:runId",
    alias: "AdminLlmStrategyInstancesController_getRunDetail",
    requestFormat: "json",
    parameters: [
      {
        name: "runId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmStrategyRunResponseDto,
  },
  {
    method: "post",
    path: "/admin/market-symbols",
    alias: "AdminMarketSymbolsController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminCreateMarketSymbolDto,
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: MarketSymbolDto }).partial().passthrough()
    ),
  },
  {
    method: "put",
    path: "/admin/market-symbols/:code",
    alias: "AdminMarketSymbolsController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminUpdateMarketSymbolDto,
      },
      {
        name: "code",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: MarketSymbolDto }).partial().passthrough()
    ),
  },
  {
    method: "get",
    path: "/admin/menu",
    alias: "AdminMenuController_findMenuTree[0]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/menu",
    alias: "AdminMenuController_create[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminMenuDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menu/:id",
    alias: "AdminMenuController_findById[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "put",
    path: "/admin/menu/:id",
    alias: "AdminMenuController_update[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminMenuDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "delete",
    path: "/admin/menu/:id",
    alias: "AdminMenuController_delete[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menu/flat",
    alias: "AdminMenuController_findFlat[0]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menu/permission",
    alias: "AdminMenuController_findPermissionMenus[0]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menus",
    alias: "AdminMenuController_findMenuTree[1]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/menus",
    alias: "AdminMenuController_create[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminMenuDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menus/:id",
    alias: "AdminMenuController_findById[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "put",
    path: "/admin/menus/:id",
    alias: "AdminMenuController_update[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminMenuDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "delete",
    path: "/admin/menus/:id",
    alias: "AdminMenuController_delete[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menus/flat",
    alias: "AdminMenuController_findFlat[1]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menus/permission",
    alias: "AdminMenuController_findPermissionMenus[1]",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/role",
    alias: "AdminRoleController_list[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "code",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({
          items: z.array(
            z
              .object({
                id: z.string(),
                code: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                menuPermissions: z.array(z.string()),
                featurePermissions: z.array(z.string()),
                apiPermissions: z.array(z.string()),
                createdAt: z.string().datetime({ offset: true }),
                updatedAt: z.string().datetime({ offset: true }),
              })
              .partial()
              .passthrough()
          ),
        })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/role",
    alias: "AdminRoleController_create[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminRoleDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/role/:id",
    alias: "AdminRoleController_findOne[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "put",
    path: "/admin/role/:id",
    alias: "AdminRoleController_update[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminRoleDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "delete",
    path: "/admin/role/:id",
    alias: "AdminRoleController_delete[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/roles",
    alias: "AdminRoleController_list[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "code",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({
          items: z.array(
            z
              .object({
                id: z.string(),
                code: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                menuPermissions: z.array(z.string()),
                featurePermissions: z.array(z.string()),
                apiPermissions: z.array(z.string()),
                createdAt: z.string().datetime({ offset: true }),
                updatedAt: z.string().datetime({ offset: true }),
              })
              .partial()
              .passthrough()
          ),
        })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/roles",
    alias: "AdminRoleController_create[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminRoleDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/roles/:id",
    alias: "AdminRoleController_findOne[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "put",
    path: "/admin/roles/:id",
    alias: "AdminRoleController_update[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminRoleDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "delete",
    path: "/admin/roles/:id",
    alias: "AdminRoleController_delete[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/settings",
    alias: "AdminSettingsController_getAllSettings",
    requestFormat: "json",
    parameters: [
      {
        name: "category",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: z.array(SettingResponseDto), message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/settings",
    alias: "AdminSettingsController_createSetting",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateSettingDto,
      },
    ],
    response: z
      .object({ data: SettingResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "put",
    path: "/admin/settings/:key",
    alias: "AdminSettingsController_updateSetting",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateSettingDto,
      },
      {
        name: "key",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: SettingResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "patch",
    path: "/admin/settings/reload",
    alias: "AdminSettingsController_reloadSettings",
    requestFormat: "json",
    response: z
      .object({
        data: z.object({ success: z.boolean() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/strategy-instances",
    alias: "AdminStrategyInstancesController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateStrategyInstanceDto,
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: "get",
    path: "/admin/strategy-instances",
    alias: "AdminStrategyInstancesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "strategyTemplateId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["draft", "running", "paused", "stopped"]).optional(),
      },
      {
        name: "mode",
        type: "Query",
        schema: z.enum(["BACKTEST", "PAPER", "TESTNET", "LIVE"]).optional(),
      },
      {
        name: "llmModel",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "includeStats",
        type: "Query",
        schema: z.boolean().optional().default(true),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyInstanceResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/admin/strategy-instances/:id",
    alias: "AdminStrategyInstancesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: "patch",
    path: "/admin/strategy-instances/:id",
    alias: "AdminStrategyInstancesController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateStrategyInstanceDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: StrategyInstanceResponseDto,
  },
  {
    method: "delete",
    path: "/admin/strategy-instances/:id",
    alias: "AdminStrategyInstancesController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/strategy-instances/:id/generate-signal",
    alias: "AdminStrategyInstancesController_generateSignal",
    description: `手动触发指定策略实例的信号生成流程。会根据当前市场数据执行策略脚本、调用 AI 并生成真实交易信号。仅限管理员使用，用于测试或紧急情况下手动触发信号生成。`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ message: z.string(), instanceId: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/strategy-instances/:id/subscriptions",
    alias: "AdminStrategyInstancesController_getSubscriptionDetails",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
    ],
    response: StrategyInstanceSubscriptionDetailsDto,
  },
  {
    method: "post",
    path: "/admin/strategy-instances/:id/test-run",
    alias: "AdminStrategyInstancesController_testRun",
    description: `根据传入的市场数据执行关联策略模板的脚本，返回脚本结果及填充后的 Prompt，用于本地调试。`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: TestStrategyInstanceDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: TestStrategyInstanceResultDto,
  },
  {
    method: "get",
    path: "/admin/strategy-instances/:id/test-run/prefill",
    alias: "AdminStrategyInstancesController_buildTestPayload",
    description: `根据策略模板的 legs 和 dataRequirements，从行情表中拉取最近一段 K 线数据，按 multiLegData 结构返回，方便前端一键填充调试参数。`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: TestStrategyInstanceDto,
  },
  {
    method: "get",
    path: "/admin/strategy-templates",
    alias: "AdminStrategyTemplatesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1).optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100).optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["draft", "testing", "live", "disabled"]).optional(),
      },
      {
        name: "keyword",
        type: "Query",
        schema: z.string().max(100).optional(),
      },
      {
        name: "orderBy",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "onlyDraft",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyTemplateResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/strategy-templates",
    alias: "AdminStrategyTemplatesController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `创建策略模板请求体`,
        type: "Body",
        schema: CreateStrategyTemplateDto,
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: "get",
    path: "/admin/strategy-templates/:id",
    alias: "AdminStrategyTemplatesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: "put",
    path: "/admin/strategy-templates/:id",
    alias: "AdminStrategyTemplatesController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `更新策略模板请求体`,
        type: "Body",
        schema: UpdateStrategyTemplateDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: StrategyTemplateResponseDto,
  },
  {
    method: "delete",
    path: "/admin/strategy-templates/:id",
    alias: "AdminStrategyTemplatesController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/strategy-templates/:id/generate-script",
    alias: "AdminStrategyTemplatesController_generateScript",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.object({ script: z.string() }).partial().passthrough(),
  },
  {
    method: "post",
    path: "/admin/strategy-templates/validate-script",
    alias: "AdminStrategyTemplatesController_validateScript",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `脚本验证请求`,
        type: "Body",
        schema: z.object({ script: z.string() }).passthrough(),
      },
    ],
    response: z
      .object({
        valid: z.boolean(),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
      })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/trading-signals",
    alias: "AdminTradingSignalsController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "strategyInstanceId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "strategyId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "llmStrategyId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "llmStrategyInstanceId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "symbolId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z
          .enum([
            "PENDING",
            "EXECUTED",
            "PARTIAL",
            "EXPIRED",
            "CANCELLED",
            "FAILED",
          ])
          .optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(TradingSignalResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/admin/user",
    alias: "AdminUserController_list[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "keyword",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminUserDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/user",
    alias: "AdminUserController_create[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminUserDto,
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "get",
    path: "/admin/user/:id",
    alias: "AdminUserController_findOne[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "put",
    path: "/admin/user/:id",
    alias: "AdminUserController_update[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminUserDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "delete",
    path: "/admin/user/:id",
    alias: "AdminUserController_delete[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/user/info",
    alias: "AdminUserController_info[0]",
    requestFormat: "json",
    response: AdminUserInfoDto,
  },
  {
    method: "post",
    path: "/admin/user/login",
    alias: "AdminUserController_login[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminLoginDto,
      },
    ],
    response: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresIn: z.string(),
        user: AdminUserDto,
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/user/refresh",
    alias: "AdminUserController_refresh[0]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ refreshToken: z.string() }).passthrough(),
      },
    ],
    response: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresIn: z.string(),
        user: AdminUserDto,
      })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/users",
    alias: "AdminUserController_list[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "keyword",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminUserDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/users",
    alias: "AdminUserController_create[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminUserDto,
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "get",
    path: "/admin/users/:id",
    alias: "AdminUserController_findOne[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "put",
    path: "/admin/users/:id",
    alias: "AdminUserController_update[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminUserDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: "delete",
    path: "/admin/users/:id",
    alias: "AdminUserController_delete[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/users/info",
    alias: "AdminUserController_info[1]",
    requestFormat: "json",
    response: AdminUserInfoDto,
  },
  {
    method: "post",
    path: "/admin/users/login",
    alias: "AdminUserController_login[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminLoginDto,
      },
    ],
    response: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresIn: z.string(),
        user: AdminUserDto,
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/users/refresh",
    alias: "AdminUserController_refresh[1]",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ refreshToken: z.string() }).passthrough(),
      },
    ],
    response: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresIn: z.string(),
        user: AdminUserDto,
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/auth/login",
    alias: "AuthController_login",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: LoginRequestDto,
      },
    ],
    response: z
      .object({ data: AuthResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: "post",
    path: "/auth/password-reset",
    alias: "AuthController_requestPasswordReset",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/password-reset/verify",
    alias: "AuthController_verifyPasswordReset",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: VerifyPasswordResetRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/register",
    alias: "AuthController_register",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: RegisterRequestDto,
      },
    ],
    response: z
      .object({ data: AuthResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: "post",
    path: "/auth/resend-verification",
    alias: "AuthController_resendVerification",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/send-verification-code",
    alias: "AuthController_sendVerificationCode",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: SendVerificationCodeRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/verify-email",
    alias: "AuthController_verifyEmail",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: VerifyEmailRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/health",
    alias: "HealthController_health",
    requestFormat: "json",
    response: z
      .object({
        data: z
          .object({
            service: z.string(),
            status: z.enum(["ok", "degraded", "down"]),
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
    method: "get",
    path: "/internal/indicators/series",
    alias: "InternalIndicatorsController_getSeries",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/internal/indicators/snapshot",
    alias: "InternalIndicatorsController_getSnapshot",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/llm-strategy-instances",
    alias: "UserLlmStrategyInstancesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "llmModel",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "strategyId",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(UserLlmStrategyInstanceResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/llm-strategy-instances/:id",
    alias: "UserLlmStrategyInstancesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: UserLlmStrategyInstanceResponseDto,
  },
  {
    method: "get",
    path: "/llm-strategy-instances/:id/signals",
    alias: "UserLlmStrategyInstancesController_listSignals",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(z.object({}).partial().passthrough()) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/market/bars",
    alias: "MarketDataController_getBars",
    requestFormat: "json",
    response: z.array(MarketBarDto),
  },
  {
    method: "get",
    path: "/market/quote",
    alias: "MarketDataController_getQuote",
    requestFormat: "json",
    response: MarketQuoteDto,
  },
  {
    method: "get",
    path: "/market/stream/ticker",
    alias: "MarketDataController_streamTicker",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "get",
    path: "/market/symbols",
    alias: "MarketDataController_listSymbols",
    requestFormat: "json",
    parameters: [
      {
        name: "keyword",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]).optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["ACTIVE", "DISABLED"]).optional(),
      },
      {
        name: "type",
        type: "Query",
        schema: z.enum(["CRYPTO", "STOCK", "FOREX"]).optional(),
      },
      {
        name: "exchange",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(MarketSymbolDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/positions/close",
    alias: "PositionsController_closePosition",
    description: `用户通过市价单主动平仓（支持全平或部分平仓）`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: ClosePositionDto,
      },
    ],
    response: ClosePositionResponseDto,
  },
  {
    method: "post",
    path: "/positions/fills",
    alias: "PositionsController_recordTrade",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: TradeResponseDto,
  },
  {
    method: "get",
    path: "/positions/history",
    alias: "PositionsController_listHistoricalPositions",
    requestFormat: "json",
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(PositionResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/positions/open",
    alias: "PositionsController_listOpenPositions",
    requestFormat: "json",
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(PositionResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/positions/quotes",
    alias: "PositionsController_applyQuotes",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/positions/sync",
    alias: "PositionsController_triggerPositionSync",
    description: `从交易所获取实际仓位并与本地数据对比同步。管理员可以对任意账户执行同步操作。`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: PositionSyncResultDto,
  },
  {
    method: "post",
    path: "/positions/sync/all",
    alias: "PositionsController_syncAllPositions",
    description: `批量同步所有活跃用户的仓位。仅管理员可以执行此操作。`,
    requestFormat: "json",
    response: z.array(PositionSyncResultDto),
  },
  {
    method: "get",
    path: "/strategy-instances",
    alias: "UserStrategyInstancesController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "llmModel",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "strategyTemplateId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "includeStats",
        type: "Query",
        schema: z.boolean().optional().default(true),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(UserStrategyInstanceResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/strategy-instances/:id",
    alias: "UserStrategyInstancesController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: UserStrategyInstanceResponseDto,
  },
  {
    method: "get",
    path: "/strategy-instances/:id/signals",
    alias: "UserStrategyInstancesController_listSignals",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(StrategyInstanceSignalPublicResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/user/exchange-accounts",
    alias: "UserExchangeAccountsController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateExchangeAccountDto,
      },
    ],
    response: ExchangeAccountResponseDto,
  },
  {
    method: "get",
    path: "/user/exchange-accounts",
    alias: "UserExchangeAccountsController_list",
    requestFormat: "json",
    response: z.array(ExchangeAccountResponseDto),
  },
  {
    method: "delete",
    path: "/user/exchange-accounts/:accountId",
    alias: "UserExchangeAccountsController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "accountId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/user/llm-strategy-subscriptions",
    alias: "UserLlmStrategySubscriptionsController_subscribe",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateLlmSubscriptionDto,
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: "get",
    path: "/user/llm-strategy-subscriptions",
    alias: "UserLlmStrategySubscriptionsController_listMySubscriptions",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["active", "paused", "cancelled"]).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LlmSubscriptionResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/user/llm-strategy-subscriptions/:subscriptionId",
    alias: "UserLlmStrategySubscriptionsController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: "patch",
    path: "/user/llm-strategy-subscriptions/:subscriptionId",
    alias: "UserLlmStrategySubscriptionsController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateLlmSubscriptionDto,
      },
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: LlmSubscriptionResponseDto,
  },
  {
    method: "delete",
    path: "/user/llm-strategy-subscriptions/:subscriptionId",
    alias: "UserLlmStrategySubscriptionsController_cancel",
    requestFormat: "json",
    parameters: [
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/user/strategy-subscriptions",
    alias: "UserStrategySubscriptionsController_subscribe",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateSubscriptionDto,
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: "get",
    path: "/user/strategy-subscriptions",
    alias: "UserStrategySubscriptionsController_listMySubscriptions",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(100),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["active", "paused", "cancelled"]).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(SubscriptionResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/user/strategy-subscriptions/:subscriptionId",
    alias: "UserStrategySubscriptionsController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: "patch",
    path: "/user/strategy-subscriptions/:subscriptionId",
    alias: "UserStrategySubscriptionsController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateSubscriptionDto,
      },
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: SubscriptionResponseDto,
  },
  {
    method: "delete",
    path: "/user/strategy-subscriptions/:subscriptionId",
    alias: "UserStrategySubscriptionsController_cancel",
    requestFormat: "json",
    parameters: [
      {
        name: "subscriptionId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/users/me",
    alias: "UserController_me",
    requestFormat: "json",
    response: UserProfileResponseDto,
  },
]);

export const aiBackendClient = new Zodios(
  "http://localhost:3000/api/v1",
  endpoints
);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
