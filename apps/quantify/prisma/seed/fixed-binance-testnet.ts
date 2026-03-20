import { createCipheriv, randomBytes } from 'node:crypto'
import type { PrismaClient } from '../../generated/prisma'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SECRET_PLACEHOLDER = '__SET_IN_env.local__'

export interface FixedBinanceTestnetSeedConfig {
  spotApiKey: string
  spotApiSecret: string
  perpApiKey: string
  perpApiSecret: string
  spotBaseAsset: string
  perpBaseAsset: string
  quoteAsset: string
  initialBalance: string
  userEmail: string
  userNickname: string
  operatorId: string
}

interface BinanceExchangeAccountConfig {
  apiKey: string
  secret: string
  isTestnet: true
  spotEnabled: true
  futuresEnabled: true
}

interface SeedSymbolPlan {
  code: string
  baseAsset: string
  quoteAsset: string
  exchange: 'BINANCE'
  instrumentType: 'SPOT' | 'PERPETUAL'
  type: 'CRYPTO'
  status: 'ACTIVE'
  precisionPrice: number
  precisionQuantity: number
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

interface FixedBinanceTestnetSeedPlan {
  user: {
    email: string
    nickname: string
  }
  exchangeAccounts: Array<{
    name: string
    isTestnet: true
    config: BinanceExchangeAccountConfig
  }>
  strategy: {
    name: string
    description: string
    status: 'live'
    createdBy: string
    updatedBy: string
    allowedSymbols: string[]
    allowedTimeframes: string[]
    riskConfig: {
      bootstrapMode: 'fixed-binance-testnet'
      baseCurrency: string
      initialBalance: string
    }
    metadata: {
      bootstrapMode: 'fixed-binance-testnet'
      exchangeId: 'binance'
      isTestnet: true
    }
  }
  symbols: SeedSymbolPlan[]
  instances: SeedInstancePlan[]
  strategyAccount: {
    strategyName: string
    baseCurrency: string
    initialBalance: string
  }
}

function resolvePerpPrecisionQuantity(baseAsset: string): number {
  if (baseAsset === 'XRP') return 1
  return 6
}

function normalizedValue(value: string | undefined): string | undefined {
  if (value == null)
    return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed === SECRET_PLACEHOLDER)
    return undefined

  return trimmed
}

function normalizedBoolean(value: string | undefined): boolean {
  const normalized = normalizedValue(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function requiredValue(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string {
  const value = normalizedValue(env[key])
  if (!value) {
    throw new Error(`[fixed-binance-testnet] Missing required environment variable: ${key}`)
  }
  return value
}

function decodeKey(value: string): Buffer {
  const hexPattern = /^[0-9a-f]+$/i
  if (hexPattern.test(value) && value.length === 64)
    return Buffer.from(value, 'hex')
  return Buffer.from(value, 'base64')
}

export function readFixedBinanceTestnetSeedConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): FixedBinanceTestnetSeedConfig | null {
  if (!normalizedBoolean(env.QUANTIFY_FIXED_BINANCE_TESTNET_ENABLED))
    return null

  return {
    spotApiKey: requiredValue(env, 'QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_KEY'),
    spotApiSecret: requiredValue(env, 'QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_SECRET'),
    perpApiKey: requiredValue(env, 'QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_KEY'),
    perpApiSecret: requiredValue(env, 'QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_SECRET'),
    spotBaseAsset: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_BASE_ASSET)?.toUpperCase() ?? 'BTC',
    perpBaseAsset: normalizedValue(env.QUANTIFY_FIXED_BINANCE_PERP_TESTNET_BASE_ASSET)?.toUpperCase() ?? 'XRP',
    quoteAsset: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_QUOTE_ASSET)?.toUpperCase() ?? 'USDT',
    initialBalance: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_INITIAL_BALANCE) ?? '10',
    userEmail: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_USER_EMAIL) ?? 'binance-testnet-fixed@local.dev',
    userNickname: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_USER_NICKNAME) ?? 'Binance Testnet Fixed User',
    operatorId: normalizedValue(env.QUANTIFY_FIXED_BINANCE_TESTNET_OPERATOR_ID) ?? 'system-fixed-binance-seed',
  }
}

