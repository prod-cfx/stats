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

  it('persists runtime provenance into generated signal metadata', async () => {
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'signal-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      countRecentSignals: jest.fn().mockResolvedValue(0),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT' }, timeframe: 'm15' } as any,
      config,
      { rsi: 60 },
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 88,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        reasoning: 'snapshot signal',
        rawResponse: '{"action":"buy"}',
      } as any,
      {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        executionSemanticKey: 'on_start.entry.primary',
      },
      false,
    )

    expect(tradingSignalRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        generatorVersion: 'v1',
        runtimeProvenance: expect.objectContaining({
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
        }),
      }),
    }))
  })

  it('runs the runtime-state consume callback inside the signal creation transaction', async () => {
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'signal-atomic-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      countRecentSignals: jest.fn().mockResolvedValue(0),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const onCreatedInTransaction = jest.fn().mockResolvedValue(undefined)
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT' }, timeframe: 'm15' } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        reasoning: 'atomic state consume',
        rawResponse: '{"action":"buy"}',
      } as any,
      {},
      false,
      onCreatedInTransaction,
    )

    expect(onCreatedInTransaction).toHaveBeenCalledWith('signal-atomic-1')
  })

  it('does not apply cooldown checks to exit signals', async () => {
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'exit-signal-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      countRecentSignals: jest.fn().mockResolvedValue(1),
      findClosablePositionsForExitAdmission: jest.fn().mockResolvedValue([{ id: 'pos-1', positionSide: 'LONG', quantity: '0.01' }]),
      hasExitReconcileRisk: jest.fn().mockResolvedValue(false),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    const result = await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT:PERP', exchange: 'OKX', instrumentType: 'PERPETUAL' }, timeframe: 'm15' } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        confidence: 90,
        entryPrice: 100,
        reasoning: 'close long',
        rawResponse: '{"action":"close"}',
      } as any,
      {},
      false,
    )

    expect(result).toEqual({ created: true, signalId: 'exit-signal-1' })
    expect(generatorRepository.countRecentSignals).not.toHaveBeenCalled()
  })

  it('does not apply cooldown checks to multi-leg exit signals', async () => {
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'multi-exit-signal-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      findRecentSignalForCooldown: jest.fn().mockResolvedValue({ id: 'recent-exit-signal' }),
      findClosablePositionsForExitAdmission: jest.fn().mockResolvedValue([{ id: 'pos-1', positionSide: 'LONG', quantity: '0.01' }]),
      hasExitReconcileRisk: jest.fn().mockResolvedValue(false),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    const result = await stage.createMultiLegSignal(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { id: 'symbol-1', code: 'BTCUSDT:PERP', exchange: 'OKX', instrumentType: 'PERPETUAL' } as any,
      { timeframe: '1m', cooldownMinutes: 15 },
      {},
      {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        confidence: 90,
        entryPrice: 100,
        reasoning: 'close long',
        rawResponse: '{"action":"close"}',
      } as any,
      config,
      {},
      false,
    )

    expect(result).toEqual({ created: true, signalId: 'multi-exit-signal-1' })
    expect(generatorRepository.findRecentSignalForCooldown).not.toHaveBeenCalled()
  })

  it('blocks duplicate entry signal generation when an active subscribed account already has an open position', async () => {
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'entry-signal-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      findOpenPositionsForAdmission: jest.fn().mockResolvedValue([
        { positionSide: 'LONG', quantity: '0.0359' },
      ]),
      hasPendingReconcileRequiredEntryExecution: jest.fn().mockResolvedValue(false),
      countRecentSignals: jest.fn().mockResolvedValue(0),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    const result = await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      {
        symbol: {
          id: 'symbol-1',
          code: 'BTCUSDT:PERP',
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
        },
        timeframe: 'm1',
      } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 100,
        reasoning: 'duplicate long',
        rawResponse: '{"action":"buy"}',
      } as any,
      {
        marketType: 'perp',
        portfolio: {
          positionMode: 'long_only',
          maxConcurrentPositions: 1,
          allowPyramiding: false,
        },
      },
      false,
    )

    expect(result).toEqual({
      created: false,
      signalId: null,
      reason: 'ENTRY_BLOCKED_BY_MAX_CONCURRENT_POSITIONS',
      runtimeDisposition: 'consume',
    })
    expect(generatorRepository.findOpenPositionsForAdmission).toHaveBeenCalledWith({
      strategyId: 'strategy-1',
      strategyInstanceId: 'instance-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
    })
    expect(generatorRepository.countRecentSignals).not.toHaveBeenCalled()
    expect(tradingSignalRepository.create).not.toHaveBeenCalled()
  })

  it('records consumed runtime telemetry when cooldown prevents a duplicate published-snapshot signal', async () => {
    const telemetry = { recordGeneration: jest.fn() }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      countRecentSignals: jest.fn().mockResolvedValue(1),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      { create: jest.fn() } as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      telemetry as any,
      txHost as any,
    )

    const result = await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT' }, timeframe: 'm15' } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        reasoning: 'duplicate runtime consume',
        rawResponse: '{"action":"buy"}',
      } as any,
      {},
      false,
      undefined,
      {
        runtimePhase: 'consumed',
        cooldownConsumesRuntimeState: true,
      },
    )

    expect(result).toEqual({ created: false, signalId: null, reason: 'COOLDOWN', runtimeDisposition: 'consume' })
    expect(telemetry.recordGeneration).toHaveBeenCalledWith({
      strategyId: 'strategy-1',
      symbolCode: 'BTCUSDT',
      success: true,
      reason: 'COOLDOWN_CONSUMED',
      runtimePhase: 'consumed',
    })
  })

  it('does not let a different runtime semantic on the same instance and snapshot block the current semantic', async () => {
    const telemetry = { recordGeneration: jest.fn() }
    const tradingSignalRepository = {
      create: jest.fn().mockResolvedValue({ id: 'signal-instance-1' }),
    }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      countRecentSignals: jest.fn().mockImplementation(async (args: unknown) => {
        if (
          args
          && typeof args === 'object'
          && 'runtimeScope' in args
          && (args as {
            runtimeScope?: { strategyInstanceId?: string, publishedSnapshotId?: string, executionSemanticKey?: string }
          }).runtimeScope?.strategyInstanceId === 'instance-1'
          && (args as {
            runtimeScope?: { strategyInstanceId?: string, publishedSnapshotId?: string, executionSemanticKey?: string }
          }).runtimeScope?.publishedSnapshotId === 'snapshot-1'
          && (args as {
            runtimeScope?: { strategyInstanceId?: string, publishedSnapshotId?: string, executionSemanticKey?: string }
          }).runtimeScope?.executionSemanticKey === 'on_start.entry.secondary'
        ) {
          return 0
        }

        return 1
      }),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const onCreatedInTransaction = jest.fn().mockResolvedValue(undefined)
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      telemetry as any,
      txHost as any,
    )

    const result = await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT' }, timeframe: 'm15' } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 80,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        reasoning: 'instance scoped runtime cooldown',
        rawResponse: '{"action":"buy"}',
      } as any,
      {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        executionContentSource: 'PUBLISHED_SNAPSHOT',
        executionSemanticKey: 'on_start.entry.secondary',
      },
      false,
      onCreatedInTransaction,
      {
        runtimePhase: 'consumed',
        cooldownConsumesRuntimeState: true,
      },
    )

    expect(result).toEqual({ created: true, signalId: 'signal-instance-1' })
    expect(generatorRepository.countRecentSignals).toHaveBeenCalledWith(expect.objectContaining({
      strategyId: 'strategy-1',
      symbolId: 'symbol-1',
      runtimeScope: {
        strategyInstanceId: 'instance-1',
        publishedSnapshotId: 'snapshot-1',
        executionSemanticKey: 'on_start.entry.secondary',
      },
    }))
    expect(onCreatedInTransaction).toHaveBeenCalledWith('signal-instance-1')
    expect(telemetry.recordGeneration).toHaveBeenCalledWith({
      strategyId: 'strategy-1',
      symbolCode: 'BTCUSDT',
      success: true,
      runtimePhase: 'consumed',
    })
  })

  it('consumes runtime state without creating an exit signal when no active account has a closable position', async () => {
    const tradingSignalRepository = { create: jest.fn() }
    const eventEmitter = { emit: jest.fn() }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      findClosablePositionsForExitAdmission: jest.fn().mockResolvedValue([]),
      hasExitReconcileRisk: jest.fn().mockResolvedValue(false),
      countRecentSignals: jest.fn().mockResolvedValue(0),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      eventEmitter as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    const result = await stage.createSignalWithCooldownAndLock(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { symbol: { id: 'symbol-1', code: 'BTCUSDT:PERP', exchange: 'OKX', instrumentType: 'PERPETUAL' }, timeframe: 'm15' } as any,
      config,
      {},
      new Date('2026-04-10T10:00:00.000Z'),
      { signalType: 'EXIT', direction: 'CLOSE_LONG', entryPrice: 100, reasoning: 'close', rawResponse: '{}' } as any,
      { marketType: 'perp' },
      false,
    )

    expect(result).toEqual({
      created: false,
      signalId: null,
      reason: 'EXIT_NO_OPEN_POSITION_TO_CLOSE',
      runtimeDisposition: 'consume',
    })
    expect(generatorRepository.findClosablePositionsForExitAdmission).toHaveBeenCalledWith(expect.objectContaining({
      strategyId: 'strategy-1',
      strategyInstanceId: 'instance-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
    }))
    expect(tradingSignalRepository.create).not.toHaveBeenCalled()
    expect(eventEmitter.emit).not.toHaveBeenCalled()
  })

  it('keeps runtime execution retryable when exit admission sees reconcile risk', async () => {
    const tradingSignalRepository = { create: jest.fn() }
    const generatorRepository = {
      lockStrategyInstance: jest.fn().mockResolvedValue(undefined),
      findClosablePositionsForExitAdmission: jest.fn().mockResolvedValue([]),
      hasExitReconcileRisk: jest.fn().mockResolvedValue(true),
      countRecentSignals: jest.fn().mockResolvedValue(0),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }
    const stage = new SignalGenerationPersistenceStage(
      generatorRepository as any,
      tradingSignalRepository as any,
      { findByStrategyInstanceId: jest.fn(), incrementFailure: jest.fn(), reset: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { recordGeneration: jest.fn() } as any,
      txHost as any,
    )

    const result = await stage.createMultiLegSignal(
      { id: 'instance-1', llmModel: 'gpt-4o-mini' } as any,
      { id: 'strategy-1' } as any,
      { id: 'symbol-1', code: 'BTCUSDT:PERP', exchange: 'OKX', instrumentType: 'PERPETUAL' } as any,
      { timeframe: '15m', cooldownMinutes: 15 },
      {},
      { signalType: 'EXIT', direction: 'CLOSE_LONG', entryPrice: 100, reasoning: 'close', rawResponse: '{}' } as any,
      config,
      { marketType: 'perp' },
      false,
    )

    expect(result).toEqual({
      created: false,
      signalId: null,
      reason: 'EXIT_BLOCKED_RECONCILE_REQUIRED',
      runtimeDisposition: 'retry',
    })
    expect(tradingSignalRepository.create).not.toHaveBeenCalled()
  })

})
