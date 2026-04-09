import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { SignalGenerationPersistenceStage } from '../signal-generation-persistence.stage'

describe('signalGenerationPersistenceStage', () => {
  const config: StrategySignalsRuntimeConfig = {
    enabled: true,
    cronExpression: '*/5 * * * *',
    cooldownMinutes: 15,
    batchSize: 10,
    maxSymbolsPerStrategy: 3,
    debug: { enabled: false, maxScriptLength: 1000, maxValueLength: 200 },
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

  it('locks the strategy instance when consecutive failures hit the cooldown threshold', async () => {
    const stateRepository = {
      findByStrategyInstanceId: jest.fn().mockResolvedValue({ consecutiveFailures: 2 }),
      incrementFailure: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
    }
    const stage = new SignalGenerationPersistenceStage(
      {} as any,
      {} as any,
      stateRepository as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      { withTransaction: jest.fn() } as any,
    )

    await stage.handleStrategyFailure('instance-1', config)

    expect(stateRepository.incrementFailure).toHaveBeenCalledTimes(1)
    expect(stateRepository.incrementFailure).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({ reset: true, lockedUntil: expect.any(Date) }),
    )
  })
})
