import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { FixedOkxSimulatedSignalService } from './fixed-okx-simulated-signal.service'

describe('fixedOkxSimulatedSignalService', () => {
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
      contextRepo as any,
      env as any,
      signalExecutor as any,
    )

    return { service, contextRepo, env, signalExecutor }
  }

  it('creates a spot fixed-okx signal with resolved context and fetched ticker price', async () => {
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
    contextRepo.createTradingSignal.mockResolvedValue({ id: 'signal-1' })

    jest.spyOn(service, 'fetchTickerPrice').mockResolvedValue('61000')

    const signal = await service.createSignal({
      marketType: 'spot',
      signalType: 'ENTRY',
      direction: 'BUY',
      reason: 'unit-test-open',
      positionSizeQuote: '10',
    })

    expect(signal).toEqual({ id: 'signal-1' })
    expect(contextRepo.createTradingSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        llmStrategyId: 'strategy-1',
        llmStrategyInstanceId: 'spot-instance-1',
        symbolId: 'spot-symbol-1',
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '61000',
        positionSizeQuote: '10',
        aiReasoning: 'unit-test-open',
      }),
    )
  })

  it('can create and execute a perp fixed-okx signal with override config', async () => {
    const { service, contextRepo, signalExecutor } = createService()

    contextRepo.findLlmStrategyByName.mockResolvedValue({ id: 'strategy-1' })
    contextRepo.findUserByEmail.mockResolvedValue({ id: 'user-1' })
    contextRepo.findSymbolByCode
      .mockResolvedValueOnce({ id: 'spot-symbol-1' })
      .mockResolvedValueOnce({ id: 'perp-symbol-1' })
    contextRepo.findUserStrategyAccount.mockResolvedValue({ id: 'account-1' })
    contextRepo.findLlmStrategyInstance
      .mockResolvedValueOnce({ id: 'spot-instance-1' })
      .mockResolvedValueOnce({ id: 'perp-instance-1' })
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
      entryPrice: '60500',
      executionConfig,
    })

    expect(signal).toEqual({ id: 'signal-2' })
    expect(contextRepo.createTradingSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        llmStrategyInstanceId: 'perp-instance-1',
        symbolId: 'perp-symbol-1',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '60500',
      }),
    )
    expect(signalExecutor.executeSignalForSubscribedUsers).toHaveBeenCalledWith('signal-2', executionConfig)
  })

  it('resolves separate spot/perp symbols from env when perp uses a different base asset', async () => {
    const { service, contextRepo, env } = createService()

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

    expect(contextRepo.findSymbolByCode).toHaveBeenNthCalledWith(1, 'BTCUSDT')
    expect(contextRepo.findSymbolByCode).toHaveBeenNthCalledWith(2, 'ETHUSDT:PERP')
    expect(contextRepo.findLlmStrategyInstance).toHaveBeenNthCalledWith(1, 'strategy-1', 'fixed-okx-btcusdt-spot')
    expect(contextRepo.findLlmStrategyInstance).toHaveBeenNthCalledWith(2, 'strategy-1', 'fixed-okx-ethusdt-perp')
    expect(context.spotSymbol).toBe('BTC/USDT')
    expect(context.perpSymbol).toBe('ETH/USDT:PERP')
  })
})
