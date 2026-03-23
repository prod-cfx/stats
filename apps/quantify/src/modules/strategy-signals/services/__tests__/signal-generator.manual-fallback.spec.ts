import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { SignalGeneratorService } from '../signal-generator.service'

describe('signal generator manual fallback', () => {
  const config: StrategySignalsRuntimeConfig = {
    enabled: true,
    cronExpression: '*/5 * * * *',
    cooldownMinutes: 15,
    batchSize: 10,
    maxSymbolsPerStrategy: 3,
    debug: {
      enabled: false,
      maxScriptLength: 1000,
      maxValueLength: 200,
    },
    ai: {
      maxAttempts: 2,
      temperature: 0.2,
      maxTokens: 400,
      maxFailuresBeforeCooldown: 3,
      failureCooldownMinutes: 30,
      maxRawResponseLength: 4000,
    },
    execution: {
      enabled: false,
      dryRun: true,
      maxAccountsPerSignal: 25,
      defaultQuoteAmount: 100,
      minBalanceThreshold: 50,
      maxRiskFraction: 0.2,
    },
  }

  let service: SignalGeneratorService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})
    service = new SignalGeneratorService(
      {} as any,
      { get: jest.fn().mockReturnValue(config) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds deterministic BUY fallback payload for manual trigger', () => {
    const fallback = (service as any).buildManualFallbackSignal(100, 'strategy-1', 'BTCUSDT:SPOT')

    expect(fallback).toMatchObject({
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 1,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit: 102,
    })
    expect(typeof fallback.rawResponse).toBe('string')
  })

  it('returns null when reference price is invalid', () => {
    const fallback = (service as any).buildManualFallbackSignal(undefined, 'strategy-1', 'BTCUSDT:SPOT')
    expect(fallback).toBeNull()
  })
})
