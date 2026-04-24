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
const CreateTelegramDesktopIntentRequestDto = z
  .object({
    intent: z.enum(['login', 'bind']).default('login'),
    lng: z.enum(['zh', 'en']).default('zh'),
    redirect: z.string(),
  })
  .partial()
  .passthrough()
const TelegramDesktopExchangeRequestDto = z.object({ intentId: z.string() }).passthrough()
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
  .passthrough()
const AuthResponseDto = z
  .object({ accessToken: z.string(), user: UserProfileResponseDto })
  .passthrough()
const TelegramBotWebhookRequestDto = z
  .object({
    message: z.object({}).partial().passthrough(),
    edited_message: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough()
const SendVerificationCodeRequestDto = z
  .object({ email: z.string(), purpose: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']) })
  .passthrough()
const SendEmailLoginCodeRequestDto = z.object({ email: z.string() }).passthrough()
const VerifyEmailLoginCodeRequestDto = z
  .object({ email: z.string(), code: z.string() })
  .passthrough()
const TelegramExchangeRequestDto = z
  .object({
    telegramId: z.string(),
    authDate: z.string(),
    hash: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    photoUrl: z.string().optional(),
    source: z.enum(['web', 'desktop', 'webapp']).optional(),
  })
  .passthrough()
const RegisterRequestDto = z
  .object({ email: z.string(), password: z.string(), nickname: z.string().optional() })
  .passthrough()
const LoginRequestDto = z.object({ email: z.string(), password: z.string() }).passthrough()
const PasswordResetRequestDto = z.object({ email: z.string() }).passthrough()
const VerifyPasswordResetRequestDto = z
  .object({ email: z.string(), code: z.string(), newPassword: z.string().min(6) })
  .passthrough()
const VerifyEmailRequestDto = z
  .object({
    email: z.string(),
    code: z.string(),
    updateUserStatus: z.boolean().optional().default(true),
  })
  .passthrough()
const ResendVerificationRequestDto = z.object({ email: z.string() }).passthrough()
const BindEmailRequestDto = z.object({ email: z.string(), code: z.string() }).passthrough()
const BindTelegramRequestDto = z
  .object({
    telegramId: z.string(),
    authDate: z.string(),
    hash: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    photoUrl: z.string().optional(),
  })
  .passthrough()
const AccountExchangeAccountResponseDto = z
  .object({
    id: z.string().nullish(),
    exchangeId: z.enum(['binance', 'okx', 'hyperliquid']),
    isBound: z.boolean(),
    name: z.string().nullish(),
    maskedCredential: z.string().nullish(),
    isTestnet: z.boolean().nullish(),
    lastValidatedAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }).nullish(),
  })
  .passthrough()
const CreateAccountExchangeAccountDto = z
  .object({
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
const AiQuantConversationMessageResponseDto = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string() })
  .passthrough()
const AiQuantConversationLastBacktestRangeResponseDto = z
  .object({
    preset: z.enum(['7D', '30D', '90D', '1Y', 'CUSTOM']),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .passthrough()
const AiQuantConversationLastBacktestExecutionResponseDto = z
  .object({
    initialCash: z.number(),
    leverage: z.number().nullish(),
    slippageBps: z.number(),
    feeBps: z.number(),
    priceSource: z.enum(['open', 'close', 'mid']),
    allowPartial: z.boolean(),
  })
  .passthrough()
const AiQuantConversationLastBacktestConfigResponseDto = z
  .object({
    range: AiQuantConversationLastBacktestRangeResponseDto,
    execution: AiQuantConversationLastBacktestExecutionResponseDto,
  })
  .passthrough()
const AiQuantConversationLastBacktestSummaryResponseDto = z
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
const AiQuantConversationLastBacktestRefResponseDto = z
  .object({
    jobId: z.string(),
    publishedSnapshotId: z.string(),
    config: AiQuantConversationLastBacktestConfigResponseDto,
    summary: AiQuantConversationLastBacktestSummaryResponseDto,
    completedAt: z.string(),
  })
  .passthrough()
const AiQuantConversationResponseDto = z
  .object({
    id: z.string(),
    activeCodegenSessionId: z.string().optional(),
    conversationTitle: z.string().optional(),
    conversationMessages: z.array(AiQuantConversationMessageResponseDto).optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    backtestDraftConfig: AiQuantConversationLastBacktestConfigResponseDto.nullish(),
    lastBacktestRef: AiQuantConversationLastBacktestRefResponseDto.nullish(),
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
const BasePaginationResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(z.object({}).partial().passthrough()),
  })
  .passthrough()
const AccountAiQuantStrategyListItemResponseDto = z
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
    metrics: z.object({}).partial().passthrough(),
    updatedAt: z.string(),
  })
  .passthrough()
const AccountAiQuantStrategyDetailResponseDto = z
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
    metrics: z.object({}).partial().passthrough(),
    updatedAt: z.string(),
    totalPnl: z.number().nullish(),
    todayPnl: z.number().nullish(),
    equitySeries: z.array(z.object({}).partial().passthrough()),
    snapshot: z.object({}).partial().passthrough(),
    timeline: z.array(z.object({}).partial().passthrough()),
    accountOverview: z.object({}).partial().passthrough(),
    positionOverview: z.object({}).partial().passthrough(),
    latestOrders: z.array(z.object({}).partial().passthrough()),
    deployment: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough()
const AccountAiQuantActionRequestDto = z.object({ action: z.enum(['run', 'stop']) }).passthrough()
const AccountAiQuantDeployRequestDto = z
  .object({
    name: z.string(),
    deployRequestId: z.string(),
    publishedSnapshotId: z.string(),
    exchangeAccountId: z.string().optional(),
    exchangeAccountName: z.string().optional(),
    deploymentExecutionConfig: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const AccountAiQuantUpdateExecutionLeverageRequestDto = z
  .object({ leverage: z.number() })
  .passthrough()
const BacktestingSymbolSupportRequestDto = z
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
const BacktestingSymbolSupportResponseDto = z
  .object({
    status: z.enum(['supported', 'refreshed_then_supported', 'not_supported']),
    reasonCode: z.string().optional(),
    args: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BacktestingCreateJobExecutionDto = z
  .object({
    slippageBps: z.number(),
    feeBps: z.number(),
    priceSource: z.enum(['open', 'close', 'mid']),
  })
  .passthrough()
const BacktestingCreateJobStrategyDto = z
  .object({
    id: z.string().optional(),
    protocolVersion: z.literal('v1'),
    publishedSnapshotId: z.string().optional(),
    params: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BacktestingCreateJobRangeDto = z
  .object({ fromTs: z.number(), toTs: z.number() })
  .passthrough()
const BacktestingCreateJobRequestedRangeInputDto = z
  .object({
    preset: z.enum(['7D', '30D', '90D', '1Y', 'CUSTOM']),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .passthrough()
const BacktestingCreateJobBarDto = z
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
const BacktestingCreateJobRequestDto = z
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
    execution: BacktestingCreateJobExecutionDto,
    strategy: BacktestingCreateJobStrategyDto,
    dataRange: BacktestingCreateJobRangeDto,
    requestedRangeInput: BacktestingCreateJobRequestedRangeInputDto.optional(),
    bars: z.array(BacktestingCreateJobBarDto).optional(),
  })
  .passthrough()
const BacktestingCreateJobErrorDetailsDto = z
  .object({
    code: z.string().optional(),
    message: z.string(),
    args: z.object({}).partial().passthrough().optional(),
  })
  .passthrough()
const BacktestingCreateJobInputSummaryDto = z
  .object({
    symbols: z.array(z.string()),
    baseTimeframe: z.string(),
    stateTimeframes: z.array(z.string()),
    initialCash: z.number(),
    leverage: z.number().nullish(),
    marketType: z.enum(['spot', 'perp']),
    dataRange: BacktestingCreateJobRangeDto,
    requestedRange: BacktestingCreateJobRangeDto,
    appliedRange: BacktestingCreateJobRangeDto.optional(),
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
const BacktestingCreateJobSummaryDto = z
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
const BacktestingCreateJobResponseDto = z
  .object({
    id: z.string(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed']),
    createdAt: z.string(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    error: z.string().optional(),
    errorDetails: BacktestingCreateJobErrorDetailsDto.optional(),
    inputSummary: BacktestingCreateJobInputSummaryDto,
    resultSummary: BacktestingCreateJobSummaryDto.optional(),
  })
  .passthrough()
const LlmCodegenStartRequestDto = z
  .object({ initialMessage: z.string(), guideConfig: z.object({}).partial().passthrough() })
  .partial()
  .passthrough()
const CodegenConversationMessageResponseDto = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string() })
  .passthrough()
const CodegenSessionResponseDto = z
  .object({
    id: z.string(),
    conversationId: z.string().nullish(),
    conversationTitle: z.string().optional(),
    conversationMessages: z.array(CodegenConversationMessageResponseDto).optional(),
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
    clarificationState: z.object({}).partial().passthrough().nullish(),
    clarificationGate: z.object({}).partial().passthrough(),
    publicationGate: z.object({}).partial().passthrough().nullish(),
    strategyInstanceId: z.string().nullish(),
    rejectReason: z.string().nullish(),
    assistantPrompt: z.string().optional(),
  })
  .passthrough()
const LlmCodegenContinueRequestDto = z
  .object({
    message: z.string(),
    clarificationAnswers: z.record(z.string()).optional(),
    guideConfig: z.object({}).partial().passthrough().optional(),
    confirmGenerate: z.boolean().optional(),
    confirmedCanonicalDigest: z.string().optional(),
    providerCode: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
  })
  .passthrough()
const Function = z.object({}).partial().passthrough()
const StrategyPlazaRunRequestDto = z.object({ runRequestId: z.string() }).passthrough()
const AdminLoginDto = z.object({ username: z.string(), password: z.string() }).passthrough()
const AdminProfileDto = z
  .object({
    id: z.string(),
    username: z.string(),
    email: z.string().nullish(),
    nickName: z.string().nullish(),
    isFrozen: z.boolean(),
    menuPermissions: z.array(z.string()),
  })
  .passthrough()
const AdminAuthResponseDto = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresIn: z.string().optional(),
    admin: AdminProfileDto,
  })
  .passthrough()
const AdminRefreshDto = z.object({ refreshToken: z.string() }).passthrough()
const AdminRegisterDto = z
  .object({
    username: z.string(),
    password: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    roleCodes: z.array(z.string()).optional(),
  })
  .passthrough()
const AdminAssignedRoleDto = z
  .object({ id: z.string(), code: z.string(), name: z.string(), description: z.string().nullish() })
  .passthrough()
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
  .passthrough()
const AdminMenuPermissionDto = z
  .object({
    id: z.string(),
    parentId: z.string().nullish(),
    name: z.string(),
    route: z.string().nullish(),
    icon: z.string().nullish(),
    sortOrder: z.number(),
    code: z.string().nullable(),
    type: z.enum(['DIRECTORY', 'MENU', 'FEATURE']),
    children: z.object({}).partial().passthrough(),
  })
  .passthrough()
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
  .passthrough()
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
  .passthrough()
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
  .passthrough()
const CreateAdminRoleDto = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    menuPermissions: z.array(z.string()).optional(),
    featurePermissions: z.array(z.string()).optional(),
    apiPermissions: z.array(z.string()).optional(),
  })
  .passthrough()
const UpdateAdminRoleDto = z
  .object({
    name: z.string(),
    description: z.string(),
    menuPermissions: z.array(z.string()),
    featurePermissions: z.array(z.string()),
    apiPermissions: z.array(z.string()),
  })
  .partial()
  .passthrough()
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
  .passthrough()
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
  .passthrough()
const AdminDataPullTaskResponseDto = z
  .object({
    id: z.number(),
    key: z.string(),
    name: z.string(),
    source: z.string().nullish(),
    type: z.string().nullish(),
    cron: z.string().nullish(),
    intervalSeconds: z.number().nullish(),
    enabled: z.boolean(),
    cursor: z.string().nullish(),
    lastStatus: z.string().nullish(),
    lastRunAt: z.string().datetime({ offset: true }).nullish(),
    lastSuccessAt: z.string().datetime({ offset: true }).nullish(),
    lastError: z.string().nullish(),
    meta: z.object({}).partial().passthrough().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateAdminDataPullTaskDto = z
  .object({
    key: z.string(),
    name: z.string(),
    source: z.string().nullish(),
    type: z.string().nullish(),
    cron: z.string().nullish(),
    intervalSeconds: z.number().nullish(),
    enabled: z.boolean().optional().default(true),
    cursor: z.string().nullish(),
    meta: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough()
const AdminDataPullExecutionResponseDto = z
  .object({
    id: z.number(),
    taskId: z.number(),
    status: z.string(),
    fetchedCount: z.number(),
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }).nullish(),
    errorMessage: z.string().nullish(),
    meta: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough()
const UpdateAdminDataPullTaskDto = z
  .object({
    name: z.string(),
    source: z.string().nullable(),
    type: z.string().nullable(),
    cron: z.string().nullable(),
    intervalSeconds: z.number().nullable(),
    enabled: z.boolean(),
    cursor: z.string().nullable(),
    meta: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough()
const LiquidationHeatmapResponseDto = z
  .object({
    snapshotId: z.number(),
    symbol: z.string(),
    exchangeCode: z.string().nullable(),
    tradingPair: z.string().nullable(),
    contractType: z.string().nullable(),
    modelType: z.enum(['MODEL1', 'MODEL2', 'MODEL3']),
    timeInterval: z.string().nullable(),
    valueCurrency: z.string(),
    fetchedAt: z.string().datetime({ offset: true }),
    effectiveFrom: z.string().datetime({ offset: true }).nullable(),
    effectiveTo: z.string().datetime({ offset: true }).nullable(),
    y_axis: z.array(z.number()),
    liquidation_leverage_data: z.array(z.array(z.number())),
    price_candlesticks: z.array(z.array(z.union([z.number(), z.string()]))),
  })
  .passthrough()
const CreateOpenInterestDto = z
  .object({
    exchange: z.string(),
    symbol: z.string(),
    open_interest_usd: z.number(),
    open_interest_quantity: z.number(),
    open_interest_by_stable_coin_margin: z.number().optional(),
    open_interest_by_coin_margin: z.number().optional(),
    open_interest_quantity_by_coin_margin: z.number().optional(),
    open_interest_quantity_by_stable_coin_margin: z.number().optional(),
    open_interest_change_percent_5m: z.number().optional(),
    open_interest_change_percent_15m: z.number().optional(),
    open_interest_change_percent_30m: z.number().optional(),
    open_interest_change_percent_1h: z.number().optional(),
    open_interest_change_percent_4h: z.number().optional(),
    open_interest_change_percent_24h: z.number().optional(),
    data_timestamp: z.string(),
  })
  .passthrough()
const BaseResponseDto = z
  .object({ data: z.object({}).partial().passthrough(), message: z.string().optional() })
  .passthrough()
const OpenInterestDto = z
  .object({
    exchange: z.string(),
    symbol: z.string(),
    open_interest_usd: z.number(),
    open_interest_quantity: z.number(),
    open_interest_by_stable_coin_margin: z.number().optional(),
    open_interest_by_coin_margin: z.number().optional(),
    open_interest_quantity_by_coin_margin: z.number().optional(),
    open_interest_quantity_by_stable_coin_margin: z.number().optional(),
    open_interest_change_percent_5m: z.number().optional(),
    open_interest_change_percent_15m: z.number().optional(),
    open_interest_change_percent_30m: z.number().optional(),
    open_interest_change_percent_1h: z.number().optional(),
    open_interest_change_percent_4h: z.number().optional(),
    open_interest_change_percent_24h: z.number().optional(),
    data_timestamp: z.string().optional(),
  })
  .passthrough()
const OpenInterestStatsDto = z
  .object({
    symbol: z.string(),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    dataPoints: z.number(),
    max: z.number(),
    min: z.number(),
    avg: z.number(),
    latest: z.number(),
    earliest: z.number(),
    change: z.number(),
    changePercent: z.number(),
  })
  .passthrough()
const OrderbookPairConfigResponseDto = z
  .object({
    id: z.string(),
    pairId: z.string(),
    venue: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(['CEX', 'DEX']),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    enabled: z.boolean(),
    pullIntervalSeconds: z.number().nullish(),
    depthLevels: z.number().nullish(),
    priority: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    description: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateOrderbookPairConfigDto = z
  .object({
    pairId: z.string().regex(/^[A-Z0-9]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/),
    venue: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(['CEX', 'DEX']),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    enabled: z.boolean().optional().default(true),
    pullIntervalSeconds: z.number().gte(1).nullish(),
    depthLevels: z.number().gte(5).lte(500).nullish(),
    priority: z.number().gte(1).lte(1000).optional().default(100),
    metadata: z.object({}).partial().passthrough().optional(),
    description: z.string().optional(),
  })
  .passthrough()
const UpdateOrderbookPairConfigDto = z
  .object({
    enabled: z.boolean(),
    pullIntervalSeconds: z.number().gte(1).nullable(),
    depthLevels: z.number().gte(5).lte(500).nullable(),
    priority: z.number().gte(1).lte(1000),
    metadata: z.object({}).partial().passthrough().nullable(),
    description: z.string().nullable(),
  })
  .partial()
  .passthrough()
const OrderBookLevelDto = z.object({ price: z.number(), size: z.number() }).passthrough()
const VenueOrderBookDto = z
  .object({
    venueId: z.string(),
    marketKey: z.string(),
    bids: z.array(OrderBookLevelDto),
    asks: z.array(OrderBookLevelDto),
    exchangeTs: z.number().nullish(),
    receivedTs: z.number(),
    version: z.number(),
  })
  .passthrough()
const CryptoStockQuoteResponseDto = z
  .object({
    id: z.number(),
    symbol: z.string(),
    name: z.string().nullish(),
    exchange: z.string().nullish(),
    price: z.string(),
    openPrice: z.string().nullish(),
    highPrice: z.string().nullish(),
    lowPrice: z.string().nullish(),
    closePrice: z.string().nullish(),
    volume: z.string().nullish(),
    turnover: z.string().nullish(),
    priceChange: z.string().nullish(),
    priceChangePercent: z.string().nullish(),
    marketCap: z.string().nullish(),
    peRatio: z.string().nullish(),
    high52Week: z.string().nullish(),
    low52Week: z.string().nullish(),
    assetSymbol: z.string().nullish(),
    assetLogoUrl: z.string().nullish(),
    companyLogoUrl: z.string().nullish(),
    holdingsValue: z.string().nullish(),
    holdingsAmount: z.string().nullish(),
    mNav: z.string().nullish(),
    holdingValue: z.string().nullish(),
    holdingQuantity: z.string().nullish(),
    companyType: z.string().nullish(),
    infoParagraphs: z.array(z.string()).optional(),
    source: z.string(),
    quoteTimestamp: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const TradesPairConfigResponseDto = z
  .object({
    id: z.string(),
    pairId: z.string(),
    exchange: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    canonicalInstId: z.string().nullish(),
    enabled: z.boolean(),
    priority: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    description: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const CreateTradesPairConfigDto = z
  .object({
    pairId: z.string().regex(/^[A-Z0-9_-]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/),
    exchange: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    enabled: z.boolean().optional().default(true),
    priority: z.number().gte(1).lte(1000).optional().default(100),
    metadata: z.object({}).partial().passthrough().optional(),
    description: z.string().optional(),
  })
  .passthrough()
const UpdateTradesPairConfigDto = z
  .object({
    enabled: z.boolean(),
    priority: z.number().gte(1).lte(1000),
    metadata: z.object({}).partial().passthrough().nullable(),
    description: z.string().nullable(),
  })
  .partial()
  .passthrough()
const WhaleAlertSide = z.enum(['Long', 'Short'])
const RealtimeWhaleAlertDto = z
  .object({
    user_address: z.string(),
    symbol: z.string(),
    position_size: z.number(),
    entry_price: z.number(),
    liq_price: z.number(),
    position_value_usd: z.number(),
    position_action: z.number(),
    create_time: z.string(),
    side: WhaleAlertSide,
  })
  .passthrough()
const WhaleTradeDto = z
  .object({
    user_address: z.string(),
    symbol: z.string(),
    side: z.enum(['Long', 'Short']),
    trade_size: z.number(),
    price: z.number(),
    trade_value_usd: z.number(),
    trade_time: z.string(),
  })
  .passthrough()
const WhaleDiscoverTraderAiTagDto = z
  .object({
    key: z.enum(['bullWarGod', 'swingKing', 'smartTrader', 'treasuryKeeper', 'twitterKol']),
    color: z.string(),
    bgColor: z.string(),
    descriptionKey: z
      .enum(['bullWarGod', 'swingKing', 'smartTrader', 'treasuryKeeper', 'twitterKol'])
      .optional(),
  })
  .passthrough()
const WhaleDiscoverTraderDto = z
  .object({
    variant: z.enum(['recommended', 'detail']),
    address: z.string(),
    handle: z.string().nullish(),
    tag: z.string().nullish(),
    totalValueUsd: z.number(),
    pnlUsd: z.number(),
    pnlLabelKey: z.enum(['realizedPnl', 'realizedPnl1m']).optional(),
    trades: z.number().optional(),
    positions: z.number().optional(),
    winRatePct: z.number(),
    winRateLabelKey: z.enum(['winRate', 'winRate1m']).optional(),
    avatarColor: z.string(),
    aiTags: z.array(WhaleDiscoverTraderAiTagDto).optional(),
  })
  .passthrough()
const WhaleDiscoverResponseDto = z
  .object({
    recommended: z.array(WhaleDiscoverTraderDto),
    details: z.array(WhaleDiscoverTraderDto),
  })
  .passthrough()
const WhaleTraderSummaryPerformanceDto = z
  .object({
    address: z.string(),
    lookbackDays: z.number(),
    symbolFilter: z.string().optional(),
    trades: z.number(),
    positions: z.number(),
    totalValueUsd: z.number(),
    longCount: z.number(),
    shortCount: z.number(),
    winRatePct: z.number(),
    pnlUsd: z.number(),
  })
  .passthrough()
const WhaleAssetPerformanceDto = z
  .object({
    symbol: z.string(),
    totalValueUsd: z.number(),
    trades: z.number(),
    longCount: z.number(),
    shortCount: z.number(),
  })
  .passthrough()
const WhaleTradeHistoryItemDto = z
  .object({
    address: z.string(),
    symbol: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    positionSize: z.number(),
    positionValueUsd: z.number(),
    entryPrice: z.number(),
    liquidationPrice: z.number(),
    positionAction: z.union([z.literal(1), z.literal(2)]),
    createTime: z.string(),
  })
  .passthrough()
const WhaleAddressPerformanceResponseDto = z
  .object({
    summary: WhaleTraderSummaryPerformanceDto,
    byAsset: z.array(WhaleAssetPerformanceDto),
    trades: z.array(WhaleTradeHistoryItemDto),
  })
  .passthrough()
const SnapshotPerpDto = z
  .object({
    accountValue: z.number(),
    totalMarginUsed: z.number(),
    totalPositionValue: z.number(),
    withdrawable: z.number(),
    marginUsagePercent: z.number(),
    leverageRatio: z.number(),
    unrealizedPnl: z.number(),
    roi: z.number(),
  })
  .passthrough()
const SpotBalanceItemDto = z
  .object({
    coin: z.string(),
    total: z.number(),
    hold: z.number(),
    value: z.number(),
    sharePercent: z.number(),
  })
  .passthrough()
const SnapshotSpotDto = z
  .object({ totalValue: z.number(), balances: z.array(SpotBalanceItemDto) })
  .passthrough()
const SnapshotTotalDto = z
  .object({ accountValue: z.number(), perpPercent: z.number(), spotPercent: z.number() })
  .passthrough()
const TraderSnapshotResponseDto = z
  .object({ perp: SnapshotPerpDto, spot: SnapshotSpotDto, total: SnapshotTotalDto })
  .passthrough()
const LeverageDto = z
  .object({ type: z.enum(['cross', 'isolated']), value: z.number() })
  .passthrough()
const PerpPositionDto = z
  .object({
    coin: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    size: z.number(),
    entryPrice: z.number(),
    markPrice: z.number(),
    liquidationPrice: z.number(),
    positionValue: z.number(),
    marginUsed: z.number(),
    leverage: LeverageDto,
    unrealizedPnl: z.number(),
    unrealizedPnlPercent: z.number(),
    fundingRate: z.number().optional(),
    roi: z.number(),
  })
  .passthrough()
const SpotBalanceDto = z
  .object({
    coin: z.string(),
    total: z.number(),
    hold: z.number(),
    available: z.number(),
    value: z.number(),
  })
  .passthrough()
const TraderPositionsResponseDto = z
  .object({ perp: z.array(PerpPositionDto), spot: z.array(SpotBalanceDto) })
  .passthrough()
const OpenOrderDto = z
  .object({
    orderId: z.number(),
    coin: z.string(),
    side: z.enum(['BUY', 'SELL']),
    type: z.string(),
    price: z.number(),
    size: z.number(),
    origSize: z.number(),
    value: z.number(),
    timestamp: z.string(),
    triggerPrice: z.number().optional(),
    triggerCondition: z.string().optional(),
    reduceOnly: z.boolean(),
  })
  .passthrough()
const TraderOpenOrdersResponseDto = z.object({ orders: z.array(OpenOrderDto) }).passthrough()
const TraderDiscoverTagsResponseDto = z
  .object({ tag: z.string().nullish(), aiTags: z.array(WhaleDiscoverTraderAiTagDto) })
  .passthrough()
const TradingPairConfigResponseDto = z
  .object({
    id: z.string(),
    displaySymbol: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(['DEX', 'CEX']),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    pricePrecision: z.number(),
    quantityPrecision: z.number(),
    minNotional: z.number().optional(),
    minQuantity: z.number().optional(),
    enabled: z.boolean(),
    exchange: z.enum(['BINANCE', 'OKX', 'BYBIT']).optional(),
    exchangeSymbol: z.string().optional(),
    maxLeverage: z.number().optional(),
    contractSize: z.number().optional(),
    chainId: z.number().optional(),
    baseTokenAddress: z.string().optional(),
    quoteTokenAddress: z.string().optional(),
    routerAddress: z.string().optional(),
    poolAddress: z.string().optional(),
    dexName: z.string().optional(),
  })
  .passthrough()
const LongShortRatioPointResponseDto = z
  .object({
    tradingPairId: z.string(),
    interval: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
    timestamp: z.string(),
    longShortRatio: z.string(),
    longAccountRatio: z.string().nullish(),
    shortAccountRatio: z.string().nullish(),
    longVolume: z.string().nullish(),
    shortVolume: z.string().nullish(),
    longShortAccountRatio: z.string().nullish(),
    source: z.string(),
  })
  .passthrough()
const ExchangeLongShortRatioResponseDto = z
  .object({
    rank: z.number(),
    name: z.string(),
    logoUrl: z.string().optional(),
    longPercent: z.number(),
    shortPercent: z.number(),
    longAmountUsd: z.number(),
    shortAmountUsd: z.number(),
  })
  .passthrough()
const MarketTradeResponseDto = z
  .object({
    id: z.number(),
    exchange: z.string(),
    instrumentType: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    tradeId: z.string(),
    price: z.string(),
    size: z.string(),
    side: z.enum(['buy', 'sell']),
    tradeTimestamp: z.string(),
    createdAt: z.string(),
  })
  .passthrough()
const AggregatedVolumeResponseDto = z
  .object({
    id: z.number(),
    exchange: z.string(),
    symbol: z.string(),
    instrumentType: z.enum(['SPOT', 'PERPETUAL']).optional(),
    volumeUsd: z.string(),
    dataTimestamp: z.string(),
    source: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const TickerResponseDto = z
  .object({
    symbol: z.string(),
    exchange: z.string().optional(),
    currentPrice: z.string(),
    indexPrice: z.string().optional(),
    priceChangePercent24h: z.string().optional(),
    volumeUsd: z.string(),
    openInterestUsd: z.string().optional(),
    fundingRate: z.string().optional(),
    nextFundingTime: z.string().optional(),
    high24h: z.string().optional(),
    low24h: z.string().optional(),
  })
  .passthrough()
const WhaleNotificationChannelsDto = z
  .object({ web: z.boolean(), email: z.boolean(), telegram: z.boolean() })
  .passthrough()
const WhaleNotificationRuleResponseDto = z
  .object({
    id: z.string(),
    type: z.enum(['ADDRESS', 'SYMBOL']),
    address: z.string().optional(),
    symbol: z.string().optional(),
    thresholdUsd: z.number(),
    note: z.string().optional(),
    channels: WhaleNotificationChannelsDto,
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const CreateWhaleNotificationRuleDto = z
  .object({
    type: z.enum(['ADDRESS', 'SYMBOL']),
    address: z.string().optional(),
    symbol: z.string().optional(),
    thresholdUsd: z.number(),
    note: z.string().optional(),
    channels: WhaleNotificationChannelsDto,
  })
  .passthrough()
const UpdateWhaleNotificationRuleDto = z
  .object({
    thresholdUsd: z.number(),
    note: z.string(),
    channels: WhaleNotificationChannelsDto,
    isActive: z.boolean(),
  })
  .partial()
  .passthrough()
const WhaleNotificationDeliveryMapDto = z
  .object({ web: z.string(), email: z.string(), telegram: z.string() })
  .passthrough()
const WhaleNotificationInboxResponseDto = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    ruleId: z.string().optional(),
    channels: WhaleNotificationDeliveryMapDto,
    read: z.boolean(),
    createdAt: z.string(),
  })
  .passthrough()
const LiquidationSummaryItemDto = z
  .object({
    timeframe: z.enum(['1h', '4h', '12h', '24h']),
    totalUsd: z.number(),
    longUsd: z.number(),
    shortUsd: z.number(),
  })
  .passthrough()
const AggregatedLiquidationSummaryDto = z
  .object({ symbol: z.string(), items: z.array(LiquidationSummaryItemDto) })
  .passthrough()
const ExchangeLiquidationRowDto = z
  .object({
    exchange: z.string(),
    symbol: z.string(),
    timeframe: z.enum(['1h', '4h', '12h', '24h']),
    amountUsd: z.number(),
    longUsd: z.number(),
    shortUsd: z.number(),
    longShare: z.number().optional(),
    isTotal: z.boolean().optional(),
  })
  .passthrough()
const ExchangeLiquidationResponseDto = z
  .object({
    symbol: z.string(),
    timeframe: z.enum(['1h', '4h', '12h', '24h']),
    rows: z.array(ExchangeLiquidationRowDto),
  })
  .passthrough()
const VenueDetailDto = z.object({ venueId: z.string(), size: z.number() }).passthrough()
const AggregatedLevelDto = z
  .object({ price: z.number(), sizeTotal: z.number(), details: z.array(VenueDetailDto) })
  .passthrough()
const AggregatedOrderbookResponseDto = z
  .object({
    marketKey: z.string(),
    base: z.string(),
    type: z.string(),
    asks: z.array(AggregatedLevelDto),
    bids: z.array(AggregatedLevelDto),
    midPrice: z.number(),
    updatedAt: z.number(),
    venues: z.array(z.string()),
    mergedQuotes: z.array(z.string()),
  })
  .passthrough()
const KlineBarDto = z
  .object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  })
  .passthrough()
const ExchangeConfigResponseDto = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullish(),
    intro: z.string().nullish(),
    websiteUrl: z.string().nullish(),
    venueType: z.enum(['CEX', 'DEX']).nullish(),
    enabled: z.boolean(),
    sort: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
const CreateExchangeConfigDto = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    name: z.string(),
    avatarUrl: z.string().nullish(),
    intro: z.string().nullish(),
    websiteUrl: z.string().nullish(),
    venueType: z.enum(['CEX', 'DEX']).nullish(),
    enabled: z.boolean().optional().default(true),
    sort: z.number().gte(0).lte(100000).optional().default(100),
    metadata: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough()
const UpdateExchangeConfigDto = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    intro: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    venueType: z.enum(['CEX', 'DEX']).nullable(),
    enabled: z.boolean(),
    sort: z.number().gte(0).lte(100000),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
  .partial()
  .passthrough()
const PredictionMarketOutcomeDto = z
  .object({ label: z.string(), probability: z.string() })
  .passthrough()
const PredictionMarketRulesDto = z
  .object({ paragraphs: z.array(z.string()), createdAt: z.string().optional() })
  .passthrough()
const PredictionMarketCardDto = z
  .object({
    id: z.string(),
    title: z.string(),
    options: z.array(PredictionMarketOutcomeDto).optional(),
    probability: z.string().optional(),
    status: z.string().optional(),
    volume24h: z.string().optional(),
    volumeTotal: z.string().optional(),
    openInterest: z.string().optional(),
    rules: PredictionMarketRulesDto.optional(),
  })
  .passthrough()
const WhaleHoldingDto = z
  .object({
    userAddress: z.string(),
    symbol: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    positionSize: z.number(),
    positionValueUsd: z.number(),
    entryPrice: z.number(),
    liquidationPrice: z.number().nullable(),
    pnl: z.number().nullable(),
    roe: z.number().nullable(),
    leverage: z.number().nullable(),
    snapshotTime: z.string(),
  })
  .passthrough()

export const schemas = {
  SettingResponseDto,
  CreateSettingDto,
  UpdateSettingDto,
  CreateTelegramDesktopIntentRequestDto,
  TelegramDesktopExchangeRequestDto,
  UserProfileResponseDto,
  AuthResponseDto,
  TelegramBotWebhookRequestDto,
  SendVerificationCodeRequestDto,
  SendEmailLoginCodeRequestDto,
  VerifyEmailLoginCodeRequestDto,
  TelegramExchangeRequestDto,
  RegisterRequestDto,
  LoginRequestDto,
  PasswordResetRequestDto,
  VerifyPasswordResetRequestDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  BindEmailRequestDto,
  BindTelegramRequestDto,
  AccountExchangeAccountResponseDto,
  CreateAccountExchangeAccountDto,
  AiQuantConversationMessageResponseDto,
  AiQuantConversationLastBacktestRangeResponseDto,
  AiQuantConversationLastBacktestExecutionResponseDto,
  AiQuantConversationLastBacktestConfigResponseDto,
  AiQuantConversationLastBacktestSummaryResponseDto,
  AiQuantConversationLastBacktestRefResponseDto,
  AiQuantConversationResponseDto,
  BasePaginationResponseDto,
  AccountAiQuantStrategyListItemResponseDto,
  AccountAiQuantStrategyDetailResponseDto,
  AccountAiQuantActionRequestDto,
  AccountAiQuantDeployRequestDto,
  AccountAiQuantUpdateExecutionLeverageRequestDto,
  BacktestingSymbolSupportRequestDto,
  BacktestingSymbolSupportResponseDto,
  BacktestingCreateJobExecutionDto,
  BacktestingCreateJobStrategyDto,
  BacktestingCreateJobRangeDto,
  BacktestingCreateJobRequestedRangeInputDto,
  BacktestingCreateJobBarDto,
  BacktestingCreateJobRequestDto,
  BacktestingCreateJobErrorDetailsDto,
  BacktestingCreateJobInputSummaryDto,
  BacktestingCreateJobSummaryDto,
  BacktestingCreateJobResponseDto,
  LlmCodegenStartRequestDto,
  CodegenConversationMessageResponseDto,
  CodegenSessionResponseDto,
  LlmCodegenContinueRequestDto,
  Function,
  StrategyPlazaRunRequestDto,
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
  AdminDataPullTaskResponseDto,
  CreateAdminDataPullTaskDto,
  AdminDataPullExecutionResponseDto,
  UpdateAdminDataPullTaskDto,
  LiquidationHeatmapResponseDto,
  CreateOpenInterestDto,
  BaseResponseDto,
  OpenInterestDto,
  OpenInterestStatsDto,
  OrderbookPairConfigResponseDto,
  CreateOrderbookPairConfigDto,
  UpdateOrderbookPairConfigDto,
  OrderBookLevelDto,
  VenueOrderBookDto,
  CryptoStockQuoteResponseDto,
  TradesPairConfigResponseDto,
  CreateTradesPairConfigDto,
  UpdateTradesPairConfigDto,
  WhaleAlertSide,
  RealtimeWhaleAlertDto,
  WhaleTradeDto,
  WhaleDiscoverTraderAiTagDto,
  WhaleDiscoverTraderDto,
  WhaleDiscoverResponseDto,
  WhaleTraderSummaryPerformanceDto,
  WhaleAssetPerformanceDto,
  WhaleTradeHistoryItemDto,
  WhaleAddressPerformanceResponseDto,
  SnapshotPerpDto,
  SpotBalanceItemDto,
  SnapshotSpotDto,
  SnapshotTotalDto,
  TraderSnapshotResponseDto,
  LeverageDto,
  PerpPositionDto,
  SpotBalanceDto,
  TraderPositionsResponseDto,
  OpenOrderDto,
  TraderOpenOrdersResponseDto,
  TraderDiscoverTagsResponseDto,
  TradingPairConfigResponseDto,
  LongShortRatioPointResponseDto,
  ExchangeLongShortRatioResponseDto,
  MarketTradeResponseDto,
  AggregatedVolumeResponseDto,
  TickerResponseDto,
  WhaleNotificationChannelsDto,
  WhaleNotificationRuleResponseDto,
  CreateWhaleNotificationRuleDto,
  UpdateWhaleNotificationRuleDto,
  WhaleNotificationDeliveryMapDto,
  WhaleNotificationInboxResponseDto,
  LiquidationSummaryItemDto,
  AggregatedLiquidationSummaryDto,
  ExchangeLiquidationRowDto,
  ExchangeLiquidationResponseDto,
  VenueDetailDto,
  AggregatedLevelDto,
  AggregatedOrderbookResponseDto,
  KlineBarDto,
  ExchangeConfigResponseDto,
  CreateExchangeConfigDto,
  UpdateExchangeConfigDto,
  PredictionMarketOutcomeDto,
  PredictionMarketRulesDto,
  PredictionMarketCardDto,
  WhaleHoldingDto,
}

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
    alias: 'AccountAiQuantStrategiesController_list',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
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
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AccountAiQuantStrategyListItemResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/account/ai-quant/strategies/:id',
    alias: 'AccountAiQuantStrategiesController_detail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
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
      .object({ data: AccountAiQuantStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/account/ai-quant/strategies/:id',
    alias: 'AccountAiQuantStrategiesController_remove',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
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
    method: 'post',
    path: '/account/ai-quant/strategies/:id/actions',
    alias: 'AccountAiQuantStrategiesController_action',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AccountAiQuantActionRequestDto,
      },
      {
        name: 'authorization',
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
      .object({ data: AccountAiQuantStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/account/ai-quant/strategies/:id/execution/leverage',
    alias: 'AccountAiQuantStrategiesController_updateExecutionLeverage',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ leverage: z.number() }).passthrough(),
      },
      {
        name: 'authorization',
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
      .object({ data: AccountAiQuantStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'post',
    path: '/account/ai-quant/strategies/deploy',
    alias: 'AccountAiQuantStrategiesController_deploy',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AccountAiQuantDeployRequestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: AccountAiQuantStrategyDetailResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/account/ai-quant/strategies/deploy-requests/:deployRequestId/result',
    alias: 'AccountAiQuantStrategiesController_deployResult',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'deployRequestId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({
        data: z.union([AccountAiQuantStrategyDetailResponseDto, z.null()]),
        message: z.string().optional(),
      })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/account/exchange-accounts',
    alias: 'AccountExchangeAccountsController_list',
    requestFormat: 'json',
    response: z.array(AccountExchangeAccountResponseDto),
  },
  {
    method: 'post',
    path: '/account/exchange-accounts',
    alias: 'AccountExchangeAccountsController_upsert',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAccountExchangeAccountDto,
      },
    ],
    response: AccountExchangeAccountResponseDto,
  },
  {
    method: 'delete',
    path: '/account/exchange-accounts/:exchangeId',
    alias: 'AccountExchangeAccountsController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'exchangeId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: z.object({ success: z.boolean() }).partial().passthrough() })
      .partial()
      .passthrough(),
  },
  {
    method: 'post',
    path: '/admin/auth/login',
    alias: 'AdminAuthController_login',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AdminLoginDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: 'get',
    path: '/admin/auth/me',
    alias: 'AdminAuthController_me',
    requestFormat: 'json',
    response: AdminProfileDto,
  },
  {
    method: 'post',
    path: '/admin/auth/refresh',
    alias: 'AdminAuthController_refresh',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ refreshToken: z.string() }).passthrough(),
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: 'post',
    path: '/admin/auth/register',
    alias: 'AdminAuthController_register',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: AdminRegisterDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: 'get',
    path: '/admin/data-pull-tasks',
    alias: 'AdminDataPullTaskController_list',
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
        name: 'key',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'name',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'enabled',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminDataPullTaskResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/data-pull-tasks',
    alias: 'AdminDataPullTaskController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminDataPullTaskDto,
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: 'get',
    path: '/admin/data-pull-tasks/:id',
    alias: 'AdminDataPullTaskController_findOne',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: 'put',
    path: '/admin/data-pull-tasks/:id',
    alias: 'AdminDataPullTaskController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminDataPullTaskDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: 'delete',
    path: '/admin/data-pull-tasks/:id',
    alias: 'AdminDataPullTaskController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/data-pull-tasks/:id/executions',
    alias: 'AdminDataPullTaskController_listExecutions',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminDataPullExecutionResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/data-pull-tasks/:id/interrupt',
    alias: 'AdminDataPullTaskController_interruptTask',
    description: `将任务状态从 RUNNING 重置为 IDLE，使其可以被重新调度。用于处理卡住的任务。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
    ],
    response: z.object({ success: z.boolean(), message: z.string() }).partial().passthrough(),
  },
  {
    method: 'post',
    path: '/admin/data-pull-tasks/:id/trigger',
    alias: 'AdminDataPullTaskController_triggerOnce',
    description: `立即执行指定任务一次，不受 intervalSeconds 限制；如果任务当前正在运行会直接报错，避免并发执行。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.number(),
      },
    ],
    response: AdminDataPullExecutionResponseDto,
  },
  {
    method: 'get',
    path: '/admin/data-pull-tasks/registered-jobs',
    alias: 'AdminDataPullTaskController_getRegisteredJobs',
    requestFormat: 'json',
    response: z
      .object({
        jobs: z.array(
          z
            .object({
              key: z.string(),
              name: z.string(),
              metaSchema: z
                .object({
                  description: z.string(),
                  fields: z.array(z.any()),
                  example: z.object({}).partial().passthrough(),
                })
                .partial()
                .passthrough()
                .nullable(),
            })
            .partial()
            .passthrough(),
        ),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/data-pull-tasks/registered-keys',
    alias: 'AdminDataPullTaskController_getRegisteredKeys',
    requestFormat: 'json',
    response: z
      .object({ keys: z.array(z.string()) })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/exchange-configs',
    alias: 'AdminExchangeConfigController_getAllConfigs',
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
        name: 'code',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'name',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'venueType',
        type: 'Query',
        schema: z.enum(['CEX', 'DEX']).optional(),
      },
      {
        name: 'enabled',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(ExchangeConfigResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/exchange-configs',
    alias: 'AdminExchangeConfigController_createConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateExchangeConfigDto,
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/exchange-configs/:id',
    alias: 'AdminExchangeConfigController_getConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'put',
    path: '/admin/exchange-configs/:id',
    alias: 'AdminExchangeConfigController_updateConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateExchangeConfigDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/admin/exchange-configs/:id',
    alias: 'AdminExchangeConfigController_deleteConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({
        data: z.object({ success: z.boolean() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/menu',
    alias: 'AdminMenuController_findMenuTree[0]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'post',
    path: '/admin/menu',
    alias: 'AdminMenuController_create[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminMenuDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/menu/:id',
    alias: 'AdminMenuController_findById[0]',
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
    method: 'put',
    path: '/admin/menu/:id',
    alias: 'AdminMenuController_update[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminMenuDto,
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
    method: 'delete',
    path: '/admin/menu/:id',
    alias: 'AdminMenuController_delete[0]',
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
    path: '/admin/menu/flat',
    alias: 'AdminMenuController_findFlat[0]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/menu/permission',
    alias: 'AdminMenuController_findPermissionMenus[0]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/menus',
    alias: 'AdminMenuController_findMenuTree[1]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'post',
    path: '/admin/menus',
    alias: 'AdminMenuController_create[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminMenuDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/menus/:id',
    alias: 'AdminMenuController_findById[1]',
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
    method: 'put',
    path: '/admin/menus/:id',
    alias: 'AdminMenuController_update[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminMenuDto,
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
    method: 'delete',
    path: '/admin/menus/:id',
    alias: 'AdminMenuController_delete[1]',
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
    path: '/admin/menus/flat',
    alias: 'AdminMenuController_findFlat[1]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/menus/permission',
    alias: 'AdminMenuController_findPermissionMenus[1]',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/orderbook-configs',
    alias: 'AdminOrderbookPairConfigController_getAllConfigs',
    requestFormat: 'json',
    parameters: [
      {
        name: 'venue',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'venueType',
        type: 'Query',
        schema: z.enum(['CEX', 'DEX']).optional(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']).optional(),
      },
      {
        name: 'enabledOnly',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: z
      .object({ data: z.array(OrderbookPairConfigResponseDto), message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'post',
    path: '/admin/orderbook-configs',
    alias: 'AdminOrderbookPairConfigController_createConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateOrderbookPairConfigDto,
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/orderbook-configs/:id',
    alias: 'AdminOrderbookPairConfigController_getConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'put',
    path: '/admin/orderbook-configs/:id',
    alias: 'AdminOrderbookPairConfigController_updateConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateOrderbookPairConfigDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/admin/orderbook-configs/:id',
    alias: 'AdminOrderbookPairConfigController_deleteConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({
        data: z.object({ success: z.boolean() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/orderbook-configs/:id/orderbook',
    alias: 'AdminOrderbookPairConfigController_getCurrentOrderbook',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.object({ data: VenueOrderBookDto, message: z.string() }).partial().passthrough(),
  },
  {
    method: 'get',
    path: '/admin/role',
    alias: 'AdminRoleController_list[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'code',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'name',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'page',
        type: 'Query',
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
              .passthrough(),
          ),
        })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/role',
    alias: 'AdminRoleController_create[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminRoleDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/role/:id',
    alias: 'AdminRoleController_findOne[0]',
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
    method: 'put',
    path: '/admin/role/:id',
    alias: 'AdminRoleController_update[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminRoleDto,
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
    method: 'delete',
    path: '/admin/role/:id',
    alias: 'AdminRoleController_delete[0]',
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
    path: '/admin/roles',
    alias: 'AdminRoleController_list[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'code',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'name',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'page',
        type: 'Query',
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
              .passthrough(),
          ),
        })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/roles',
    alias: 'AdminRoleController_create[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminRoleDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/admin/roles/:id',
    alias: 'AdminRoleController_findOne[1]',
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
    method: 'put',
    path: '/admin/roles/:id',
    alias: 'AdminRoleController_update[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminRoleDto,
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
    method: 'delete',
    path: '/admin/roles/:id',
    alias: 'AdminRoleController_delete[1]',
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
    path: '/admin/settings',
    alias: 'AdminSettingsController_getAllSettings',
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
    path: '/admin/settings',
    alias: 'AdminSettingsController_createSetting',
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
    path: '/admin/settings/:key',
    alias: 'AdminSettingsController_updateSetting',
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
    path: '/admin/settings/reload',
    alias: 'AdminSettingsController_reloadSettings',
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
    method: 'get',
    path: '/admin/trades-configs',
    alias: 'AdminTradesPairConfigController_getAllConfigs',
    requestFormat: 'json',
    parameters: [
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']).optional(),
      },
      {
        name: 'enabledOnly',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: z
      .object({ data: z.array(TradesPairConfigResponseDto), message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'post',
    path: '/admin/trades-configs',
    alias: 'AdminTradesPairConfigController_createConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateTradesPairConfigDto,
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/admin/trades-configs/:id',
    alias: 'AdminTradesPairConfigController_getConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'put',
    path: '/admin/trades-configs/:id',
    alias: 'AdminTradesPairConfigController_updateConfig',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateTradesPairConfigDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'delete',
    path: '/admin/trades-configs/:id',
    alias: 'AdminTradesPairConfigController_deleteConfig',
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
    path: '/admin/user',
    alias: 'AdminUserController_list[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminUserDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/user',
    alias: 'AdminUserController_create[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminUserDto,
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'get',
    path: '/admin/user/:id',
    alias: 'AdminUserController_findOne[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'put',
    path: '/admin/user/:id',
    alias: 'AdminUserController_update[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminUserDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'delete',
    path: '/admin/user/:id',
    alias: 'AdminUserController_delete[0]',
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
    path: '/admin/user/info',
    alias: 'AdminUserController_info[0]',
    requestFormat: 'json',
    response: AdminUserInfoDto,
  },
  {
    method: 'post',
    path: '/admin/user/login',
    alias: 'AdminUserController_login[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
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
    method: 'post',
    path: '/admin/user/refresh',
    alias: 'AdminUserController_refresh[0]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
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
    method: 'get',
    path: '/admin/users',
    alias: 'AdminUserController_list[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'keyword',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'page',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminUserDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/admin/users',
    alias: 'AdminUserController_create[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateAdminUserDto,
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'get',
    path: '/admin/users/:id',
    alias: 'AdminUserController_findOne[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'put',
    path: '/admin/users/:id',
    alias: 'AdminUserController_update[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateAdminUserDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: AdminUserDto,
  },
  {
    method: 'delete',
    path: '/admin/users/:id',
    alias: 'AdminUserController_delete[1]',
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
    path: '/admin/users/info',
    alias: 'AdminUserController_info[1]',
    requestFormat: 'json',
    response: AdminUserInfoDto,
  },
  {
    method: 'post',
    path: '/admin/users/login',
    alias: 'AdminUserController_login[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
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
    method: 'post',
    path: '/admin/users/refresh',
    alias: 'AdminUserController_refresh[1]',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
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
    method: 'get',
    path: '/aggregated-liquidation/exchanges',
    alias: 'AggregatedLiquidationController_getExchanges',
    description: `基于 AggregatedLiquidationHistory 表，对指定币种 + 时间区间，在最新时间点上按交易所拆分 long/short，并返回 TOTAL 汇总行和各交易所行，用于前端交易所表格。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'timeframe',
        type: 'Query',
        schema: z.enum(['1h', '4h', '12h', '24h']),
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: ExchangeLiquidationResponseDto }).partial().passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/aggregated-liquidation/summary',
    alias: 'AggregatedLiquidationController_getSummary',
    description: `基于 AggregatedLiquidationHistory 表，对指定币种在 1h/4h/12h/24h 粒度下的最新爆仓数据进行聚合，用于前端顶部 summary 卡片。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: AggregatedLiquidationSummaryDto }).partial().passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/auth/bind/email',
    alias: 'AuthController_bindEmail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: BindEmailRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/bind/telegram',
    alias: 'AuthController_bindTelegram',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: BindTelegramRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/bind/telegram/desktop',
    alias: 'AuthController_bindTelegramByDesktopIntent',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ intentId: z.string() }).passthrough(),
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/email/send-code',
    alias: 'AuthController_sendEmailLoginCode',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/email/verify-code',
    alias: 'AuthController_verifyEmailLoginCode',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: VerifyEmailLoginCodeRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/login',
    alias: 'AuthController_login',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: LoginRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/password-reset',
    alias: 'AuthController_requestPasswordReset',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/password-reset/verify',
    alias: 'AuthController_verifyPasswordReset',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: VerifyPasswordResetRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/register',
    alias: 'AuthController_register',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: RegisterRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/resend-verification',
    alias: 'AuthController_resendVerification',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/send-verification-code',
    alias: 'AuthController_sendVerificationCode',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: SendVerificationCodeRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/telegram/bot/webhook',
    alias: 'AuthController_handleTelegramBotWebhook',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: TelegramBotWebhookRequestDto,
      },
      {
        name: 'x-telegram-bot-api-secret-token',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/telegram/desktop/exchange',
    alias: 'AuthController_telegramDesktopExchange',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ intentId: z.string() }).passthrough(),
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'post',
    path: '/auth/telegram/desktop/intent',
    alias: 'AuthController_createTelegramDesktopIntent',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateTelegramDesktopIntentRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/auth/telegram/desktop/intent/:intentId',
    alias: 'AuthController_getTelegramDesktopIntentStatus',
    requestFormat: 'json',
    parameters: [
      {
        name: 'intentId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/telegram/exchange',
    alias: 'AuthController_telegramExchange',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: TelegramExchangeRequestDto,
      },
    ],
    response: z.object({ data: AuthResponseDto, message: z.string().optional() }).passthrough(),
  },
  {
    method: 'get',
    path: '/auth/telegram/login-config',
    alias: 'AuthController_getTelegramLoginConfig',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/auth/telegram/web/authorize-url',
    alias: 'AuthController_getTelegramWebAuthorizeUrl',
    requestFormat: 'json',
    parameters: [
      {
        name: 'intent',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'lng',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'redirect',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/auth/verify-email',
    alias: 'AuthController_verifyEmail',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: VerifyEmailRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/backtesting/capabilities',
    alias: 'BacktestingProxyController_capabilities',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/backtesting/jobs',
    alias: 'BacktestingProxyController_createJob',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: BacktestingCreateJobRequestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z
      .object({ data: BacktestingCreateJobResponseDto, message: z.string().optional() })
      .passthrough(),
  },
  {
    method: 'get',
    path: '/backtesting/jobs/:id',
    alias: 'BacktestingProxyController_getJob',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-request-id',
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
    path: '/backtesting/jobs/:id/result',
    alias: 'BacktestingProxyController_getJobResult',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-request-id',
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
    method: 'post',
    path: '/backtesting/symbols/check',
    alias: 'BacktestingProxyController_checkSymbolSupport',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: BacktestingSymbolSupportRequestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
      {
        name: 'x-request-id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: BacktestingSymbolSupportResponseDto,
  },
  {
    method: 'get',
    path: '/crypto-stock-quotes/latest',
    alias: 'CryptoStockQuotesController_getLatest',
    description: `返回每个股票代码（symbol）的最新一条报价记录，可通过 symbols 过滤特定标的`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbols',
        type: 'Query',
        schema: z.array(z.string()).optional(),
      },
      {
        name: 'source',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(CryptoStockQuoteResponseDto) })
        .partial()
        .passthrough(),
    ),
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
    path: '/kline',
    alias: 'KlineController_getKlineBars',
    description: `查询期货价格历史 OHLC 数据，支持单交易所或聚合模式`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'interval',
        type: 'Query',
        schema: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
      },
      {
        name: 'from',
        type: 'Query',
        schema: z.number(),
      },
      {
        name: 'to',
        type: 'Query',
        schema: z.number(),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: z.array(KlineBarDto),
  },
  {
    method: 'get',
    path: '/liquidation-heatmap/latest',
    alias: 'LiquidationHeatmapController_getLatest',
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'exchangeCode',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'contractType',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'timeInterval',
        type: 'Query',
        schema: z.string().optional().default('15m'),
      },
      {
        name: 'modelType',
        type: 'Query',
        schema: z.enum(['MODEL1', 'MODEL2', 'MODEL3']).optional(),
      },
    ],
    response: LiquidationHeatmapResponseDto,
  },
  {
    method: 'post',
    path: '/llm-strategy-codegen/sessions',
    alias: 'LlmStrategyCodegenController_startSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: LlmCodegenStartRequestDto,
      },
      {
        name: 'authorization',
        type: 'Header',
        schema: z.string(),
      },
    ],
    response: CodegenSessionResponseDto,
  },
  {
    method: 'get',
    path: '/llm-strategy-codegen/sessions/:id',
    alias: 'LlmStrategyCodegenController_getSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
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
    method: 'post',
    path: '/llm-strategy-codegen/sessions/:id/messages',
    alias: 'LlmStrategyCodegenController_continueSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: LlmCodegenContinueRequestDto,
      },
      {
        name: 'authorization',
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
    alias: 'LlmStrategyInstancesController_list',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/llm-strategy-instances/:id',
    alias: 'LlmStrategyInstancesController_detail',
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
    path: '/llm-strategy-instances/:id/signals',
    alias: 'LlmStrategyInstancesController_signals',
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
    path: '/llm-strategy-subscriptions',
    alias: 'LlmStrategySubscriptionsController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({}).partial().passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/llm-strategy-subscriptions',
    alias: 'LlmStrategySubscriptionsController_list',
    requestFormat: 'json',
    response: z.void(),
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
    ],
    response: z.void(),
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
        schema: z.object({}).partial().passthrough(),
      },
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'delete',
    path: '/llm-strategy-subscriptions/:subscriptionId',
    alias: 'LlmStrategySubscriptionsController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'subscriptionId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/markets/long-short-ratio',
    alias: 'MarketsController_getLongShortRatio',
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
        schema: z.number().gte(1).lte(2000).optional().default(500),
      },
      {
        name: 'tradingPairId',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'interval',
        type: 'Query',
        schema: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']),
      },
      {
        name: 'from',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'to',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(LongShortRatioPointResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/markets/long-short-ratio/exchanges',
    alias: 'MarketsController_getExchangeLongShortRatio',
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'timeRange',
        type: 'Query',
        schema: z.enum(['5m', '15m', '30m', '1h', '4h', '12h', '24h']),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(ExchangeLongShortRatioResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/markets/pairs',
    alias: 'MarketsController_getTradingPairs',
    requestFormat: 'json',
    parameters: [
      {
        name: 'venueType',
        type: 'Query',
        schema: z.enum(['DEX', 'CEX']).optional(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']).optional(),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.enum(['BINANCE', 'OKX', 'BYBIT']).optional(),
      },
    ],
    response: z.array(TradingPairConfigResponseDto),
  },
  {
    method: 'get',
    path: '/markets/ticker',
    alias: 'MarketsController_getTicker',
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: TickerResponseDto,
  },
  {
    method: 'get',
    path: '/markets/trades',
    alias: 'MarketsController_getTrades',
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
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']).optional(),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'baseAsset',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'quoteAsset',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'side',
        type: 'Query',
        schema: z.enum(['buy', 'sell']).optional(),
      },
      {
        name: 'fromTimestamp',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'toTimestamp',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(MarketTradeResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/markets/trades/large',
    alias: 'MarketsController_getLargeTrades',
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
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'minValue',
        type: 'Query',
        schema: z.number().gte(0).optional().default(100000),
      },
    ],
    response: z.array(MarketTradeResponseDto),
  },
  {
    method: 'get',
    path: '/markets/trades/latest',
    alias: 'MarketsController_getLatestTrades',
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
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
      {
        name: 'exchange',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL', 'FUTURE']),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(MarketTradeResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/markets/volume/aggregated',
    alias: 'MarketsController_getAggregatedVolumes',
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
        name: 'symbol',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'instrumentType',
        type: 'Query',
        schema: z.enum(['SPOT', 'PERPETUAL']).optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AggregatedVolumeResponseDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'post',
    path: '/open-interest',
    alias: 'OpenInterestController_upsert',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateOpenInterestDto,
      },
    ],
    response: BaseResponseDto.and(z.object({ data: OpenInterestDto }).partial().passthrough()),
    errors: [
      {
        status: 400,
        description: `参数验证失败`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/open-interest',
    alias: 'OpenInterestController_query',
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
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'startTime',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'endTime',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(OpenInterestDto) })
        .partial()
        .passthrough(),
    ),
    errors: [
      {
        status: 400,
        description: `参数验证失败`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/open-interest/batch',
    alias: 'OpenInterestController_batchUpsert',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.array(CreateOpenInterestDto),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(OpenInterestDto) })
        .partial()
        .passthrough(),
    ),
    errors: [
      {
        status: 400,
        description: `参数验证失败`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/open-interest/latest/:exchange/:symbol',
    alias: 'OpenInterestController_getLatest',
    requestFormat: 'json',
    parameters: [
      {
        name: 'exchange',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'symbol',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(z.object({ data: OpenInterestDto }).partial().passthrough()),
    errors: [
      {
        status: 404,
        description: `未找到数据`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/open-interest/stats/:symbol',
    alias: 'OpenInterestController_getStats',
    requestFormat: 'json',
    parameters: [
      {
        name: 'symbol',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'startTime',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'endTime',
        type: 'Query',
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(z.object({ data: OpenInterestStatsDto }).partial().passthrough()),
    errors: [
      {
        status: 400,
        description: `参数错误`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `未找到数据`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/orderbook/aggregated',
    alias: 'AggregatedOrderbookController_getAggregatedOrderbook',
    description: `合并多个交易所的订单簿数据，USDT/USDC 计价会自动合并`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'base',
        type: 'Query',
        schema: z.string(),
      },
      {
        name: 'type',
        type: 'Query',
        schema: z.enum(['spot', 'perp']),
      },
      {
        name: 'venues',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'depth',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'tickSize',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: z
      .object({ data: AggregatedOrderbookResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/polymarket/markets',
    alias: 'PolymarketController_listMarkets',
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
        name: 'category',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'onlyActive',
        type: 'Query',
        schema: z.boolean().optional().default(true),
      },
      {
        name: 'locale',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: z.array(PredictionMarketCardDto),
  },
  {
    method: 'get',
    path: '/strategy-plaza/templates',
    alias: 'StrategyPlazaProxyController_list',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/strategy-plaza/templates/:id',
    alias: 'StrategyPlazaProxyController_detail',
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
    path: '/strategy-plaza/templates/:id/edit-session',
    alias: 'StrategyPlazaProxyController_editSession',
    requestFormat: 'json',
    parameters: [
      {
        name: 'authorization',
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
    method: 'post',
    path: '/strategy-plaza/templates/:id/run',
    alias: 'StrategyPlazaProxyController_run',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ runRequestId: z.string() }).passthrough(),
      },
      {
        name: 'authorization',
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
    path: '/users/me',
    alias: 'UserController_me',
    requestFormat: 'json',
    response: UserProfileResponseDto,
  },
  {
    method: 'get',
    path: '/whale-alerts/realtime',
    alias: 'WhaleAlertController_getRealtime',
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
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'min_position_value_usd',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'since',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(RealtimeWhaleAlertDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/whale-alerts/realtime-stream',
    alias: 'WhaleAlertStreamController_getRealtimeStream',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/whale-alerts/trades',
    alias: 'WhaleAlertController_getWhaleTrades',
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
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'min_trade_value_usd',
        type: 'Query',
        schema: z.number().optional(),
      },
      {
        name: 'since',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(WhaleTradeDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/whale-holdings',
    alias: 'WhaleHoldingsController_getWhaleHoldings',
    description: `返回 Hyperliquid 平台上持仓价值超过指定阈值的鲸鱼实时持仓快照，每个用户+币种只有最新状态。`,
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
        schema: z.number().gte(1).lte(500).optional().default(100),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'minPositionValueUsd',
        type: 'Query',
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(WhaleHoldingDto) })
        .partial()
        .passthrough(),
    ),
  },
  {
    method: 'get',
    path: '/whale-notification/metrics',
    alias: 'WhaleNotificationMetricsController_metrics',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/whale-notification/notifications',
    alias: 'WhaleNotificationInboxController_list',
    requestFormat: 'json',
    response: z.array(WhaleNotificationInboxResponseDto),
  },
  {
    method: 'patch',
    path: '/whale-notification/notifications/:id/read',
    alias: 'WhaleNotificationInboxController_markRead',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
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
    path: '/whale-notification/notifications/read-all',
    alias: 'WhaleNotificationInboxController_markAllRead',
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
    method: 'get',
    path: '/whale-notification/notifications/unread-count',
    alias: 'WhaleNotificationInboxController_unreadCount',
    requestFormat: 'json',
    response: z
      .object({
        data: z.object({ unread: z.number() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/whale-notification/rules',
    alias: 'WhaleNotificationRulesController_list',
    requestFormat: 'json',
    response: z.array(WhaleNotificationRuleResponseDto),
  },
  {
    method: 'post',
    path: '/whale-notification/rules',
    alias: 'WhaleNotificationRulesController_create',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: CreateWhaleNotificationRuleDto,
      },
    ],
    response: WhaleNotificationRuleResponseDto,
  },
  {
    method: 'put',
    path: '/whale-notification/rules/:id',
    alias: 'WhaleNotificationRulesController_update',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: UpdateWhaleNotificationRuleDto,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: WhaleNotificationRuleResponseDto,
  },
  {
    method: 'delete',
    path: '/whale-notification/rules/:id',
    alias: 'WhaleNotificationRulesController_delete',
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z
      .object({
        data: z.object({ success: z.boolean() }).partial().passthrough(),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: 'get',
    path: '/whale-tracking/discover',
    alias: 'WhaleTrackingController_getDiscover',
    description: `基于 Hyperliquid 鲸鱼预警数据，按最近一段时间的持仓价值与活跃度聚合出一批代表性鲸鱼地址，用于 discover 页面渲染。`,
    requestFormat: 'json',
    response: WhaleDiscoverResponseDto,
  },
  {
    method: 'get',
    path: '/whale-tracking/traders/:address/discover-tags',
    alias: 'WhaleTrackingController_getTraderDiscoverTags',
    description: `基于 Hyperliquid Whale Alert 近 lookbackDays（当前 7 天）的聚合统计，复用 Discover 的 AI 打标逻辑，为 Profile Header 提供 Discover 视角的标签。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'address',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: TraderDiscoverTagsResponseDto,
  },
  {
    method: 'get',
    path: '/whale-tracking/traders/:address/open-orders',
    alias: 'WhaleTrackingController_getTraderOpenOrders',
    description: `通过 Hyperliquid API 实时查询指定地址的当前挂单列表，包括订单 ID、币种、方向、类型、限价、数量、订单价值、创建时间等信息。支持按币种筛选，默认缓存 5 秒。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'address',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'coin',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'skipCache',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: TraderOpenOrdersResponseDto,
  },
  {
    method: 'get',
    path: '/whale-tracking/traders/:address/performance',
    alias: 'WhaleTrackingController_getTraderPerformance',
    description: `基于 Hyperliquid Whale Alert 数据，对指定鲸鱼地址在给定时间窗口内的名义价值、方向分布等信息做聚合统计，并返回按币种与时间排序的预警明细。当前返回的 PnL 与胜率字段为占位统计值，仅用于可视化与排序，不代表真实历史盈亏/胜率。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'address',
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
        schema: z.number().gte(1).lte(500).optional().default(200),
      },
      {
        name: 'timeRangeDays',
        type: 'Query',
        schema: z.number().gte(1).lte(365).optional(),
      },
      {
        name: 'symbol',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: WhaleAddressPerformanceResponseDto,
  },
  {
    method: 'get',
    path: '/whale-tracking/traders/:address/positions',
    alias: 'WhaleTrackingController_getTraderPositions',
    description: `通过 Hyperliquid API 实时查询指定地址的持仓详情，包括永续合约持仓（币种、方向、数量、入场价、标记价、清算价、未实现盈亏、杠杆信息）与现货余额（币种、总量、锁定量、可用量、价值）。支持按类型筛选（perp/spot/all），默认缓存 5 秒。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'address',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'type',
        type: 'Query',
        schema: z.enum(['perp', 'spot', 'all']).optional(),
      },
      {
        name: 'skipCache',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: TraderPositionsResponseDto,
  },
  {
    method: 'get',
    path: '/whale-tracking/traders/:address/snapshot',
    alias: 'WhaleTrackingController_getTraderSnapshot',
    description: `通过 Hyperliquid API 实时查询指定地址的账户快照数据，包括永续合约账户状态（账户价值、保证金使用率、杠杆倍数、未实现盈亏）与现货余额汇总。数据直接来源于 Hyperliquid 清算所状态，默认缓存 5 秒。`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'address',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'skipCache',
        type: 'Query',
        schema: z.boolean().optional(),
      },
    ],
    response: TraderSnapshotResponseDto,
  },
])

export const aiBackendClient = new Zodios('/api/v1', endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options)
}
