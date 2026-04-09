import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
jest.mock('@/common/utils/prisma-enum-mappers', () => ({
  reverseMapTimeframe: (value: string) => value,
}))

import { SignalGeneratorService } from '../signal-generator.service'

describe('signal generator strict AI codegen fail-fast', () => {
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
  let aiService: { chat: jest.Mock }
  let telemetry: { recordGeneration: jest.Mock }
  let generatorRepository: { findSymbolByCode: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    aiService = { chat: jest.fn() }
    telemetry = { recordGeneration: jest.fn() }
    generatorRepository = {
      findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT:SPOT' }),
    }

    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})
    service = new SignalGeneratorService(
      generatorRepository as any,
      { get: jest.fn().mockReturnValue(config) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      aiService as any,
      {} as any,
      { reset: jest.fn(), incrementFailure: jest.fn() } as any,
      { emit: jest.fn() } as any,
      telemetry as any,
      {} as any,
      { isProd: jest.fn().mockReturnValue(false) } as any,
      {} as any,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not call generic AI fallback on strict single-leg path when direct extraction fails', async () => {
    aiService.chat.mockResolvedValue({
      content:
        '{"direction":"BUY","signalType":"ENTRY","confidence":80,"entryPrice":100,"stopLoss":90,"takeProfit":110,"positionSizeRatio":0.1,"reasoning":"fallback"}',
    })
    jest.spyOn(service as any, 'buildPublishedCodegenSignalPayload').mockReturnValue(null)

    const payload = await (service as any).generateSignalWithAi(
      { id: 'instance-1', llmModel: 'gpt-4o-mini', params: {} },
      {
        id: 'strategy-1',
        name: 'strict strategy',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        defaultParams: {},
      },
      { code: 'BTCUSDT:SPOT' },
      '1h',
      { rsi: 50 },
      config,
      100,
      true,
    )

    expect(payload).toBeNull()
    expect(aiService.chat).not.toHaveBeenCalled()
  })

  it('does not call generic AI fallback on strict multi-leg path when direct extraction fails', async () => {
    aiService.chat.mockResolvedValue({
      content:
        '{"direction":"BUY","signalType":"ENTRY","confidence":80,"entryPrice":124,"stopLoss":120,"takeProfit":130,"positionSizeRatio":0.1,"reasoning":"fallback"}',
    })
    jest.spyOn(service as any, 'buildPublishedCodegenSignalPayload').mockReturnValue(null)
    jest.spyOn(service as any, 'loadMultiLegDataBatch').mockResolvedValue({
      primary: {
        '15m': {
          bars: Array.from({ length: 25 }, (_unused, index) => ({
            open: 100 + index,
            high: 101 + index,
            low: 99 + index,
            close: 100 + index,
            volume: 10 + index,
            timestamp: 1_775_000_000_000 + index * 900_000,
          })),
          indicators: {},
          currentPrice: 124,
        },
      },
    })
    const createMultiLegSignal = jest.spyOn(service as any, 'createMultiLegSignal').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-4',
        params: {},
      },
      {
        id: 'template-1',
        name: 'strict multi-leg strategy',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script:
          '({ direction: "BUY", signalType: "ENTRY", confidence: 55, entryPrice: 124, stopLoss: 120, takeProfit: 130, positionSizeRatio: 0.1, reasoning: "buy signal" })',
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', role: 'primary', symbol: 'BTCUSDT:SPOT', description: 'primary leg' }],
      { id: 'primary', role: 'primary', symbol: 'BTCUSDT:SPOT', description: 'primary leg' },
      config,
      { skipCooldown: true },
    )

    expect(aiService.chat).not.toHaveBeenCalled()
    expect(createMultiLegSignal).not.toHaveBeenCalled()
    expect(handleStrategyFailure).toHaveBeenCalledTimes(1)
  })

  it('filters the latest unfinished bar for bar-close runtime normalization', () => {
    const bars = (service as any).normalizeRuntimeBars([
      {
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 10,
        timestamp: 1,
        isFinal: true,
      },
      {
        open: 101,
        high: 102,
        low: 100,
        close: 101,
        volume: 11,
        timestamp: 2,
        isFinal: false,
      },
    ], {
      requireFinalLatestBar: true,
    })

    expect(bars.map((bar: any) => bar.timestamp)).toEqual([1])
  })
})
