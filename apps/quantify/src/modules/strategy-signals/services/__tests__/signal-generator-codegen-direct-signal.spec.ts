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
      {} as any,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('maps buy action output into an ENTRY BUY signal payload when strict fields are explicit', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        action: 'buy',
        confidence: 88,
        positionSizeQuote: 100,
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
        confidence: 88,
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

  it('accepts normalized signal payloads emitted from StrategyAdapterV1 codegen scripts', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        direction: 'BUY',
        signalType: 'ENTRY',
        confidence: 55,
        entryPrice: 200,
        stopLoss: 180,
        takeProfit: 220,
        positionSizeRatio: 0.1,
        reasoning: 'fast SMA above slow SMA',
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
      {},
    )

    expect(payload).toMatchObject({
      type: 'signal',
      payload: {
        direction: 'BUY',
        signalType: 'ENTRY',
        confidence: 55,
        entryPrice: 200,
        stopLoss: 180,
        takeProfit: 220,
        positionSizeRatio: 0.1,
        reasoning: 'fast SMA above slow SMA',
      },
    })
  })

  it('accepts normalized payloads that omit optional confidence or risk fields by applying protocol defaults', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        direction: 'BUY',
        signalType: 'ENTRY',
        entryPrice: 200,
        positionSizeRatio: 0.1,
        reasoning: 'missing confidence and risk fields',
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
      {},
    )

    expect(payload).toMatchObject({
      type: 'signal',
      payload: {
        direction: 'BUY',
        signalType: 'ENTRY',
        confidence: 80,
        entryPrice: 200,
        stopLoss: 196,
        takeProfit: 204,
        positionSizeRatio: 0.1,
        reasoning: 'missing confidence and risk fields',
      },
    })
  })

  it('accepts strict action payloads that omit optional confidence or risk fields by applying protocol defaults', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        action: 'buy',
        positionSizeRatio: 0.1,
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
      {},
    )

    expect(payload).toMatchObject({
      type: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 200,
        stopLoss: 196,
        takeProfit: 204,
        positionSizeRatio: 0.1,
      },
    })
  })

  it('rejects ENTRY payloads without explicit positionSizeQuote or positionSizeRatio', () => {
    const payload = (service as any).buildPublishedCodegenSignalPayload(
      {
        direction: 'BUY',
        signalType: 'ENTRY',
        confidence: 60,
        entryPrice: 200,
        stopLoss: 180,
        takeProfit: 220,
        reasoning: 'missing explicit position size',
      },
      200,
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
      {
        params: {
          entryQuoteAmount: 100,
        },
      },
    )

    expect(payload).toEqual({ type: 'none', reason: 'INVALID_NORMALIZED_SIGNAL' })
  })

  it('runs published codegen adapter scripts against single-leg bars context even when template has legs metadata', async () => {
    const generatorRepository = {
      findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT:SPOT' }),
    }
    service = new SignalGeneratorService(
      generatorRepository as any,
      { get: jest.fn().mockReturnValue(config) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      {} as any,
      {} as any,
      { reset: jest.fn(), incrementFailure: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      {} as any,
      { isProd: jest.fn().mockReturnValue(false) } as any,
      {} as any,
    )

    const loadMultiLegDataBatch = jest.spyOn(service as any, 'loadMultiLegDataBatch').mockResolvedValue({
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
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-4',
        params: {},
      },
      {
        id: 'template-1',
        name: 'codegen strategy',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = Array.isArray(ctx.bars) ? ctx.bars : []
    if (bars.length < 20) return { action: 'NOOP', reason: 'insufficient bars' }
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      confidence: 55,
      risk: { stopLoss: 120, takeProfit: 130 },
      reason: 'buy signal',
    }
  },
}
strategy`,
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', role: 'primary', symbol: 'BTCUSDT:SPOT', description: 'primary leg' }],
      { id: 'primary', role: 'primary', symbol: 'BTCUSDT:SPOT', description: 'primary leg' },
      config,
      { skipCooldown: true },
    )

    expect(loadMultiLegDataBatch).toHaveBeenCalled()
    expect(createMultiLegSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ code: 'BTCUSDT:SPOT' }),
      expect.objectContaining({ timeframe: '15m' }),
      expect.anything(),
      expect.objectContaining({
        direction: 'BUY',
        signalType: 'ENTRY',
        confidence: 55,
        stopLoss: 120,
        takeProfit: 130,
        positionSizeRatio: 0.1,
        reasoning: 'buy signal',
      }),
      expect.anything(),
      true,
    )
  })
})
