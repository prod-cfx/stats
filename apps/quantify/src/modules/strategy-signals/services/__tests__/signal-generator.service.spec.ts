import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
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
      ...overrides.generatorRepository,
    }
    const runtimeExecutionStateService = {
      buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue([]),
      loadExecutableStates: jest.fn().mockResolvedValue([]),
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
    jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue({
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 88,
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 110,
      rawResponse: '{"direction":"BUY"}',
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
    )
  })

  it('marks a ready on_start snapshot semantic as consumed after a published snapshot signal is created', async () => {
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
    const { service, generatorRepository, runtimeExecutionStateService, runtimeExecutionStateRepository } = createService({
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
    jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue({
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 88,
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 110,
      rawResponse: '{"direction":"BUY"}',
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
    expect(runtimeExecutionStateRepository.markConsumed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateRepository.markFailed).not.toHaveBeenCalled()
  })

  it('marks a ready on_start snapshot semantic as failed when no signal is generated', async () => {
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
    const { runtimeExecutionStateRepository, runtimeExecutionStateService, service } = createService({
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
    jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue(null)
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
    expect(runtimeExecutionStateRepository.markFailed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
    })
    expect(runtimeExecutionStateRepository.markConsumed).not.toHaveBeenCalled()
  })

  it('marks a ready on_start snapshot semantic as failed when the bound symbol cannot be loaded', async () => {
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
    const { generatorRepository, runtimeExecutionStateRepository, runtimeExecutionStateService, service } = createService({
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
    expect(runtimeExecutionStateRepository.markFailed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
    })
    expect(runtimeExecutionStateRepository.markConsumed).not.toHaveBeenCalled()
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
    const { runtimeExecutionStateRepository, runtimeExecutionStateService, service } = createService({
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
    jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue({
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 88,
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 110,
      rawResponse: '{"direction":"BUY"}',
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

    expect(runtimeExecutionStateRepository.markConsumed).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      publishedSnapshotId: 'snapshot-1',
      executionSemanticKey: 'on_start.entry.primary',
    })
    expect(runtimeExecutionStateRepository.markFailed).not.toHaveBeenCalled()
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
    const { runtimeExecutionStateRepository, runtimeExecutionStateService, service } = createService({
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
    expect(runtimeExecutionStateRepository.markConsumed).not.toHaveBeenCalled()
    expect(runtimeExecutionStateRepository.markFailed).not.toHaveBeenCalled()
  })
})
