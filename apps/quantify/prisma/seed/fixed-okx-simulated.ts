import type { PrismaClient } from '../../generated/prisma'
import { createCipheriv, randomBytes } from 'node:crypto'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SECRET_PLACEHOLDER = '__SET_IN_env.local__'

export interface FixedOkxSimulatedSeedConfig {
  apiKey: string
  apiSecret: string
  apiPassphrase: string
  spotBaseAsset: string
  perpBaseAsset: string
  quoteAsset: string
  initialBalance: string
  userEmail: string
  userNickname: string
  operatorId: string
  isTestnet: boolean
}

interface OkxExchangeAccountConfig {
  apiKey: string
  secret: string
  passphrase: string
  isTestnet: boolean
  useUnifiedAccount: true
}

interface SeedSymbolPlan {
  code: string
  baseAsset: string
  quoteAsset: string
  exchange: 'OKX'
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

interface FixedOkxSimulatedSeedPlan {
  user: {
    email: string
    nickname: string
  }
  exchangeAccounts: Array<{
    name: string
    isTestnet: boolean
    config: OkxExchangeAccountConfig
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
      bootstrapMode: 'fixed-okx-simulated'
      baseCurrency: string
      initialBalance: string
    }
    metadata: {
      bootstrapMode: 'fixed-okx-simulated'
      exchangeId: 'okx'
      isTestnet: boolean
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
  if (value == null) return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed === SECRET_PLACEHOLDER) return undefined

