import type {MarketTimeframe} from '@ai/shared';
import { DEFAULT_MARKET_SYMBOLS, ErrorCode, MARKET_TIMEFRAMES  } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor, parsePositiveInt } from '../common/env/env.accessor'
import { DomainException } from '../common/exceptions/domain.exception'
import { polymarketConfig } from './polymarket.config'

const env = defaultEnvAccessor
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60

export const appConfig = registerAs('app', () => ({
  appEnv: env.appEnv() || 'development',
  port: env.int('PORT', 3000),
  apiPrefix: env.str('API_PREFIX', 'api/v1'),
  appName: env.str('APP_NAME', '@net/backend'),
}))

export const databaseConfig = registerAs('database', () => ({
  host: env.str('DB_HOST', 'localhost'),
  port: env.int('DB_PORT', 5432),
  username: env.str('DB_USERNAME', 'postgres'),
  password: env.str('DB_PASSWORD', 'postgres'),
  database: env.str('DB_DATABASE', 'postgres'),
}))

export const redisConfig = registerAs('redis', () => ({
  url: env.str('REDIS_URL', ''),
  host: env.str('REDIS_HOST', 'localhost'),
  port: env.int('REDIS_PORT', 6379),
  password: env.str('REDIS_PASSWORD', ''),
  db: env.int('REDIS_DB', 0),
  tls: env.bool('REDIS_TLS'),
}))

export const jwtConfig = registerAs('jwt', () => {
  const appEnv = env.appEnv()
  const secret = env.str('JWT_SECRET')
  if (!secret && appEnv !== 'development') {
    throw new DomainException('config.validation_error', {
      code: ErrorCode.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: 'JWT_SECRET is required' },
    })
  }
  return {
    secret: (() => {
      if (secret) return secret
      // 开发环境使用默认密钥并告警
      console.warn('JWT_SECRET is not set. Using a default secret for development only.')
      return 'dev_only_secret'
    })(),
    expiresIn: env.str('JWT_EXPIRES_IN', '30d'),
    accessExpiration: env.int('JWT_ACCESS_EXPIRATION', THIRTY_DAYS_IN_SECONDS),
  }
})

export const uploadConfig = registerAs('upload', () => ({
  maxFileSize: env.int('MAX_FILE_SIZE', 10485760),
  allowedFileTypes: (env.str('ALLOWED_FILE_TYPES', 'jpg,jpeg,png,gif,mp4') || '')
    .split(',')
    .filter(Boolean),
  // 移除本地持久化默认值，遵循"文件存储必须 S3/R2"规范
  // 使用方必须显式配置或使用 s3Config
  destination: env.str('UPLOAD_DESTINATION'),
}))

export const httpConfig = registerAs('http', () => ({
  // 优先使用 HTTP_TRUST_PROXY，仅在未配置时回退到 TRUST_PROXY
  // 使用 raw() 检查变量是否存在，避免 || 运算符覆盖显式的 false
  trustProxy: env.raw('HTTP_TRUST_PROXY') !== undefined
    ? env.bool('HTTP_TRUST_PROXY')
    : env.bool('TRUST_PROXY'),
  trustProxyHops: Math.max(0, env.int('HTTP_TRUST_PROXY_HOPS', 0)),
}))

export const openaiConfig = registerAs('openai', () => ({
  apiKey: env.str('OPENAI_COMPATIBLE_API_KEY'),
  apiBaseUrl: env.str('OPENAI_COMPATIBLE_BASE_URL'),
}))

export const aiConfig = registerAs('ai', () => ({
  uniapi: {
    apiKey: env.str('UNIAPI_API_KEY'),
    baseUrl: env.str('UNIAPI_BASE_URL', 'https://api.uniapi.io'),
  },
}))

export const rbacConfig = registerAs('rbac', () => ({
  debugMode: env.bool('RBAC_DEBUG'),
}))

export const oauthConfig = registerAs('oauth', () => ({
  google: {
    clientId: env.str('GOOGLE_CLIENT_ID', ''),
    clientSecret: env.str('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: env.str('GOOGLE_CALLBACK_URL', 'http://localhost:3000/api/v1/auth/google/callback'),
  },
  discord: {
    clientId: env.str('DISCORD_CLIENT_ID', ''),
    clientSecret: env.str('DISCORD_CLIENT_SECRET', ''),
    callbackUrl: env.str(
      'DISCORD_CALLBACK_URL',
      'http://localhost:3000/api/v1/auth/discord/callback',
    ),
  },
}))

export const authRateLimitConfig = registerAs('authRateLimit', () => {
  const envEnabled = env.str('AUTH_RATE_LIMIT_ENABLED')
  // 使用统一的环境识别，支持别名（prod/stage 等）
  const appEnv = env.appEnv()
  const enabled =
    typeof envEnabled === 'string' ? envEnabled.toLowerCase() === 'true' : appEnv === 'production'

  return {
    enabled,
    maxAttempts: parsePositiveInt(env.str('AUTH_RATE_LIMIT_MAX'), 10),
    fallbackMaxAttempts: parsePositiveInt(env.str('AUTH_RATE_LIMIT_FALLBACK_MAX'), 20),
    windowMs: parsePositiveInt(env.str('AUTH_RATE_LIMIT_WINDOW_MS'), 5 * 60 * 1000),
  }
})

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parsePositiveInt(env.str('THROTTLE_TTL'), 60),
  limit: parsePositiveInt(env.str('THROTTLE_LIMIT'), 30),
  ignoreUserAgents: (env.str('THROTTLE_IGNORE_USER_AGENTS', '') || '').split(',').filter(Boolean),
  skipIf: env.str('THROTTLE_SKIP_IF') || null,
  redisEnabled: env.bool('THROTTLE_REDIS_ENABLE'),
}))

