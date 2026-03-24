import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { SignalGeneratorService } from '../signal-generator.service'

describe('signal generator AI_CODEGEN_PUBLISHED_TEMPLATE direct signal', () => {
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
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('maps buy action output into an ENTRY BUY signal payload', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        action: 'buy',
        amount: 0.5,
        metadata: {
          entryPrice: 200,
          stopLossPrice: 180,
          takeProfitPrice: 220,
        },
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        defaultParams: {
          entryQuoteAmount: 100,
        },
      },
      {
        params: {
          entryQuoteAmount: 100,
        },
      },
    )

    expect(payload).toMatchObject({
      type: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: 200,
        stopLoss: 180,
        takeProfit: 220,
        positionSizeQuote: 100,
      },
    })
  })

  it('returns no-signal marker when script output action is hold', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        action: 'hold',
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
      {},
    )

    expect(payload).toEqual({ type: 'none', reason: 'NO_ACTION' })
  })
})
