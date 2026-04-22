import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '@/prisma/prisma.service'
import type { PrismaClient, User } from '@/prisma/prisma.types'
import { setTimeout as sleep } from 'node:timers/promises'
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { TradingService } from '@/modules/trading/trading.service'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

const RUNTIME_SIGNAL_CONFIG = {
  ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
  enabled: true,
  batchSize: 10,
  execution: {
    ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
    enabled: true,
    dryRun: false,
    defaultQuoteAmount: 100,
    minBalanceThreshold: 10,
    maxRiskFraction: 0.5,
  },
}

const PUBLISHED_RUNTIME_SCRIPT = `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(): StrategyDecisionV1 {
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }
  },
}
strategy`

const RUNTIME_SYMBOL_CODE = 'BTCUSDT:SPOT'

describe('account-strategy-view (E2E)', () => {
  let app: INestApplication
  let _moduleFixture: TestingModule
  let prisma: PrismaService

  let owner: User
  let subscriber: User
  let templateId: string
  let strategyRunningId: string
  let strategyPausedId: string
  let ownerBinanceAccountId: string
  let symbolId: string
  let codegenSessionId: string
  let publishedSnapshotId: string

  function createTestUser(prisma: PrismaClient, emailPrefix: string, nickname: string) {
    return prisma.user.create({
      data: {
        email: `${emailPrefix}-${Date.now()}@e2e.test`,
        nickname,
      },
    })
  }

  function createTestStrategyTemplate(prisma: PrismaClient) {
    return prisma.strategyTemplate.create({
      data: {
        name: `E2E-Account-Strategy-Template-${Date.now()}`,
        description: 'Account strategy view e2e template',
        llmModel: 'gpt-4',
        promptTemplate: 'test prompt',
        paramsSchema: { type: 'object', properties: {} },
        defaultParams: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
        status: 'live',
      },
    })
  }

  function upsertTestSymbol(
    prisma: PrismaClient,
    params: { code: string; baseAsset: string; quoteAsset: string },
  ) {
    const common: any = {
      code: params.code,
      baseAsset: params.baseAsset,
      quoteAsset: params.quoteAsset,
      exchange: 'BINANCE',
      type: 'CRYPTO',
      instrumentType: 'SPOT',
      status: 'ACTIVE',
      precisionPrice: 2,
      precisionQuantity: 6,
    }

    return prisma.symbol.upsert({
      where: { code: params.code },
      update: common,
      create: common,
    })
  }

  function seedRuntimeBars(
    prisma: PrismaClient,
    params: { symbolId: string; close: number; time: Date },
  ) {
    return prisma.marketBar.createMany({
      data: [{
        symbolId: params.symbolId,
        timeframe: mapTimeframe('15m'),
        time: params.time,
        open: params.close - 50,
        high: params.close + 50,
        low: params.close - 100,
        close: params.close,
        volume: 10,
        quoteVolume: params.close * 10,
        trades: 5,
        source: 'E2E',
        isFinal: true,
      }],
      skipDuplicates: true,
    })
  }

  function createTestStrategyInstance(
    prisma: PrismaClient,
    params: { templateId: string; name: string; status: 'running' | 'paused'; ownerId: string },
  ) {
    return prisma.strategyInstance.create({
      data: {
        strategyTemplateId: params.templateId,
        name: `${params.name}-${Date.now()}`,
        description: `${params.status} strategy`,
        llmModel: 'gpt-4',
        status: params.status,
        mode: 'LIVE',
        startedAt: new Date('2026-03-18T00:00:00.000Z'),
        createdBy: params.ownerId,
        updatedBy: params.ownerId,
      },
    })
  }

  function createTestUserStrategyAccount(
    prisma: PrismaClient,
    params: { userId: string; strategyId: string },
  ) {
    return prisma.userStrategyAccount.create({
      data: {
        userId: params.userId,
        strategyId: params.strategyId,
        strategyName: 'account view strategy',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10320.12,
        equity: 10320.12,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: 20.12,
      },
    })
  }

  function createTestSubscriptions(
    prisma: PrismaClient,
    params: { userId: string; instanceIds: string[] },
  ) {
    return prisma.userStrategySubscription.createMany({
      data: params.instanceIds.map(id => ({
        userId: params.userId,
        strategyInstanceId: id,
        status: 'active',
      })),
    })
  }

  function seedTestPnlDaily(
    prisma: PrismaClient,
    accountId: string,
    entries: Array<{ date: Date; equityStart: number; equityEnd: number; realizedPnl: number; unrealizedPnl: number; maxDrawdown: number }>,
  ) {
    return prisma.strategyPnlDaily.createMany({
      data: entries.map(e => ({ userStrategyAccountId: accountId, ...e })),
    })
  }

  beforeAll(async () => {
    const testing = await createTestingApp({
      providerOverrides: [{
        provide: AccountStrategyCallerIdentityService,
        useValue: {
          async resolveCallerUserIdFromAuthorization(authorization?: string) {
            const token = authorization?.replace(/^Bearer\s+/i, '').trim()
            if (!token) {
              throw new Error('missing bearer token for test')
            }
            return token
          },
        },
      }],
    })
    app = testing.app
    _moduleFixture = testing.moduleFixture
    if (!testing.prisma) {
      throw new Error('PrismaService unavailable for account-strategy-view e2e')
    }
    prisma = testing.prisma

    owner = await createTestUser(prisma, 'account-strategy-owner', 'owner')
    subscriber = await createTestUser(prisma, 'account-strategy-subscriber', 'subscriber')
    const ownerBinanceAccount = await prisma.exchangeAccount.create({
      data: {
        userId: owner.id,
        exchangeId: 'binance',
        name: 'owner-binance',
        isTestnet: false,
        encryptedConfig: '{"apiKey":"k","apiSecret":"s"}',
      },
    })
    ownerBinanceAccountId = ownerBinanceAccount.id

    const template = await createTestStrategyTemplate(prisma)
    templateId = template.id

    const running = await createTestStrategyInstance(prisma, {
      templateId,
      name: 'E2E-Account-Strategy-Running',
      status: 'running',
      ownerId: owner.id,
    })
    strategyRunningId = running.id

    const symbol = await upsertTestSymbol(prisma, {
      code: RUNTIME_SYMBOL_CODE,
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    })
    symbolId = symbol.id
    await seedRuntimeBars(prisma, {
      symbolId: symbol.id,
      close: 60000,
      time: new Date('2026-04-21T00:00:00.000Z'),
    })

    const session = await prisma.llmStrategyCodegenSession.create({
      data: {
        userId: owner.id,
        strategyInstanceId: running.id,
        status: 'PUBLISHED',
      },
    })
    codegenSessionId = session.id

    const snapshot = await prisma.publishedStrategySnapshot.create({
      data: {
        sessionId: session.id,
        strategyTemplateId: templateId,
        strategyInstanceId: running.id,
        snapshotHash: 'snapshot-hash-e2e',
        scriptHash: 'script-hash-e2e',
        specHash: 'spec-hash-e2e',
        scriptSnapshot: PUBLISHED_RUNTIME_SCRIPT,
        specSnapshot: {},
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
          runtimeExecutionSemantics: [{
            semanticKey: 'on_start.entry.primary',
          }],
        },
        consistencyReport: {},
        userIntentSummary: {},
        strategySummary: {},
        scriptSummary: {},
        strategyConfig: {
          exchange: 'binance',
          symbol: RUNTIME_SYMBOL_CODE,
          timeframe: '15m',
          positionPct: 10,
          marketType: 'spot',
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          defaultLeverage: 1,
        },
        lockedParams: {
          exchange: 'binance',
          symbol: RUNTIME_SYMBOL_CODE,
          timeframe: '15m',
          positionPct: 10,
        },
        paramsSnapshot: {
          exchange: 'binance',
          symbol: RUNTIME_SYMBOL_CODE,
          timeframe: '15m',
          positionPct: 10,
        },
      },
    })
    publishedSnapshotId = snapshot.id

    await prisma.strategyInstance.update({
      where: { id: running.id },
      data: {
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: snapshot.id,
          snapshotHash: snapshot.snapshotHash,
          sourceStrategyInstanceId: running.id,
          sourceStrategyTemplateId: templateId,
        },
      },
    })

    const configService = app.get(ConfigService)
    const originalGet = configService.get.bind(configService)
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'strategySignals') {
        return RUNTIME_SIGNAL_CONFIG
      }
      return originalGet(key)
    })

    const paused = await createTestStrategyInstance(prisma, {
      templateId,
      name: 'E2E-Account-Strategy-Paused',
      status: 'paused',
      ownerId: owner.id,
    })
    strategyPausedId = paused.id

    await createTestSubscriptions(prisma, {
      userId: owner.id,
      instanceIds: [strategyRunningId, strategyPausedId],
    })

    const account = await createTestUserStrategyAccount(prisma, {
      userId: owner.id,
      strategyId: templateId,
    })

    await seedTestPnlDaily(prisma, account.id, [
      { date: new Date('2026-03-19T00:00:00.000Z'), equityStart: 10000, equityEnd: 10000, realizedPnl: 0, unrealizedPnl: 0, maxDrawdown: 0 },
      { date: new Date('2026-03-20T00:00:00.000Z'), equityStart: 10000, equityEnd: 9450, realizedPnl: 0, unrealizedPnl: -550, maxDrawdown: 5.5 },
    ])
  })

  afterAll(async () => {
    await prisma.userSignalExecution.deleteMany({
      where: {
        signal: {
          strategyInstanceId: strategyRunningId,
        },
      },
    })
    await prisma.tradingSignal.deleteMany({
      where: {
        strategyInstanceId: strategyRunningId,
      },
    })
    await prisma.strategyRuntimeExecutionState.deleteMany({
      where: {
        strategyInstanceId: strategyRunningId,
      },
    })
    await prisma.strategyPnlDaily.deleteMany({
      where: {
        account: {
          userId: owner.id,
          strategyId: templateId,
        },
      },
    })
    await prisma.userStrategyAccount.deleteMany({
      where: {
        userId: owner.id,
        strategyId: templateId,
      },
    })
    await prisma.userStrategySubscription.deleteMany({
      where: {
        userId: {
          in: [owner.id, subscriber.id],
        },
      },
    })
    await prisma.strategyInstanceRiskProfile.deleteMany({
      where: {
        strategyInstanceId: {
          in: [strategyRunningId, strategyPausedId],
        },
      },
    })
    await prisma.deployRequest.deleteMany({
      where: {
        userId: {
          in: [owner.id, subscriber.id],
        },
      },
    })
    await prisma.publishedStrategySnapshot.deleteMany({
      where: { id: publishedSnapshotId },
    })
    await prisma.llmStrategyCodegenSession.deleteMany({
      where: { id: codegenSessionId },
    })
    await prisma.exchangeAccount.deleteMany({
      where: {
        id: ownerBinanceAccountId,
      },
    })
    await prisma.marketBar.deleteMany({
      where: {
        symbolId,
      },
    })
    await prisma.symbol.deleteMany({
      where: {
        id: symbolId,
      },
    })
    await prisma.strategyInstance.deleteMany({
      where: {
        id: {
          in: [strategyRunningId, strategyPausedId],
        },
      },
    })
    await prisma.strategyTemplate.deleteMany({
      where: {
        id: templateId,
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [owner.id, subscriber.id],
        },
      },
    })
    await app.close()
  })

  it('returns list data and maps paused to stopped in account view', async () => {
    const request: any = createApiClient(app)
    const response = await request
      .get(`account/ai-quant/strategies?userId=${owner.id}&page=1&limit=20`)
      .set('authorization', `Bearer ${owner.id}`)
      .expect(200)

    const payload = response.body?.data ?? response.body
    expect(payload?.items?.length).toBeGreaterThanOrEqual(2)

    const pausedItem = payload.items.find((item: any) => item.id === strategyPausedId)
    expect(pausedItem).toBeDefined()
    expect(pausedItem.status).toBe('stopped')
  })

  it('returns detail payload with backend pnl metrics', async () => {
    const request: any = createApiClient(app)
    const response = await request
      .get(`account/ai-quant/strategies/${strategyRunningId}?userId=${owner.id}`)
      .set('authorization', `Bearer ${owner.id}`)
      .expect(200)

    const payload = response.body?.data
    expect(payload.id).toBe(strategyRunningId)
    expect(payload.totalPnl).toBe(320.12)
    // todayPnl = realizedToday(no closed positions today) + totalUnrealizedPnl(20.12)
    expect(payload.todayPnl).toBe(20.12)
    expect(payload.metrics.maxDrawdownPct).toBe(5.5)
  })

  it('applies stop action and returns updated detail status', async () => {
    const request: any = createApiClient(app)
    const response = await request
      .post(`account/ai-quant/strategies/${strategyRunningId}/actions`)
      .set('authorization', `Bearer ${owner.id}`)
      .send({
        userId: owner.id,
        action: 'stop',
      })
      .expect(201)

    const payload = response.body?.data
    expect(payload.id).toBe(strategyRunningId)
    expect(payload.status).toBe('stopped')
  })

  it('deploy initializes published snapshot runtime and, after direct generation, automatically advances execution', async () => {
    const request: any = createApiClient(app)
    const deployRequestId = `e2e-deploy-runtime-${Date.now()}`

    expect(await prisma.strategyRuntimeExecutionState.count({
      where: {
        strategyInstanceId: strategyRunningId,
        publishedSnapshotId,
      },
    })).toBe(0)

    expect(await prisma.tradingSignal.count({
      where: {
        strategyInstanceId: strategyRunningId,
      },
    })).toBe(0)

    await request
      .post('account/ai-quant/strategies/deploy')
      .set('authorization', `Bearer ${owner.id}`)
      .send({
        name: 'E2E Deploy Runtime Continuity',
        deployRequestId,
        publishedSnapshotId,
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        strategyInstanceId: strategyRunningId,
        exchangeAccountId: ownerBinanceAccountId,
      })
      .expect(201)

    const runtimeState = await prisma.strategyRuntimeExecutionState.findFirst({
      where: {
        strategyInstanceId: strategyRunningId,
        publishedSnapshotId,
      },
    })
    expect(runtimeState).toBeDefined()
    expect(runtimeState?.status).toBe('ready')
    expect(runtimeState?.executionSemanticKey).toBe('on_start.entry.primary')

    const tradingService = app.get(TradingService)
    const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
      id: 'E2E-DEPLOY-ORDER',
      clientOrderId: 'E2E-DEPLOY-CLIENT',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      price: 60000,
      amount: 0.00166667,
      filled: 0.00166667,
      status: 'closed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      raw: {},
    } as any)

    try {
      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(RUNTIME_SIGNAL_CONFIG)

      const signal = await waitForExecution(async () => {
        return prisma.tradingSignal.findFirst({
          where: {
            strategyInstanceId: strategyRunningId,
          },
          orderBy: { createdAt: 'desc' },
        })
      })

      expect(await prisma.tradingSignal.count({
        where: {
          strategyInstanceId: strategyRunningId,
        },
      })).toBeGreaterThanOrEqual(1)
      expect((signal.metadata as {
        runtimeProvenance?: {
          publishedSnapshotId?: string
          executionSemanticKey?: string
        }
      } | null)?.runtimeProvenance?.publishedSnapshotId).toBe(publishedSnapshotId)
      expect((signal.metadata as {
        runtimeProvenance?: {
          publishedSnapshotId?: string
          executionSemanticKey?: string
        }
      } | null)?.runtimeProvenance?.executionSemanticKey).toBe('on_start.entry.primary')

      const execution = await waitForExecution(async () => {
        return prisma.userSignalExecution.findFirst({
          where: {
            userId: owner.id,
            signal: {
              strategyInstanceId: strategyRunningId,
            },
          },
          include: {
            signal: true,
          },
          orderBy: { executedAt: 'desc' },
        })
      })

      expect(placeOrderSpy).toHaveBeenCalled()
      expect(execution.status).toBe('EXECUTED')
    } finally {
      placeOrderSpy.mockRestore()
    }
  })

  it('deploy is idempotent: repeated click with same deployRequestId does not duplicate records', async () => {
    const request: any = createApiClient(app)
    const deployRequestId = `e2e-deploy-idem-${Date.now()}`
    const body = {
      name: 'E2E Deploy Idempotent',
      deployRequestId,
      publishedSnapshotId,
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      strategyInstanceId: strategyRunningId,
      exchangeAccountId: ownerBinanceAccountId,
    }

    const first = await request
      .post('account/ai-quant/strategies/deploy')
      .set('authorization', `Bearer ${owner.id}`)
      .send(body)
      .expect(201)

    const second = await request
      .post('account/ai-quant/strategies/deploy')
      .set('authorization', `Bearer ${owner.id}`)
      .send(body)
      .expect(201)

    expect(first.body?.data?.id).toBe(strategyRunningId)
    expect(second.body?.data?.id).toBe(strategyRunningId)

    const deployRequestCount = await prisma.deployRequest.count({
      where: {
        userId: owner.id,
        deployRequestId,
      },
    })
    expect(deployRequestCount).toBe(1)

    const subscriptionCount = await prisma.userStrategySubscription.count({
      where: {
        userId: owner.id,
        strategyInstanceId: strategyRunningId,
      },
    })
    expect(subscriptionCount).toBe(1)

    const riskProfileCount = await prisma.strategyInstanceRiskProfile.count({
      where: {
        strategyInstanceId: strategyRunningId,
      },
    })
    expect(riskProfileCount).toBe(1)
  })
})

async function waitForExecution<T>(loader: () => Promise<T | null>, attempts = 30): Promise<T> {
  const result = await pollForResult(loader, attempts)
  if (result) {
    return result
  }

  throw new Error('Timed out waiting for execution record')
}

async function pollForResult<T>(loader: () => Promise<T | null>, attempts = 30): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await loader()
    if (result) {
      return result
    }
    await sleep(100)
  }
  return null
}