export function buildFixedBinanceTestnetPlan(
  config: FixedBinanceTestnetSeedConfig,
): FixedBinanceTestnetSeedPlan {
  const spotCode = `${config.spotBaseAsset}${config.quoteAsset}`
  const perpBaseCode = `${config.perpBaseAsset}${config.quoteAsset}`
  const perpCode = `${perpBaseCode}:PERP`
  const spotStrategySlug = spotCode.toLowerCase()
  const perpStrategySlug = perpBaseCode.toLowerCase()
  const allowedTimeframes = ['1m', '5m', '15m', '1h']

  return {
    user: {
      email: config.userEmail,
      nickname: config.userNickname,
    },
    exchangeAccounts: [
      {
        name: 'binance-testnet-spot',
        isTestnet: true,
        config: {
          apiKey: config.spotApiKey,
          secret: config.spotApiSecret,
          isTestnet: true,
          spotEnabled: true,
          futuresEnabled: false,
        },
      },
      {
        name: 'binance-testnet-perp',
        isTestnet: true,
        config: {
          apiKey: config.perpApiKey,
          secret: config.perpApiSecret,
          isTestnet: true,
          spotEnabled: false,
          futuresEnabled: true,
        },
      },
    ],
    strategy: {
      name: `FIXED-BINANCE-TESTNET-${spotCode}`,
      description: `Fixed Binance testnet bootstrap strategy for ${spotCode} spot and ${perpCode} perpetual execution.`,
      status: 'live',
      createdBy: config.operatorId,
      updatedBy: config.operatorId,
      allowedSymbols: [spotCode, perpCode],
      allowedTimeframes,
      riskConfig: {
        bootstrapMode: 'fixed-binance-testnet',
        baseCurrency: config.quoteAsset,
        initialBalance: config.initialBalance,
      },
      metadata: {
        bootstrapMode: 'fixed-binance-testnet',
        exchangeId: 'binance',
        isTestnet: true,
      },
    },
    symbols: [
      {
        code: spotCode,
        baseAsset: config.spotBaseAsset,
        quoteAsset: config.quoteAsset,
        exchange: 'BINANCE',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
      {
        code: perpCode,
        baseAsset: config.perpBaseAsset,
        quoteAsset: config.quoteAsset,
        exchange: 'BINANCE',
        instrumentType: 'PERPETUAL',
        type: 'CRYPTO',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: resolvePerpPrecisionQuantity(config.perpBaseAsset),
      },
    ],
    instances: [
      {
        name: `fixed-binance-${spotStrategySlug}-spot`,
        exchangeAccountName: 'binance-testnet-spot',
        mode: 'LIVE',
        status: 'paused',
        llmModel: 'gpt-4.1-mini',
        metadata: {
          allowedSymbols: [spotCode],
          allowedTimeframes,
          marketType: 'spot',
        },
      },
      {
        name: `fixed-binance-${perpStrategySlug}-perp`,
        exchangeAccountName: 'binance-testnet-perp',
        mode: 'LIVE',
        status: 'paused',
        llmModel: 'gpt-4.1-mini',
        metadata: {
          allowedSymbols: [perpCode],
          allowedTimeframes,
          marketType: 'perp',
        },
      },
    ],
    strategyAccount: {
      strategyName: `FIXED-BINANCE-TESTNET-${spotCode}`,
      baseCurrency: config.quoteAsset,
      initialBalance: config.initialBalance,
    },
  }
}

export function encryptExchangeAccountConfig(
  payload: BinanceExchangeAccountConfig,
  rawKey: string,
): string {
  const key = decodeKey(rawKey.trim())
  if (key.length !== 32) {
    throw new Error('[fixed-binance-testnet] EXCHANGE_ACCOUNT_CRYPTO_KEY must decode to 32 bytes')
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
  accountPlan: FixedBinanceTestnetSeedPlan['exchangeAccounts'][number],
  cryptoKey: string,
) {
  const encryptedConfig = encryptExchangeAccountConfig(accountPlan.config, cryptoKey)
  const existing = await prisma.exchangeAccount.findFirst({
    where: {
      userId,
      exchangeId: 'binance',
      name: accountPlan.name,
    },
  })

  if (existing) {
    return prisma.exchangeAccount.update({
      where: { id: existing.id },
      data: {
        isTestnet: true,
        encryptedConfig,
        name: accountPlan.name,
      },
    })
  }

  return prisma.exchangeAccount.create({
    data: {
      userId,
      exchangeId: 'binance',
      name: accountPlan.name,
      isTestnet: true,
      encryptedConfig,
    },
  })
}

async function ensureStrategyInstance(
  prisma: PrismaClient,
  strategyId: string,
  instance: SeedInstancePlan,
  operatorId: string,
) {
  const existing = await prisma.llmStrategyInstance.findFirst({
    where: {
      strategyId,
      name: instance.name,
    },
  })

  if (existing) {
    return prisma.llmStrategyInstance.update({
      where: { id: existing.id },
      data: {
        status: instance.status,
        mode: instance.mode,
        llmModel: instance.llmModel,
        metadata: instance.metadata,
        updatedBy: operatorId,
      },
    })
  }

  return prisma.llmStrategyInstance.create({
    data: {
      strategyId,
      name: instance.name,
      status: instance.status,
      mode: instance.mode,
      llmModel: instance.llmModel,
      metadata: instance.metadata,
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
  plan: FixedBinanceTestnetSeedPlan,
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

export async function seedFixedBinanceTestnet(prisma: PrismaClient): Promise<void> {
  const config = readFixedBinanceTestnetSeedConfig()
  if (!config) {
    console.log('[seed] QUANTIFY_FIXED_BINANCE_TESTNET_ENABLED is not enabled. Skipping fixed Binance testnet seed.')
    return
  }

  const cryptoKey = requiredValue(process.env, 'EXCHANGE_ACCOUNT_CRYPTO_KEY')
  const plan = buildFixedBinanceTestnetPlan(config)

  console.log(`[seed] Seeding fixed Binance testnet data for ${plan.user.email}...`)

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

  for (const symbol of plan.symbols) {
    await prisma.symbol.upsert({
      where: { code: symbol.code },
      update: {
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        exchange: symbol.exchange,
        instrumentType: symbol.instrumentType,
        status: symbol.status,
        precisionPrice: symbol.precisionPrice,
        precisionQuantity: symbol.precisionQuantity,
      },
      create: symbol,
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

  const exchangeAccountsByName = new Map<string, Awaited<ReturnType<typeof ensureExchangeAccount>>>()
  for (const accountPlan of plan.exchangeAccounts) {
    const account = await ensureExchangeAccount(prisma, user.id, accountPlan, cryptoKey)
    exchangeAccountsByName.set(accountPlan.name, account)
  }

  const persistedInstances = []
  for (const instance of plan.instances) {
    const persisted = await ensureStrategyInstance(prisma, strategy.id, instance, config.operatorId)
    persistedInstances.push({
      id: persisted.id,
      name: persisted.name,
      exchangeAccountName: instance.exchangeAccountName,
    })
  }

  for (const instance of persistedInstances) {
    const account = exchangeAccountsByName.get(instance.exchangeAccountName)
    if (!account) {
      throw new Error(
        `[fixed-binance-testnet] Missing exchange account binding for instance ${instance.name} -> ${instance.exchangeAccountName}`,
      )
    }
    await ensureLlmSubscription(prisma, user.id, instance.id, account.id)
  }

  await ensureStrategyAccount(prisma, user.id, strategy.id, plan)

  console.log(
    `[seed] Fixed Binance testnet data ready: user=${plan.user.email}, ` +
      `symbols=${plan.symbols.map(symbol => symbol.code).join(', ')}, ` +
      `accounts=${Array.from(exchangeAccountsByName.values()).map(account => account.id).join(', ')}`,
  )
}
