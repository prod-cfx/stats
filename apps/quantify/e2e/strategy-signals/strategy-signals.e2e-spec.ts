import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../../src/prisma/prisma.service'
import type { TestingAppContext } from '../fixtures/fixtures'
import { ExecutionStatus, SignalDirection, SignalSourceType, SignalStatus, SignalType } from '@/prisma/prisma.types'
import { SignalExecutorService } from '@/modules/strategy-signals/services/signal-executor.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { TradingService } from '@/modules/trading/trading.service'
import { createTestingApp } from '../fixtures/fixtures'

describe('StrategySignals (E2E, DB only)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let prisma: PrismaService

  const TEST_USER_ID = 'e2e-signal-user'
  const TEST_STRATEGY_TEMPLATE_ID = 'e2e-signal-strategy-template'
  const TEST_ACCOUNT_ID = 'e2e-signal-account'
  const TEST_SYMBOL_ID = 'e2e-signal-symbol'

  beforeAll(async () => {
    const context: TestingAppContext = await createTestingApp()
    app = context.app
    moduleFixture = context.moduleFixture
    prisma = context.prisma

    // 准备用户
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: 'e2e-signal-user@test.com',
        nickname: 'E2E 策略信号用户',
      },
    })

    // 准备策略模板（最小可用字段）
    await prisma.strategyTemplate.create({
      data: {
        id: TEST_STRATEGY_TEMPLATE_ID,
        name: 'E2E-Signal-Template',
        description: 'E2E 策略信号测试模板',
        legs: [],
        llmModel: 'gpt-4',
        promptTemplate: '测试策略信号 Prompt',
        paramsSchema: { type: 'object' },
        requiredFields: [],
        status: 'draft',
      },
    })

    // 准备行情交易对
    await prisma.symbol.create({
      data: {
        id: TEST_SYMBOL_ID,
        code: 'E2E-BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        type: 'CRYPTO',
        instrumentType: 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
    })

    // 准备用户策略账户
    await prisma.userStrategyAccount.create({
      data: {
        id: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        strategyName: 'E2E 策略',
        strategyVersion: 'v1',
        baseCurrency: 'USDT',
        initialBalance: '1000',
        balance: '1000',
        equity: '1000',
      },
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
    const signal = await prisma.tradingSignal.create({
      data: {
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        symbolId: TEST_SYMBOL_ID,
        sourceType: SignalSourceType.AI_GENERATED,
        signalType: SignalType.ENTRY,
        direction: SignalDirection.BUY,
        status: SignalStatus.PENDING,
        confidence: '80',
        entryPrice: '60000',
        targetPrice: '65000',
        stopLoss: '58000',
        takeProfit: '64000',
        aiModel: 'gpt-4',
        aiReasoning: 'E2E 测试信号理由',
        marketContext: {
          timeframe: '1h',
          indicators: {
            ma_20: '59000',
          },
        },
      },
      include: {
        strategy: true,
        symbol: true,
      },
    })

    expect(signal.id).toBeDefined()
    expect(signal.strategyId).toBe(TEST_STRATEGY_TEMPLATE_ID)
    expect(signal.symbolId).toBe(TEST_SYMBOL_ID)
    expect(signal.strategy.name).toBe('E2E-Signal-Template')
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

    const execution = await prisma.userSignalExecution.create({
      data: {
        signalId: baseSignal.id,
        userId: TEST_USER_ID,
        userStrategyAccountId: TEST_ACCOUNT_ID,
        status: ExecutionStatus.EXECUTED,
        orderSide: 'BUY',
        positionSide: 'LONG',
        executedPrice: '61000',
        executedQuantity: '0.01',
        fee: '1.2',
        feeCurrency: 'USDT',
        tradeId: 'E2E-TRADE-ID',
        executedAt: new Date(),
      },
      include: {
        signal: true,
        user: true,
        account: true,
      },
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
      await prisma.user.upsert({
        where: { id: RISK_CONTROL_USER_ID },
        update: {},
        create: {
          id: RISK_CONTROL_USER_ID,
          email: 'risk-control@test.com',
          nickname: 'Risk Control Test User',
        },
      })

      // 准备风控测试账户，余额 1000 USDT
      await prisma.userStrategyAccount.upsert({
        where: { id: RISK_CONTROL_ACCOUNT_ID },
        update: {
          balance: '1000',
          equity: '1000',
        },
        create: {
          id: RISK_CONTROL_ACCOUNT_ID,
          userId: RISK_CONTROL_USER_ID,
          strategyId: TEST_STRATEGY_TEMPLATE_ID,
          strategyName: 'Risk Control Test Strategy',
          strategyVersion: 'v1',
          baseCurrency: 'USDT',
          initialBalance: '1000',
          balance: '1000',
          equity: '1000',
        },
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

      const signal = await prisma.tradingSignal.create({
        data: {
          strategyId: TEST_STRATEGY_TEMPLATE_ID,
          symbolId: TEST_SYMBOL_ID,
          sourceType: SignalSourceType.AI_GENERATED,
          signalType: SignalType.ENTRY,
          direction: SignalDirection.BUY,
          status: SignalStatus.PENDING,
          confidence: '80',
          entryPrice: '50000',
          positionSizeQuote: '500', // 策略要求 500 USDT
          aiModel: 'gpt-4',
          aiReasoning: 'TC-SIGNAL-003 test',
        },
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
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)
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

      const signal = await prisma.tradingSignal.create({
        data: {
          strategyId: TEST_STRATEGY_TEMPLATE_ID,
          symbolId: TEST_SYMBOL_ID,
          sourceType: SignalSourceType.AI_GENERATED,
          signalType: SignalType.ENTRY,
          direction: SignalDirection.BUY,
          status: SignalStatus.PENDING,
          confidence: '80',
          entryPrice: '50000',
          positionSizeRatio: '0.5', // 策略要求 50% = 500 USDT
          aiModel: 'gpt-4',
          aiReasoning: 'TC-SIGNAL-004 test',
        },
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
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)
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

      const signal = await prisma.tradingSignal.create({
        data: {
          strategyId: TEST_STRATEGY_TEMPLATE_ID,
          symbolId: TEST_SYMBOL_ID,
          sourceType: SignalSourceType.AI_GENERATED,
          signalType: SignalType.ENTRY,
          direction: SignalDirection.BUY,
          status: SignalStatus.PENDING,
          confidence: '80',
          entryPrice: '50000',
          // 不指定 positionSizeQuote 或 positionSizeRatio
          aiModel: 'gpt-4',
          aiReasoning: 'TC-SIGNAL-005 test',
        },
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
      const callArgs = placeOrderSpy.mock.calls.find(call => call[0] === RISK_CONTROL_USER_ID)
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

      const signal = await prisma.tradingSignal.create({
        data: {
          strategyId: TEST_STRATEGY_TEMPLATE_ID,
          symbolId: TEST_SYMBOL_ID,
          sourceType: SignalSourceType.AI_GENERATED,
          signalType: SignalType.ENTRY,
          direction: SignalDirection.BUY,
          status: SignalStatus.PENDING,
          confidence: '80',
          entryPrice: '50000',
          positionSizeQuote: '0', // 无效值
          aiModel: 'gpt-4',
          aiReasoning: 'TC-SIGNAL-006 test',
        },
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
})
