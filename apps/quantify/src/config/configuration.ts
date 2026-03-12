import type { MarketTimeframe } from '@ai/shared'
import { DEFAULT_MARKET_SYMBOLS, MARKET_TIMEFRAMES } from '@ai/shared'
import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor, parsePositiveInt } from '../common/env/env.accessor'

const env = defaultEnvAccessor

export const appConfig = registerAs('app', () => ({
  appEnv: env.appEnv() || 'development',
  port: env.int('PORT', 3000),
  apiPrefix: env.str('API_PREFIX', 'api/v1'),
  appName: env.str('APP_NAME', '@net/backend'),
}))

export const databaseConfig = registerAs('database', () => ({
  url: env.str('DATABASE_URL'),
}))

export const redisConfig = registerAs('redis', () => ({
  url: env.str('REDIS_URL', ''),
}))

export const uploadConfig = registerAs('upload', () => ({
  maxFileSize: env.int('MAX_FILE_SIZE', 10485760),
  allowedFileTypes: (env.str('ALLOWED_FILE_TYPES', 'jpg,jpeg,png,gif,mp4') || '')
    .split(',')
    .filter(Boolean),
  // 绉婚櫎鏈湴鎸佷箙鍖栭粯璁ゅ€硷紝閬靛惊"鏂囦欢瀛樺偍蹇呴』 S3/R2"瑙勮寖
  // 浣跨敤鏂瑰繀椤绘樉寮忛厤缃垨浣跨敤 s3Config
  destination: env.str('UPLOAD_DESTINATION'),
}))

export const httpConfig = registerAs('http', () => ({
  // 浼樺厛浣跨敤 HTTP_TRUST_PROXY锛屼粎鍦ㄦ湭閰嶇疆鏃跺洖閫€鍒?TRUST_PROXY
  // 浣跨敤 raw() 妫€鏌ュ彉閲忔槸鍚﹀瓨鍦紝閬垮厤 || 杩愮畻绗﹁鐩栨樉寮忕殑 false
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
      `鏃犳晥鐨勬椂闂村懆鏈熼厤缃凡琚拷鐣? ${invalid.join(', ')}. 鏀寔鐨勫懆鏈? ${MARKET_TIMEFRAMES.join(', ')}`,
    )
  }

  if (valid.length === 0) {

    console.warn(
      `MARKET_DATA_TIMEFRAMES 閰嶇疆鍏ㄩ儴鏃犳晥锛屽皢鍥為€€鍒伴粯璁ゅ€? ${fallback.join(', ')}`,
    )
    return [...(fallback as MarketTimeframe[])]
  }

  return valid
}

export const marketDataConfig = registerAs('marketData', () => ({
  provider: env.str('MARKET_DATA_PROVIDER', 'binance'),
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
    // 鏄惁鍚敤璇︾粏鐨勮剼鏈皟璇曟棩蹇楋紙浠呯敤浜庡紑鍙?璋冭瘯锛岀敓浜х幆澧冨簲绂佺敤锛?
    enabled: env.bool('DEBUG_STRATEGY_SCRIPTS', false),
    // 鑴氭湰鍐呭鏈€澶ц緭鍑洪暱搴?
    maxScriptLength: parsePositiveInt(env.str('DEBUG_SCRIPT_MAX_LENGTH'), 1000),
    // 杩斿洖鍊兼渶澶ц緭鍑洪暱搴?
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

// 榛樿浠呭姞杞藉繀瑕佺殑閰嶇疆锛涘叾浣欏懡鍚嶇┖闂翠繚鐣欏疄鐜颁絾涓嶉粯璁ゅ惎鐢?
export const backendConfigLoaders = [
  appConfig,
  httpConfig,
  redisConfig,
  aiConfig, // AI 閰嶇疆鐢ㄤ簬绛栫暐鑴氭湰鐢熸垚
  marketDataConfig,
  strategySignalsConfig,
  // 鍏朵粬閰嶇疆鍦ㄩ渶瑕佹椂鍐嶅姞鍏?ConfigModule.load
]
