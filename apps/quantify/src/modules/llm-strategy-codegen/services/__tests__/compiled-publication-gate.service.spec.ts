import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'

describe('CompiledPublicationGateService', () => {
  it('persists graph/ir/ast/script snapshots after parser self-check passes', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })
    const graphSnapshot = {
      version: 3,
      status: 'confirmed' as const,
      trigger: [
        { id: 'trigger-entry-1', phase: 'entry' as const, operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))' },
      ],
      actions: [
        { id: 'action-buy-1', action: 'BUY' as const, target: 'BTCUSDT', amount: '25%' },
      ],
      risk: ['stopLossPct: STOP_LOSS_PCT(4)'],
      meta: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 25,
        executionTags: [],
      },
    }

    const result = await gate.publish({
      sessionId: 'session-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      graphSnapshot,
      ir,
      ast,
      executionEnvelope,
      script,
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'ma-crossover' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(result.snapshotId).toBe('snapshot-1')
    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      specSnapshot: graphSnapshot,
      irSnapshot: expect.objectContaining({ irVersion: 'csi.v1' }),
      astSnapshot: expect.objectContaining({ astVersion: 'csa.v1' }),
      compiledManifest: expect.objectContaining({ compileVersion: 'compiler.v1' }),
      executionEnvelope: expect.objectContaining({ marginMode: 'cash' }),
    }))
  })
})

function createIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: 'sha256:11aa',
      specHash: 'sha256:11aa',
    },
    market: {
      venue: 'binance',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 25 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 21,
      maxLookback: 21,
      requiredTimeframes: ['1h'],
    },
    signalCatalog: {
      series: [
        { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
        { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
        { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
        { id: 'exit_cross', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_cross',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_cross',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [
        { id: 'stop_loss_4', kind: 'STOP_LOSS_PCT', scope: 'position', value: 4, onBreach: 'FORCE_EXIT' },
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
}
