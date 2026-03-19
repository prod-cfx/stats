import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { FixedHyperliquidTestnetSignalService } from './fixed-hyperliquid-testnet-signal.service'

describe('FixedHyperliquidTestnetSignalService', () => {
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
          QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
          QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET: 'BTC',
          QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'USDC',
          QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL: 'hyperliquid-testnet-fixed@local.dev',
        }
        return values[key] ?? defaultValue
      }),
    }

    const signalExecutor = {
      executeSignalForSubscribedUsers: jest.fn(),
    }

    const service = new FixedHyperliquidTestnetSignalService(
      prisma as any,
      env as any,
      signalExecutor as any,
    )

    return { service, prisma, env, signalExecutor }
  }

  it('creates a perp signal and fetches ticker when entry price is missing', async () => {
    const { service, prisma } = createService()

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst.mockResolvedValue({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst.mockResolvedValue({ id: 'perp-instance-1' })
    prisma.tradingSignal.create.mockResolvedValue({ id: 'signal-1' })

    jest.spyOn(service, 'fetchTickerPrice').mockResolvedValue('13000')

    const signal = await service.createSignal({
      marketType: 'perp',
      signalType: 'ENTRY',
      direction: 'BUY',
      reason: 'unit-test-open',
      positionSizeQuote: '5',
    })

    expect(signal).toEqual({ id: 'signal-1' })
    expect(prisma.tradingSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        llmStrategyId: 'strategy-1',
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '13000',
        positionSizeQuote: '5',
        aiReasoning: 'unit-test-open',
      }),
    })
  })

  it('executes a perp signal when config overrides are provided', async () => {
    const { service, prisma, signalExecutor } = createService()

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst.mockResolvedValue({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst.mockResolvedValue({ id: 'perp-instance-1' })
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
      entryPrice: '12950',
      executionConfig,
    })

    expect(signal).toEqual({ id: 'signal-2' })
    expect(prisma.tradingSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '12950',
      }),
    })
    expect(signalExecutor.executeSignalForSubscribedUsers).toHaveBeenCalledWith('signal-2', executionConfig)
  })

  it('resolves the perp strategy context from env values', async () => {
    const { service, prisma, env } = createService()

    env.getString = jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET: 'ETH',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'USDT',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL: 'hyperliquid-testnet-fixed@local.dev',
      }
      return values[key] ?? defaultValue
    })

    prisma.llmStrategy.findUnique.mockResolvedValue({ id: 'strategy-1' })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    prisma.symbol.findFirst.mockResolvedValue({ id: 'perp-symbol-1' })
    prisma.userStrategyAccount.findFirst.mockResolvedValue({ id: 'account-1' })
    prisma.llmStrategyInstance.findFirst.mockResolvedValue({ id: 'perp-instance-1' })

    const context = await service.resolveContext()

    expect(prisma.symbol.findFirst).toHaveBeenCalledWith({ where: { code: 'ETHUSDT:PERP' } })
    expect(prisma.llmStrategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        strategyId: 'strategy-1',
        name: 'fixed-hyperliquid-ethusdt-perp',
      },
    })
    expect(context.perpSymbol).toBe('ETH/USDT:PERP')
  })
})
