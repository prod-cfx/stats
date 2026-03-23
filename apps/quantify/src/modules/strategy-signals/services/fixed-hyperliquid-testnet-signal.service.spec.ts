import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { FixedHyperliquidTestnetSignalService } from './fixed-hyperliquid-testnet-signal.service'

describe('fixedHyperliquidTestnetSignalService', () => {
  function createService() {
    const contextRepo = {
      findLlmStrategyByName: jest.fn(),
      findUserByEmail: jest.fn(),
      findSymbolByCode: jest.fn(),
      findSymbolsByCodes: jest.fn(),
      findUserStrategyAccount: jest.fn(),
      findLlmStrategyInstance: jest.fn(),
      createTradingSignal: jest.fn(),
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
      contextRepo as any,
      env as any,
      signalExecutor as any,
    )

    return { service, contextRepo, env, signalExecutor }
  }

  it('creates a perp signal and fetches ticker when entry price is missing', async () => {
    const { service, contextRepo } = createService()

    contextRepo.findLlmStrategyByName.mockResolvedValue({ id: 'strategy-1' })
    contextRepo.findUserByEmail.mockResolvedValue({ id: 'user-1' })
    contextRepo.findSymbolByCode.mockResolvedValue({ id: 'perp-symbol-1' })
    contextRepo.findUserStrategyAccount.mockResolvedValue({ id: 'account-1' })
    contextRepo.findLlmStrategyInstance.mockResolvedValue({ id: 'perp-instance-1' })
    contextRepo.createTradingSignal.mockResolvedValue({ id: 'signal-1' })

    jest.spyOn(service, 'fetchTickerPrice').mockResolvedValue('13000')

    const signal = await service.createSignal({
      marketType: 'perp',
      signalType: 'ENTRY',
      direction: 'BUY',
      reason: 'unit-test-open',
      positionSizeQuote: '5',
    })

    expect(signal).toEqual({ id: 'signal-1' })
    expect(contextRepo.createTradingSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        llmStrategyId: 'strategy-1',
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '13000',
        positionSizeQuote: '5',
        aiReasoning: 'unit-test-open',
      }),
    )
  })

  it('creates a spot signal with the spot symbol and instance context', async () => {
    const { service, contextRepo } = createService()

    contextRepo.findLlmStrategyByName.mockResolvedValue({ id: 'strategy-1' })
    contextRepo.findUserByEmail.mockResolvedValue({ id: 'user-1' })
    contextRepo.findSymbolByCode
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    contextRepo.findUserStrategyAccount.mockResolvedValue({ id: 'account-1' })
    contextRepo.findLlmStrategyInstance
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })
    contextRepo.createTradingSignal.mockResolvedValue({ id: 'signal-spot-1' })

    jest.spyOn(service, 'fetchTickerPrice').mockResolvedValue('0.42')

    const signal = await service.createSignal({
      marketType: 'spot',
      signalType: 'ENTRY',
      direction: 'BUY',
      reason: 'unit-test-open-spot',
      positionSizeQuote: '8',
    })

    expect(signal).toEqual({ id: 'signal-spot-1' })
    expect(contextRepo.createTradingSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        llmStrategyInstanceId: 'spot-instance-1',
        symbolId: 'spot-symbol-1',
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '0.42',
      }),
    )
  })

  it('executes a perp signal when config overrides are provided', async () => {
    const { service, contextRepo, signalExecutor } = createService()

    contextRepo.findLlmStrategyByName.mockResolvedValue({ id: 'strategy-1' })
    contextRepo.findUserByEmail.mockResolvedValue({ id: 'user-1' })
    contextRepo.findSymbolByCode.mockResolvedValue({ id: 'perp-symbol-1' })
    contextRepo.findUserStrategyAccount.mockResolvedValue({ id: 'account-1' })
    contextRepo.findLlmStrategyInstance.mockResolvedValue({ id: 'perp-instance-1' })
    contextRepo.createTradingSignal.mockResolvedValue({ id: 'signal-2' })

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
    expect(contextRepo.createTradingSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '12950',
      }),
    )
    expect(signalExecutor.executeSignalForSubscribedUsers).toHaveBeenCalledWith('signal-2', executionConfig)
  })

  it('resolves the perp strategy context from env values', async () => {
    const { service, contextRepo, env } = createService()

    env.getString = jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET: 'ETH',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'USDT',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL: 'hyperliquid-testnet-fixed@local.dev',
      }
      return values[key] ?? defaultValue
    })

    contextRepo.findLlmStrategyByName.mockResolvedValue({ id: 'strategy-1' })
    contextRepo.findUserByEmail.mockResolvedValue({ id: 'user-1' })
    contextRepo.findSymbolByCode
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    contextRepo.findUserStrategyAccount.mockResolvedValue({ id: 'account-1' })
    contextRepo.findLlmStrategyInstance
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })

    const context = await service.resolveContext()

    expect(contextRepo.findLlmStrategyByName).toHaveBeenCalledWith('FIXED-HYPERLIQUID-TESTNET-ETHUSDT')
    expect(contextRepo.findSymbolByCode).toHaveBeenNthCalledWith(1, 'ETHUSDT')
    expect(contextRepo.findSymbolByCode).toHaveBeenNthCalledWith(2, 'ETHUSDT:PERP')
    expect(contextRepo.findLlmStrategyInstance).toHaveBeenCalledWith('strategy-1', 'fixed-hyperliquid-ethusdt-perp')
    expect(context.spotSymbolId).toBe('spot-symbol-1')
    expect(context.spotInstanceId).toBe('spot-instance-1')
    expect(context.spotSymbol).toBe('ETH/USDT')
    expect(context.perpSymbol).toBe('ETH/USDT:PERP')
  })
})
