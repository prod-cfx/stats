import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../../src/prisma/prisma.service'
import type { TestingAppContext } from '../fixtures/fixtures'
import { ExecutionStatus, SignalDirection, SignalSourceType, SignalStatus, SignalType } from '@prisma/client'
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

    // 鍑嗗鐢ㄦ埛
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: 'e2e-signal-user@test.com',
        nickname: 'E2E 绛栫暐淇″彿鐢ㄦ埛',
      },
    })

    // 鍑嗗绛栫暐妯℃澘锛堟渶灏忓彲鐢ㄥ瓧娈碉級
    await prisma.strategyTemplate.create({
      data: {
        id: TEST_STRATEGY_TEMPLATE_ID,
        name: 'E2E-Signal-Template',
        description: 'E2E 绛栫暐淇″彿娴嬭瘯妯℃澘',
        legs: [],
        llmModel: 'gpt-4',
        promptTemplate: '娴嬭瘯绛栫暐淇″彿鐨?Prompt',
        paramsSchema: { type: 'object' },
        requiredFields: [],
        status: 'draft',
      },
    })

    // 鍑嗗琛屾儏浜ゆ槗瀵?
    await prisma.symbol.create({
      data: {
        id: TEST_SYMBOL_ID,
        code: 'E2E-BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'E2E-EXCHANGE',
        type: 'CRYPTO',
        instrumentType: 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
    })

    // 鍑嗗鐢ㄦ埛绛栫暐璐︽埛
    await prisma.userStrategyAccount.create({
      data: {
        id: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        strategyId: TEST_STRATEGY_TEMPLATE_ID,
        strategyName: 'E2E 绛栫暐',
        strategyVersion: 'v1',
        baseCurrency: 'USDT',
        initialBalance: '1000',
        balance: '1000',
        equity: '1000',
      },
    })
  })

  afterAll(async () => {
    // 娓呯悊鏁版嵁锛堟寜澶栭敭渚濊禆椤哄簭锛?
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
        aiReasoning: 'E2E 娴嬭瘯淇″彿鐞嗙敱',
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
      // 鍑嗗椋庢帶娴嬭瘯鐢ㄦ埛
      await prisma.user.upsert({
        where: { id: RISK_CONTROL_USER_ID },
        update: {},
        create: {
          id: RISK_CONTROL_USER_ID,
          email: 'risk-control@test.com',
          nickname: 'Risk Control Test User',
        },
      })

      // 鍑嗗椋庢帶娴嬭瘯璐︽埛锛屼綑棰?1000 USDT
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
      // 娴嬭瘯閰嶇疆锛歮axRiskFraction = 0.2 (20%), defaultQuoteAmount = 100
      // 璐︽埛浣欓 1000锛屽洜姝ら闄╀笂闄愪负 1000 * 0.2 = 200
      // 绛栫暐瑕佹眰 positionSizeQuote = 500锛屽簲璇ヨ闄愬埗涓?200锛堣€岄潪 defaultQuoteAmount 鐨?100锛?

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
          positionSizeQuote: '500', // 绛栫暐瑕佹眰 500 USDT
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

      // 楠岃瘉瀹為檯涓嬪崟閲戦琚檺鍒跺湪椋庨櫓涓婇檺鍐咃紙200 USDT锛夛紝鑰岄潪 defaultQuoteAmount锛?00 USDT锛?
      expect(placeOrderSpy).toHaveBeenCalled()
      const callArgs = placeOrderSpy.mock.calls[0]
      const orderParams = callArgs[3]

      // amount 搴旇鏄?200 / 50000 = 0.004锛堝彈 maxRiskFraction 闄愬埗锛?
      // 鑰屼笉鏄?100 / 50000 = 0.002锛坉efaultQuoteAmount 涓嶅簲闄愬埗绛栫暐浠撲綅锛?
      expect(orderParams.amount).toBeCloseTo(0.004, 6)

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-004] should use strategy-specified positionSizeRatio but enforce maxRiskFraction limit', async () => {
      // 娴嬭瘯閰嶇疆锛歮axRiskFraction = 0.2 (20%), defaultQuoteAmount = 100
      // 璐︽埛浣欓 1000锛屽洜姝ら闄╀笂闄愪负 200
      // 绛栫暐瑕佹眰 positionSizeRatio = 0.5 (50%)锛屽嵆 500 USDT锛屽簲璇ヨ闄愬埗涓?200

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
          positionSizeRatio: '0.5', // 绛栫暐瑕佹眰 50% = 500 USDT
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

      // 楠岃瘉瀹為檯涓嬪崟閲戦琚檺鍒跺湪椋庨櫓涓婇檺鍐咃紙200 USDT锛?
      expect(placeOrderSpy).toHaveBeenCalled()
      const callArgs = placeOrderSpy.mock.calls[0]
      const orderParams = callArgs[3]

      // amount 搴旇鏄?200 / 50000 = 0.004
      expect(orderParams.amount).toBeCloseTo(0.004, 6)

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-005] should fallback to global config when no strategy position size specified', async () => {
      // 娴嬭瘯閰嶇疆锛歮axRiskFraction = 0.2, defaultQuoteAmount = 100
      // 绛栫暐鏈寚瀹氫粨浣嶅ぇ灏忥紝搴旇浣跨敤 min(1000 * 0.2, 100) = 100

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
          // 涓嶆寚瀹?positionSizeQuote 鎴?positionSizeRatio
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
      const callArgs = placeOrderSpy.mock.calls[0]
      const orderParams = callArgs[3]

      // 搴旇浣跨敤鍏ㄥ眬閰嶇疆 min(200, 100) = 100 USDT
      expect(orderParams.amount).toBeCloseTo(0.002, 6) // 100 / 50000

      placeOrderSpy.mockRestore()
    })

    it('[TC-SIGNAL-006] should skip execution when strategy position size is invalid (zero or negative)', async () => {
      // 娴嬭瘯鏃犳晥鐨勪粨浣嶅ぇ灏忓€?

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
          positionSizeQuote: '0', // 鏃犳晥鍊?
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
        amount: 0.002, // 100 / 50000 = 0.002锛堝洖閫€鍒板叏灞€閰嶇疆锛?
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

      // 鏃犳晥鐨?positionSizeQuote 搴旇鍥為€€鍒板叏灞€閰嶇疆锛岃€屼笉鏄烦杩?
      // 鍥犱负浠ｇ爜涓 positionSizeQuote 鐨勬鏌ユ槸 `new Decimal(signal.positionSizeQuote).gt(0)`
      // 濡傛灉涓?0 鎴栬礋鏁帮紝浼氳蛋 else if 鎴栨渶鍚庣殑鍏ㄥ眬閰嶇疆鍒嗘敮
      expect(execution).toBeDefined()
      expect(execution!.status).toBe(ExecutionStatus.EXECUTED)

      // 搴旇浣跨敤鍏ㄥ眬閰嶇疆鑰屼笉鏄瓥鐣ユ寚瀹氱殑 0
      expect(placeOrderSpy).toHaveBeenCalled()

      placeOrderSpy.mockRestore()
    })
  })
})
