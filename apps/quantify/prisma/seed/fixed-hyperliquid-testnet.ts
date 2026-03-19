import type { PrismaClient } from '../../generated/prisma'
import { createCipheriv, randomBytes } from 'node:crypto'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SECRET_PLACEHOLDER = '__SET_IN_env.local__'
const DEFAULT_TIMEFRAMES = ['1m', '5m', '15m', '1h']
const DEFAULT_QUOTE_ASSET = 'USDC'
const DEFAULT_INITIAL_BALANCE = '1000'
const EXCHANGE_ACCOUNT_NAME = 'hyperliquid-testnet-perp'
const STRATEGY_PREFIX = 'FIXED-HYPERLIQUID-TESTNET'

export interface FixedHyperliquidTestnetSeedConfig {
  userEmail: string
  userNickname: string
  operatorId: string
  spotBaseAsset: string
  perpBaseAsset: string
  quoteAsset: string
  initialBalance: string
  mainWalletAddress: string
  agentPrivateKey: string
  isTestnet: boolean
}

interface HyperliquidExchangeAccountConfig {
  mainWalletAddress: string
  agentPrivateKey: string
  isTestnet: boolean
}

interface SeedSymbolPlan {
  code: string
  baseAsset: string
  quoteAsset: string
  exchange: 'HYPERLIQUID'
  instrumentType: 'SPOT' | 'PERPETUAL'
  type: 'CRYPTO'
  status: 'ACTIVE'
  precisionPrice: number
  precisionQuantity: number
  lotSize?: string
}

interface SeedInstancePlan {
  name: string
  exchangeAccountName: string
  mode: 'LIVE'
  status: 'paused'
  llmModel: string
  metadata: {
    allowedSymbols: string[]
    allowedTimeframes: string[]
    marketType: 'spot' | 'perp'
  }
}

export interface FixedHyperliquidTestnetSeedPlan {
  user: {
    email: string
    nickname: string
  }
  symbol: SeedSymbolPlan
  exchangeAccount: {
    name: string
    config: HyperliquidExchangeAccountConfig
  }
  symbols: SeedSymbolPlan[]
  strategy: {
    name: string
    description: string
    status: 'live'
    createdBy: string
    updatedBy: string
    allowedSymbols: string[]
    allowedTimeframes: string[]
    riskConfig: {
      bootstrapMode: 'fixed-hyperliquid-testnet'
      baseCurrency: string
      initialBalance: string
    }
    metadata: {
      bootstrapMode: 'fixed-hyperliquid-testnet'
      exchangeId: 'hyperliquid'
      isTestnet: boolean
    }
  }
  instances: SeedInstancePlan[]
  strategyAccount: {
    strategyName: string
    baseCurrency: string
    initialBalance: string
  }
}

function normalizedValue(value: string | undefined): string | undefined {
  if (value == null)
    return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed === SECRET_PLACEHOLDER)
    return undefined

  return trimmed
}

function normalizedBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizedValue(value)?.toLowerCase()
  if (!normalized)
    return undefined

  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function requiredValue(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string {
  const value = normalizedValue(env[key])
  if (!value) {
    throw new Error(`[fixed-hyperliquid-testnet] Missing required environment variable: ${key}`)
  }
  return value
}

function resolvePerpPrecisionQuantity(baseAsset: string): number {
  if (baseAsset === 'XRP')
    return 1
  return 6
}

function resolveSpotPrecisionQuantity(baseAsset: string): number {
  if (baseAsset === 'PURR')
    return 0
  return 6
}

function resolveSpotLotSize(baseAsset: string): string | undefined {
  if (baseAsset === 'PURR')
    return '1'
  return undefined
}

function resolveBaseAsset(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  primaryKey: string,
): string {
  const primary = normalizedValue(env[primaryKey])?.toUpperCase()
  if (primary)
    return primary

  const legacy = normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET)?.toUpperCase()
  if (legacy)
    return legacy

  throw new Error(
    `[fixed-hyperliquid-testnet] Missing required environment variable: ${primaryKey} or QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET`,
  )
}

export function readFixedHyperliquidTestnetSeedConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): FixedHyperliquidTestnetSeedConfig | null {
  if (!normalizedBoolean(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED))
    return null

  const isTestnet = normalizedBoolean(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_IS_TESTNET)

  return {
    userEmail: normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL) ??
      'hyperliquid-testnet-fixed@local.dev',
    userNickname: normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_NICKNAME) ??
      'Hyperliquid Testnet Fixed User',
    operatorId: normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_OPERATOR_ID) ??
      'system-fixed-hyperliquid-seed',
    spotBaseAsset: resolveBaseAsset(env, 'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_SPOT_BASE_ASSET'),
    perpBaseAsset: resolveBaseAsset(env, 'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_PERP_BASE_ASSET'),
    quoteAsset:
      normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET)?.toUpperCase() ?? DEFAULT_QUOTE_ASSET,
    initialBalance: normalizedValue(env.QUANTIFY_FIXED_HYPERLIQUID_TESTNET_INITIAL_BALANCE) ??
      DEFAULT_INITIAL_BALANCE,
    mainWalletAddress: requiredValue(env, 'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS'),
    agentPrivateKey: requiredValue(env, 'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY'),
    isTestnet: isTestnet ?? true,
  }
}

export function buildFixedHyperliquidTestnetPlan(
  config: FixedHyperliquidTestnetSeedConfig,
): FixedHyperliquidTestnetSeedPlan {
  const spotCode = `${config.spotBaseAsset}${config.quoteAsset}`
  const perpBaseCode = `${config.perpBaseAsset}${config.quoteAsset}`
  const perpCode = `${perpBaseCode}:PERP`
  const spotStrategySlug = spotCode.toLowerCase()
  const perpStrategySlug = perpBaseCode.toLowerCase()

  return {
    user: {
      email: config.userEmail,
      nickname: config.userNickname,
    },
    exchangeAccount: {
      name: EXCHANGE_ACCOUNT_NAME,
      config: {
        mainWalletAddress: config.mainWalletAddress,
        agentPrivateKey: config.agentPrivateKey,
        isTestnet: config.isTestnet,
      },
    },
    symbols: [
      {
        code: spotCode,
        baseAsset: config.spotBaseAsset,
        quoteAsset: config.quoteAsset,
        exchange: 'HYPERLIQUID',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: resolveSpotPrecisionQuantity(config.spotBaseAsset),
        lotSize: resolveSpotLotSize(config.spotBaseAsset),
      },
      {
        code: perpCode,
        baseAsset: config.perpBaseAsset,
        quoteAsset: config.quoteAsset,
        exchange: 'HYPERLIQUID',
        instrumentType: 'PERPETUAL',
        type: 'CRYPTO',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: resolvePerpPrecisionQuantity(config.perpBaseAsset),
      },
    ],
    strategy: {
      name: `${STRATEGY_PREFIX}-${spotCode}`,
      description: `Fixed Hyperliquid testnet bootstrap for ${spotCode} spot and ${perpCode} perpetual execution.`,
      status: 'live',
      createdBy: config.operatorId,
      updatedBy: config.operatorId,
      allowedSymbols: [spotCode, perpCode],
      allowedTimeframes: DEFAULT_TIMEFRAMES,
      riskConfig: {
        bootstrapMode: 'fixed-hyperliquid-testnet',
        baseCurrency: config.quoteAsset,
        initialBalance: config.initialBalance,
      },
      metadata: {
        bootstrapMode: 'fixed-hyperliquid-testnet',
        exchangeId: 'hyperliquid',
        isTestnet: config.isTestnet,
      },
    },
    instances: [
      {
        name: `fixed-hyperliquid-${spotStrategySlug}-spot`,
        exchangeAccountName: EXCHANGE_ACCOUNT_NAME,
        mode: 'LIVE',
        status: 'paused',
        llmModel: 'gpt-4.1-mini',
        metadata: {
          allowedSymbols: [spotCode],
          allowedTimeframes: DEFAULT_TIMEFRAMES,
          marketType: 'spot',
        },
      },
      {
        name: `fixed-hyperliquid-${perpStrategySlug}-perp`,
        exchangeAccountName: EXCHANGE_ACCOUNT_NAME,
        mode: 'LIVE',
        status: 'paused',
        llmModel: 'gpt-4.1-mini',
        metadata: {
          allowedSymbols: [perpCode],
          allowedTimeframes: DEFAULT_TIMEFRAMES,
          marketType: 'perp',
        },
      },
    ],
    strategyAccount: {
      strategyName: `${STRATEGY_PREFIX}-${spotCode}`,
      baseCurrency: config.quoteAsset,
      initialBalance: config.initialBalance,
    },
  }
}

