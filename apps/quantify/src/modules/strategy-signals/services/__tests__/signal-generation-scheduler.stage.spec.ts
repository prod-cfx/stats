import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { computeSpreadDelayMs, SignalGenerationSchedulerStage } from '../signal-generation-scheduler.stage'

describe('signalGenerationSchedulerStage', () => {
  const config: StrategySignalsRuntimeConfig = {
    enabled: true,
    cronExpression: '*/5 * * * *',
    cooldownMinutes: 15,
    batchSize: 2,
    maxSymbolsPerStrategy: 3,
    spread: { enabled: false, windowSeconds: 300 },
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

  it('skips overlapping runs while a previous cycle is still active', async () => {
    const warn = jest.fn()
    const stage = new SignalGenerationSchedulerStage(
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { warn, error: jest.fn(), log: jest.fn() } as any,
    )

    const setRunning = jest.fn()

    await stage.runGenerationCycle(config, true, setRunning, jest.fn())

    expect(warn).toHaveBeenCalledWith(
      'Signal generator is still running from the previous cycle, skipping this tick',
    )
    expect(setRunning).not.toHaveBeenCalled()
  })

  it('runs generation once and resets state after completion', async () => {
    const stage = new SignalGenerationSchedulerStage(
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { warn: jest.fn(), error: jest.fn(), log: jest.fn() } as any,
    )

    const state = { isRunning: false }
    const setRunning = (value: boolean) => {
      state.isRunning = value
    }
    const generateSignals = jest.fn().mockResolvedValue(undefined)

    await stage.runGenerationCycle(config, state.isRunning, setRunning, generateSignals)

    expect(generateSignals).toHaveBeenCalledTimes(1)
    expect(state.isRunning).toBe(false)
  })

  it('computes a stable delay inside the configured spread window', () => {
    const first = computeSpreadDelayMs('strategy-instance-1', 300)
    const second = computeSpreadDelayMs('strategy-instance-1', 300)

    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(300_000)
  })

  it('applies a computed spread delay before generation without forcing real sleeps', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined)
    const stage = new SignalGenerationSchedulerStage(
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { warn: jest.fn(), error: jest.fn(), log: jest.fn() } as any,
      sleep,
    )
    const generateSignals = jest.fn().mockResolvedValue(undefined)

    await stage.runGenerationCycle(
      { ...config, spread: { enabled: true, windowSeconds: 300 } },
      false,
      jest.fn(),
      generateSignals,
      'strategy-instance-1',
    )

    expect(sleep).toHaveBeenCalledWith(computeSpreadDelayMs('strategy-instance-1', 300))
    expect(generateSignals).toHaveBeenCalledTimes(1)
  })
})
