import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { SignalGeneratorService } from '../signal-generator.service'

describe('signalGeneratorService coordinator behavior', () => {
  const config: StrategySignalsRuntimeConfig = {
    enabled: true,
    cronExpression: '*/5 * * * *',
    cooldownMinutes: 15,
    batchSize: 2,
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

  function createService(overrides: Partial<any> = {}) {
    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})

    const generatorRepository = {
      findRunningInstances: jest.fn().mockResolvedValue([]),
      findSymbolByCode: jest.fn(),
      findSymbolByCodeForMarket: jest.fn(),
      findOpenPositionForRuntimeContext: jest.fn().mockResolvedValue(null),
      updateStrategyInstanceMetadata: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      ...overrides.generatorRepository,
    }
    const runtimeExecutionStateService = {
      buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue([]),
      loadExecutableStates: jest.fn().mockResolvedValue([]),
      markRunning: jest.fn().mockResolvedValue(undefined),
      markRetryableFailure: jest.fn().mockResolvedValue(undefined),
      markTerminalFailure: jest.fn().mockResolvedValue(undefined),
      markConsumed: jest.fn().mockResolvedValue(undefined),
      ...overrides.runtimeExecutionStateService,
    }
    const runtimeExecutionStateRepository = {
      markConsumed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      ...overrides.runtimeExecutionStateRepository,
    }

    const service = new SignalGeneratorService(
      generatorRepository as any,
      { get: jest.fn().mockReturnValue(config) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { chat: jest.fn() } as any,
      { create: jest.fn() } as any,
      { findByStrategyInstanceId: jest.fn(), reset: jest.fn(), incrementFailure: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      {
        getLatestBarBySymbolId: jest.fn(),
        getRecentBarsBySymbolId: jest.fn(),
      } as any,
      { isProd: jest.fn().mockReturnValue(false) } as any,
      { withTransaction: jest.fn() } as any,
      overrides.publishedSnapshotsRepository as any,
      runtimeExecutionStateService as any,
      runtimeExecutionStateRepository as any,
    )

    return {
      service,
      generatorRepository,
      runtimeExecutionStateService,
      runtimeExecutionStateRepository,
    }
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('skips a cron cycle when generation is already running', async () => {
    const { service } = createService()
    const generateSignals = jest
      .spyOn(service, 'generateSignals')
      .mockImplementation(async () => undefined)

    ;(service as any).isRunning = true

    await (service as any).runGenerationCycle()

    expect(generateSignals).not.toHaveBeenCalled()
  })

  it('processes only batch-sized instances and advances rotation', async () => {
    const instances = [
      { id: 'instance-1' },
      { id: 'instance-2' },
      { id: 'instance-3' },
    ]
    const { service, generatorRepository } = createService({
      generatorRepository: {
        findRunningInstances: jest.fn().mockResolvedValue(instances),
      },
    })
    const processStrategyInstance = jest
      .spyOn(service as any, 'processStrategyInstance')
      .mockResolvedValue(undefined)

    await service.generateSignals(config)

    expect(generatorRepository.findRunningInstances).toHaveBeenCalledTimes(1)
    expect(processStrategyInstance).toHaveBeenCalledTimes(2)
    expect(processStrategyInstance.mock.calls[0]?.[0]).toBe(instances[0])
    expect(processStrategyInstance.mock.calls[1]?.[0]).toBe(instances[1])
    expect((service as any).lastStrategyIndex).toBe(2)
  })

  it('uses the bound published snapshot script as the runtime execution source', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
      }),
    }
    const { service } = createService({ publishedSnapshotsRepository })

    const runtimeSource = await (service as any).resolveRuntimeStrategySource(
      {
        id: 'instance-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
      },
      {
        id: 'template-1',
        script: 'return "template-script"',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      },
    )

    expect(runtimeSource).toMatchObject({
      strategy: {
        script: 'return "snapshot-script"',
      },
      provenance: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        controlPlaneSource: 'STRATEGY_TEMPLATE',
      },
    })
    expect(publishedSnapshotsRepository.findById).toHaveBeenCalledWith('snapshot-1')
  })

  it('bypasses template indicator-group discovery for published snapshot runtime execution', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
        lockedParams: {},
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findRunningInstances: jest.fn().mockResolvedValue([]),
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
    })

    const findCandidateGroups = jest.spyOn(service as any, 'findCandidateGroups')
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({ close: 100, time: new Date(), timestamp: Date.now() })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 88,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    const createSignal = jest.spyOn(service as any, 'createSignalWithCooldownAndLock').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })
    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'CHANGED_TEMPLATE_SHOULD_NOT_MATTER',
          requiredFields: ['rsi'],
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(generatorRepository.findSymbolByCode).toHaveBeenCalledWith('BTCUSDT')
    expect(findCandidateGroups).not.toHaveBeenCalled()
    expect(createSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      expect.objectContaining({
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return "snapshot-script"',
      }),
      expect.objectContaining({
        symbol: expect.objectContaining({ code: 'BTCUSDT' }),
      }),
      expect.anything(),
      expect.anything(),
      expect.any(Date),
      expect.objectContaining({
        signalType: 'ENTRY',
        direction: 'BUY',
      }),
      expect.objectContaining({
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
      }),
      false,
      undefined,
      undefined,
    )
  })

  it('uses market-aware symbol lookup for perp published snapshot runtime execution', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        paramsSnapshot: { symbol: 'BTC-USDT-SWAP', timeframe: '15m', marketType: 'perp' },
        strategyConfig: { symbol: 'BTC-USDT-SWAP', baseTimeframe: '15m', marketType: 'perp' },
        lockedParams: {},
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-spot-1', code: 'BTCUSDT' }),
        findSymbolByCodeForMarket: jest.fn().mockResolvedValue({
          id: 'symbol-perp-1',
          code: 'BTCUSDT:PERP',
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
        }),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 88,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    const createSignal = jest.spyOn(service as any, 'createSignalWithCooldownAndLock').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(generatorRepository.findSymbolByCodeForMarket).toHaveBeenCalledWith('BTC-USDT-SWAP', 'perp')
    expect(generatorRepository.findSymbolByCode).not.toHaveBeenCalledWith('BTC-USDT-SWAP')
    expect(createSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      expect.anything(),
      expect.objectContaining({
        symbol: expect.objectContaining({
          id: 'symbol-perp-1',
          code: 'BTC-USDT-SWAP',
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
        }),
      }),
      expect.anything(),
      expect.anything(),
      expect.any(Date),
      expect.anything(),
      expect.objectContaining({
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        marketType: 'perp',
      }),
      false,
      undefined,
      undefined,
    )
  })

  it('fails published snapshot binding when runtime market type is invalid', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        paramsSnapshot: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'banana' },
        lockedParams: {},
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn(),
        findSymbolByCodeForMarket: jest.fn(),
      },
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(handleStrategyFailure).toHaveBeenCalledWith('instance-1', config)
    expect(generatorRepository.findSymbolByCode).not.toHaveBeenCalled()
    expect(generatorRepository.findSymbolByCodeForMarket).not.toHaveBeenCalled()
  })

  it('fails published snapshot binding when symbol conflicts with runtime market type', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        paramsSnapshot: { symbol: 'BTC-USDT-SWAP', timeframe: '15m', marketType: 'spot' },
        lockedParams: {},
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn(),
        findSymbolByCodeForMarket: jest.fn().mockImplementation(() => {
          throw new DomainException('market.symbol_unknown_suffix', {
            code: ErrorCode.MARKET_INVALID_SYMBOL,
            args: { symbol: 'BTC-USDT-SWAP' },
          })
        }),
      },
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)
    const loadLatestBar = jest.spyOn(service as any, 'loadLatestBar')
    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(generatorRepository.findSymbolByCodeForMarket).toHaveBeenCalledWith('BTC-USDT-SWAP', 'spot')
    expect(handleStrategyFailure).toHaveBeenCalledWith('instance-1', config)
    expect(loadLatestBar).not.toHaveBeenCalled()
  })

  it('passes perp market type into published runtime decision context from symbol instrument type', async () => {
    const { service } = createService()
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    jest.spyOn(service as any, 'buildCompiledRuntimeAdapter').mockReturnValue({
      adapter: {
        onBar: jest.fn().mockReturnValue({
          action: 'OPEN_SHORT',
          size: { mode: 'RATIO', value: 0.1 },
          reason: 'compiled.short',
        }),
      },
      parseError: null,
    })
    const buildOutcome = jest
      .spyOn((service as any).decisionStage, 'buildPublishedRuntimeSignalOutcomeFromDecision')
      .mockReturnValue({
        kind: 'noop',
        reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
        reason: 'test',
      })

    await (service as any).generatePublishedSnapshotRuntimeSignalOutcome(
      {
        id: 'instance-1',
        params: { marketType: 'perp' },
      },
      {
        id: 'template-1',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'compiled strategy script',
      },
      {
        id: 'symbol-perp-1',
        code: 'BTCUSDT:PERP',
        exchange: 'OKX',
        instrumentType: 'PERPETUAL',
      },
      '15m',
      config,
      100,
    )

    expect(buildOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPEN_SHORT',
      }),
      expect.objectContaining({
        exchange: 'OKX',
        marketType: 'perp',
        symbol: 'BTCUSDT:PERP',
        timeframe: '15m',
        referencePrice: 100,
      }),
      config,
    )
  })

  it('uses the previous closed 1m bar for bar-close published runtime evaluation', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-20T09:30:01.000Z'))
    const { service } = createService()
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([
      {
        open: 99,
        high: 100,
        low: 97,
        close: 98,
        volume: 10,
        timestamp: Date.parse('2026-04-20T09:28:00.000Z'),
      },
      {
        open: 98,
        high: 102,
        low: 97,
        close: 101,
        volume: 10,
        timestamp: Date.parse('2026-04-20T09:29:00.000Z'),
      },
      {
        open: 101,
        high: 101,
        low: 99,
        close: 100,
        volume: 10,
        timestamp: Date.parse('2026-04-20T09:30:00.000Z'),
      },
    ])
    const onBar = jest.fn().mockReturnValue({
      action: 'NOOP',
      reason: 'test.noop',
    })
    jest.spyOn(service as any, 'buildCompiledRuntimeAdapter').mockReturnValue({
      adapter: { onBar },
      parseError: null,
    })
    jest
      .spyOn((service as any).decisionStage, 'buildPublishedRuntimeSignalOutcomeFromDecision')
      .mockReturnValue({
        kind: 'noop',
        reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
        reason: 'test',
      })

    await (service as any).generatePublishedSnapshotRuntimeSignalOutcome(
      { id: 'instance-1', params: {} },
      {
        id: 'template-1',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'compiled strategy script',
      },
      {
        id: 'symbol-perp-1',
        code: 'BTCUSDT:PERP',
        exchange: 'OKX',
        instrumentType: 'PERPETUAL',
      },
      '1m',
      config,
      101,
    )

    const context = onBar.mock.calls[0]?.[0]
    expect(context.bars).toHaveLength(2)
    expect(context.bars.at(-1)).toMatchObject({
      close: 101,
      timestamp: Date.parse('2026-04-20T09:29:00.000Z'),
    })

    nowSpy.mockRestore()
  })

  it('uses effective params market type for multi-leg primary and batch symbol lookup', async () => {
    const { service, generatorRepository } = createService({
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-legacy-1', code: 'BTCUSDT' }),
        findSymbolByCodeForMarket: jest.fn().mockResolvedValue({
          id: 'symbol-spot-1',
          code: 'BTCUSDT:SPOT',
        }),
      },
    })
    const loadMultiLegDataBatch = jest.spyOn(service as any, 'loadMultiLegDataBatch').mockResolvedValue({
      primary: {
        '15m': {
          bars: [
            {
              open: 100,
              high: 105,
              low: 95,
              close: 102,
              volume: 10,
              timestamp: 1776675600000,
            },
          ],
          indicators: {},
          currentPrice: 102,
        },
      },
    })
    jest.spyOn((service as any).decisionStage, 'resolveMultiLegScriptPromptData').mockResolvedValue({
      ok: true,
      promptData: {},
    })
    jest.spyOn(service as any, 'buildPublishedCodegenSignalPayload').mockReturnValue({
      type: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 102,
        stopLoss: 90,
        takeProfit: 120,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)
    const createMultiLegSignal = jest.spyOn(service as any, 'createMultiLegSignal').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {
          marketType: 'spot',
        },
      },
      {
        id: 'template-1',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return {}',
        defaultParams: {
          marketType: 'perp',
        },
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { id: 'primary', symbol: 'BTCUSDT', role: 'primary' },
      config,
    )

    expect(generatorRepository.findSymbolByCodeForMarket).toHaveBeenCalledWith('BTCUSDT', 'spot')
    expect(generatorRepository.findSymbolByCode).not.toHaveBeenCalledWith('BTCUSDT')
    expect(loadMultiLegDataBatch).toHaveBeenCalledWith(
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { primary: ['15m'] },
      'spot',
    )
    expect(createMultiLegSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ id: 'symbol-spot-1', code: 'BTCUSDT:SPOT' }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ marketType: 'spot' }),
      false,
    )
  })

  it('preserves effective market type on multi-leg manual fallback signals', async () => {
    const { service } = createService({
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-legacy-1', code: 'BTCUSDT' }),
        findSymbolByCodeForMarket: jest.fn().mockResolvedValue({
          id: 'symbol-perp-1',
          code: 'BTCUSDT:PERP',
        }),
      },
    })
    jest.spyOn(service as any, 'loadMultiLegDataBatch').mockResolvedValue({
      primary: {
        '15m': {
          bars: [
            {
              open: 100,
              high: 105,
              low: 95,
              close: 102,
              volume: 10,
              timestamp: 1776675600000,
            },
          ],
          indicators: {},
          currentPrice: 102,
        },
      },
    })
    jest.spyOn((service as any).decisionStage, 'resolveMultiLegScriptPromptData').mockResolvedValue({
      ok: true,
      promptData: {},
    })
    jest.spyOn(service as any, 'buildPublishedCodegenSignalPayload').mockReturnValue(null)
    jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue(null)
    jest.spyOn(service as any, 'buildManualFallbackSignal').mockReturnValue({
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 50,
      entryPrice: 102,
      rawResponse: '{"direction":"BUY"}',
    })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)
    const createMultiLegSignal = jest.spyOn(service as any, 'createMultiLegSignal').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {
          marketType: 'perp',
        },
      },
      {
        id: 'template-1',
        name: 'fallback template',
        promptTemplate: 'Analyze market context',
        script: 'return {}',
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { id: 'primary', symbol: 'BTCUSDT', role: 'primary' },
      config,
      { skipCooldown: true },
    )

    expect(createMultiLegSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ id: 'symbol-perp-1' }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ marketType: 'perp' }),
      true,
    )
  })

  it('fails multi-leg generation when effective market type is invalid', async () => {
    const { service, generatorRepository } = createService({
      generatorRepository: {
        findSymbolByCode: jest.fn(),
        findSymbolByCodeForMarket: jest.fn(),
      },
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)
    const loadMultiLegDataBatch = jest.spyOn(service as any, 'loadMultiLegDataBatch')

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {
          marketType: 'banana',
        },
      },
      {
        id: 'template-1',
        promptTemplate: 'Analyze market context',
        script: 'return {}',
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { id: 'primary', symbol: 'BTCUSDT', role: 'primary' },
      config,
    )

    expect(handleStrategyFailure).toHaveBeenCalledWith('instance-1', config)
    expect(generatorRepository.findSymbolByCode).not.toHaveBeenCalled()
    expect(generatorRepository.findSymbolByCodeForMarket).not.toHaveBeenCalled()
    expect(loadMultiLegDataBatch).not.toHaveBeenCalled()
  })

  it('fails multi-leg generation when primary symbol conflicts with effective market type', async () => {
    const { service, generatorRepository } = createService({
      generatorRepository: {
        findSymbolByCode: jest.fn(),
        findSymbolByCodeForMarket: jest.fn().mockImplementation(() => {
          throw new DomainException('market.symbol_unknown_suffix', {
            code: ErrorCode.MARKET_INVALID_SYMBOL,
            args: { symbol: 'BTC-USDT-SWAP' },
          })
        }),
      },
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)
    const loadMultiLegDataBatch = jest.spyOn(service as any, 'loadMultiLegDataBatch')

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {
          marketType: 'spot',
        },
      },
      {
        id: 'template-1',
        promptTemplate: 'Analyze market context',
        script: 'return {}',
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', symbol: 'BTC-USDT-SWAP', role: 'primary' }],
      { id: 'primary', symbol: 'BTC-USDT-SWAP', role: 'primary' },
      config,
    )

    expect(generatorRepository.findSymbolByCodeForMarket).toHaveBeenCalledWith('BTC-USDT-SWAP', 'spot')
    expect(handleStrategyFailure).toHaveBeenCalledWith('instance-1', config)
    expect(loadMultiLegDataBatch).not.toHaveBeenCalled()
  })

  it('keeps legacy multi-leg symbol lookup when effective params omit market type', async () => {
    const { service, generatorRepository } = createService({
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-legacy-1', code: 'BTCUSDT' }),
        findSymbolByCodeForMarket: jest.fn().mockResolvedValue({
          id: 'symbol-perp-1',
          code: 'BTCUSDT:PERP',
        }),
      },
    })
    const loadMultiLegDataBatch = jest.spyOn(service as any, 'loadMultiLegDataBatch').mockResolvedValue({
      primary: {
        '15m': {
          bars: [
            {
              open: 100,
              high: 105,
              low: 95,
              close: 102,
              volume: 10,
              timestamp: 1776675600000,
            },
          ],
          indicators: {},
          currentPrice: 102,
        },
      },
    })
    jest.spyOn((service as any).decisionStage, 'resolveMultiLegScriptPromptData').mockResolvedValue({
      ok: true,
      promptData: {},
    })
    jest.spyOn(service as any, 'buildPublishedCodegenSignalPayload').mockReturnValue({
      type: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 102,
        stopLoss: 90,
        takeProfit: 120,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)
    const createMultiLegSignal = jest.spyOn(service as any, 'createMultiLegSignal').mockResolvedValue({
      created: true,
      signalId: 'signal-1',
    })

    await (service as any).generateSignalForMultiLegStrategy(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
      },
      {
        id: 'template-1',
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return {}',
        defaultParams: {},
      },
      { timeframe: '15m', cooldownMinutes: 15 },
      { primary: ['15m'] },
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { id: 'primary', symbol: 'BTCUSDT', role: 'primary' },
      config,
    )

    expect(generatorRepository.findSymbolByCode).toHaveBeenCalledWith('BTCUSDT')
    expect(generatorRepository.findSymbolByCodeForMarket).not.toHaveBeenCalled()
    expect(loadMultiLegDataBatch).toHaveBeenCalledWith(
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { primary: ['15m'] },
      null,
    )
    expect(createMultiLegSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ id: 'symbol-legacy-1', code: 'BTCUSDT' }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      false,
    )
  })

  it('marks a ready on_start snapshot semantic as running then consumed after a published snapshot signal is created', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { service, generatorRepository, runtimeExecutionStateService } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 88,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    jest.spyOn(service as any, 'createSignalWithCooldownAndLock').mockImplementation(
      async (
        _instance: unknown,
        _strategy: unknown,
        _group: unknown,
        _config: unknown,
        _indicatorValues: unknown,
        _latestIndicatorTime: unknown,
        _aiPayload: unknown,
        _runtimeProvenance: unknown,
        _skipCooldown: boolean,
        onCreatedInTransaction?: () => Promise<void>,
      ) => {
        await onCreatedInTransaction?.()
        return { created: true, signalId: 'signal-1' }
      },
    )
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.loadExecutableStates).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
    })
    expect(generatorRepository.findSymbolByCode).toHaveBeenCalledWith('BTCUSDT')
    expect(runtimeExecutionStateService.markRunning).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markConsumed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
  })

  it('loads persisted semantic state and injects open position into published snapshot runtime context', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          runtimeRequirements: {
            stateKeys: ['breakout'],
          },
        },
        paramsSnapshot: {
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTCUSDT:PERP',
          timeframe: '15m',
        },
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCodeForMarket: jest.fn().mockResolvedValue({
          id: 'symbol-1',
          code: 'BTCUSDT:PERP',
          instrumentType: 'PERPETUAL',
        }),
        findOpenPositionForRuntimeContext: jest.fn().mockResolvedValue({
          positionSide: 'LONG',
          quantity: '2',
          avgEntryPrice: '100',
        }),
        updateStrategyInstanceMetadata: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 103,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    const generatePublished = jest
      .spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome')
      .mockImplementation(async (...args: unknown[]) => {
        const semanticRuntimeState = args[7] as Record<string, Record<string, unknown>>
        semanticRuntimeState.breakout = {
          ...semanticRuntimeState.breakout,
          rememberedLevel: 102,
          confirmed: true,
        }
        return {
          kind: 'noop',
          reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
          reason: 'waiting',
        }
      })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          atomicContractRuntimeState: {
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
            semanticRuntimeState: {
              breakout: { rememberedLevel: 101 },
            },
          },
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(generatorRepository.findOpenPositionForRuntimeContext).toHaveBeenCalledWith({
      strategyId: 'template-1',
      strategyInstanceId: 'instance-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT:PERP',
    })
    expect(generatePublished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      '15m',
      expect.anything(),
      103,
      undefined,
      { breakout: { rememberedLevel: 102, confirmed: true } },
      { qty: 2, avgEntryPrice: 100, entryPrice: 100, positionSide: 'LONG' },
    )
    expect(generatorRepository.updateStrategyInstanceMetadata).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        atomicContractRuntimeState: expect.objectContaining({
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          semanticRuntimeState: {
            breakout: { rememberedLevel: 102, confirmed: true },
          },
        }),
      }),
    )
  })

  it('keeps published snapshot params locked over mutable instance params', () => {
    const { service } = createService()

    const effectiveParams = (service as any).decisionStage.buildEffectiveParams(
      {
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        defaultParams: {
          __publishedSnapshotLockedParams: true,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'perp',
          positionPct: 10,
          customThreshold: 35,
        },
      },
      {
        params: {
          symbol: 'ETHUSDT',
          timeframe: '15m',
          marketType: 'spot',
          positionPct: 99,
          customThreshold: 40,
          userRuntimeNote: 'kept',
        },
      },
    )

    expect(effectiveParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      marketType: 'perp',
      positionPct: 10,
      customThreshold: 35,
      userRuntimeNote: 'kept',
    })
  })

  it('does not persist mutated semantic state when published runtime returns an error outcome', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          runtimeRequirements: {
            stateKeys: ['breakout'],
          },
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { service, generatorRepository } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest
      .spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome')
      .mockImplementation(async (...args: unknown[]) => {
        const semanticRuntimeState = args[7] as Record<string, Record<string, unknown>>
        semanticRuntimeState.breakout = { rememberedLevel: 999 }
        return {
          kind: 'unexpected_error',
          reasonCode: 'SNAPSHOT_RUNTIME_SCRIPT_OUTPUT_INVALID',
          reason: 'invalid output',
        }
      })
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(generatorRepository.updateStrategyInstanceMetadata).not.toHaveBeenCalled()
  })

  it('creates a signal for a published snapshot runtime OPEN_LONG decision that only has required adapter truth', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(): StrategyDecisionV1 {
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }
  },
}
strategy`,
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    const createSignalWithCooldownAndLock = jest
      .spyOn(service as any, 'createSignalWithCooldownAndLock')
      .mockImplementation(
        async (
          _instance: unknown,
          _strategy: unknown,
          _group: unknown,
          _config: unknown,
          _indicatorValues: unknown,
          _latestIndicatorTime: unknown,
          _aiPayload: unknown,
          _runtimeProvenance: unknown,
          _skipCooldown: boolean,
          onCreatedInTransaction?: () => Promise<void>,
        ) => {
          await onCreatedInTransaction?.()
          return { created: true, signalId: 'signal-1' }
        },
      )
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(createSignalWithCooldownAndLock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      expect.objectContaining({
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
      }),
      expect.objectContaining({
        symbol: expect.objectContaining({ code: 'BTCUSDT' }),
      }),
      expect.anything(),
      {},
      expect.any(Date),
      expect.objectContaining({
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: 100,
        positionSizeRatio: 0.1,
        reasoning: 'compiled.entry',
      }),
      expect.objectContaining({
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
      }),
      false,
      expect.any(Function),
      expect.objectContaining({
        runtimePhase: 'consumed',
        cooldownConsumesRuntimeState: true,
      }),
    )
    expect(runtimeExecutionStateService.markConsumed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
  })

  it('records the adapter missing_required_truth reason code for a published snapshot runtime decision', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(): StrategyDecisionV1 {
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
    }
  },
}
strategy`,
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'RUNTIME_SIGNAL_REASONING_MISSING',
      failureCode: 'RUNTIME_SIGNAL_REASONING_MISSING',
    })
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
  })

  it('keeps NOOP published snapshot runtime decisions as terminal no-signal', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(): StrategyDecisionV1 {
    return {
      action: 'NOOP',
      reason: 'compiled.noop',
    }
  },
}
strategy`,
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
      failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
    })
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
  })

  it('records compile failures as explicit runtime execution failures instead of no-signal', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(): StrategyDecisionV1 {
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 'bad-size' },
      reason: 'compiled.entry',
    }
  },
}
strategy`,
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_SCRIPT_COMPILE_FAILED',
      failureCode: 'SNAPSHOT_RUNTIME_SCRIPT_COMPILE_FAILED',
    })
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
  })

  it('fails closed when a compiler.v1 snapshot cannot be parsed by the compiled runtime adapter', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: `/* @generated by compiler.v1 */\nconst definitelyBroken = true\n`,
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return \"template-script\"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_COMPILED_SCRIPT_INVALID',
      failureCode: 'SNAPSHOT_RUNTIME_COMPILED_SCRIPT_INVALID',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalledWith(
      expect.objectContaining({
        failureReason: 'SNAPSHOT_RUNTIME_SCRIPT_COMPILE_FAILED',
      }),
    )
  })

  it('executes compiler.v1 published snapshot scripts without routing them through TypeScript recompilation', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: createCompiledNoopScriptFixture(),
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
      isFinal: true,
    })
    jest.spyOn(service as any, 'loadRecentBars').mockResolvedValue([{
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 10,
      timestamp: 1_775_000_000_000,
      isFinal: true,
    }])
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
      failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalledWith(
      expect.objectContaining({
        failureReason: 'SNAPSHOT_RUNTIME_SCRIPT_COMPILE_FAILED',
        failureCode: 'SNAPSHOT_RUNTIME_SCRIPT_COMPILE_FAILED',
      }),
    )
  })

  it('applies compiler.v1 risk predicates on parsed published runtime adapter decisions', () => {
    const { service } = createService()
    const compiled = (service as any).buildCompiledRuntimeAdapter(createCompiledAtrRiskScriptFixture())

    expect(compiled.parseError).toBeUndefined()
    expect(compiled.adapter).not.toBeNull()

    const decision = compiled.adapter!.onBar({
      position: { qty: 1, avgEntryPrice: 100 },
      currentPrice: 75,
      bars: Array.from({ length: 16 }, (_, index) => ({
        time: index + 1,
        open: 100,
        high: 105,
        low: 95,
        close: index === 15 ? 75 : 100,
        volume: 10,
        timestamp: 1_775_000_000_000 + index * 60_000,
      })),
      __compiledDecisionState: { barIndex: 16, lastTriggeredByProgram: {} },
    } as any)
    const outcome = (service as any).decisionStage.buildPublishedRuntimeSignalOutcomeFromDecision(
      decision,
      {
        exchange: 'OKX',
        marketType: 'perp',
        symbol: 'BTCUSDT:PERP',
        timeframe: '15m',
        referencePrice: 75,
      },
      config,
    )

    expect(decision).toMatchObject({
      action: 'CLOSE_LONG',
      reason: 'compiled.force_exit',
      meta: expect.objectContaining({
        guardState: expect.objectContaining({
          forceExit: true,
          triggered: ['risk_predicate_01_atr-stop'],
        }),
      }),
    })
    expect(outcome).toMatchObject({
      kind: 'signal',
      payload: {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: 75,
      },
    })
  })

  it('marks a ready on_start snapshot semantic as terminal after runtime outcome resolves to noop', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'noop',
      reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
      reason: 'compiled.noop',
    })
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.loadExecutableStates).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
    })
    expect(runtimeExecutionStateService.markRunning).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
      failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
    })
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
  })

  it('treats noop from continuous compiled snapshots as no trigger instead of a runtime failure', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-continuous-1',
        snapshotHash: 'snapshot-hash-continuous-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          astVersion: 'csa.v1',
          decisionPrograms: [{
            id: 'decision_01_entry',
            sourceRef: 'entry-bollinger-touch_upper-210',
            phase: 'entry',
            when: 'expr_01_entry',
            actions: [{ kind: 'OPEN_SHORT' }],
          }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '1m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue([]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'noop',
      reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
      reason: 'compiled.noop',
    })
    const handleStrategyFailure = jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-continuous-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-continuous-1',
          snapshotHash: 'snapshot-hash-continuous-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.loadExecutableStates).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
    expect(handleStrategyFailure).not.toHaveBeenCalled()
  })

  it('marks a ready on_start snapshot semantic as terminal when the bound symbol cannot be loaded', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { generatorRepository, runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue(null),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'handleStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: { symbol: 'BTCUSDT', timeframe: '15m' },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return \"template-script\"',
        },
      },
      config,
    )

    expect(generatorRepository.findSymbolByCode).toHaveBeenCalledWith('BTCUSDT')
    expect(runtimeExecutionStateService.markRunning).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
    })
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
  })

  it('marks a ready on_start snapshot semantic as retryable when activation is missing the required reference bar', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T09:00:00.000Z'))

    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
          runtimeExecutionSemantics: [{
            semanticKey: 'on_start.entry.primary',
            trigger: 'on_start',
            phase: 'entry',
            consumePolicy: 'once',
            requiredRuntimeContext: {
              barIndex: 1,
              requiresReferenceBar: true,
              requiresSymbol: true,
              requiresTimeframe: true,
            },
            sourceRefs: ['entry-primary'],
          }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { generatorRepository, runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    const generateSignalWithAi = jest.spyOn(service as any, 'generateSignalWithAi')
    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue(null)

    try {
      await (service as any).processStrategyInstance(
        {
          id: 'instance-1',
          llmModel: 'gpt-5.4',
          params: { symbol: 'BTCUSDT', timeframe: '15m' },
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
          },
          strategyTemplate: {
            id: 'template-1',
            promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
            script: 'return "template-script"',
          },
        },
        config,
      )

      expect(generatorRepository.findSymbolByCode).toHaveBeenCalledWith('BTCUSDT')
      expect(generateSignalWithAi).not.toHaveBeenCalled()
      expect(runtimeExecutionStateService.markRunning).not.toHaveBeenCalled()
      expect(runtimeExecutionStateService.markRetryableFailure).toHaveBeenCalledWith({
        strategyInstanceId: 'instance-1',
        publishedSnapshotId: 'snapshot-1',
        executionSemanticKey: 'on_start.entry.primary',
        failureReason: 'SNAPSHOT_REFERENCE_BAR_MISSING',
        failureCode: 'SNAPSHOT_REFERENCE_BAR_MISSING',
        cooldownUntil: new Date('2026-04-20T09:15:00.000Z'),
      })
      expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
      expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('consumes a ready on_start snapshot semantic when cooldown prevents creating a duplicate signal', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'signal',
      payload: {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 88,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        rawResponse: '{"direction":"BUY"}',
      },
    })
    jest.spyOn(service as any, 'createSignalWithCooldownAndLock').mockResolvedValue({
      created: false,
      signalId: null,
    })
    jest.spyOn(service as any, 'resetStrategyFailure').mockResolvedValue(undefined)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: { symbol: 'BTCUSDT', timeframe: '15m' },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return \"template-script\"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markRunning).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markConsumed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
  })

  it('marks a running on_start snapshot semantic as terminal when runtime outcome reports an unexpected error', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      generatorRepository: {
        findSymbolByCode: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([{
          strategyInstanceId: 'instance-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }]),
      },
    })

    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)
    jest.spyOn(service as any, 'loadLatestBar').mockResolvedValue({
      close: 100,
      time: new Date('2026-04-20T09:00:00.000Z'),
      timestamp: Date.now(),
    })
    jest.spyOn(service as any, 'generatePublishedSnapshotRuntimeSignalOutcome').mockResolvedValue({
      kind: 'unexpected_error',
      reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_UNEXPECTED_ERROR',
      reason: 'ai crashed',
    })

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.markRunning).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateService.markTerminalFailure).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_RUNTIME_EXECUTION_UNEXPECTED_ERROR',
      failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_UNEXPECTED_ERROR',
    })
  })

  it('does not rerun a published snapshot when no ready on_start semantic remains', async () => {
    const publishedSnapshotsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'source-instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'return "snapshot-script"',
        astSnapshot: {
          decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
        },
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      }),
    }
    const { runtimeExecutionStateService, service } = createService({
      publishedSnapshotsRepository,
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
        loadExecutableStates: jest.fn().mockResolvedValue([]),
      },
    })

    const generateSignalWithAi = jest.spyOn(service as any, 'generateSignalWithAi')
    jest.spyOn(service as any, 'isStrategyLocked').mockResolvedValue(false)

    await (service as any).processStrategyInstance(
      {
        id: 'instance-1',
        llmModel: 'gpt-5.4',
        params: { symbol: 'BTCUSDT', timeframe: '15m' },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        strategyTemplate: {
          id: 'template-1',
          promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
          script: 'return "template-script"',
        },
      },
      config,
    )

    expect(runtimeExecutionStateService.loadExecutableStates).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
    })
    expect(generateSignalWithAi).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markConsumed).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.markRetryableFailure).not.toHaveBeenCalled()
  })
})

