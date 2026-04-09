import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'

describe('canonicalStrategyAstCompilerService', () => {
  it('compiles canonical IR into deterministic AST topology', () => {
    const compiler = new CanonicalStrategyAstCompilerService()

    const ir: CanonicalStrategyIrV1 = {
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

    const ast = compiler.compile(ir)

    expect(ast.topology.exprOrder).toEqual([
      'expr_01_close_1h',
      'expr_02_ema_7',
      'expr_03_ema_21',
      'expr_04_exit_cross',
      'expr_05_entry_cross',
    ])
    expect(ast.topology.guardOrder).toEqual(['guard_01_stop_loss_4'])
    expect(ast.topology.decisionOrder).toEqual([
      'decision_01_entry_long',
      'decision_02_exit_long',
    ])
    expect(ast.manifest.structuralDigest).toMatch(/^sha256:/)
    expect(ast.manifest.irHash).toMatch(/^sha256:/)
  })
})