function decodeKey(value: string): Buffer {
  const hexPattern = /^[0-9a-f]+$/i
  if (hexPattern.test(value) && value.length === 64)
    return Buffer.from(value, 'hex')

  return Buffer.from(value, 'base64')
}

export function encryptExchangeAccountConfig(
  payload: HyperliquidExchangeAccountConfig,
  rawKey: string,
): string {
  const key = decodeKey(rawKey.trim())
  if (key.length !== 32) {
    throw new Error('[fixed-hyperliquid-testnet] EXCHANGE_ACCOUNT_CRYPTO_KEY must decode to 32 bytes')
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv)
  const json = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

async function ensureExchangeAccount(
  prisma: PrismaClient,
  userId: string,
  accountPlan: FixedHyperliquidTestnetSeedPlan['exchangeAccount'],
  cryptoKey: string,
) {
  const encryptedConfig = encryptExchangeAccountConfig(accountPlan.config, cryptoKey)
  const existing = await prisma.exchangeAccount.findFirst({
    where: {
      userId,
      exchangeId: 'hyperliquid',
      name: accountPlan.name,
    },
  })

  if (existing) {
    return prisma.exchangeAccount.update({
      where: { id: existing.id },
      data: {
        name: accountPlan.name,
        isTestnet: accountPlan.config.isTestnet,
        encryptedConfig,
      },
    })
  }

  return prisma.exchangeAccount.create({
    data: {
      userId,
      exchangeId: 'hyperliquid',
      name: accountPlan.name,
      isTestnet: accountPlan.config.isTestnet,
      encryptedConfig,
    },
  })
}

async function ensureStrategyInstance(
  prisma: PrismaClient,
  strategyId: string,
  instancePlan: FixedHyperliquidTestnetSeedPlan['instances'][number],
  operatorId: string,
) {
  const existing = await prisma.llmStrategyInstance.findFirst({
    where: {
      strategyId,
      name: instancePlan.name,
    },
  })

  if (existing) {
    return prisma.llmStrategyInstance.update({
      where: { id: existing.id },
      data: {
        status: instancePlan.status,
        mode: instancePlan.mode,
        llmModel: instancePlan.llmModel,
        metadata: instancePlan.metadata,
        updatedBy: operatorId,
      },
    })
  }

  return prisma.llmStrategyInstance.create({
    data: {
      strategyId,
      name: instancePlan.name,
      status: instancePlan.status,
      mode: instancePlan.mode,
      llmModel: instancePlan.llmModel,
      metadata: instancePlan.metadata,
      createdBy: operatorId,
      updatedBy: operatorId,
    },
  })
}

async function ensureLlmSubscription(
  prisma: PrismaClient,
  userId: string,
  llmStrategyInstanceId: string,
  exchangeAccountId: string,
) {
  const existing = await prisma.userLlmStrategySubscription.findFirst({
    where: {
      userId,
      llmStrategyInstanceId,
    },
  })

  if (existing) {
    return prisma.userLlmStrategySubscription.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        exchangeAccountId,
        unsubscribedAt: null,
      },
    })
  }

  return prisma.userLlmStrategySubscription.create({
    data: {
      userId,
      llmStrategyInstanceId,
      status: 'active',
      exchangeAccountId,
    },
  })
}

