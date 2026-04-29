import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'

describe('canonicalStrategyAstCompilerService', () => {
  it('preserves order programs without expanding them into decision programs', () => {
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    const compiled = irCompiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTC-USDT-SWAP',
          marketType: 'perp',
          defaultTimeframe: '15m',
        },
        indicators: [],
        sizing: null,
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [],
        orderPrograms: [
          {
            id: 'contract-order-program-grid',
            kind: 'contract_order_program',
            mode: 'perp_neutral',
            levelSet: {
              lower: 60000,
              upper: 80000,
              gridCount: 100,
              spacingMode: 'arithmetic',
            },
            budget: {
              mode: 'per_order_quote',
              value: 20,
              asset: 'USDT',
            },
            orderType: 'limit',
            timeInForce: 'gtc',
            recycleOnFill: true,
            cancelOnStop: true,
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    const ast = astCompiler.compile(compiled.ir)

    expect(ast.orderPrograms).toHaveLength(1)
    expect(ast.orderPrograms[0].payload).toEqual(expect.objectContaining({
      kind: 'LIMIT_LADDER',
      recycleOnFill: true,
    }))
    expect(ast.decisionPrograms.flatMap(program => program.actions)).toEqual([])
  })

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
          cooldownBars: 5,
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
    expect(ast.decisionPrograms[0]).toEqual(expect.objectContaining({
      sourceRef: 'entry_long',
      cooldownBars: 5,
    }))
    expect(ast.manifest.structuralDigest).toMatch(/^sha256:/)
    expect(ast.manifest.irHash).toMatch(/^sha256:/)
  })

  it('keeps short-side bollinger middle revert as a short-only decision program', () => {
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    const compiled = irCompiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-short-middle',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'bollinger.middle_revert',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    const ast = astCompiler.compile(compiled.ir)

    expect(ast.exprPool).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceRef: 'exit_short_middle_middle_revert',
        nodeType: 'predicate',
        payload: expect.objectContaining({
          kind: 'OR',
        }),
      }),
    ]))
    expect(ast.decisionPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceRef: 'exit-short-middle',
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('keeps expr deps and decision when refs aligned with the emitted expr ids for execution and price-change strategies', () => {
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    const compiled = irCompiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'entry-on-start',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'execution.on_start',
              semanticScope: 'market',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-prev-close-rise',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.01,
              params: { timeframe: '1h', lookbackBars: 1, basis: 'prev_close' },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      } as any,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const ast = astCompiler.compile(compiled.ir)
    const exprIds = new Set(ast.exprPool.map(expr => expr.id))

    for (const expr of ast.exprPool) {
      expect(exprIds).toContain(expr.id)
      for (const dep of expr.deps) {
        expect(exprIds).toContain(dep)
      }
    }

    for (const program of ast.decisionPrograms) {
      expect(exprIds).toContain(program.when)
    }
  })
})
