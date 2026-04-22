import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../../src/prisma/prisma.service'
import type { TestingAppContext } from '../fixtures/fixtures'
import { setTimeout as sleep } from 'node:timers/promises'
import { ExecutionStatus, SignalDirection, SignalSourceType, SignalStatus, SignalType } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { SignalExecutorService } from '@/modules/strategy-signals/services/signal-executor.service'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'
import { StrategyRuntimeExecutionStateService } from '@/modules/strategy-signals/services/strategy-runtime-execution-state.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { TradingService } from '@/modules/trading/trading.service'
import { createTestingApp } from '../fixtures/fixtures'

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

describe('StrategySignals (E2E, DB only)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let prisma: PrismaService

  const TEST_USER_ID = 'e2e-signal-user'
  const TEST_STRATEGY_TEMPLATE_ID = 'e2e-signal-strategy-template'
  const TEST_ACCOUNT_ID = 'e2e-signal-account'
  const TEST_SYMBOL_ID = 'e2e-signal-symbol'

  function upsertTestUser(
    p: PrismaService,
    params: { id: string; email: string; nickname: string },
  ) {
    return p.user.upsert({
      where: { id: params.id },
      update: {},
      create: {
        id: params.id,
        email: params.email,
        nickname: params.nickname,
      },
    })
  }

  function upsertTestUserStrategyAccount(
    p: PrismaService,
    params: { id: string; userId: string; strategyId: string; strategyName: string },
  ) {
    return p.userStrategyAccount.upsert({
      where: { id: params.id },
      update: { balance: '1000', equity: '1000' },
      create: {
        id: params.id,
        userId: params.userId,
        strategyId: params.strategyId,
        strategyName: params.strategyName,
        strategyVersion: 'v1',
        baseCurrency: 'USDT',
        initialBalance: '1000',
        balance: '1000',
        equity: '1000',
      },
    })
  }

  function createTestStrategyTemplate(
    p: PrismaService,
    params: { id: string; name: string; description: string; status?: 'draft' | 'live' },
  ) {
    return p.strategyTemplate.create({
      data: {
        id: params.id,
        name: params.name,
        description: params.description,
        legs: [],
        llmModel: 'gpt-4',
        promptTemplate: '测试策略信号 Prompt',
        paramsSchema: { type: 'object' },
        requiredFields: [],
        status: params.status ?? 'draft',
      },
    })
  }

  function createTestSymbol(
    p: PrismaService,
    params: { id: string; code: string; baseAsset: string; quoteAsset: string; instrumentType?: 'SPOT' | 'PERPETUAL' },
  ) {
    return p.symbol.create({
      data: {
        id: params.id,
        code: params.code,
        baseAsset: params.baseAsset,
        quoteAsset: params.quoteAsset,
        exchange: 'BINANCE',
        type: 'CRYPTO',
        instrumentType: params.instrumentType ?? 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
    })
  }

  function upsertTestSymbol(
    p: PrismaService,
    params: { id: string; code: string; baseAsset: string; quoteAsset: string; instrumentType?: 'SPOT' | 'PERPETUAL' },
  ) {
    const instrumentType = params.instrumentType ?? 'SPOT'
    const common: any = {
      code: params.code,
      baseAsset: params.baseAsset,
      quoteAsset: params.quoteAsset,
      exchange: 'BINANCE',
      instrumentType,
      type: 'CRYPTO',
      status: 'ACTIVE',
      precisionPrice: 2,
      precisionQuantity: 6,
    }
    return p.symbol.upsert({
      where: { code: params.code },
      update: common,
      create: { id: params.id, ...common },
    })
  }

  function createTestStrategyInstance(
    p: PrismaService,
    params: { id: string; templateId: string; name: string; status: 'running'; ownerId: string; mode?: 'LIVE' | 'TESTNET' },
  ) {
    return p.strategyInstance.create({
      data: {
        id: params.id,
        strategyTemplateId: params.templateId,
        name: params.name,
        description: `${params.name} runtime instance`,
        llmModel: 'gpt-4',
        status: params.status,
        mode: params.mode ?? 'LIVE',
        startedAt: new Date('2026-04-22T00:00:00.000Z'),
        createdBy: params.ownerId,
        updatedBy: params.ownerId,
      },
    })
  }

  function createTestSubscription(
    p: PrismaService,
    params: { userId: string; strategyInstanceId: string; exchangeAccountId?: string | null },
  ) {
    return p.userStrategySubscription.create({
      data: {
        userId: params.userId,
        strategyInstanceId: params.strategyInstanceId,
        status: 'active',
        exchangeAccountId: params.exchangeAccountId ?? null,
      },
    })
  }

  function createTestExchangeAccount(
    p: PrismaService,
    params: { id: string; userId: string; exchangeId: 'okx' | 'binance' | 'hyperliquid'; isTestnet?: boolean; name?: string },
  ) {
    return p.exchangeAccount.create({
      data: {
        id: params.id,
        userId: params.userId,
        exchangeId: params.exchangeId,
        isTestnet: params.isTestnet ?? true,
        name: params.name ?? `${params.exchangeId}-test-account`,
        encryptedConfig: 'encrypted-config-placeholder',
      },
    })
  }

  function seedRuntimeBar(
    p: PrismaService,
    params: { symbolId: string; close: number; time: Date },
  ) {
    return p.marketBar.createMany({
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

  function createTestTradingSignal(
    p: PrismaService,
    params: {
      strategyId: string
      symbolId: string
      direction: SignalDirection
      signalType?: SignalType
      entryPrice?: string
      positionSizeQuote?: string
      positionSizeRatio?: string
      confidence?: string
      aiReasoning?: string
      extraData?: Record<string, unknown>
    },
  ) {
    return p.tradingSignal.create({
      data: {
        strategyId: params.strategyId,
        symbolId: params.symbolId,
        sourceType: SignalSourceType.AI_GENERATED,
        signalType: params.signalType ?? SignalType.ENTRY,
        direction: params.direction,
        status: SignalStatus.PENDING,
        confidence: params.confidence ?? '80',
        entryPrice: params.entryPrice ?? '50000',
        positionSizeQuote: params.positionSizeQuote,
        positionSizeRatio: params.positionSizeRatio,
        aiModel: 'gpt-4',
        aiReasoning: params.aiReasoning ?? 'E2E test signal',
        ...params.extraData,
      },
    })
  }

  function createTestUserSignalExecution(
    p: PrismaService,
    params: {
      signalId: string
      userId: string
      userStrategyAccountId: string
      executedPrice: string
      executedQuantity: string
      fee: string
      tradeId: string
    },
  ) {
    return p.userSignalExecution.create({
      data: {
        signalId: params.signalId,
        userId: params.userId,
        userStrategyAccountId: params.userStrategyAccountId,
        status: ExecutionStatus.EXECUTED,
        orderSide: 'BUY',
        positionSide: 'LONG',
        executedPrice: params.executedPrice,
        executedQuantity: params.executedQuantity,
        fee: params.fee,
        feeCurrency: 'USDT',
        tradeId: params.tradeId,
        executedAt: new Date(),
      },
      include: {
        signal: true,
        user: true,
        account: true,
      },
    })
  }

  function createTestPosition(
    p: PrismaService,
    params: {
      userStrategyAccountId: string
      symbol: string
      quantity: string
      avgEntryPrice: string
      exchangeId: string
      marketType: string
    },
  ) {
    return p.position.create({
      data: {
        userStrategyAccountId: params.userStrategyAccountId,
        symbol: params.symbol,
        positionSide: 'LONG',
        quantity: params.quantity,
        avgEntryPrice: params.avgEntryPrice,
        realizedPnl: '0',
        unrealizedPnl: '0',
        status: 'OPEN',
        exchangeId: params.exchangeId,
        marketType: params.marketType,
        openedAt: new Date(),
      },
    })
  }

  beforeAll(async () => {
    const context: TestingAppContext = await createTestingApp()
    app = context.app
    moduleFixture = context.moduleFixture
    if (!context.prisma) {
      throw new Error('PrismaService unavailable for strategy-signals e2e')
    }
    prisma = context.prisma

    const configService = app.get(ConfigService)
    const originalGet = configService.get.bind(configService)
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'strategySignals') {
        return RUNTIME_SIGNAL_CONFIG
      }
      return originalGet(key)
    })

    // 准备用户
    await upsertTestUser(prisma, {
      id: TEST_USER_ID,
      email: 'e2e-signal-user@test.com',
      nickname: 'E2E 策略信号用户',
    })

    // 准备策略模板（最小可用字段）
    await createTestStrategyTemplate(prisma, {
      id: TEST_STRATEGY_TEMPLATE_ID,
      name: 'E2E-Signal-Template',
      description: 'E2E 策略信号测试模板',
    })

    // 准备行情交易对
    await createTestSymbol(prisma, {
      id: TEST_SYMBOL_ID,
      code: 'E2E-BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    })

    // 准备用户策略账户
    await upsertTestUserStrategyAccount(prisma, {
      id: TEST_ACCOUNT_ID,
      userId: TEST_USER_ID,
      strategyId: TEST_STRATEGY_TEMPLATE_ID,
      strategyName: 'E2E 策略',
    })
  })

  afterAll(async () => {
    // 清理数据（按外键依赖顺序）
    await prisma.userSignalExecution.deleteMany({
      where: { userStrategyAccountId: TEST_ACCOUNT_ID },
    })
    await prisma.tradingSignal.deleteMany({
      where: { strategyId: TEST_STRATEGY_TEMPLATE_ID },
    })
    await prisma.userStrategyAccount.deleteMany({
      where: { id: TEST_ACCOUNT_ID },
    })
    await prisma.symbol.deleteMany({
      where: { id: TEST_SYMBOL_ID },
    })
    await prisma.strategyTemplate.deleteMany({
      where: { id: TEST_STRATEGY_TEMPLATE_ID },
    })
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    })

    await app.close()
  })

  it('[TC-SIGNAL-001] should create TradingSignal record and associate with strategy and symbol', async () => {
    const signal = await createTestTradingSignal(prisma, {
      strategyId: TEST_STRATEGY_TEMPLATE_ID,
      symbolId: TEST_SYMBOL_ID,
      direction: SignalDirection.BUY,
      entryPrice: '60000',
      confidence: '80',
      aiReasoning: 'E2E 测试信号理由',
      extraData: {
        targetPrice: '65000',
        stopLoss: '58000',
        takeProfit: '64000',
        marketContext: {
          timeframe: '1h',
          indicators: {
            ma_20: '59000',
          },
        },
      },
    }).then(s => prisma.tradingSignal.findUniqueOrThrow({
      where: { id: s.id },
      include: { strategy: true, symbol: true },
    }))

    expect(signal.id).toBeDefined()
    expect(signal.strategyId).toBe(TEST_STRATEGY_TEMPLATE_ID)
    expect(signal.symbolId).toBe(TEST_SYMBOL_ID)
    expect(signal.strategy?.name).toBe('E2E-Signal-Template')
    expect(signal.symbol.code).toBe('E2E-BTCUSDT')
    expect(signal.direction).toBe(SignalDirection.BUY)
    expect(signal.signalType).toBe(SignalType.ENTRY)
    expect(signal.status).toBe(SignalStatus.PENDING)
  })

  it('[TC-SIGNAL-002] should record UserSignalExecution and associate with user and account', async () => {
    const baseSignal = await prisma.tradingSignal.findFirstOrThrow({
      where: {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
      },
    })

    const execution = await createTestUserSignalExecution(prisma, {
      signalId: baseSignal.id,
      userId: TEST_USER_ID,
      userStrategyAccountId: TEST_ACCOUNT_ID,
      executedPrice: '61000',
      executedQuantity: '0.01',
      fee: '1.2',
      tradeId: 'E2E-TRADE-ID',
    })

    expect(execution.id).toBeDefined()
    expect(execution.signalId).toBe(baseSignal.id)
    expect(execution.userId).toBe(TEST_USER_ID)
    expect(execution.userStrategyAccountId).toBe(TEST_ACCOUNT_ID)
    expect(execution.status).toBe(ExecutionStatus.EXECUTED)
    expect(execution.user.email).toBe('e2e-signal-user@test.com')
    expect(execution.account.baseCurrency).toBe('USDT')
    expect(execution.signal.strategyId).toBe(TEST_STRATEGY_TEMPLATE_ID)
  })

  describe('Position Size Calculation & Risk Control (TC-SIGNAL-003~006)', () => {
    const RISK_CONTROL_ACCOUNT_ID = 'e2e-risk-control-account'
    const RISK_CONTROL_USER_ID = 'e2e-risk-control-user'

    beforeAll(async () => {
      // 准备风控测试用户
      await upsertTestUser(prisma, {
        id: RISK_CONTROL_USER_ID,
        email: 'risk-control@test.com',
        nickname: 'Risk Control Test User',
      })

      // 准备风控测试账户，余额 1000 USDT
      await upsertTestUserStrategyAccount(prisma, {
        id: RISK_CONTROL_ACCOUNT_ID,
        userId: RISK_CONTROL_USER_ID,
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        strategyName: 'Risk Control Test Strategy',
      })
    })

    afterAll(async () => {
      await prisma.userSignalExecution.deleteMany({
        where: { userStrategyAccountId: RISK_CONTROL_ACCOUNT_ID },
      })
      await prisma.userStrategyAccount.deleteMany({
        where: { id: RISK_CONTROL_ACCOUNT_ID },
      })
      await prisma.user.deleteMany({
        where: { id: RISK_CONTROL_USER_ID },
      })
    })

    it('[TC-SIGNAL-003] should use strategy-specified positionSizeQuote but enforce maxRiskFraction limit', async () => {
      // 测试配置：maxRiskFraction = 0.2 (20%), defaultQuoteAmount = 100
      // 账户余额 1000，因此风险上限为 1000 * 0.2 = 200
      // 策略要求 positionSizeQuote = 500，应该被限制到 200，而非 defaultQuoteAmount 的 100

      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        direction: SignalDirection.BUY,
        positionSizeQuote: '500', // 策略要求 500 USDT
        aiReasoning: 'TC-SIGNAL-003 test',
      })

      // Mock TradingService
      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-003-ORDER',
        clientOrderId: 'TC-003-CLIENT',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        price: 50000,
        amount: 0.004, // 200 / 50000 = 0.004
        filled: 0.004,
        status: 'closed',
        createdAt: Date.now(),
        raw: {},
      } as any)

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.2,
          minBalanceThreshold: 10,
        },
      }

      await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)

      const execution = await prisma.userSignalExecution.findFirst({
        where: {
          signalId: signal.id,
          userStrategyAccountId: RISK_CONTROL_ACCOUNT_ID,
        },
      })

      expect(execution).toBeDefined()
      expect(execution!.status).toBe(ExecutionStatus.EXECUTED)

      // 验证实际下单金额被限制在风险上限内（200 USDT），而非 defaultQuoteAmount 的 100 USDT
      expect(placeOrderSpy).toHaveBeenCalled()
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)!
      expect(callArgs).toBeDefined()
      const orderParams = callArgs[3]

      // amount 应该是 200 / 50000 = 0.004（受 maxRiskFraction 限制）
      // 而不是 100 / 50000 = 0.002（defaultQuoteAmount 不应限制策略仓位）
      expect(orderParams.amount).toBeCloseTo(0.004, 6)

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-004] should use strategy-specified positionSizeRatio but enforce maxRiskFraction limit', async () => {
      // 测试配置：maxRiskFraction = 0.2 (20%), defaultQuoteAmount = 100
      // 账户余额 1000，因此风险上限为 200
      // 策略要求 positionSizeRatio = 0.5 (50%)，即 500 USDT，应该被限制到 200

      await prisma.userStrategyAccount.update({
        where: { id: RISK_CONTROL_ACCOUNT_ID },
        data: { balance: '1000', equity: '1000' },
      })

      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        direction: SignalDirection.BUY,
        positionSizeRatio: '0.5', // 策略要求 50% = 500 USDT
        aiReasoning: 'TC-SIGNAL-004 test',
      })

      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-004-ORDER',
        clientOrderId: 'TC-004-CLIENT',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        price: 50000,
        amount: 0.004, // 200 / 50000 = 0.004
        filled: 0.004,
        status: 'closed',
        createdAt: Date.now(),
        raw: {},
      } as any)

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.2,
          minBalanceThreshold: 10,
        },
      }

      await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)

      const execution = await prisma.userSignalExecution.findFirst({
        where: {
          signalId: signal.id,
          userStrategyAccountId: RISK_CONTROL_ACCOUNT_ID,
        },
      })

      expect(execution).toBeDefined()
      expect(execution!.status).toBe(ExecutionStatus.EXECUTED)

      // 验证实际下单金额被限制在风险上限内（200 USDT）
      expect(placeOrderSpy).toHaveBeenCalled()
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)!
      expect(callArgs).toBeDefined()
      const orderParams = callArgs[3]

      // amount 应该是 200 / 50000 = 0.004
      expect(orderParams.amount).toBeCloseTo(0.004, 6)

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-005] should fallback to global config when no strategy position size specified', async () => {
      // 测试配置：maxRiskFraction = 0.2, defaultQuoteAmount = 100
      // 策略未指定仓位大小，应该使用 min(1000 * 0.2, 100) = 100

      await prisma.userStrategyAccount.update({
        where: { id: RISK_CONTROL_ACCOUNT_ID },
        data: { balance: '1000', equity: '1000' },
      })

      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        direction: SignalDirection.BUY,
        // 不指定 positionSizeQuote 或 positionSizeRatio
        aiReasoning: 'TC-SIGNAL-005 test',
      })

      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-005-ORDER',
        clientOrderId: 'TC-005-CLIENT',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        price: 50000,
        amount: 0.002,
        filled: 0.002,
        status: 'closed',
        createdAt: Date.now(),
        raw: {},
      } as any)

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.2,
          minBalanceThreshold: 10,
        },
      }

      await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)

      const execution = await prisma.userSignalExecution.findFirst({
        where: {
          signalId: signal.id,
          userStrategyAccountId: RISK_CONTROL_ACCOUNT_ID,
        },
      })

      expect(execution).toBeDefined()
      expect(execution!.status).toBe(ExecutionStatus.EXECUTED)

      expect(placeOrderSpy).toHaveBeenCalled()
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)!
      expect(callArgs).toBeDefined()
      const orderParams = callArgs[3]

      // 应该使用全局配置 min(200, 100) = 100 USDT
      expect(orderParams.amount).toBeCloseTo(0.002, 6) // 100 / 50000

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-006] should skip execution when strategy position size is invalid (zero or negative)', async () => {
      // 测试无效的仓位大小

      await prisma.userStrategyAccount.update({
        where: { id: RISK_CONTROL_ACCOUNT_ID },
        data: { balance: '1000', equity: '1000' },
      })

      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        direction: SignalDirection.BUY,
        positionSizeQuote: '0', // 无效值
        aiReasoning: 'TC-SIGNAL-006 test',
      })

      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-006-ORDER',
        clientOrderId: 'TC-006-CLIENT',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        price: 50000,
        amount: 0.002, // 100 / 50000 = 0.002（回退到全局配置）
        filled: 0.002,
        status: 'closed',
        createdAt: Date.now(),
        raw: {},
      } as any)

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.2,
          minBalanceThreshold: 10,
        },
      }

      await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)

      const execution = await prisma.userSignalExecution.findFirst({
        where: {
          signalId: signal.id,
          userStrategyAccountId: RISK_CONTROL_ACCOUNT_ID,
        },
      })

      // 无效的 positionSizeQuote 应该回退到全局配置，而不是跳过
      // 因为代码中对 positionSizeQuote 的检查是 `new Decimal(signal.positionSizeQuote).gt(0)`
      // 如果是 0 或负数，会走 else if 或最后的全局配置分支
      expect(execution).toBeDefined()
      expect(execution!.status).toBe(ExecutionStatus.EXECUTED)

      // 应该使用全局配置而不是策略指定的 0
      expect(placeOrderSpy).toHaveBeenCalled()

      placeOrderSpy.mockRestore()
    })
  })

  describe('Perp Close Position Execution (TC-SIGNAL-008)', () => {
    const PERP_CLOSE_USER_ID = 'e2e-perp-close-user'
    const PERP_CLOSE_ACCOUNT_ID = 'e2e-perp-close-account'
    const PERP_CLOSE_SYMBOL_ID = 'e2e-perp-close-symbol'
    let perpCloseResolvedSymbolId = PERP_CLOSE_SYMBOL_ID

    beforeAll(async () => {
      await upsertTestUser(prisma, {
        id: PERP_CLOSE_USER_ID,
        email: 'perp-close@test.com',
        nickname: 'Perp Close Test User',
      })

      const perpSymbol = await upsertTestSymbol(prisma, {
        id: PERP_CLOSE_SYMBOL_ID,
        code: 'BTCUSDT:PERP',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        instrumentType: 'PERPETUAL',
      })
      perpCloseResolvedSymbolId = perpSymbol.id

      await upsertTestUserStrategyAccount(prisma, {
        id: PERP_CLOSE_ACCOUNT_ID,
        userId: PERP_CLOSE_USER_ID,
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        strategyName: 'Perp Close Strategy',
      })

      await createTestPosition(prisma, {
        userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID,
        symbol: 'BTCUSDT',
        quantity: '0.01',
        avgEntryPrice: '60000',
        exchangeId: 'binance',
        marketType: 'perp',
      })
    })

    afterAll(async () => {
      await prisma.userSignalExecution.deleteMany({
        where: { userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID },
      })
      await prisma.trade.deleteMany({
        where: { userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID },
      })
      await prisma.position.deleteMany({
        where: { userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID },
      })
      await prisma.userStrategyAccount.deleteMany({
        where: { id: PERP_CLOSE_ACCOUNT_ID },
      })
      await prisma.symbol.deleteMany({
        where: { id: PERP_CLOSE_SYMBOL_ID },
      })
      await prisma.user.deleteMany({
        where: { id: PERP_CLOSE_USER_ID },
      })
    })

    it('[TC-SIGNAL-008] should close an open perp position using normalized local symbol lookup', async () => {
      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: perpCloseResolvedSymbolId,
        direction: SignalDirection.CLOSE_LONG,
        signalType: SignalType.EXIT,
        entryPrice: '60000',
        confidence: '88',
        aiReasoning: 'TC-SIGNAL-008 close perp position test',
      })

      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-008-ORDER',
        clientOrderId: 'TC-008-CLIENT',
        symbol: 'BTC/USDT:PERP',
        marketType: 'perp',
        side: 'sell',
        type: 'market',
        price: 60000,
        amount: 0.01,
        filled: 0.01,
        status: 'closed',
        createdAt: Date.now(),
        raw: {},
      } as any)

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.5,
          minBalanceThreshold: 0,
        },
      }

      await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)

      const execution = await prisma.userSignalExecution.findFirstOrThrow({
        where: {
          signalId: signal.id,
          userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID,
        },
      })
      const closedPosition = await prisma.position.findFirst({
        where: {
          userStrategyAccountId: PERP_CLOSE_ACCOUNT_ID,
          symbol: 'BTCUSDT',
          positionSide: 'LONG',
        },
        orderBy: { openedAt: 'desc' },
      })

      expect(execution.status).toBe(ExecutionStatus.EXECUTED)
      expect(placeOrderSpy).toHaveBeenCalled()
      const placeOrderArgs = placeOrderSpy.mock.calls.find(call => call[0] === PERP_CLOSE_USER_ID)
      expect(placeOrderArgs?.[3]).toMatchObject({
        symbol: 'BTC/USDT:PERP',
        marketType: 'perp',
        side: 'sell',
        reduceOnly: true,
        amount: 0.01,
      })
      expect(closedPosition?.status).toBe('CLOSED')
      expect(closedPosition?.quantity.toString()).toBe('0')

      placeOrderSpy.mockRestore()
    })
  })

  describe('Execution Metadata Persistence (TC-SIGNAL-007)', () => {
    it('[TC-SIGNAL-007] should persist order stage history and Binance execution payload metadata', async () => {
      const signal = await createTestTradingSignal(prisma, {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        direction: SignalDirection.BUY,
        entryPrice: '60000',
        confidence: '90',
        aiReasoning: 'TC-SIGNAL-007 metadata persistence test',
      })

      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-007-ORDER',
        clientOrderId: 'TC-007-CLIENT',
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

      const signalExecutor = moduleFixture.get(SignalExecutorService)
      const config = {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          enabled: true,
          dryRun: false,
          defaultQuoteAmount: 100,
          maxRiskFraction: 0.5,
          minBalanceThreshold: 10,
        },
      }

      try {
        await signalExecutor.executeSignalForSubscribedUsers(signal.id, config)
      }
      finally {
        placeOrderSpy.mockRestore()
      }

      const execution = await prisma.userSignalExecution.findFirstOrThrow({
        where: {
          signalId: signal.id,
          userStrategyAccountId: TEST_ACCOUNT_ID,
        },
      })

      expect(execution.status).toBe(ExecutionStatus.EXECUTED)
      expect(execution.metadata).toBeDefined()

      const metadata = execution.metadata as { [key: string]: unknown }
      const stageHistory = Array.isArray(metadata.stageHistory)
        ? metadata.stageHistory as Array<{ stage?: string }>
        : []

      expect(stageHistory.map(stage => stage.stage)).toEqual(
        expect.arrayContaining(['ORDER_SUBMITTED', 'ORDER_ACKED', 'LEDGER_APPLIED']),
      )

      expect(metadata.orderRequest).toMatchObject({
        exchangeId: 'binance',
        exchangeAccountId: null,
        symbol: 'BTC/USDT',
        side: 'buy',
        marketType: 'spot',
        type: 'market',
      })

      expect(metadata.orderResponse).toMatchObject({
        id: 'TC-007-ORDER',
        status: 'closed',
        amount: 0.00166667,
        filled: 0.00166667,
        price: 60000,
      })

      expect(metadata.providerOrderId).toBe('TC-007-ORDER')
      expect(metadata.providerStatus).toBe('closed')
      expect(metadata.exchangeAccountId).toBeNull()
    })
  })

  describe('Published Snapshot Runtime Continuity (TC-SIGNAL-009)', () => {
    const RUNTIME_USER_ID = 'e2e-runtime-user'
    const RUNTIME_TEMPLATE_ID = 'e2e-runtime-template'
    const RUNTIME_INSTANCE_ID = 'e2e-runtime-instance'
    const RUNTIME_ACCOUNT_ID = 'e2e-runtime-account'
    const RUNTIME_EXCHANGE_ACCOUNT_ID = 'e2e-runtime-exchange-account'
    const RUNTIME_SYMBOL_ID = 'e2e-runtime-symbol'
    const RUNTIME_SYMBOL_CODE = 'E2E-RUNTIME-BTCUSDT:SPOT'
    const RUNTIME_SESSION_ID = 'e2e-runtime-session'
    const RUNTIME_SNAPSHOT_ID = 'e2e-runtime-snapshot'
    const RUNTIME_SNAPSHOT_HASH = 'e2e-runtime-snapshot-hash'

    beforeAll(async () => {
      await upsertTestUser(prisma, {
        id: RUNTIME_USER_ID,
        email: 'e2e-runtime-user@test.com',
        nickname: 'E2E Runtime User',
      })

      await createTestStrategyTemplate(prisma, {
        id: RUNTIME_TEMPLATE_ID,
        name: 'E2E-Runtime-Template',
        description: 'Published snapshot runtime continuity',
        status: 'live',
      })

      await createTestStrategyInstance(prisma, {
        id: RUNTIME_INSTANCE_ID,
        templateId: RUNTIME_TEMPLATE_ID,
        name: 'E2E-Runtime-Instance',
        status: 'running',
        ownerId: RUNTIME_USER_ID,
      })

      await upsertTestUserStrategyAccount(prisma, {
        id: RUNTIME_ACCOUNT_ID,
        userId: RUNTIME_USER_ID,
        strategyId: RUNTIME_TEMPLATE_ID,
        strategyName: 'E2E Runtime Strategy',
      })

      await createTestExchangeAccount(prisma, {
        id: RUNTIME_EXCHANGE_ACCOUNT_ID,
        userId: RUNTIME_USER_ID,
        exchangeId: 'okx',
        isTestnet: true,
        name: 'E2E Runtime OKX Testnet',
      })

      await createTestSubscription(prisma, {
        userId: RUNTIME_USER_ID,
        strategyInstanceId: RUNTIME_INSTANCE_ID,
        exchangeAccountId: RUNTIME_EXCHANGE_ACCOUNT_ID,
      })

      await createTestSymbol(prisma, {
        id: RUNTIME_SYMBOL_ID,
        code: RUNTIME_SYMBOL_CODE,
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
      })

      await seedRuntimeBar(prisma, {
        symbolId: RUNTIME_SYMBOL_ID,
        close: 60000,
        time: new Date('2026-04-22T00:00:00.000Z'),
      })

      await prisma.llmStrategyCodegenSession.create({
        data: {
          id: RUNTIME_SESSION_ID,
          userId: RUNTIME_USER_ID,
          strategyInstanceId: RUNTIME_INSTANCE_ID,
          status: 'PUBLISHED',
        },
      })

      const snapshot = await prisma.publishedStrategySnapshot.create({
        data: {
          id: RUNTIME_SNAPSHOT_ID,
          sessionId: RUNTIME_SESSION_ID,
          strategyTemplateId: RUNTIME_TEMPLATE_ID,
          strategyInstanceId: RUNTIME_INSTANCE_ID,
          snapshotHash: RUNTIME_SNAPSHOT_HASH,
          scriptHash: 'e2e-runtime-script-hash',
          specHash: 'e2e-runtime-spec-hash',
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

      await prisma.strategyInstance.update({
        where: { id: RUNTIME_INSTANCE_ID },
        data: {
          mode: 'TESTNET',
          runtimeBindingStatus: 'READY',
          runtimeBindingErrorCode: null,
          runtimeBindingUpdatedAt: new Date('2026-04-22T00:00:00.000Z'),
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: snapshot.id,
            snapshotHash: snapshot.snapshotHash,
            sourceStrategyInstanceId: RUNTIME_INSTANCE_ID,
            sourceStrategyTemplateId: RUNTIME_TEMPLATE_ID,
          },
        },
      })

      const runtimeExecutionStateService = app.get(StrategyRuntimeExecutionStateService)
      await runtimeExecutionStateService.initializeStatesForDeploy({
        strategyInstanceId: RUNTIME_INSTANCE_ID,
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        snapshot,
      })
    })

    afterAll(async () => {
      await prisma.userSignalExecution.deleteMany({
        where: {
          signal: {
            strategyInstanceId: RUNTIME_INSTANCE_ID,
          },
        },
      })
      await prisma.tradingSignal.deleteMany({
        where: {
          strategyInstanceId: RUNTIME_INSTANCE_ID,
        },
      })
      await prisma.strategyRuntimeExecutionState.deleteMany({
        where: {
          strategyInstanceId: RUNTIME_INSTANCE_ID,
        },
      })
      await prisma.marketBar.deleteMany({
        where: { symbolId: RUNTIME_SYMBOL_ID },
      })
      await prisma.userStrategySubscription.deleteMany({
        where: {
          userId: RUNTIME_USER_ID,
          strategyInstanceId: RUNTIME_INSTANCE_ID,
        },
      })
      await prisma.exchangeAccount.deleteMany({
        where: { id: RUNTIME_EXCHANGE_ACCOUNT_ID },
      })
      await prisma.userStrategyAccount.deleteMany({
        where: { id: RUNTIME_ACCOUNT_ID },
      })
      await prisma.publishedStrategySnapshot.deleteMany({
        where: { id: RUNTIME_SNAPSHOT_ID },
      })
      await prisma.llmStrategyCodegenSession.deleteMany({
        where: { id: RUNTIME_SESSION_ID },
      })
      await prisma.strategyInstance.deleteMany({
        where: { id: RUNTIME_INSTANCE_ID },
      })
      await prisma.symbol.deleteMany({
        where: { id: RUNTIME_SYMBOL_ID },
      })
      await prisma.strategyTemplate.deleteMany({
        where: { id: RUNTIME_TEMPLATE_ID },
      })
      await prisma.user.deleteMany({
        where: { id: RUNTIME_USER_ID },
      })
    })

    it('[TC-SIGNAL-009] should create a runtime signal and, after direct generation, automatically advance it into execution', async () => {
      const tradingService = moduleFixture.get(TradingService)
      const placeOrderSpy = jest.spyOn(tradingService, 'placeOrder').mockResolvedValue({
        id: 'TC-009-ORDER',
        clientOrderId: 'TC-009-CLIENT',
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
              strategyInstanceId: RUNTIME_INSTANCE_ID,
            },
            orderBy: { createdAt: 'desc' },
          })
        })

        expect((signal.metadata as {
          runtimeProvenance?: {
            publishedSnapshotId?: string
            executionSemanticKey?: string
          }
        } | null)?.runtimeProvenance?.publishedSnapshotId).toBe(RUNTIME_SNAPSHOT_ID)
        expect((signal.metadata as {
          runtimeProvenance?: {
            publishedSnapshotId?: string
            executionSemanticKey?: string
          }
        } | null)?.runtimeProvenance?.executionSemanticKey).toBe('on_start.entry.primary')

        const execution = await waitForExecution(async () => {
          return prisma.userSignalExecution.findFirst({
            where: {
              userId: RUNTIME_USER_ID,
              signal: {
                strategyInstanceId: RUNTIME_INSTANCE_ID,
              },
            },
            include: {
              signal: true,
            },
            orderBy: { executedAt: 'desc' },
          })
        })

        const runtimeState = await prisma.strategyRuntimeExecutionState.findFirstOrThrow({
          where: {
            strategyInstanceId: RUNTIME_INSTANCE_ID,
            publishedSnapshotId: RUNTIME_SNAPSHOT_ID,
          },
        })
        const executedSignal = execution.signal as {
          status: string
          metadata?: {
            runtimeProvenance?: {
              publishedSnapshotId?: string
              executionSemanticKey?: string
            }
          }
        }

        expect(placeOrderSpy).toHaveBeenCalled()
        expect(execution.status).toBe(ExecutionStatus.EXECUTED)
        expect(executedSignal.status).toBe(SignalStatus.EXECUTED)
        expect(runtimeState.status).toBe('consumed')
      } finally {
        placeOrderSpy.mockRestore()
      }
    })
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