  return trimmed
}

function normalizedBoolean(value: string | undefined): boolean {
  const normalized = normalizedValue(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function requiredValue(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string {
  const value = normalizedValue(env[key])
  if (!value) {
    throw new Error(`[fixed-okx-simulated] Missing required environment variable: ${key}`)
  }
  return value
}

function decodeKey(value: string): Buffer {
  const hexPattern = /^[0-9a-f]+$/i
  if (hexPattern.test(value) && value.length === 64) return Buffer.from(value, 'hex')
  return Buffer.from(value, 'base64')
}

export function readFixedOkxSimulatedSeedConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): FixedOkxSimulatedSeedConfig | null {
  if (!normalizedBoolean(env.QUANTIFY_FIXED_OKX_ENABLED)) return null

  const rawIsTestnet = env.QUANTIFY_FIXED_OKX_IS_TESTNET
  const isTestnet = rawIsTestnet == null ? true : normalizedBoolean(rawIsTestnet)

  return {
    apiKey: requiredValue(env, 'QUANTIFY_FIXED_OKX_API_KEY'),
    apiSecret: requiredValue(env, 'QUANTIFY_FIXED_OKX_API_SECRET'),
    apiPassphrase: requiredValue(env, 'QUANTIFY_FIXED_OKX_API_PASSPHRASE'),
    spotBaseAsset: normalizedValue(env.QUANTIFY_FIXED_OKX_SPOT_BASE_ASSET)?.toUpperCase() ?? 'BTC',
    perpBaseAsset: normalizedValue(env.QUANTIFY_FIXED_OKX_PERP_BASE_ASSET)?.toUpperCase() ?? 'BTC',
    quoteAsset: normalizedValue(env.QUANTIFY_FIXED_OKX_QUOTE_ASSET)?.toUpperCase() ?? 'USDT',
    initialBalance: normalizedValue(env.QUANTIFY_FIXED_OKX_INITIAL_BALANCE) ?? '1000',
    userEmail: normalizedValue(env.QUANTIFY_FIXED_OKX_USER_EMAIL) ?? 'okx-sim-fixed@local.dev',
    userNickname: normalizedValue(env.QUANTIFY_FIXED_OKX_USER_NICKNAME) ?? 'OKX Sim Fixed User',
    operatorId: normalizedValue(env.QUANTIFY_FIXED_OKX_OPERATOR_ID) ?? 'system-fixed-okx-seed',
    isTestnet,
  }
}

export function buildFixedOkxSimulatedPlan(
  config: FixedOkxSimulatedSeedConfig,
): FixedOkxSimulatedSeedPlan {
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
        name: 'okx-sim-spot',
        isTestnet: config.isTestnet,
        config: {
          apiKey: config.apiKey,
          secret: config.apiSecret,
          passphrase: config.apiPassphrase,
          isTestnet: config.isTestnet,
          useUnifiedAccount: true,
        },
      },
      {
        name: 'okx-sim-perp',
        isTestnet: config.isTestnet,
        config: {
          apiKey: config.apiKey,
          secret: config.apiSecret,
          passphrase: config.apiPassphrase,
          isTestnet: config.isTestnet,
          useUnifiedAccount: true,
        },
      },
    ],
    strategy: {
      name: `FIXED-OKX-SIMULATED-${spotCode}`,
      description: `Fixed OKX simulated bootstrap strategy for ${spotCode} spot and ${perpCode} perpetual execution.`,
      status: 'live',
      createdBy: config.operatorId,
      updatedBy: config.operatorId,
      allowedSymbols: [spotCode, perpCode],
      allowedTimeframes,
      riskConfig: {
        bootstrapMode: 'fixed-okx-simulated',
        baseCurrency: config.quoteAsset,
        initialBalance: config.initialBalance,
      },
      metadata: {
        bootstrapMode: 'fixed-okx-simulated',
        exchangeId: 'okx',
        isTestnet: config.isTestnet,
      },
    },
    symbols: [
      {
        code: spotCode,
        baseAsset: config.spotBaseAsset,
        quoteAsset: config.quoteAsset,
        exchange: 'OKX',
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
        exchange: 'OKX',
        instrumentType: 'PERPETUAL',
        type: 'CRYPTO',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: resolvePerpPrecisionQuantity(config.perpBaseAsset),
      },
    ],
    instances: [
      {
        name: `fixed-okx-${spotStrategySlug}-spot`,
        exchangeAccountName: 'okx-sim-spot',
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
        name: `fixed-okx-${perpStrategySlug}-perp`,
        exchangeAccountName: 'okx-sim-perp',
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
      strategyName: `FIXED-OKX-SIMULATED-${spotCode}`,
      baseCurrency: config.quoteAsset,
      initialBalance: config.initialBalance,
    },
  }
}

export function encryptExchangeAccountConfig(
  payload: OkxExchangeAccountConfig,
  rawKey: string,
): string {
  const key = decodeKey(rawKey.trim())
  if (key.length !== 32) {
    throw new Error('[fixed-okx-simulated] EXCHANGE_ACCOUNT_CRYPTO_KEY must decode to 32 bytes')
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
  accountPlan: FixedOkxSimulatedSeedPlan['exchangeAccounts'][number],
  cryptoKey: string,
) {
  const encryptedConfig = encryptExchangeAccountConfig(accountPlan.config, cryptoKey)
  const existing = await prisma.exchangeAccount.findFirst({
    where: {
      userId,
      exchangeId: 'okx',
    },
  })

  if (existing) {
    return prisma.exchangeAccount.update({
      where: { id: existing.id },
      data: {
        isTestnet: accountPlan.isTestnet,
        encryptedConfig,
        name: accountPlan.name,
      },
    })
  }

  return prisma.exchangeAccount.create({
    data: {
      userId,
      exchangeId: 'okx',
      name: accountPlan.name,
      isTestnet: accountPlan.isTestnet,
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
  plan: FixedOkxSimulatedSeedPlan,
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

export async function seedFixedOkxSimulated(prisma: PrismaClient): Promise<void> {
  const config = readFixedOkxSimulatedSeedConfig()
  if (!config) {
    console.log('[seed] QUANTIFY_FIXED_OKX_ENABLED is not enabled. Skipping fixed OKX simulated seed.')
    return
  }

  const cryptoKey = requiredValue(process.env, 'EXCHANGE_ACCOUNT_CRYPTO_KEY')
  const plan = buildFixedOkxSimulatedPlan(config)

  console.log(`[seed] Seeding fixed OKX simulated data for ${plan.user.email}...`)

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

  const persistedInstances: Array<{ id: string; name: string; exchangeAccountName: string }> = []
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
        `[fixed-okx-simulated] Missing exchange account binding for instance ${instance.name} -> ${instance.exchangeAccountName}`,
      )
    }
    await ensureLlmSubscription(prisma, user.id, instance.id, account.id)
  }

  await ensureStrategyAccount(prisma, user.id, strategy.id, plan)

  console.log(
    `[seed] Fixed OKX simulated data ready: user=${plan.user.email}, ` +
      `symbols=${plan.symbols.map(symbol => symbol.code).join(', ')}, ` +
      `accounts=${Array.from(exchangeAccountsByName.values()).map(account => account.id).join(', ')}`,
  )
}
