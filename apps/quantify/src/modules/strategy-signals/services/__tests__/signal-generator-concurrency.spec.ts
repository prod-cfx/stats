import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { SignalGeneratorService } from '../signal-generator.service'

describe('signal generator concurrency guard', () => {
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
      { isProd: jest.fn().mockReturnValue(false) } as any,
      {} as any,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('skips overlapping generation cycles while a previous cycle is still running', async () => {
    let release!: () => void
    const blocker = new Promise<void>(resolve => {
      release = resolve
    })
    const generateSignals = jest
      .spyOn(service, 'generateSignals')
      .mockImplementation(async () => blocker)
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {})

    const firstRun = (service as any).runGenerationCycle()
    await Promise.resolve()

    await (service as any).runGenerationCycle()

    expect(generateSignals).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      'Signal generator is still running from the previous cycle, skipping this tick',
    )

    release()
    await firstRun
  })
})