function createCompiledNoopScriptFixture(): string {
  const compiler = new CanonicalStrategyAstCompilerService()
  const emitter = new CompiledScriptEmitterService()
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'7'.repeat(64)}`,
      specHash: `sha256:${'8'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['15m'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 10 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 2,
      maxLookback: 2,
      requiredTimeframes: ['15m'],
    },
    signalCatalog: {
      series: [
        { id: 'close_15m', kind: 'PRICE', timeframe: '15m', field: 'close' },
      ],
      levelSets: [],
      predicates: [],
    },
    ruleBlocks: [],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }

  return emitter.emit({
    ast: compiler.compile(ir),
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })
}

function createCompiledAtrRiskScriptFixture(): string {
  const compiler = new CanonicalStrategyAstCompilerService()
  const emitter = new CompiledScriptEmitterService()
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'9'.repeat(64)}`,
      specHash: `sha256:${'a'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'BTCUSDT:PERP',
      timeframes: ['15m'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_short',
      sizing: { mode: 'pct_equity', value: 10 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 16,
      maxLookback: 16,
      requiredTimeframes: ['15m'],
    },
    runtimeRequirements: {
      helpers: ['atr'],
      stateKeys: [],
    },
    signalCatalog: {
      series: [
        { id: 'close_15m', kind: 'PRICE', timeframe: '15m', field: 'close' },
      ],
      levelSets: [],
      predicates: [],
    },
    ruleBlocks: [],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
      riskPredicates: [
        { id: 'atr-stop', kind: 'atrMultipleStop', params: { multiple: 2 } },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }

  return emitter.emit({
    ast: compiler.compile(ir),
    executionEnvelope: {
      positionMode: 'long_short',
      marginMode: 'isolated',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })
}

describe('signalGeneratorService live HTF alignment gate (#1017)', () => {
  function createBareService() {
    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})
    return new SignalGeneratorService(
      {} as any,
      { get: jest.fn().mockReturnValue({}) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { chat: jest.fn() } as any,
      { create: jest.fn() } as any,
      { findByStrategyInstanceId: jest.fn(), reset: jest.fn(), incrementFailure: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      {
        getLatestBarBySymbolId: jest.fn(),
        getRecentBarsBySymbolId: jest.fn(),
      } as any,
      { isProd: jest.fn().mockReturnValue(false) } as any,
      { withTransaction: jest.fn() } as any,
      undefined as any,
      undefined as any,
      undefined as any,
    )
  }

  // 1m timeframe -> 60_000 ms; 1h -> 3_600_000 ms
  const ONE_MIN = 60_000
  const ONE_HOUR = 60 * 60 * 1000

  const legs = [
    { id: 'primary', symbol: 'BTCUSDT', role: 'primary' as const },
  ]

  function makeBar(openTs: number) {
    return { timestamp: openTs, close: 1 }
  }

  afterEach(() => jest.restoreAllMocks())

  it('aligned=true 当 dataRequirements 中 leg 的 timeframes 为空（仅 base TF）时 gate 不生效', () => {
    const service = createBareService() as any
    const dataRequirements = { primary: ['1m'] as const }
    const multiLegData = {
      primary: { '1m': { bars: [makeBar(Date.now() - ONE_MIN)] } },
    }
    const result = service.evaluateLiveHtfGate(legs, dataRequirements, multiLegData, '1m', Date.now())
    expect(result).toEqual({ aligned: true, missingTimeframes: [] })
  })

  it('aligned=true 当所有 HTF 最新 bar closeTime ≤ currentTs', () => {
    const service = createBareService() as any
    const now = Date.now()
    const dataRequirements = { primary: ['1m', '1h'] }
    const multiLegData = {
      primary: {
        '1m': { bars: [makeBar(now - ONE_MIN)] },
        '1h': { bars: [makeBar(now - ONE_HOUR - 1000)] }, // closeTime = now - 1000
      },
    }
    const result = service.evaluateLiveHtfGate(legs, dataRequirements, multiLegData, '1m', now)
    expect(result.aligned).toBe(true)
    expect(result.missingTimeframes).toEqual([])
  })

  it('aligned=false 当 HTF 完全缺失（multiLegData 无该 timeframe）', () => {
    const service = createBareService() as any
    const now = Date.now()
    const dataRequirements = { primary: ['1m', '1h'] }
    const multiLegData = {
      primary: {
        '1m': { bars: [makeBar(now - ONE_MIN)] },
        // 1h 完全缺失
      },
    }
    const result = service.evaluateLiveHtfGate(legs, dataRequirements, multiLegData, '1m', now)
    expect(result.aligned).toBe(false)
    expect(result.missingTimeframes).toEqual(['primary:1h'])
  })

  it('aligned=false 当最新 HTF bar closeTime > currentTs（未来 bar）', () => {
    const service = createBareService() as any
    const now = Date.now()
    const dataRequirements = { primary: ['1m', '1h'] }
    const multiLegData = {
      primary: {
        '1m': { bars: [makeBar(now - ONE_MIN)] },
        '1h': { bars: [makeBar(now - 1000)] }, // closeTime = now + ONE_HOUR - 1000 > now
      },
    }
    const result = service.evaluateLiveHtfGate(legs, dataRequirements, multiLegData, '1m', now)
    expect(result.aligned).toBe(false)
    expect(result.missingTimeframes).toEqual(['primary:1h'])
  })

  it('aligned=false 多 HTF 部分缺失/未对齐时缺失列表全部列出', () => {
    const service = createBareService() as any
    const now = Date.now()
    const multiLegLegs = [
      { id: 'primary', symbol: 'BTCUSDT', role: 'primary' as const },
      { id: 'context', symbol: 'ETHUSDT', role: 'context' as const },
    ]
    const dataRequirements = {
      primary: ['1m', '1h'],
      context: ['1m', '1h'],
    }
    const multiLegData = {
      primary: {
        '1m': { bars: [makeBar(now - ONE_MIN)] },
        '1h': { bars: [makeBar(now - ONE_HOUR - 1000)] }, // 已对齐
      },
      context: {
        '1m': { bars: [makeBar(now - ONE_MIN)] },
        '1h': { bars: [] }, // 空 bars
      },
    }
    const result = service.evaluateLiveHtfGate(multiLegLegs, dataRequirements, multiLegData, '1m', now)
    expect(result.aligned).toBe(false)
    expect(result.missingTimeframes).toEqual(['context:1h'])
  })
})