export const messageBusConfig = registerAs('messageBus', () => ({
  backoffDelayMs: env.int('MESSAGEBUS_BACKOFF_DELAY_MS', 1000),
  defaultMode: (env.str('MESSAGEBUS_DEFAULT_MODE', 'volatile') || 'volatile') as
    | 'volatile'
    | 'reliable'
    | 'handshake',
  outbox: {
    pollIntervalMs: env.int('MESSAGEBUS_OUTBOX_POLL_INTERVAL_MS', 500),
    batchSize: env.int('MESSAGEBUS_OUTBOX_BATCH_SIZE', 20),
    maxAttempts: env.int('MESSAGEBUS_OUTBOX_MAX_ATTEMPTS', 6),
    lockTimeoutSec: env.int('MESSAGEBUS_OUTBOX_LOCK_TIMEOUT_SEC', 30),
    baseBackoffMs: env.int('MESSAGEBUS_OUTBOX_BASE_BACKOFF_MS', 1000),
    retainDays: env.int('MESSAGEBUS_OUTBOX_RETAIN_DAYS', 7),
    publishAttempts: env.int('MESSAGEBUS_OUTBOX_PUBLISH_ATTEMPTS', 3),
    candidateFactor: env.int('MESSAGEBUS_OUTBOX_CANDIDATE_FACTOR', 3),
    claimMaxCycles: env.int('MESSAGEBUS_OUTBOX_CLAIM_MAX_CYCLES', 1),
  },
}))

export const userActivityConfig = registerAs('userActivity', () => ({
  dedupeTtlSec: env.int('USERACTIVITY_DEDUPE_TTL_SEC', 300),
}))

export const engagementConfig = registerAs('engagement', () => ({
  dedupeTtlSec: env.int('ENGAGEMENT_DEDUPE_TTL_SEC', env.int('USERACTIVITY_DEDUPE_TTL_SEC', 300)),
  timezone: env.str('ENGAGEMENT_TIMEZONE', 'Asia/Shanghai'),
  maxDelayDays: env.int('ENGAGEMENT_MAX_DELAY_DAYS', 7),
}))

export const paymentConfig = registerAs('payment', () => ({
  wgqpay: {
    host: env.str('PAYMENT_WGQPAY_HOST', 'http://cc.wgqpay.com'),
    merchantNo: env.str('PAYMENT_WGQPAY_MERCHANT_NO', ''),
    secret: env.str('PAYMENT_WGQPAY_SECRET', ''),
    payType: env.str('PAYMENT_WGQPAY_PAY_TYPE', '1'),
    notifyUrl: env.str('PAYMENT_WGQPAY_NOTIFY_URL', ''),
    returnUrl: env.str('PAYMENT_WGQPAY_RETURN_URL', ''),
    requestTimeoutMs: env.int('PAYMENT_WGQPAY_TIMEOUT_MS', 10000),
    userAgent: env.str('PAYMENT_WGQPAY_UA', 'wgqpay-adapter/1.0'),
    callerIp: env.str('PAYMENT_WGQPAY_CALLER_IP', '127.0.0.1'),
    tradeName: env.str('PAYMENT_WGQPAY_TRADE_NAME', 'Account Top-up'),
  },
  webhookSecrets: {},
}))

export const prismaConfig = registerAs('prisma', () => ({
  slowQueryMs: env.int('PRISMA_SLOW_QUERY_MS', 100),
  criticalSlowQueryMs: env.int('PRISMA_CRITICAL_SLOW_QUERY_MS', 500),
}))

const parseFloatValue = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseSymbolList = (value: string | undefined, fallback: readonly string[]): string[] => {
  if (!value) return [...fallback]
  return value
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean)
}

const parseTimeframeList = (
  value: string | undefined,
  fallback: readonly string[],
): MarketTimeframe[] => {
  const source = value
    ? value
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
    : [...fallback]

  const valid = source.filter(item => MARKET_TIMEFRAMES.includes(item as MarketTimeframe)) as MarketTimeframe[]
  const invalid = source.filter(item => !MARKET_TIMEFRAMES.includes(item as MarketTimeframe))

  if (invalid.length > 0) {
     
    console.warn(
      `无效的时间周期配置已被忽略: ${invalid.join(', ')}. 支持的周期: ${MARKET_TIMEFRAMES.join(', ')}`,
    )
  }

  if (valid.length === 0) {
     
    console.warn(
      `MARKET_DATA_TIMEFRAMES 配置全部无效，将回退到默认值: ${fallback.join(', ')}`,
    )
    return [...(fallback as MarketTimeframe[])]
  }

  return valid
}

