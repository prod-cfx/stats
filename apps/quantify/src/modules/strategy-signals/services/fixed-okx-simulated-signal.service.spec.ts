import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { FixedOkxSimulatedSignalService } from './fixed-okx-simulated-signal.service'

describe('FixedOkxSimulatedSignalService', () => {
  function createService() {
    const prisma = {
      llmStrategy: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      symbol: { findFirst: jest.fn() },
      userStrategyAccount: { findFirst: jest.fn() },
      llmStrategyInstance: { findFirst: jest.fn() },
      tradingSignal: { create: jest.fn() },
    }

    const env = {
      getString: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          QUANTIFY_FIXED_OKX_ENABLED: 'true',
          QUANTIFY_FIXED_OKX_SPOT_BASE_ASSET: 'BTC',
          QUANTIFY_FIXED_OKX_PERP_BASE_ASSET: 'BTC',
          QUANTIFY_FIXED_OKX_QUOTE_ASSET: 'USDT',
          QUANTIFY_FIXED_OKX_USER_EMAIL: 'okx-sim-fixed@local.dev',
        }
        return values[key] ?? defaultValue
      }),
    }

    const signalExecutor = {
      executeSignalForSubscribedUsers: jest.fn(),
    }

    const service = new FixedOkxSimulatedSignalService(
      prisma as any,
      env as any,
      signalExecutor as any,
    )

    return { service, prisma, env, signalExecutor }
  }

  it('creates a spot fixed-okx signal with resolved context and fetched ticker price', async () => {
    const { service, prisma } = createService()

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })
    prisma.tradingSignal.create.mockResolvedValue({ id: 'signal-1' })

    jest.spyOn(service, 'fetchTickerPrice').mockResolvedValue('61000')

    const signal = await service.createSignal({
      marketType: 'spot',
      signalType: 'ENTRY',
      direction: 'BUY',
      reason: 'unit-test-open',
      positionSizeQuote: '10',
    })

    expect(signal).toEqual({ id: 'signal-1' })
    expect(prisma.tradingSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        llmStrategyId: 'strategy-1',
        llmStrategyInstanceId: 'spot-instance-1',
        symbolId: 'spot-symbol-1',
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '61000',
        positionSizeQuote: '10',
        aiReasoning: 'unit-test-open',
      }),
    })
  })

  it('can create and execute a perp fixed-okx signal with override config', async () => {
    const { service, prisma, signalExecutor } = createService()

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })
    prisma.tradingSignal.create.mockResolvedValue({ id: 'signal-2' })

    const executionConfig = {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: true,
        dryRun: false,
      },
    }

    const signal = await service.createAndExecuteSignal({
      marketType: 'perp',
      signalType: 'EXIT',
      direction: 'CLOSE_LONG',
      reason: 'unit-test-close',
      entryPrice: '60500',
      executionConfig,
    })

    expect(signal).toEqual({ id: 'signal-2' })
    expect(prisma.tradingSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '60500',
      }),
    })
    expect(signalExecutor.executeSignalForSubscribedUsers).toHaveBeenCalledWith('signal-2', executionConfig)
  })

  it('resolves separate spot/perp symbols from env when perp uses a different base asset', async () => {
    const { service, prisma, env } = createService()

    env.getString = jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        QUANTIFY_FIXED_OKX_ENABLED: 'true',
        QUANTIFY_FIXED_OKX_SPOT_BASE_ASSET: 'BTC',
        QUANTIFY_FIXED_OKX_PERP_BASE_ASSET: 'ETH',
        QUANTIFY_FIXED_OKX_QUOTE_ASSET: 'USDT',
        QUANTIFY_FIXED_OKX_USER_EMAIL: 'okx-sim-fixed@local.dev',
      }
      return values[key] ?? defaultValue
    })

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })

    const context = await service.resolveContext()

    expect(prisma.symbol.findFirst).toHaveBeenNthCalledWith(1, { where: { code: 'BTCUSDT' } })
    expect(prisma.symbol.findFirst).toHaveBeenNthCalledWith(2, { where: { code: 'ETHUSDT:PERP' } })
    expect(prisma.llmStrategyInstance.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        strategyId: 'strategy-1',
        name: 'fixed-okx-btcusdt-spot',
      },
    })
    expect(prisma.llmStrategyInstance.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        strategyId: 'strategy-1',
        name: 'fixed-okx-ethusdt-perp',
      },
    })
    expect(context.spotSymbol).toBe('BTC/USDT')
    expect(context.perpSymbol).toBe('ETH/USDT:PERP')
  })
})
