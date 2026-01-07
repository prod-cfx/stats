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
const BasePaginationResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(z.object({}).partial().passthrough()),
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const LiquidationHeatmapResponseDto = z
  .object({
    snapshotId: z.number(),
    symbol: z.string(),
    exchangeCode: z.string().nullable(),
    tradingPair: z.string().nullable(),
    contractType: z.string().nullable(),
    modelType: z.enum(["MODEL1", "MODEL2", "MODEL3"]),
    timeInterval: z.string().nullable(),
    valueCurrency: z.string(),
    fetchedAt: z.string().datetime({ offset: true }),
    effectiveFrom: z.string().datetime({ offset: true }).nullable(),
    effectiveTo: z.string().datetime({ offset: true }).nullable(),
    y_axis: z.array(z.number()),
    liquidation_leverage_data: z.array(z.array(z.any())),
    price_candlesticks: z.array(z.array(z.any())),
  })
  .passthrough();
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
  .passthrough();
const BaseResponseDto = z
  .object({
    data: z.object({}).partial().passthrough(),
    message: z.string().optional(),
  })
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const OrderbookPairConfigResponseDto = z
  .object({
    id: z.string(),
    pairId: z.string(),
    venue: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(["CEX", "DEX"]),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    enabled: z.boolean(),
    pullIntervalSeconds: z.number().nullish(),
    depthLevels: z.number().nullish(),
    priority: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    description: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateOrderbookPairConfigDto = z
  .object({
    pairId: z
      .string()
      .regex(/^[A-Z0-9]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/),
    venue: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(["CEX", "DEX"]),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    enabled: z.boolean().optional().default(true),
    pullIntervalSeconds: z.number().gte(1).nullish(),
    depthLevels: z.number().gte(5).lte(500).nullish(),
    priority: z.number().gte(1).lte(1000).optional().default(100),
    metadata: z.object({}).partial().passthrough().optional(),
    description: z.string().optional(),
  })
  .passthrough();
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
  .passthrough();
const OrderBookLevelDto = z
  .object({ price: z.number(), size: z.number() })
  .passthrough();
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
  .passthrough();
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
    infoParagraphs: z.array(z.string()).optional(),
    source: z.string(),
    quoteTimestamp: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const TradesPairConfigResponseDto = z
  .object({
    id: z.string(),
    pairId: z.string(),
    exchange: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    canonicalInstId: z.string().nullish(),
    enabled: z.boolean(),
    priority: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    description: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
const CreateTradesPairConfigDto = z
  .object({
    pairId: z
      .string()
      .regex(/^[A-Z0-9\-]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/),
    exchange: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    enabled: z.boolean().optional().default(true),
    priority: z.number().gte(1).lte(1000).optional().default(100),
    metadata: z.object({}).partial().passthrough().optional(),
    description: z.string().optional(),
  })
  .passthrough();
const UpdateTradesPairConfigDto = z
  .object({
    enabled: z.boolean(),
    priority: z.number().gte(1).lte(1000),
    metadata: z.object({}).partial().passthrough().nullable(),
    description: z.string().nullable(),
  })
  .partial()
  .passthrough();
const TradingPairConfigResponseDto = z
  .object({
    id: z.string(),
    displaySymbol: z.string(),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    venueType: z.enum(["DEX", "CEX"]),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    pricePrecision: z.number(),
    quantityPrecision: z.number(),
    minNotional: z.number().optional(),
    minQuantity: z.number().optional(),
    enabled: z.boolean(),
    exchange: z.enum(["BINANCE", "OKX", "BYBIT"]).optional(),
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
  .passthrough();
const LongShortRatioPointResponseDto = z
  .object({
    tradingPairId: z.string(),
    interval: z.enum([
      "1m",
      "3m",
      "5m",
      "15m",
      "30m",
      "1h",
      "4h",
      "6h",
      "8h",
      "12h",
      "1d",
      "1w",
    ]),
    timestamp: z.string(),
    longShortRatio: z.string(),
    longAccountRatio: z.string().nullish(),
    shortAccountRatio: z.string().nullish(),
    longVolume: z.string().nullish(),
    shortVolume: z.string().nullish(),
    longShortAccountRatio: z.string().nullish(),
    source: z.string(),
  })
  .passthrough();
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
  .passthrough();
const MarketTradeResponseDto = z
  .object({
    id: z.number(),
    exchange: z.string(),
    instrumentType: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
    symbol: z.string(),
    baseAsset: z.string(),
    quoteAsset: z.string(),
    tradeId: z.string(),
    price: z.string(),
    size: z.string(),
    side: z.enum(["buy", "sell"]),
    tradeTimestamp: z.string(),
    createdAt: z.string(),
  })
  .passthrough();
const ExchangeConfigResponseDto = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullish(),
    intro: z.string().nullish(),
    websiteUrl: z.string().nullish(),
    venueType: z.enum(["CEX", "DEX"]).nullish(),
    enabled: z.boolean(),
    sort: z.number(),
    metadata: z.object({}).partial().passthrough().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateExchangeConfigDto = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    name: z.string(),
    avatarUrl: z.string().nullish(),
    intro: z.string().nullish(),
    websiteUrl: z.string().nullish(),
    venueType: z.enum(["CEX", "DEX"]).nullish(),
    enabled: z.boolean().optional().default(true),
    sort: z.number().gte(0).lte(100000).optional().default(100),
    metadata: z.object({}).partial().passthrough().nullish(),
  })
  .passthrough();
const UpdateExchangeConfigDto = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    intro: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    venueType: z.enum(["CEX", "DEX"]).nullable(),
    enabled: z.boolean(),
    sort: z.number().gte(0).lte(100000),
    metadata: z.object({}).partial().passthrough().nullable(),
  })
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
  AdminLoginDto,
  AdminProfileDto,
  AdminAuthResponseDto,
  AdminRefreshDto,
  AdminRegisterDto,
  AdminAssignedRoleDto,
  AdminUserDto,
  AdminMenuPermissionDto,
  AdminUserInfoDto,
  BasePaginationResponseDto,
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
  TradingPairConfigResponseDto,
  LongShortRatioPointResponseDto,
  ExchangeLongShortRatioResponseDto,
  MarketTradeResponseDto,
  ExchangeConfigResponseDto,
  CreateExchangeConfigDto,
  UpdateExchangeConfigDto,
};

const endpoints = makeApi([
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
    path: "/admin/data-pull-tasks",
    alias: "AdminDataPullTaskController_list",
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
        name: "key",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "enabled",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(AdminDataPullTaskResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/data-pull-tasks",
    alias: "AdminDataPullTaskController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminDataPullTaskDto,
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: "get",
    path: "/admin/data-pull-tasks/:id",
    alias: "AdminDataPullTaskController_findOne",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number(),
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: "put",
    path: "/admin/data-pull-tasks/:id",
    alias: "AdminDataPullTaskController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminDataPullTaskDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.number(),
      },
    ],
    response: AdminDataPullTaskResponseDto,
  },
  {
    method: "delete",
    path: "/admin/data-pull-tasks/:id",
    alias: "AdminDataPullTaskController_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/data-pull-tasks/:id/executions",
    alias: "AdminDataPullTaskController_listExecutions",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number(),
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
        .object({ items: z.array(AdminDataPullExecutionResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/admin/data-pull-tasks/registered-jobs",
    alias: "AdminDataPullTaskController_getRegisteredJobs",
    requestFormat: "json",
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
            .passthrough()
        ),
      })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/data-pull-tasks/registered-keys",
    alias: "AdminDataPullTaskController_getRegisteredKeys",
    requestFormat: "json",
    response: z
      .object({ keys: z.array(z.string()) })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/exchange-configs",
    alias: "AdminExchangeConfigController_getAllConfigs",
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
        name: "venueType",
        type: "Query",
        schema: z.enum(["CEX", "DEX"]).optional(),
      },
      {
        name: "enabled",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(ExchangeConfigResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "post",
    path: "/admin/exchange-configs",
    alias: "AdminExchangeConfigController_createConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateExchangeConfigDto,
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/exchange-configs/:id",
    alias: "AdminExchangeConfigController_getConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "put",
    path: "/admin/exchange-configs/:id",
    alias: "AdminExchangeConfigController_updateConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateExchangeConfigDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: ExchangeConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "delete",
    path: "/admin/exchange-configs/:id",
    alias: "AdminExchangeConfigController_deleteConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
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
    path: "/admin/orderbook-configs",
    alias: "AdminOrderbookPairConfigController_getAllConfigs",
    requestFormat: "json",
    parameters: [
      {
        name: "venue",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "venueType",
        type: "Query",
        schema: z.enum(["CEX", "DEX"]).optional(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]).optional(),
      },
      {
        name: "enabledOnly",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: z
      .object({
        data: z.array(OrderbookPairConfigResponseDto),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/orderbook-configs",
    alias: "AdminOrderbookPairConfigController_createConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateOrderbookPairConfigDto,
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/orderbook-configs/:id",
    alias: "AdminOrderbookPairConfigController_getConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "put",
    path: "/admin/orderbook-configs/:id",
    alias: "AdminOrderbookPairConfigController_updateConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateOrderbookPairConfigDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: OrderbookPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "delete",
    path: "/admin/orderbook-configs/:id",
    alias: "AdminOrderbookPairConfigController_deleteConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
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
    method: "get",
    path: "/admin/orderbook-configs/:id/orderbook",
    alias: "AdminOrderbookPairConfigController_getCurrentOrderbook",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: VenueOrderBookDto, message: z.string() })
      .partial()
      .passthrough(),
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
    method: "get",
    path: "/admin/trades-configs",
    alias: "AdminTradesPairConfigController_getAllConfigs",
    requestFormat: "json",
    parameters: [
      {
        name: "exchange",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]).optional(),
      },
      {
        name: "enabledOnly",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: z
      .object({
        data: z.array(TradesPairConfigResponseDto),
        message: z.string(),
      })
      .partial()
      .passthrough(),
  },
  {
    method: "post",
    path: "/admin/trades-configs",
    alias: "AdminTradesPairConfigController_createConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateTradesPairConfigDto,
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "get",
    path: "/admin/trades-configs/:id",
    alias: "AdminTradesPairConfigController_getConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "put",
    path: "/admin/trades-configs/:id",
    alias: "AdminTradesPairConfigController_updateConfig",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateTradesPairConfigDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z
      .object({ data: TradesPairConfigResponseDto, message: z.string() })
      .partial()
      .passthrough(),
  },
  {
    method: "delete",
    path: "/admin/trades-configs/:id",
    alias: "AdminTradesPairConfigController_deleteConfig",
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
    path: "/crypto-stock-quotes/latest",
    alias: "CryptoStockQuotesController_getLatest",
    description: `返回每个股票代码（symbol）的最新一条报价记录，可通过 symbols 过滤特定标的`,
    requestFormat: "json",
    parameters: [
      {
        name: "symbols",
        type: "Query",
        schema: z.array(z.string()).optional(),
      },
      {
        name: "source",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(CryptoStockQuoteResponseDto) })
        .partial()
        .passthrough()
    ),
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
    path: "/liquidation-heatmap/latest",
    alias: "LiquidationHeatmapController_getLatest",
    requestFormat: "json",
    parameters: [
      {
        name: "symbol",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "exchangeCode",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "contractType",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "timeInterval",
        type: "Query",
        schema: z.string().optional().default("15m"),
      },
      {
        name: "modelType",
        type: "Query",
        schema: z.enum(["MODEL1", "MODEL2", "MODEL3"]).optional(),
      },
    ],
    response: LiquidationHeatmapResponseDto,
  },
  {
    method: "get",
    path: "/markets/long-short-ratio",
    alias: "MarketsController_getLongShortRatio",
    requestFormat: "json",
    parameters: [
      {
        name: "tradingPairId",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "interval",
        type: "Query",
        schema: z.enum([
          "1m",
          "3m",
          "5m",
          "15m",
          "30m",
          "1h",
          "4h",
          "6h",
          "8h",
          "12h",
          "1d",
          "1w",
        ]),
      },
      {
        name: "from",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "to",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(2000).optional(),
      },
    ],
    response: z.array(LongShortRatioPointResponseDto),
  },
  {
    method: "get",
    path: "/markets/long-short-ratio/exchanges",
    alias: "MarketsController_getExchangeLongShortRatio",
    requestFormat: "json",
    parameters: [
      {
        name: "symbol",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "timeRange",
        type: "Query",
        schema: z.enum(["5m", "15m", "30m", "1h", "4h", "12h", "24h"]),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(ExchangeLongShortRatioResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/markets/pairs",
    alias: "MarketsController_getTradingPairs",
    requestFormat: "json",
    parameters: [
      {
        name: "venueType",
        type: "Query",
        schema: z.enum(["DEX", "CEX"]).optional(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]).optional(),
      },
      {
        name: "exchange",
        type: "Query",
        schema: z.enum(["BINANCE", "OKX", "BYBIT"]).optional(),
      },
    ],
    response: z.array(TradingPairConfigResponseDto),
  },
  {
    method: "get",
    path: "/markets/trades",
    alias: "MarketsController_getTrades",
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
        name: "exchange",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]).optional(),
      },
      {
        name: "symbol",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "baseAsset",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "quoteAsset",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "side",
        type: "Query",
        schema: z.enum(["buy", "sell"]).optional(),
      },
      {
        name: "fromTimestamp",
        type: "Query",
        schema: z.number().optional(),
      },
      {
        name: "toTimestamp",
        type: "Query",
        schema: z.number().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(MarketTradeResponseDto) })
        .partial()
        .passthrough()
    ),
  },
  {
    method: "get",
    path: "/markets/trades/large",
    alias: "MarketsController_getLargeTrades",
    requestFormat: "json",
    parameters: [
      {
        name: "exchange",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
      },
      {
        name: "symbol",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
      {
        name: "minValue",
        type: "Query",
        schema: z.number().gte(0).optional().default(100000),
      },
    ],
    response: z.array(MarketTradeResponseDto),
  },
  {
    method: "get",
    path: "/markets/trades/latest",
    alias: "MarketsController_getLatestTrades",
    requestFormat: "json",
    parameters: [
      {
        name: "exchange",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "instrumentType",
        type: "Query",
        schema: z.enum(["SPOT", "PERPETUAL", "FUTURE"]),
      },
      {
        name: "symbol",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200).optional().default(50),
      },
    ],
    response: z.array(MarketTradeResponseDto),
  },
  {
    method: "post",
    path: "/open-interest",
    alias: "OpenInterestController_upsert",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateOpenInterestDto,
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: OpenInterestDto }).partial().passthrough()
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
    method: "get",
    path: "/open-interest",
    alias: "OpenInterestController_query",
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
        name: "exchange",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "symbol",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "startTime",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "endTime",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: BasePaginationResponseDto.and(
      z
        .object({ items: z.array(OpenInterestDto) })
        .partial()
        .passthrough()
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
    method: "post",
    path: "/open-interest/batch",
    alias: "OpenInterestController_batchUpsert",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.array(CreateOpenInterestDto),
      },
    ],
    response: BaseResponseDto.and(
      z
        .object({ data: z.array(OpenInterestDto) })
        .partial()
        .passthrough()
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
    method: "get",
    path: "/open-interest/latest/:exchange/:symbol",
    alias: "OpenInterestController_getLatest",
    requestFormat: "json",
    parameters: [
      {
        name: "exchange",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "symbol",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: OpenInterestDto }).partial().passthrough()
    ),
    errors: [
      {
        status: 404,
        description: `未找到数据`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/open-interest/stats/:symbol",
    alias: "OpenInterestController_getStats",
    requestFormat: "json",
    parameters: [
      {
        name: "symbol",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "startTime",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "endTime",
        type: "Query",
        schema: z.string(),
      },
    ],
    response: BaseResponseDto.and(
      z.object({ data: OpenInterestStatsDto }).partial().passthrough()
    ),
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