export const marketDataConfig = registerAs('marketData', () => ({
  restBaseUrl: env.str('MARKET_DATA_API_BASE_URL', 'https://api.binance.com'),
  wsBaseUrl: env.str('MARKET_DATA_WS_URL', 'wss://stream.binance.com:9443'),
  streamPathTemplate: env.str('MARKET_DATA_WS_STREAM_PATH', 'stream?streams='),
  symbols: parseSymbolList(env.str('MARKET_DATA_SYMBOLS'), DEFAULT_MARKET_SYMBOLS),
  timeframes: parseTimeframeList(env.str('MARKET_DATA_TIMEFRAMES'), MARKET_TIMEFRAMES),
  historicalLookbackMinutes: parsePositiveInt(env.str('MARKET_DATA_HISTORICAL_LOOKBACK_MINUTES'), 24 * 60),
  restBatchSize: parsePositiveInt(env.str('MARKET_DATA_REST_BATCH_SIZE'), 500),
  wsReconnectDelayMs: env.int('MARKET_DATA_WS_RECONNECT_DELAY_MS', 5_000),
  restTimeoutMs: env.int('MARKET_DATA_REST_TIMEOUT_MS', 10_000),
}))

export const strategySignalsConfig = registerAs('strategySignals', () => ({
  enabled: env.bool('STRATEGY_SIGNALS_ENABLED', false),
  cronExpression: env.str('STRATEGY_SIGNALS_CRON', '*/5 * * * *'),
  cooldownMinutes: parsePositiveInt(env.str('STRATEGY_SIGNALS_COOLDOWN_MINUTES'), 15),
  batchSize: parsePositiveInt(env.str('STRATEGY_SIGNALS_BATCH_SIZE'), 10),
  maxSymbolsPerStrategy: parsePositiveInt(env.str('STRATEGY_SIGNALS_MAX_SYMBOLS'), 3),
  debug: {
    // 是否启用详细的脚本调试日志（仅用于开发/调试，生产环境应禁用）
    enabled: env.bool('DEBUG_STRATEGY_SCRIPTS', false),
    // 脚本内容最大输出长度
    maxScriptLength: parsePositiveInt(env.str('DEBUG_SCRIPT_MAX_LENGTH'), 1000),
    // 返回值最大输出长度
    maxValueLength: parsePositiveInt(env.str('DEBUG_VALUE_MAX_LENGTH'), 200),
  },
  ai: {
    maxAttempts: parsePositiveInt(env.str('STRATEGY_SIGNALS_AI_MAX_ATTEMPTS'), 2),
    temperature: parseFloatValue(env.str('STRATEGY_SIGNALS_AI_TEMPERATURE'), 0.2),
    maxTokens: parsePositiveInt(env.str('STRATEGY_SIGNALS_AI_MAX_TOKENS'), 400),
    maxFailuresBeforeCooldown: parsePositiveInt(env.str('STRATEGY_SIGNALS_AI_MAX_FAILURES'), 3),
    failureCooldownMinutes: parsePositiveInt(env.str('STRATEGY_SIGNALS_AI_FAILURE_COOLDOWN_MINUTES'), 30),
    maxRawResponseLength: parsePositiveInt(env.str('STRATEGY_SIGNALS_AI_MAX_RESPONSE'), 4000),
  },
  execution: {
    enabled: env.bool('STRATEGY_SIGNALS_EXECUTION_ENABLED', false),
    dryRun: env.bool('STRATEGY_SIGNALS_EXECUTION_DRY_RUN', true),
    maxAccountsPerSignal: parsePositiveInt(env.str('STRATEGY_SIGNALS_EXECUTION_MAX_ACCOUNTS'), 25),
    defaultQuoteAmount: parsePositiveInt(env.str('STRATEGY_SIGNALS_EXECUTION_DEFAULT_QUOTE'), 100),
    minBalanceThreshold: parseFloatValue(env.str('STRATEGY_SIGNALS_EXECUTION_MIN_BALANCE'), 50),
    maxRiskFraction: parseFloatValue(env.str('STRATEGY_SIGNALS_EXECUTION_MAX_RISK_FRACTION'), 0.2),
  },
}))

// 默认仅加载必要的配置；其余命名空间保留实现但不默认启用
export const backendConfigLoaders = [
  appConfig,
  httpConfig,
  redisConfig,
  jwtConfig,
  rbacConfig,
  aiConfig, // AI 配置用于策略脚本生成
  marketDataConfig,
  strategySignalsConfig,
  polymarketConfig,
  // 其他配置在需要时再加入 ConfigModule.load
]