async function ensureStrategyAccount(
  prisma: PrismaClient,
  userId: string,
  strategyId: string,
  plan: FixedHyperliquidTestnetSeedPlan,
) {
  const existing = await prisma.userStrategyAccount.findFirst({
    where: {
      userId,
      strategyId,
    },
  })

  if (existing) {
    return prisma.userStrategyAccount.update({
      where: { id: existing.id },
      data: {
        strategyName: plan.strategyAccount.strategyName,
      },
    })
  }

  return prisma.userStrategyAccount.create({
    data: {
      userId,
      strategyId,
      strategyName: plan.strategyAccount.strategyName,
      baseCurrency: plan.strategyAccount.baseCurrency,
      initialBalance: plan.strategyAccount.initialBalance,
      balance: plan.strategyAccount.initialBalance,
      equity: plan.strategyAccount.initialBalance,
    },
  })
}

export async function seedFixedHyperliquidTestnet(prisma: PrismaClient): Promise<void> {
  const config = readFixedHyperliquidTestnetSeedConfig()
  if (!config) {
    console.log(
      '[seed] QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED is not enabled. Skipping fixed Hyperliquid testnet seed.',
    )
    return
  }

  const cryptoKey = requiredValue(process.env, 'EXCHANGE_ACCOUNT_CRYPTO_KEY')
  const plan = buildFixedHyperliquidTestnetPlan(config)

  console.log(`[seed] Seeding fixed Hyperliquid testnet data for ${plan.user.email}...`)

  const user = await prisma.user.upsert({
    where: { email: plan.user.email },
    update: {
      nickname: plan.user.nickname,
      isGuest: false,
    },
    create: {
      email: plan.user.email,
      nickname: plan.user.nickname,
      isGuest: false,
    },
  })

  for (const symbolPlan of plan.symbols) {
    await prisma.symbol.upsert({
      where: { code: symbolPlan.code },
      update: {
        baseAsset: symbolPlan.baseAsset,
        quoteAsset: symbolPlan.quoteAsset,
        exchange: symbolPlan.exchange,
        instrumentType: symbolPlan.instrumentType,
        status: symbolPlan.status,
        precisionPrice: symbolPlan.precisionPrice,
        precisionQuantity: symbolPlan.precisionQuantity,
        lotSize: symbolPlan.lotSize,
      },
      create: {
        code: symbolPlan.code,
        baseAsset: symbolPlan.baseAsset,
        quoteAsset: symbolPlan.quoteAsset,
        exchange: symbolPlan.exchange,
        instrumentType: symbolPlan.instrumentType,
        type: symbolPlan.type,
        status: symbolPlan.status,
        precisionPrice: symbolPlan.precisionPrice,
        precisionQuantity: symbolPlan.precisionQuantity,
        lotSize: symbolPlan.lotSize,
      },
    })
  }

  const strategy = await prisma.llmStrategy.upsert({
    where: { name: plan.strategy.name },
    update: {
      description: plan.strategy.description,
      status: plan.strategy.status,
      allowedSymbols: plan.strategy.allowedSymbols,
      allowedTimeframes: plan.strategy.allowedTimeframes,
      riskConfig: plan.strategy.riskConfig,
      metadata: plan.strategy.metadata,
      updatedBy: plan.strategy.updatedBy,
    },
    create: {
      name: plan.strategy.name,
      description: plan.strategy.description,
      status: plan.strategy.status,
      createdBy: plan.strategy.createdBy,
      updatedBy: plan.strategy.updatedBy,
      allowedSymbols: plan.strategy.allowedSymbols,
      allowedTimeframes: plan.strategy.allowedTimeframes,
      riskConfig: plan.strategy.riskConfig,
      metadata: plan.strategy.metadata,
    },
  })

  const exchangeAccount = await ensureExchangeAccount(prisma, user.id, plan.exchangeAccount, cryptoKey)
  for (const instancePlan of plan.instances) {
    const instance = await ensureStrategyInstance(prisma, strategy.id, instancePlan, config.operatorId)
    await ensureLlmSubscription(prisma, user.id, instance.id, exchangeAccount.id)
  }
  await ensureStrategyAccount(prisma, user.id, strategy.id, plan)

  console.log(
    `[seed] Fixed Hyperliquid testnet data ready: user=${plan.user.email}, symbols=${plan.symbols.map(symbol => symbol.code).join(',')}, ` +
      `account=${exchangeAccount.id}`,
  )
}
