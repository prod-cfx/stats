import type { CanonicalStrategyIrV1, OrderProgram, PredicateDef, SeriesDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import type { SemanticExpressionOperand, SemanticState } from '../../types/semantic-state'
import { evaluateExprPool, evaluateGuards, runDecisionPrograms, runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'

type EvaluateExprPoolContext = Parameters<typeof evaluateExprPool>[0]

function findSeries(
  series: CanonicalStrategyIrV1['signalCatalog']['series'],
  matcher: (item: SeriesDef) => boolean,
): SeriesDef {
  const found = series.find(matcher)
  expect(found).toBeDefined()
  return found as SeriesDef
}

function findPredicate(
  predicates: CanonicalStrategyIrV1['signalCatalog']['predicates'],
  matcher: (item: PredicateDef) => boolean,
): PredicateDef {
  const found = predicates.find(matcher)
  expect(found).toBeDefined()
  return found as PredicateDef
}

const invalidOffsetOrderProgramMissingOffset = {
  id: 'invalid-offset-order-program',
  kind: 'LIMIT_LADDER',
  activeWhen: 'always',
  side: 'buy',
  sidePolicy: 'spot_grid',
  priceSource: 'offset_from_price',
  tickPolicy: 'round',
  quantity: { mode: 'fixed_quote', value: 10 },
  orderType: 'limit',
  timeInForce: 'gtc',
  recycleOnFill: true,
  pairingPolicy: 'adjacent_level',
  cancelScope: 'program_orders',
  maxWorkingOrders: 1,
  group: 'invalid',
// @ts-expect-error offset-from-price order programs require offset.
} satisfies OrderProgram

void invalidOffsetOrderProgramMissingOffset

const invalidOffsetOrderProgramWithLevelSetRef = {
  id: 'invalid-offset-order-program',
  kind: 'LIMIT_LADDER',
  activeWhen: 'always',
  side: 'buy',
  sidePolicy: 'spot_grid',
  priceSource: 'offset_from_price',
  levelSetRef: 'levels',
  offset: {
    basis: 'pct',
    value: 1,
    anchorRef: 'close_1m',
  },
  tickPolicy: 'round',
  quantity: { mode: 'fixed_quote', value: 10 },
  orderType: 'limit',
  timeInForce: 'gtc',
  recycleOnFill: true,
  pairingPolicy: 'adjacent_level',
  cancelScope: 'program_orders',
  maxWorkingOrders: 1,
  group: 'invalid',
// @ts-expect-error offset-from-price order programs must not accept levelSetRef.
} satisfies OrderProgram

void invalidOffsetOrderProgramWithLevelSetRef

function createSizingCanonicalSpec(
  sizing: NonNullable<CanonicalStrategySpecV2['sizing']>,
): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing,
    executionPolicy: {
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'NEXT_BAR_OPEN',
    },
    dataRequirements: {
      requiredTimeframes: ['1m'],
    },
    rules: [
      {
        id: 'entry-close-above-open',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: {
          kind: 'expression',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'series', source: 'bar', field: 'open' },
        },
        actions: [{ type: 'OPEN_LONG', sizing }],
      },
    ],
  }
}

describe('canonicalSpecV2IrCompilerService', () => {
  it('compiles contract order program intents into level sets and order programs', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
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
    } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        hardBounds: expect.any(Object),
      }),
    ])
    expect(result.ir.orderPrograms).toEqual([
      expect.objectContaining({
        kind: 'LIMIT_LADDER',
        priceSource: 'level_set',
        levelSetRef: expect.any(String),
        orderType: 'limit',
        recycleOnFill: true,
      }),
    ])
    expect(result.ir.executionPolicy.orderTypeDefault).toBe('limit')
    expect(result.ir.executionPolicy.timeInForce).toBe('gtc')
    expect(result.ir.portfolio.maxConcurrentPositions).toBeGreaterThan(1)
    expect(result.ir.portfolio.allowPyramiding).toBe(true)

    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const exprPosition = new Map(ast.topology.exprOrder.map((exprId, index) => [exprId, index]))
    for (const expr of ast.exprPool) {
      const currentPosition = exprPosition.get(expr.id)
      for (const dep of expr.deps ?? []) {
        expect(exprPosition.get(dep)).toBeLessThan(currentPosition)
      }
    }
  })

  it('distinguishes normalized level-set shapes in downstream level-set refs', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const buildSpec = (absoluteSpacing: number): CanonicalStrategySpecV2 => ({
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
            gridIntervals: 10,
            gridCount: 11,
            absoluteSpacing,
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
    })

    const first = compiler.compile({
      canonicalSpec: buildSpec(2000),
      fallback: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', baseTimeframe: '15m', positionPct: 10 },
    })
    const second = compiler.compile({
      canonicalSpec: buildSpec(2500),
      fallback: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', baseTimeframe: '15m', positionPct: 10 },
    })

    expect(first.ir.orderPrograms[0]?.levelSetRef).toContain('absolute_2000')
    expect(second.ir.orderPrograms[0]?.levelSetRef).toContain('absolute_2500')
    expect(first.ir.orderPrograms[0]?.levelSetRef).not.toBe(second.ir.orderPrograms[0]?.levelSetRef)
  })

  it('derives fixed-range level count from absolute spacing when grid count is absent', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const canonicalSpec = {
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
            lower: 79200,
            upper: 80250,
            absoluteSpacing: 100,
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
    } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', baseTimeframe: '15m', positionPct: 10 },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual([
      expect.objectContaining({
        spacing: { mode: 'absolute', value: 100 },
        levelsPerSide: { down: 0, up: 10 },
      }),
    ])
    expect(result.ir.orderPrograms[0]).toEqual(expect.objectContaining({
      maxWorkingOrders: 11,
    }))
  })

  it('keeps contract order programs exclusive from legacy grid decision rules', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        marketType: 'perp',
        defaultTimeframe: '15m',
      },
      indicators: [],
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
          id: 'semantic-entry-grid-range-rebalance-long',
          phase: 'entry',
          sideScope: 'long',
          priority: 170,
          condition: {
            kind: 'atom',
            key: 'grid.range_rebalance',
            semanticScope: 'market',
            op: 'LTE',
            params: { rangeMin: 60000, rangeMax: 80000, stepPct: 0.5, levelCount: 58 },
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          metadata: {
            normalized: {
              source: 'normalized-intent',
              family: 'grid.range_rebalance',
            },
          },
        },
      ],
      orderPrograms: [
        {
          id: 'contract-order-program-grid',
          kind: 'contract_order_program',
          mode: 'perp_neutral',
          levelSet: {
            lower: 60000,
            upper: 80000,
            gridCount: 58,
            spacingPct: 0.5,
            spacingMode: 'arithmetic',
          },
          budget: {
            mode: 'per_order_pct_equity',
            value: 10,
          },
          orderType: 'limit',
          timeInForce: 'gtc',
          recycleOnFill: true,
          cancelOnStop: true,
        },
      ],
    } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.ruleBlocks).toEqual([])
    expect(result.ir.orderPrograms).toEqual([
      expect.objectContaining({
        kind: 'LIMIT_LADDER',
        quantity: { mode: 'pct_equity', value: 10 },
        sidePolicy: 'perp_neutral',
      }),
    ])
  })

  it('compiles centered-percent contract order programs into non-empty level-set order programs', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const canonicalSpec = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: null,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [],
      orderPrograms: [
        {
          id: 'contract-order-program-grid',
          kind: 'contract_order_program',
          mode: 'spot',
          levelSet: {
            mode: 'centered_percent_range',
            centerTiming: 'deployment',
            centerSource: 'last_price',
            halfRangePct: 0.4,
            gridCount: 10,
            spacingMode: 'arithmetic',
          },
          budget: {
            mode: 'per_order_quote',
            value: 10,
            asset: 'USDT',
          },
          orderType: 'limit',
          timeInForce: 'gtc',
          recycleOnFill: true,
          cancelOnStop: true,
        },
      ],
    } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        anchorRef: 'deployment_close_1m',
        spacing: { mode: 'pct', value: 0.08 },
        levelsPerSide: { down: 5, up: 5 },
      }),
    ])
    expect(result.ir.orderPrograms).toEqual([
      expect.objectContaining({
        kind: 'LIMIT_LADDER',
        activeWhen: expect.any(String),
        sidePolicy: 'spot_grid',
        priceSource: 'level_set',
        levelSetRef: expect.any(String),
        quantity: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
        maxWorkingOrders: 10,
      }),
    ])

    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const levelSetExpr = ast.exprPool.find(expr => expr.nodeType === 'level_set')
    const exprValues = evaluateExprPool(
      {
        bars: [{ open: 100, high: 101, low: 99, close: 100 }],
        baseTimeframeBar: { close: 100, open: 100, high: 101, low: 99 },
      } as any,
      ast.exprPool as any,
      ast.topology.exprOrder,
      ast.executionModel as any,
    )
    const evaluatedLevels = levelSetExpr ? exprValues[levelSetExpr.id] : null
    expect(evaluatedLevels).toEqual(expect.objectContaining({
      levels: expect.arrayContaining([
        expect.any(Number),
      ]),
    }))
    expect((evaluatedLevels as { levels: number[] }).levels).toHaveLength(11)
    expect(Math.min(...(evaluatedLevels as { levels: number[] }).levels)).toBeLessThan(100)
    expect(Math.max(...(evaluatedLevels as { levels: number[] }).levels)).toBeGreaterThan(100)

    const activeOrderState = runOrderPrograms(
      {
        bars: [{ open: 100, high: 101, low: 99, close: 100 }],
        baseTimeframeBar: { close: 100, open: 100, high: 101, low: 99 },
      } as any,
      ast.orderPrograms as any,
      exprValues,
      {
        strategyHalt: false,
        blockNewEntry: false,
        forceExit: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ast.topology.orderProgramOrder,
      ast.executionModel as any,
    )
    expect(activeOrderState.workingOrders).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: 'LIMIT_LADDER',
          levelSetRef: levelSetExpr?.id,
        }),
        levels: expect.arrayContaining([expect.any(Number)]),
      }),
    ])
    expect(activeOrderState.workingOrders[0]?.levels).toHaveLength(11)

    const breachedExprValues = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 100, low: 100, close: 100 },
          { open: 101, high: 101, low: 101, close: 101 },
        ],
        baseTimeframeBar: { close: 101, open: 101, high: 101, low: 101 },
      } as any,
      ast.exprPool as any,
      ast.topology.exprOrder,
      ast.executionModel as any,
    )
    const breachedOrderState = runOrderPrograms(
      {
        bars: [
          { open: 100, high: 100, low: 100, close: 100 },
          { open: 101, high: 101, low: 101, close: 101 },
        ],
        baseTimeframeBar: { close: 101, open: 101, high: 101, low: 101 },
      } as any,
      ast.orderPrograms as any,
      breachedExprValues,
      {
        strategyHalt: false,
        blockNewEntry: false,
        forceExit: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ast.topology.orderProgramOrder,
      ast.executionModel as any,
    )
    expect(breachedOrderState.workingOrders).toHaveLength(0)
    expect(breachedOrderState.cancelledProgramIds).toEqual(ast.topology.orderProgramOrder)
  })

  it.each([
    { gridCount: 9, levelsPerSide: { down: 4, up: 5 }, levelLength: 10, spacing: 0.08 },
    { gridCount: 2, levelsPerSide: { down: 1, up: 1 }, levelLength: 3, spacing: 0.4 },
  ])(
    'compiles centered-percent gridCount $gridCount as interval count',
    ({ gridCount, levelsPerSide, levelLength, spacing }) => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          marketType: 'spot',
          defaultTimeframe: '1m',
        },
        indicators: [],
        sizing: null,
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1m'],
        },
        rules: [],
        orderPrograms: [
          {
            id: 'contract-order-program-grid',
            kind: 'contract_order_program',
            mode: 'spot',
            levelSet: {
              mode: 'centered_percent_range',
              centerTiming: 'deployment',
              centerSource: 'last_price',
              halfRangePct: 0.4,
              gridCount,
              spacingMode: 'arithmetic',
            },
            budget: {
              mode: 'per_order_quote',
              value: 10,
              asset: 'USDT',
            },
            orderType: 'limit',
            timeInForce: 'gtc',
            recycleOnFill: true,
            cancelOnStop: true,
          },
        ],
      } satisfies CanonicalStrategySpecV2

      const result = compiler.compile({
        canonicalSpec,
        fallback: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '1m',
          positionPct: 10,
        },
      })

      expect(result.ir.signalCatalog.levelSets).toEqual([
        expect.objectContaining({
          spacing: { mode: 'pct', value: spacing },
          levelsPerSide,
        }),
      ])

      const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
      const levelSetExpr = ast.exprPool.find(expr => expr.nodeType === 'level_set')
      const ctx = {
        bars: [{ open: 100, high: 101, low: 99, close: 100, volume: 1, timestamp: 1 }],
        baseTimeframeBar: { close: 100, open: 100, high: 101, low: 99, volume: 1, timestamp: 1 },
      } satisfies EvaluateExprPoolContext
      const exprValues = evaluateExprPool(
        ctx,
        ast.exprPool as any,
        ast.topology.exprOrder,
        ast.executionModel as any,
      )
      const evaluatedLevels = levelSetExpr ? exprValues[levelSetExpr.id] : null
      expect((evaluatedLevels as { levels: number[] }).levels).toHaveLength(levelLength)
    },
  )

  it('derives centered-percent interval count from percent spacing when grid count is absent', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const canonicalSpec = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: null,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [],
      orderPrograms: [
        {
          id: 'contract-order-program-grid',
          kind: 'contract_order_program',
          mode: 'spot',
          levelSet: {
            mode: 'centered_percent_range',
            centerTiming: 'deployment',
            centerSource: 'last_price',
            halfRangePct: 0.4,
            spacingPct: 0.08,
            spacingMode: 'arithmetic',
          },
          budget: {
            mode: 'per_order_quote',
            value: 10,
            asset: 'USDT',
          },
          orderType: 'limit',
          timeInForce: 'gtc',
          recycleOnFill: true,
          cancelOnStop: true,
        },
      ],
    } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual([
      expect.objectContaining({
        spacing: { mode: 'pct', value: 0.08 },
        levelsPerSide: { down: 5, up: 5 },
      }),
    ])

    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const levelSetExpr = ast.exprPool.find(expr => expr.nodeType === 'level_set')
    const exprValues = evaluateExprPool(
      {
        bars: [{ open: 100, high: 101, low: 99, close: 100, volume: 1, timestamp: 1 }],
        baseTimeframeBar: { close: 100, open: 100, high: 101, low: 99, volume: 1, timestamp: 1 },
      },
      ast.exprPool as any,
      ast.topology.exprOrder,
      ast.executionModel as any,
    )
    const evaluatedLevels = levelSetExpr ? exprValues[levelSetExpr.id] : null

    expect((evaluatedLevels as { levels: number[] }).levels).toHaveLength(11)
  })

  it.each([
    [
      { mode: 'QUOTE', value: 10 },
      { mode: 'fixed_quote', value: 10 },
      '10 USDT',
    ],
    [
      { mode: 'QUOTE', value: 10, asset: 'USDC' },
      { mode: 'fixed_quote', value: 10, asset: 'USDC' },
      '10 USDC',
    ],
    [
      { mode: 'QTY', value: 0.001 },
      { mode: 'fixed_base', value: 0.001 },
      '0.001 BTC',
    ],
    [
      { mode: 'QTY', value: 0.001, asset: 'ETH' },
      { mode: 'fixed_base', value: 0.001, asset: 'ETH' },
      '0.001 ETH',
    ],
  ] satisfies Array<[
    NonNullable<CanonicalStrategySpecV2['sizing']>,
    CanonicalStrategyIrV1['portfolio']['sizing'],
    string,
  ]>)(
    'maps canonical sizing %o into IR portfolio sizing %o',
    (canonicalSizing, irSizing, graphAmount) => {
      const compiler = new CanonicalSpecV2IrCompilerService()

      const result = compiler.compile({
        canonicalSpec: createSizingCanonicalSpec(canonicalSizing),
        fallback: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          positionPct: 10,
        },
      })

      expect(result.ir.portfolio.sizing).toEqual(irSizing)
      expect(result.graphSnapshot.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: graphAmount }),
      ]))
      expect(result.graphSnapshot.meta.positionSizing).toBe(graphAmount)
    },
  )

  it('compiles generic close-open expressions', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '1m',
        },
        indicators: [],
        sizing: { mode: 'QUOTE', value: 10 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1m'],
        },
        rules: [
          {
            id: 'entry-close-above-open',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'exit-close-below-open',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'expression',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'close_1m', kind: 'PRICE', field: 'close', timeframe: '1m' }),
      expect.objectContaining({ id: 'open_1m', kind: 'PRICE', field: 'open', timeframe: '1m' }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'GT', args: ['close_1m', 'open_1m'] }),
      expect.objectContaining({ kind: 'LT', args: ['close_1m', 'open_1m'] }),
    ]))
    expect(result.ir.portfolio.sizing).toEqual({ mode: 'fixed_quote', value: 10 })
  })

  it('compiles semantic expression indicator-vs-constant predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '5m',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['5m'],
        },
        rules: [
          {
            id: 'entry-rsi-gte',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'GTE',
              left: { kind: 'indicator', name: 'rsi', params: { period: 14 } },
              right: { kind: 'constant', value: 55 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '5m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rsi_14_5m', kind: 'RSI', params: { period: 14 } }),
      expect.objectContaining({ id: 'const_55', kind: 'CONST', value: 55 }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'GTE', args: ['rsi_14_5m', 'const_55'] }),
    ]))
  })

  it('compiles MACD expression operand params without relying on spec indicator defaults', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '5m',
        },
        indicators: [{ kind: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['5m'],
        },
        rules: [
          {
            id: 'entry-macd-gte',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'GTE',
              left: {
                kind: 'indicator',
                name: 'macd',
                output: 'line',
                params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 },
              },
              right: { kind: 'constant', value: 0 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '5m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'macd_line_16_34_12_5m',
        kind: 'MACD_LINE',
        params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 },
      }),
    ]))
    expect(result.ir.signalCatalog.series).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'macd_line_12_26_9_5m' }),
    ]))
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ operator: 'GTE(MACD_LINE(CLOSE,16,34,12),0)' }),
    ]))
  })

  it('rejects semantic expression has_position operands with a specific error', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '1m',
        },
        indicators: [],
        sizing: { mode: 'QUOTE', value: 10 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1m'],
        },
        rules: [
          {
            id: 'entry-has-position',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    expect(() => compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })).toThrow('codegen.semantic_expression_operand_unsupported:position:has_position')
  })

  it('rejects semantic expression boolean constants with a specific error', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '1m',
        },
        indicators: [],
        sizing: { mode: 'QUOTE', value: 10 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1m'],
        },
        rules: [
          {
            id: 'entry-boolean-constant',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'EQ',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'constant', value: true },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    expect(() => compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })).toThrow('codegen.semantic_expression_operand_unsupported:constant:boolean')
  })

  it('rejects unsupported semantic expression operands with a specific error', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const unsupportedOperand = { kind: 'wallet', field: 'balance' } as unknown as SemanticExpressionOperand
    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '1m',
        },
        indicators: [],
        sizing: { mode: 'QUOTE', value: 10 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1m'],
        },
        rules: [
          {
            id: 'entry-unsupported',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'expression',
              op: 'GT',
              left: unsupportedOperand,
              right: { kind: 'constant', value: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    expect(() => compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })).toThrow('codegen.semantic_expression_operand_unsupported:wallet')
  })

  it('compiles moving-average fastPeriod and slowPeriod without falling back to defaults', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'sma', params: { fastPeriod: 6, slowPeriod: 48 } }],
        sizing: { mode: 'RATIO', value: 0.35 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-ma-cross',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: { kind: 'atom', key: 'ma.golden_cross', semanticScope: 'market', op: 'CROSS_OVER' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.35 } }],
          },
          {
            id: 'exit-ma-cross',
            phase: 'exit',
            sideScope: 'long',
            priority: 140,
            condition: { kind: 'atom', key: 'ma.death_cross', semanticScope: 'market', op: 'CROSS_UNDER' },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 35,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sma_6_15m', params: { period: 6 } }),
      expect.objectContaining({ id: 'sma_48_15m', params: { period: 48 } }),
    ]))
    expect(result.ir.signalCatalog.series).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ema_7_15m' }),
      expect.objectContaining({ id: 'ema_21_15m' }),
    ]))
  })

  it('compiles MACD 16/34/12 cross rules without falling back to defaults', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'macd', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }],
        sizing: { mode: 'RATIO', value: 0.35 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-macd-cross',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: { kind: 'atom', key: 'macd.golden_cross', semanticScope: 'market', op: 'CROSS_OVER' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.35 } }],
          },
          {
            id: 'exit-macd-cross',
            phase: 'exit',
            sideScope: 'long',
            priority: 140,
            condition: { kind: 'atom', key: 'macd.death_cross', semanticScope: 'market', op: 'CROSS_UNDER' },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 35,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'macd_line_16_34_12_15m', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }),
      expect.objectContaining({ id: 'macd_signal_16_34_12_15m', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }),
    ]))
    expect(result.ir.signalCatalog.series).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'macd_line_12_26_9_15m' }),
      expect.objectContaining({ id: 'macd_signal_12_26_9_15m' }),
    ]))
  })

  it('compiles canonical spec v2 into deterministic graphSnapshot and IR without reading UI state', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'ema', params: { fast: 7, slow: 21 } }],
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
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-long',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.graphSnapshot.status).toBe('confirmed')
    expect(result.ir.irVersion).toBe('csi.v1')
    expect(result.ir.source.specHash).toMatch(/^sha256:/)
    expect(result.semanticView).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.ir.source.specHash,
    }))
  })

  it('preserves short_only positionMode when canonical spec only trades the short side', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'ema', params: { fast: 7, slow: 21 } }],
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
            id: 'exit-short',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.portfolio.positionMode).toBe('short_only')
  })

  it('compiles multi-timeframe canonical specs into ordered IR market timeframes', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '3m',
        },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['3m', '15m'],
        },
        rules: [
          {
            id: 'entry-price-change-1',
            phase: 'entry',
            priority: 100,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'LTE',
              value: -0.01,
              params: { timeframe: '3m', lookbackBars: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'exit-price-change-1',
            phase: 'exit',
            priority: 90,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'position_gain_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.02,
              params: { timeframe: '15m', basis: 'entry_avg_price' },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '3m',
        positionPct: 10,
      },
    })

    expect(result.ir.market.timeframes).toEqual(['3m', '15m'])
  })

  it('compiles per-trigger timeframe indicator compare atoms into timeframe-specific MA predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          defaultTimeframe: '15m',
          timeframes: ['15m', '1h', '4h'],
        },
        indicators: [{ kind: 'ema', params: { period: 20 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m', '1h', '4h'],
        },
        rules: ['15m', '1h', '4h'].map((timeframe, index) => ({
          id: `entry-ema-above-${timeframe}`,
          phase: 'entry',
          priority: 100 - index,
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.above',
            semanticScope: 'market',
            op: 'GTE',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': 20,
              timeframe,
            },
          },
          actions: [{ type: 'OPEN_LONG' }],
        })),
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.market.timeframes).toEqual(['15m', '1h', '4h'])
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'close_15m', kind: 'PRICE', timeframe: '15m' }),
      expect.objectContaining({ id: 'ema_20_15m', kind: 'EMA', timeframe: '15m' }),
      expect.objectContaining({ id: 'close_1h', kind: 'PRICE', timeframe: '1h' }),
      expect.objectContaining({ id: 'ema_20_1h', kind: 'EMA', timeframe: '1h' }),
      expect.objectContaining({ id: 'close_4h', kind: 'PRICE', timeframe: '4h' }),
      expect.objectContaining({ id: 'ema_20_4h', kind: 'EMA', timeframe: '4h' }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'GTE', args: ['close_15m', 'ema_20_15m'] }),
      expect.objectContaining({ kind: 'GTE', args: ['close_1h', 'ema_20_1h'] }),
      expect.objectContaining({ kind: 'GTE', args: ['close_4h', 'ema_20_4h'] }),
    ]))
  })

  it('emits one entry decision for semantic multi-timeframe confirmation strategies', () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      contextSlots: {
        exchange: {
          slotKey: 'context.exchange',
          fieldPath: 'exchange',
          value: 'binance',
          status: 'locked',
          priority: 'context',
          questionHint: '交易所',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'context.symbol',
          fieldPath: 'symbol',
          value: 'BTCUSDT',
          status: 'locked',
          priority: 'context',
          questionHint: '交易标的',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'context.marketType',
          fieldPath: 'marketType',
          value: 'perp',
          status: 'locked',
          priority: 'context',
          questionHint: '市场类型',
          affectsExecution: true,
        },
        timeframe: {
          slotKey: 'context.timeframe',
          fieldPath: 'timeframe',
          value: '15m',
          status: 'locked',
          priority: 'context',
          questionHint: 'K 线周期',
          affectsExecution: true,
        },
      },
      position: null,
      triggers: [
        ...['5m', '1h', '4h'].map((timeframe, index) => ({
          id: `entry-ema-${index}`,
          key: 'indicator.above',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          params: {
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 20,
            timeframe,
          },
        })),
        {
          id: 'exit-ema-15m',
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 20,
            timeframe: '15m',
          },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [{
        id: 'stop-loss-3',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 3, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      normalizationNotes: [],
      updatedAt: '2026-05-06T00:00:00.000Z',
    }

    const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
    const result = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: {
        positionMode: 'long_only',
        marginMode: 'cross',
        tickSize: 0.01,
        pricePrecision: 2,
        quantityPrecision: 6,
        fillAssumption: 'strict',
      },
    })
    const entryBlocks = result.ir.ruleBlocks.filter(block => block.phase === 'entry')
    const entryPredicate = result.ir.signalCatalog.predicates.find(predicate => predicate.id === entryBlocks[0]?.when)

    expect(entryBlocks).toHaveLength(1)
    expect(entryPredicate).toEqual(expect.objectContaining({
      kind: 'allOf',
      args: expect.any(Array),
    }))
    expect(entryPredicate?.args).toHaveLength(3)
    expect(ast.decisionPrograms.filter(program => program.phase === 'entry')).toHaveLength(1)
    expect(script.match(/"kind":"OPEN_LONG"/g)).toHaveLength(1)
    expect(script).not.toContain('"asset":"MIN"')
    expect(result.ir.dataRequirements.requiredTimeframes).toEqual(expect.arrayContaining(['15m', '5m', '1h', '4h']))
  })

  it('normalizes position_gain_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
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
            id: 'entry-position-gain',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'position_gain_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
              params: { timeframe: '1h', basis: 'entry_avg_price' },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'POSITION_PNL_PCT' && series.timeframe === '1h')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 10)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT', timeframe: '1h' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 10 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'GTE(POSITION_PNL_PCT,10)',
      }),
    ]))
  })

  it('normalizes risk.take_profit_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
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
            id: 'entry-take-profit',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series => series.kind === 'POSITION_PNL_PCT')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 10)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 10 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'GTE(POSITION_PNL_PCT,10)',
      }),
    ]))
  })

  it('normalizes position_loss_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
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
            id: 'entry-stop-loss',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series => series.kind === 'POSITION_PNL_PCT')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === -5)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'LTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: -5 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'LTE(POSITION_PNL_PCT,-5)',
      }),
    ]))
  })

  it('keeps price.change_pct thresholds in ratio units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
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
            id: 'entry-price-change',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.01,
              params: { timeframe: '1h', lookbackBars: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const priceChangeSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'PRICE_CHANGE_PCT' && series.timeframe === '1h')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 0.01)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(priceChangeSeries.id) && item.args.includes(thresholdSeries.id))

    expect(priceChangeSeries).toEqual(expect.objectContaining({ kind: 'PRICE_CHANGE_PCT', timeframe: '1h' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 0.01 }))
    expect(predicate.args).toEqual([priceChangeSeries.id, thresholdSeries.id])
  })

  it('compiles generic execution-on-start entry rules into deterministic runtime predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'ORDIUSDT',
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
            priority: 200,
            sideScope: 'long',
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
            priority: 100,
            sideScope: 'long',
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
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'ORDIUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'BAR_INDEX' }),
      expect.objectContaining({ kind: 'PRICE_CHANGE_PCT', timeframe: '1h' }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-on-start',
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_LONG' })],
      }),
    ]))
  })

  it('compiles bollinger outside-band reduce rule with okx perp market metadata', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
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
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
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

    expect(result.ir.market).toEqual(expect.objectContaining({
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'BTCUSDT',
      timeframes: ['15m'],
    }))
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'BOLLINGER_BARS_OUTSIDE',
        params: expect.objectContaining({ bars: 3 }),
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'REDUCE_LONG' }),
          expect.objectContaining({ kind: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('keeps middle-close, stop-loss, and outside-band full close as distinct compiled triggers', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
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
            id: 'exit-middle-1',
            phase: 'exit',
            sideScope: 'both',
            priority: 140,
            condition: {
              kind: 'atom',
              key: 'bollinger.middle_revert',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
          },
          {
            id: 'risk-stop-loss',
            phase: 'risk',
            sideScope: 'both',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
          {
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'FORCE_EXIT' }],
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

    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', value: 5 }),
    ]))
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'BOLLINGER_BARS_OUTSIDE',
        params: expect.objectContaining({ bars: 3 }),
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'CLOSE_LONG' }),
          expect.objectContaining({ kind: 'CLOSE_SHORT' }),
        ]),
      }),
    ]))
    expect(result.ir.ruleBlocks.filter(block => block.phase === 'exit')).toHaveLength(2)
  })

  it('compiles short-side bollinger middle revert without broad OR flattening', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
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

    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'CROSS_UNDER',
        args: ['close_15m', 'mid_band_20_2_15m'],
      }),
      expect.objectContaining({
        kind: 'OR',
        args: ['exit_short_middle_middle_over', 'exit_short_middle_middle_under'],
      }),
    ]))
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        operator: 'OR(CROSS_OVER(CLOSE,MID_BAND(CLOSE,20,2)),CROSS_UNDER(CLOSE,MID_BAND(CLOSE,20,2)))',
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'exit-short-middle',
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('compiles touch-confirmed Bollinger outer bands as comparisons without making middle reverts unconditional', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
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
            id: 'entry-touch-upper',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'bollinger.upper_break',
              semanticScope: 'market',
              op: 'GTE',
              params: { confirmationMode: 'touch' },
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-touch-middle',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'bollinger.middle_revert',
              semanticScope: 'market',
              params: { confirmationMode: 'touch' },
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

    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        operator: 'GTE(CLOSE,UPPER_BAND(CLOSE,20,2))',
      }),
      expect.objectContaining({
        phase: 'exit',
        operator: 'OR(CROSS_OVER(CLOSE,MID_BAND(CLOSE,20,2)),CROSS_UNDER(CLOSE,MID_BAND(CLOSE,20,2)))',
      }),
    ]))
    expect(result.graphSnapshot.trigger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        operator: 'OR(GTE(CLOSE,MID_BAND(CLOSE,20,2)),LTE(CLOSE,MID_BAND(CLOSE,20,2)))',
      }),
    ]))
  })

  it('compiles RSI threshold rules into RSI series and graph operators', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
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
            id: 'entry-rsi-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'rsi.threshold_lte',
              semanticScope: 'market',
              op: 'LTE',
              value: 30,
              params: { period: 14 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'RSI',
        params: expect.objectContaining({ period: 14 }),
      }),
    ]))
    expect(result.graphSnapshot.trigger[0]?.operator).toContain('RSI(CLOSE,14)')
  })

  it('compiles MACD cross rules into MACD line and signal series', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }],
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
            id: 'entry-macd-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'macd.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'MACD_LINE',
        params: expect.objectContaining({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      }),
      expect.objectContaining({
        kind: 'MACD_SIGNAL',
        params: expect.objectContaining({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      }),
    ]))
    expect(result.graphSnapshot.trigger[0]?.operator).toContain('MACD_LINE')
  })

  it('compiles grid rules into arithmetic level sets and touch predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { family: 'grid' } }],
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
            id: 'entry-grid',
            phase: 'entry',
            sideScope: 'long',
            priority: 170,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'LTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-grid',
            phase: 'exit',
            sideScope: 'long',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'GTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        spacing: expect.objectContaining({ mode: 'pct', value: 1 }),
      }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TOUCH_LEVEL_DOWN' }),
      expect.objectContaining({ kind: 'TOUCH_LEVEL_UP' }),
    ]))
  })

  it('compiles rolling range-position rules into dynamic channel predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { atom: 'price.range_position' } }],
        sizing: { mode: 'RATIO', value: 0.25 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-range-low-zone',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'price.range_position_lte',
              semanticScope: 'market',
              op: 'LTE',
              value: 0.2,
              params: { period: 36 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'exit-range-upper-zone',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'price.range_position_gte',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.55,
              params: { period: 36 },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 25,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HIGHEST_HIGH', params: expect.objectContaining({ period: 36 }) }),
      expect.objectContaining({ kind: 'LOWEST_LOW', params: expect.objectContaining({ period: 36 }) }),
      expect.objectContaining({
        kind: 'RANGE_POSITION_PCT',
        params: expect.objectContaining({ period: 36 }),
      }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'LTE' }),
      expect.objectContaining({ kind: 'GTE' }),
    ]))
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ operator: 'LTE(RANGE_POSITION_PCT(CLOSE,HIGHEST_HIGH(36),LOWEST_LOW(36)),0.2)' }),
      expect.objectContaining({ operator: 'GTE(RANGE_POSITION_PCT(CLOSE,HIGHEST_HIGH(36),LOWEST_LOW(36)),0.55)' }),
    ]))
  })

  it('compiles short-grid rules into short entry/exit actions and short_only position mode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { family: 'grid' } }],
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
            id: 'entry-grid-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 170,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'GTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-grid-short',
            phase: 'exit',
            sideScope: 'short',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'LTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.portfolio.positionMode).toBe('short_only')
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('compiles state-gated canonical rules into deterministic IR predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
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
            id: 'entry-gated-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'AND',
              children: [
                {
                  kind: 'atom',
                  key: 'bollinger.upper_break',
                  semanticScope: 'market',
                  op: 'CROSS_OVER',
                },
                {
                  kind: 'atom',
                  key: 'market.regime',
                  semanticScope: 'market',
                  op: 'EQ',
                  value: 'range',
                },
              ],
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
            metadata: {
              normalized: {
                source: 'normalized-intent',
                triggerKeys: ['bollinger.touch_upper'],
                gateKeys: ['market.regime'],
                actionKeys: ['OPEN_SHORT'],
                family: 'single-leg',
              },
            },
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'MARKET_REGIME' }),
      expect.objectContaining({ kind: 'CONST', value: 'range' }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'EQ' }),
      expect.objectContaining({ kind: 'AND' }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
      }),
    ]))
  })

  it('compiles no-position gate into executable MAX_POSITION runtime guard', () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg', 'state-gated'],
      triggers: [
        {
          id: 'entry-close-gt-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'gate-no-position',
          key: 'condition.expression',
          phase: 'gate',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-28T00:00:00.000Z',
    }
    const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
    const result = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: {
        positionMode: 'long_only',
        marginMode: 'cross',
        tickSize: 0.01,
        pricePrecision: 2,
        quantityPrecision: 6,
        fillAssumption: 'strict',
      },
    })

    expect(canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'gate',
        actions: [expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' })],
      }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'MAX_POSITION_PCT',
        value: 0,
        onBreach: 'BLOCK_NEW_ENTRY',
      }),
    ]))
    expect(ast.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: 'MAX_POSITION_PCT',
          value: 0,
          onBreach: 'BLOCK_NEW_ENTRY',
        }),
      }),
    ]))
    expect(script).toContain('"MAX_POSITION_PCT"')
    expect(script).toContain('"BLOCK_NEW_ENTRY"')

    const entryProgram = ast.decisionPrograms.find(program => program.phase === 'entry')
    expect(entryProgram).toBeDefined()
    const occupiedCtx = {
      position: { qty: 1, avgEntryPrice: 100 },
      currentPrice: 101,
      baseTimeframeBar: { close: 101 },
    }
    const occupiedGuardState = evaluateGuards(
      occupiedCtx as any,
      ast.guards as any,
      {},
      ast.topology.guardOrder,
    )
    const occupiedDecision = runDecisionPrograms(
      occupiedCtx as any,
      ast.decisionPrograms as any,
      { [entryProgram!.when]: true },
      occupiedGuardState,
      ast.topology.decisionOrder,
    )

    expect(occupiedGuardState.blockNewEntry).toBe(true)
    expect(occupiedDecision).toEqual(expect.objectContaining({
      action: 'NOOP',
      reason: 'compiled.noop',
    }))

    const flatCtx = {
      position: { qty: 0 },
      currentPrice: 101,
      baseTimeframeBar: { close: 101 },
    }
    const flatGuardState = evaluateGuards(
      flatCtx as any,
      ast.guards as any,
      {},
      ast.topology.guardOrder,
    )
    const flatDecision = runDecisionPrograms(
      flatCtx as any,
      ast.decisionPrograms as any,
      { [entryProgram!.when]: true },
      flatGuardState,
      ast.topology.decisionOrder,
    )

    expect(flatGuardState.blockNewEntry).toBe(false)
    expect(flatDecision).toEqual(expect.objectContaining({
      action: 'OPEN_LONG',
    }))
  })

  it('compiles breakout and risk guards into deterministic IR', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'custom', params: { family: 'breakout' } }],
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
            id: 'entry-breakout-high',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            cooldownBars: 5,
            condition: {
              kind: 'atom',
              key: 'breakout.channel_high_break',
              semanticScope: 'market',
              op: 'CROSS_OVER',
              params: { period: 20 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'risk-take-profit',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
          {
            id: 'risk-trailing-stop',
            phase: 'risk',
            sideScope: 'both',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.trailing_stop_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
          {
            id: 'exit-time-stop',
            phase: 'exit',
            sideScope: 'long',
            priority: 90,
            condition: {
              kind: 'atom',
              key: 'risk.time_stop_bars',
              semanticScope: 'position',
              op: 'GTE',
              value: 12,
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HIGHEST_HIGH', params: expect.objectContaining({ period: 20 }) }),
      expect.objectContaining({ kind: 'POSITION_BARS_HELD' }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TAKE_PROFIT_PCT', value: 5 }),
      expect.objectContaining({ kind: 'TRAILING_STOP_PCT', value: 10 }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry', cooldownBars: 5 }),
      expect.objectContaining({ phase: 'exit' }),
    ]))
  })

  it('compiles strategy pause risk expressions into halt guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const canonicalSpec: CanonicalStrategySpecV2 = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'entry',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
        {
          id: 'semantic-daily-loss-halt',
          phase: 'risk',
          sideScope: 'both',
          priority: 120,
          condition: {
            kind: 'AND',
            children: [
              {
                kind: 'expression',
                op: 'LTE',
                left: { kind: 'position', field: 'pnl_pct' },
                right: { kind: 'constant', value: -5, unit: 'percent' },
              },
              {
                kind: 'expression',
                op: 'GT',
                left: { kind: 'series', source: 'bar', field: 'close' },
                right: { kind: 'series', source: 'bar', field: 'open' },
              },
            ],
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      ],
    }

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const haltGuard = ast.guards.find(guard => guard.sourceRef === 'guard_semantic-daily-loss-halt')
    expect(haltGuard?.payload.predicateRef).toMatch(/^expr_/)
    const exprValues = evaluateExprPool(
      {
        position: { qty: 1, avgEntryPrice: 100 },
        currentPrice: 94,
        bars: [{ open: 90, high: 95, low: 89, close: 94 }],
        baseTimeframeBar: { close: 94, open: 90 },
      } as any,
      ast.exprPool as any,
      ast.topology.exprOrder,
      ast.executionModel as any,
    )
    const guardState = evaluateGuards(
      {
        position: { qty: 1, avgEntryPrice: 100 },
        currentPrice: 94,
        baseTimeframeBar: { close: 94, open: 90 },
      } as any,
      ast.guards as any,
      exprValues,
      ast.topology.guardOrder,
    )
    const entryProgram = ast.decisionPrograms.find(program => program.phase === 'entry')
    const decision = runDecisionPrograms(
      {
        position: { qty: 1, avgEntryPrice: 100 },
        currentPrice: 94,
        baseTimeframeBar: { close: 94, open: 90 },
      } as any,
      ast.decisionPrograms as any,
      { [entryProgram!.when]: true },
      guardState,
      ast.topology.decisionOrder,
    )

    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'EXPRESSION_GUARD',
        scope: 'strategy',
        onBreach: 'HALT_STRATEGY',
        predicateRef: result.ir.riskPolicy.guards.find(guard => guard.id === 'guard_semantic-daily-loss-halt')?.predicateRef,
      }),
    ]))
    expect(guardState.strategyHalt).toBe(true)
    expect(decision).toEqual(expect.objectContaining({
      action: 'NOOP',
      reason: 'compiled.strategy_halt',
    }))
  })

  it('compiles close-position risk expressions into sign-aware force-exit guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const canonicalSpec: CanonicalStrategySpecV2 = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'semantic-single-loss',
          phase: 'risk',
          sideScope: 'both',
          priority: 120,
          condition: {
            kind: 'expression',
            op: 'LTE',
            left: { kind: 'position', field: 'pnl_pct' },
            right: { kind: 'constant', value: -3, unit: 'percent' },
          },
          actions: [{ type: 'FORCE_EXIT' }],
        },
      ],
    }

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(result.ir)
    const forceExitIrGuard = result.ir.riskPolicy.guards.find(guard => guard.id === 'guard_semantic-single-loss')
    const forceExitAstGuard = ast.guards.find(guard => guard.sourceRef === 'guard_semantic-single-loss')
    expect(forceExitIrGuard).toEqual(expect.objectContaining({
      kind: 'EXPRESSION_GUARD',
      scope: 'position',
      onBreach: 'FORCE_EXIT',
    }))
    expect(forceExitAstGuard?.payload.predicateRef).toMatch(/^expr_/)
    const exprValues = evaluateExprPool(
      {
        position: { qty: -1, avgEntryPrice: 100 },
        currentPrice: 104,
        baseTimeframeBar: { close: 104 },
      } as any,
      ast.exprPool as any,
      ast.topology.exprOrder,
      ast.executionModel as any,
    )

    const guardState = evaluateGuards(
      {
        position: { qty: -1, avgEntryPrice: 100 },
        currentPrice: 104,
        baseTimeframeBar: { close: 104 },
      } as any,
      ast.guards as any,
      exprValues,
      ast.topology.guardOrder,
    )
    const decision = runDecisionPrograms(
      {
        position: { qty: -1, avgEntryPrice: 100 },
        currentPrice: 104,
        baseTimeframeBar: { close: 104 },
      } as any,
      ast.decisionPrograms as any,
      {},
      guardState,
      ast.topology.decisionOrder,
    )

    expect(guardState.forceExit).toBe(true)
    expect(decision).toEqual(expect.objectContaining({
      action: 'CLOSE_SHORT',
      reason: 'compiled.force_exit',
    }))

    const longOnlyGuardState = evaluateGuards(
      {
        position: { qty: -1, avgEntryPrice: 100 },
        currentPrice: 104,
        baseTimeframeBar: { close: 104 },
      } as any,
      [{
        ...forceExitAstGuard,
        payload: {
          ...forceExitAstGuard?.payload,
          appliesTo: 'long',
        },
      }] as any,
      exprValues,
      [forceExitAstGuard?.id],
    )
    expect(longOnlyGuardState.forceExit).toBe(false)
  })

  it('compiles short breakout and short-side trade management into deterministic IR', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '1h',
        },
        indicators: [{ kind: 'custom', params: { family: 'breakout' } }],
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
            id: 'entry-breakout-low',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            cooldownBars: 5,
            condition: {
              kind: 'atom',
              key: 'breakout.channel_low_break',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
              params: { period: 20 },
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'risk-take-profit-short',
            phase: 'risk',
            sideScope: 'short',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
          {
            id: 'risk-trailing-stop-short',
            phase: 'risk',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.trailing_stop_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.portfolio.positionMode).toBe('short_only')
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TRAILING_STOP_PCT', value: 10 }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        cooldownBars: 5,
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('normalizes flat risk side scope before emitting IR guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
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
            id: 'risk-flat-stop-loss',
            phase: 'risk',
            sideScope: 'flat',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'STOP_LOSS_PCT',
        appliesTo: 'both',
      }),
    ]))
  })

  it('compiles partial take-profit into rebalance reduce actions instead of a force-exit guard', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
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
            id: 'risk-partial-take-profit',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.riskPolicy.guards.some(guard => guard.kind === 'TAKE_PROFIT_PCT')).toBe(false)
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'REDUCE_LONG' }),
          expect.objectContaining({ kind: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('compiles partial take-profit ratio into position_pct reduce quantity', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
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
            id: 'risk-partial-take-profit-ratio',
            phase: 'risk',
            sideScope: 'long',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'REDUCE_LONG', sizing: { mode: 'RATIO', value: 0.3 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: [expect.objectContaining({
          kind: 'REDUCE_LONG',
          quantity: { mode: 'position_pct', value: 30 },
        })],
      }),
    ]))
  })
})

function makePhase1GateSpec(condition: CanonicalStrategySpecV2['rules'][number]['condition']): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing: { mode: 'RATIO', value: 0.1 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['1m'] },
    rules: [
      {
        id: 'entry-close-above-open',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: {
          kind: 'expression',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'series', source: 'bar', field: 'open' },
        },
        actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
      },
      {
        id: 'gate-phase1-atom',
        phase: 'gate',
        sideScope: 'both',
        priority: 100,
        condition,
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      },
    ],
  }
}

describe('canonicalSpecV2IrCompilerService phase-1 gate atoms', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  it.each([
    ['GT', 'LTE'],
    ['GTE', 'LT'],
    ['LT', 'GTE'],
    ['LTE', 'GT'],
  ] as const)('compiles volume.threshold %s into flipped %s expression guard', (userOp, predicateKind) => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = makePhase1GateSpec({
      kind: 'atom',
      key: 'volume.threshold',
      semanticScope: 'market',
      op: userOp,
      value: 100,
      params: { metric: 'base_volume' },
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'VOLUME' }),
      expect.objectContaining({ kind: 'CONST', value: 100 }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: predicateKind }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'EXPRESSION_GUARD',
        scope: 'strategy',
        appliesTo: 'both',
        onBreach: 'BLOCK_NEW_ENTRY',
      }),
    ]))
  })

  it('compiles volatility.atr_threshold into ATR series + flipped guard predicate', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = makePhase1GateSpec({
      kind: 'atom',
      key: 'volatility.atr_threshold',
      semanticScope: 'market',
      op: 'GT',
      value: 1,
      params: { period: 14, thresholdUnit: 'percent_of_close' },
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'ATR', params: expect.objectContaining({ period: 14 }) }),
      expect.objectContaining({ kind: 'CONST', value: 1 }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'LTE' }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'EXPRESSION_GUARD',
        scope: 'strategy',
        appliesTo: 'both',
        onBreach: 'BLOCK_NEW_ENTRY',
      }),
    ]))
    expect(result.ir.runtimeRequirements.helpers).toEqual(expect.arrayContaining(['atr']))
  })

  it('compiles strategy.time_window into IN_TIME_WINDOW series + EQ const(0) predicate', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const windows = [{ start: '09:30', end: '15:00' }]
    const spec = makePhase1GateSpec({
      kind: 'atom',
      key: 'strategy.time_window',
      semanticScope: 'market',
      op: 'EQ',
      value: 1,
      params: { timezone: 'Asia/Shanghai', windows: JSON.stringify(windows) },
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'IN_TIME_WINDOW',
        timezone: 'Asia/Shanghai',
        windows,
      }),
      expect.objectContaining({ kind: 'CONST', value: 0 }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'EQ' }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'EXPRESSION_GUARD',
        scope: 'strategy',
        appliesTo: 'both',
        onBreach: 'BLOCK_NEW_ENTRY',
      }),
    ]))
    expect(result.ir.runtimeRequirements.helpers).toEqual(expect.arrayContaining(['timezone_clock']))
  })

  it('keeps no_position gate compiled to MAX_POSITION_PCT (regression)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = makePhase1GateSpec({
      kind: 'atom',
      key: 'position.has_position',
      semanticScope: 'position',
      op: 'EQ',
      value: false,
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'MAX_POSITION_PCT',
        value: 0,
        onBreach: 'BLOCK_NEW_ENTRY',
      }),
    ]))
  })

  it('does not produce expression guards for specs without phase-1 gate atoms', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = createSizingCanonicalSpec({ mode: 'RATIO', value: 0.1 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.riskPolicy.guards.filter(guard => guard.kind === 'EXPRESSION_GUARD')).toEqual([])
  })

  describe('partial take profit ir compile', () => {
    const ptpFallback = {
      exchange: 'binance' as const,
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      positionPct: 10,
    }

    function makePartialTakeProfitState(input: {
      memoryKey: string
      tiers: Array<{ threshold: number, reduceRatio: number }>
      sideScope?: 'long' | 'short' | 'both'
    }): SemanticState {
      const params: Record<string, unknown> = {
        memoryKey: input.memoryKey,
        tiers: input.tiers.map(tier => ({
          trigger: { kind: 'pnl_pct', threshold: tier.threshold },
          reduceRatio: tier.reduceRatio,
        })),
      }
      if (input.sideScope) {
        params.sideScope = input.sideScope
      }
      return {
        version: 1,
        families: ['single-leg'],
        contextSlots: {
          exchange: {
            slotKey: 'context.exchange',
            fieldPath: 'exchange',
            value: 'binance',
            status: 'locked',
            priority: 'context',
            questionHint: '',
            affectsExecution: true,
          },
          symbol: {
            slotKey: 'context.symbol',
            fieldPath: 'symbol',
            value: 'BTCUSDT',
            status: 'locked',
            priority: 'context',
            questionHint: '',
            affectsExecution: true,
          },
          marketType: {
            slotKey: 'context.marketType',
            fieldPath: 'marketType',
            value: 'perp',
            status: 'locked',
            priority: 'context',
            questionHint: '',
            affectsExecution: true,
          },
          timeframe: {
            slotKey: 'context.timeframe',
            fieldPath: 'timeframe',
            value: '15m',
            status: 'locked',
            priority: 'context',
            questionHint: '',
            affectsExecution: true,
          },
        },
        position: null,
        triggers: [
          {
            id: 'entry-on-start',
            key: 'execution.on_start',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            status: 'locked' as const,
            source: 'user_explicit' as const,
            openSlots: [],
            params: {},
          },
        ],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        ],
        risk: [
          {
            id: 'partial-take-profit',
            key: 'risk.partial_take_profit',
            params,
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        normalizationNotes: [],
        updatedAt: '2026-05-07T00:00:00.000Z',
      }
    }

    it('compiles N risk rules into N exit rule blocks with POSITION_PNL_PCT predicates', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()
      const state = makePartialTakeProfitState({
        memoryKey: 'partial_tp_test',
        tiers: [
          { threshold: 5, reduceRatio: 0.5 },
          { threshold: 10, reduceRatio: 0.5 },
        ],
        sideScope: 'long',
      })
      const canonicalSpec = builder.buildFromSemanticState(state)
      const result = compiler.compile({ canonicalSpec, fallback: ptpFallback })

      const ptpBlocks = result.ir.ruleBlocks.filter(block => block.metadata?.partialTakeProfit !== undefined)
      expect(ptpBlocks).toHaveLength(2)
      expect(result.ir.runtimeRequirements.stateKeys).toEqual(expect.arrayContaining(['partial_tp_test']))

      expect(ptpBlocks[0]).toMatchObject({
        phase: 'exit',
        metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 0, totalTiers: 2, cumulativeReduceRatio: 0.5 } },
      })
      expect(ptpBlocks[0].actions).toEqual([
        { kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 50 } },
      ])
      expect(ptpBlocks[1]).toMatchObject({
        phase: 'exit',
        metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 1, totalTiers: 2, cumulativeReduceRatio: 1 } },
      })
      expect(ptpBlocks[1].actions).toEqual([
        { kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 100 } },
      ])

      const tier0Predicate = findPredicate(result.ir.signalCatalog.predicates, p => p.id === ptpBlocks[0].when)
      expect(tier0Predicate.kind).toBe('GTE')
      const pnlSeries = findSeries(result.ir.signalCatalog.series, s => s.id === tier0Predicate.args[0])
      expect(pnlSeries.kind).toBe('POSITION_PNL_PCT')
      const constSeriesTier0 = findSeries(result.ir.signalCatalog.series, s => s.id === tier0Predicate.args[1])
      expect(constSeriesTier0).toMatchObject({ kind: 'CONST', value: 5 })

      const tier1Predicate = findPredicate(result.ir.signalCatalog.predicates, p => p.id === ptpBlocks[1].when)
      expect(tier1Predicate.kind).toBe('GTE')
      const constSeriesTier1 = findSeries(result.ir.signalCatalog.series, s => s.id === tier1Predicate.args[1])
      expect(constSeriesTier1).toMatchObject({ kind: 'CONST', value: 10 })

      // No leak into riskPolicy.guards for partial_take_profit
      expect(result.ir.riskPolicy.guards.some(guard => guard.id.includes('ptp'))).toBe(false)
    })

    it('emits REDUCE_SHORT only when sideScope=short', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()
      const state = makePartialTakeProfitState({
        memoryKey: 'partial_tp_short',
        tiers: [{ threshold: 5, reduceRatio: 0.5 }],
        sideScope: 'short',
      })
      const canonicalSpec = builder.buildFromSemanticState(state)
      const result = compiler.compile({ canonicalSpec, fallback: ptpFallback })

      const ptpBlocks = result.ir.ruleBlocks.filter(block => block.metadata?.partialTakeProfit !== undefined)
      expect(ptpBlocks).toHaveLength(1)
      expect(ptpBlocks[0].actions).toEqual([
        { kind: 'REDUCE_SHORT', quantity: { mode: 'position_pct', value: 50 } },
      ])
    })

    it('does not affect ir for specs without partial_take_profit (regression byte-equal)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = createSizingCanonicalSpec({ mode: 'RATIO', value: 0.1 })
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      expect(result.ir.ruleBlocks.some(block => block.metadata?.partialTakeProfit !== undefined)).toBe(false)
    })
  })
})

describe('canonicalSpecV2IrCompilerService orchestration gates', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 10 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'entry-close-above-open',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  it('compiles a single regime gate into IR.orchestrationGates with non-empty exprId', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-regime-1',
          target: { phase: 'entry', sideScope: 'long' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const gates = result.ir.orchestrationGates ?? []
    expect(gates).toHaveLength(1)
    expect(typeof gates[0].exprId).toBe('string')
    expect(gates[0].exprId.length).toBeGreaterThan(0)
    expect(gates[0].id).toBe('gate-regime-1')
    expect(gates[0].target).toEqual({ phase: 'entry', sideScope: 'long' })
    expect(gates[0].effectWhenFalse).toBe('block_new_entries')
    expect(result.ir.signalCatalog.predicates.some(p => p.id === gates[0].exprId)).toBe(true)
  })

  it('dedupes the predicate when a trigger and a gate share the same expression', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const sharedActiveWhen = {
      kind: 'expression' as const,
      op: 'GT' as const,
      left: { kind: 'series' as const, source: 'bar' as const, field: 'close' as const },
      right: { kind: 'indicator' as const, name: 'ema' as const, params: { period: 50 } },
    }

    const spec: CanonicalStrategySpecV2 = {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 10 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'trigger-close-above-ema-50',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: sharedActiveWhen,
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
      orchestration: {
        gates: [
          {
            id: 'gate-regime-share',
            target: { phase: 'entry' },
            activeWhen: sharedActiveWhen,
            effectWhenFalse: 'block_new_entries',
          },
        ],
      },
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const gates = result.ir.orchestrationGates ?? []
    expect(gates).toHaveLength(1)
    const triggerPredicateId = result.ir.ruleBlocks[0].when
    expect(gates[0].exprId).toBe(triggerPredicateId)
    const sharedPredicates = result.ir.signalCatalog.predicates.filter(p => p.id === gates[0].exprId)
    expect(sharedPredicates).toHaveLength(1)
  })

  it('produces distinct exprIds for two distinct gate expressions', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-ema-50',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
        {
          id: 'gate-ema-200',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 200 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const gates = result.ir.orchestrationGates ?? []
    expect(gates).toHaveLength(2)
    expect(gates[0].exprId).not.toBe(gates[1].exprId)
  })

  it('emits empty orchestrationGates when spec has no orchestration', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationGates).toEqual([])
  })

  it('compiles a single portfolioRisk into IR.orchestrationPortfolioRisks with passthrough metadata', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      portfolioRisks: [
        {
          id: 'portfolio-drawdown-1',
          scope: 'portfolio',
          mode: 'observe',
          thresholdPct: 10,
          effectWhenTriggered: 'block_new_entries',
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const risks = result.ir.orchestrationPortfolioRisks ?? []
    expect(risks).toHaveLength(1)
    expect(risks[0]).toEqual({
      id: 'portfolio-drawdown-1',
      scope: 'portfolio',
      mode: 'observe',
      thresholdPct: 10,
      effectWhenTriggered: 'block_new_entries',
    })
  })

  it('emits empty orchestrationPortfolioRisks when spec has no orchestration.portfolioRisks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationPortfolioRisks).toEqual([])
  })

  it('emits both orchestrationGates and orchestrationPortfolioRisks when spec contains each kind', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-regime-mix',
          target: { phase: 'entry', sideScope: 'long' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      portfolioRisks: [
        {
          id: 'portfolio-drawdown-mix',
          scope: 'portfolio',
          mode: 'enforce',
          thresholdPct: 15,
          effectWhenTriggered: 'block_new_entries',
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationGates).toHaveLength(1)
    expect(result.ir.orchestrationPortfolioRisks).toHaveLength(1)
    expect(result.ir.orchestrationPortfolioRisks?.[0].id).toBe('portfolio-drawdown-mix')
    expect(result.ir.orchestrationPortfolioRisks?.[0].mode).toBe('enforce')
    const r0 = result.ir.orchestrationPortfolioRisks?.[0]
    if (r0?.scope === 'portfolio') {
      expect(r0.thresholdPct).toBe(15)
    }
  })

  it('compiles a program with valid activeWhenRef into IR.orchestrationPrograms with resolved activeWhenExprId', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-regime-prog',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      programs: [
        {
          id: 'program-grid-1',
          programKind: 'fixed_grid_gated',
          activeWhenRef: 'gate-regime-prog',
          onDeactivate: 'cancel',
          rebuildPolicy: 'static',
          gridParams: {
            anchorPrice: 30000,
            levelCount: 10,
            stepPct: 0.5,
          },
          sizing: { mode: 'fixed_quote', value: 100 },
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const programs = result.ir.orchestrationPrograms ?? []
    expect(programs).toHaveLength(1)
    const gate = (result.ir.orchestrationGates ?? [])[0]
    expect(programs[0].activeWhenExprId).toBe(gate.exprId)
    expect(programs[0].id).toBe('program-grid-1')
    const irProgram0 = programs[0]
    if (irProgram0.programKind !== 'fixed_grid_gated') throw new Error('expected fixed_grid_gated program')
    expect(irProgram0.programKind).toBe('fixed_grid_gated')
    expect(irProgram0.onDeactivate).toBe('cancel')
    expect(irProgram0.rebuildPolicy).toBe('static')
    expect(irProgram0.gridParams).toEqual({ anchorPrice: 30000, levelCount: 10, stepPct: 0.5 })
    expect(irProgram0.sizing).toEqual({ mode: 'fixed_quote', value: 100 })
  })

  it('drops orphan program when activeWhenRef points to non-existent gate', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      programs: [
        {
          id: 'program-orphan',
          programKind: 'fixed_grid_gated',
          activeWhenRef: 'gate-does-not-exist',
          onDeactivate: 'cancel',
          rebuildPolicy: 'static',
          gridParams: { anchorPrice: 30000, levelCount: 10, stepPct: 0.5 },
          sizing: { mode: 'fixed_quote', value: 100 },
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationPrograms).toEqual([])
  })

  it('emits empty orchestrationPrograms when spec has no orchestration.programs', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationPrograms).toEqual([])
  })

  it('emits both orchestrationGates and orchestrationPrograms with correctly resolved activeWhenExprId', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-a',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
        {
          id: 'gate-b',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 200 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      programs: [
        {
          id: 'program-b',
          programKind: 'fixed_grid_gated',
          activeWhenRef: 'gate-b',
          onDeactivate: 'keep',
          rebuildPolicy: 'static',
          gridParams: { anchorPrice: 30000, levelCount: 8, stepPct: 1 },
          sizing: { mode: 'fixed_base', value: 0.01 },
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationGates).toHaveLength(2)
    const programs = result.ir.orchestrationPrograms ?? []
    expect(programs).toHaveLength(1)
    const gateB = (result.ir.orchestrationGates ?? []).find(g => g.id === 'gate-b')!
    expect(programs[0].activeWhenExprId).toBe(gateB.exprId)
  })

  it('emits gates, portfolioRisks and programs concurrently', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.orchestration = {
      gates: [
        {
          id: 'gate-coexist',
          target: { phase: 'entry' },
          activeWhen: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
          },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      portfolioRisks: [
        {
          id: 'portfolio-drawdown-coexist',
          scope: 'portfolio',
          mode: 'observe',
          thresholdPct: 12,
          effectWhenTriggered: 'block_new_entries',
        },
      ],
      programs: [
        {
          id: 'program-coexist',
          programKind: 'fixed_grid_gated',
          activeWhenRef: 'gate-coexist',
          onDeactivate: 'close',
          rebuildPolicy: 'static',
          gridParams: { anchorPrice: 30000, levelCount: 6, stepPct: 0.75, lowerBound: 28000, upperBound: 32000 },
          sizing: { mode: 'fixed_pct', value: 5 },
        },
      ],
    }

    const result = compiler.compile({ canonicalSpec: spec, fallback })
    expect(result.ir.orchestrationGates).toHaveLength(1)
    expect(result.ir.orchestrationPortfolioRisks).toHaveLength(1)
    expect(result.ir.orchestrationPrograms).toHaveLength(1)
    const gate = (result.ir.orchestrationGates ?? [])[0]
    const program = (result.ir.orchestrationPrograms ?? [])[0]
    if (program.programKind !== 'fixed_grid_gated') throw new Error('expected fixed_grid_gated program')
    expect(program.activeWhenExprId).toBe(gate.exprId)
    if (program.programKind !== 'fixed_grid_gated') throw new Error('expected fixed_grid_gated')
    expect(program.gridParams.lowerBound).toBe(28000)
    expect(program.gridParams.upperBound).toBe(32000)
    expect(program.sizing).toEqual({ mode: 'fixed_pct', value: 5 })
  })
})

// ---------------------------------------------------------------------------
// risk.max_drawdown_pct ghost-atom fix: canonical→IR compile branch
// ---------------------------------------------------------------------------
describe('canonicalSpecV2IrCompilerService risk.max_drawdown_pct', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 10 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'entry-close-above-open',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  function buildSpecWithMaxDrawdown(valuePct: number): CanonicalStrategySpecV2 {
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'risk-max-drawdown',
      phase: 'risk',
      sideScope: 'both',
      priority: 100,
      condition: {
        kind: 'atom',
        key: 'risk.max_drawdown_pct',
        semanticScope: 'portfolio',
        op: 'GTE',
        // canonical-spec-builder stores as fraction (valuePct / 100)
        value: Number((valuePct / 100).toFixed(4)),
      },
      actions: [{ type: 'FORCE_EXIT' }],
    })
    return spec
  }

  it('emits a portfolio drawdown risk into orchestrationPortfolioRisks for valuePct:15', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(15)
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const risks = result.ir.orchestrationPortfolioRisks ?? []
    expect(risks.length).toBeGreaterThanOrEqual(1)
    const drawdown = risks.find(r => r.id === 'risk-max-drawdown')
    expect(drawdown).toBeDefined()
    expect(drawdown?.scope).toBe('portfolio')
    expect(drawdown?.mode).toBe('enforce')
    expect(drawdown?.effectWhenTriggered).toBe('block_new_entries')
    if (drawdown?.scope === 'portfolio') {
      expect(drawdown.thresholdPct).toBeCloseTo(15, 2)
    }
  })

  it('does not add risk.max_drawdown_pct rule to ruleBlocks or riskPolicy.guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(10)
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const ruleIds = result.ir.ruleBlocks.map(b => b.id)
    expect(ruleIds).not.toContain('risk-max-drawdown')
    const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
    expect(guardIds).not.toContain('guard_risk-max-drawdown')
  })

  it('preserves fractional valuePct precision (15.5 → thresholdPct ≈ 15.5)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(15.5)
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const drawdown = (result.ir.orchestrationPortfolioRisks ?? []).find(r => r.id === 'risk-max-drawdown')
    expect(drawdown).toBeDefined()
    if (drawdown?.scope === 'portfolio') {
      // buildSpecWithMaxDrawdown stores 0.155 (toFixed(4) → "0.1550"), * 100 = 15.5
      // toBeCloseTo(15.5, 4) locks both magnitude and 4-decimal precision contract.
      expect(drawdown.thresholdPct).toBeCloseTo(15.5, 4)
    }
  })

  it('isolates risk.max_drawdown_pct from sibling position-scope risk atoms (stop_loss_pct coexistence)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push(
      {
        id: 'risk-max-drawdown',
        phase: 'risk',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'risk.max_drawdown_pct',
          semanticScope: 'portfolio',
          op: 'GTE',
          value: 0.15,
        },
        actions: [{ type: 'FORCE_EXIT' }],
      },
      {
        id: 'risk-stop-loss',
        phase: 'risk',
        sideScope: 'long',
        priority: 90,
        condition: {
          kind: 'atom',
          key: 'position_loss_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: 0.05,
        },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    )
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    // Drawdown lives in orchestrationPortfolioRisks only
    const portfolioRiskIds = (result.ir.orchestrationPortfolioRisks ?? []).map(r => r.id)
    expect(portfolioRiskIds).toContain('risk-max-drawdown')
    expect(portfolioRiskIds).not.toContain('risk-stop-loss')

    // Stop-loss lives in riskPolicy.guards only
    const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
    expect(guardIds).toContain('guard_risk-stop-loss')
    expect(guardIds).not.toContain('guard_risk-max-drawdown')

    // Neither rule leaks into ruleBlocks
    const ruleIds = result.ir.ruleBlocks.map(b => b.id)
    expect(ruleIds).not.toContain('risk-max-drawdown')
    expect(ruleIds).not.toContain('risk-stop-loss')
  })

  it('emits one node per max_drawdown_pct rule when the spec carries multiple rules (OR semantics, no merge)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    for (const [id, valuePct] of [
      ['risk-max-drawdown-tight', 10],
      ['risk-max-drawdown-loose', 20],
    ] as const) {
      spec.rules.push({
        id,
        phase: 'risk',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'risk.max_drawdown_pct',
          semanticScope: 'portfolio',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
        },
        actions: [{ type: 'FORCE_EXIT' }],
      })
    }
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const risks = result.ir.orchestrationPortfolioRisks ?? []
    const tight = risks.find(r => r.id === 'risk-max-drawdown-tight')
    const loose = risks.find(r => r.id === 'risk-max-drawdown-loose')
    expect(tight).toBeDefined()
    expect(loose).toBeDefined()
    if (tight?.scope === 'portfolio') expect(tight.thresholdPct).toBeCloseTo(10, 2)
    if (loose?.scope === 'portfolio') expect(loose.thresholdPct).toBeCloseTo(20, 2)
  })

  it('accepts already-percentage values (>1) without double-converting — mirrors tryCompileRiskGuard contract', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'risk-max-drawdown',
      phase: 'risk',
      sideScope: 'both',
      priority: 100,
      condition: {
        kind: 'atom',
        key: 'risk.max_drawdown_pct',
        semanticScope: 'portfolio',
        op: 'GTE',
        // raw percentage form (>1) — must not be multiplied by 100 again
        value: 15,
      },
      actions: [{ type: 'FORCE_EXIT' }],
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const drawdown = result.ir.orchestrationPortfolioRisks?.find(r => r.id === 'risk-max-drawdown')
    expect(drawdown).toBeDefined()
    if (drawdown?.scope === 'portfolio') {
      expect(drawdown.thresholdPct).toBeCloseTo(15, 4)
    }
  })

  it('coexists with spec.orchestration.portfolioRisks — both appear in output', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(20)
    spec.orchestration = {
      portfolioRisks: [
        {
          id: 'portfolio-drawdown-explicit',
          scope: 'portfolio',
          mode: 'observe',
          thresholdPct: 5,
          effectWhenTriggered: 'block_new_entries',
        },
      ],
    }
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const risks = result.ir.orchestrationPortfolioRisks ?? []
    expect(risks.length).toBe(2)
    expect(risks.some(r => r.id === 'portfolio-drawdown-explicit')).toBe(true)
    expect(risks.some(r => r.id === 'risk-max-drawdown')).toBe(true)
  })

  it('fails closed when valuePct is 0 (compile entry throws)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(0)
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_max_drawdown_invalid_pct/,
    )
  })

  it('fails closed when valuePct is 100 (compile entry throws)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(100)
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_max_drawdown_invalid_pct/,
    )
  })

  it('fails closed when condition.value is missing (compile entry throws)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'risk-max-drawdown',
      phase: 'risk',
      sideScope: 'both',
      priority: 100,
      condition: {
        kind: 'atom',
        key: 'risk.max_drawdown_pct',
        semanticScope: 'portfolio',
        op: 'GTE',
        // intentionally no `value` field — fail-closed expects throw
      } as CanonicalStrategySpecV2['rules'][number]['condition'],
      actions: [{ type: 'FORCE_EXIT' }],
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_max_drawdown_invalid_pct/,
    )
  })

  it('evaluator contract: emitted IR node drives evaluateOrchestrationPortfolioRisks block decision', async () => {
    // Verifies the IR↔evaluator data contract: compiled node feeds correctly into
    // evaluateOrchestrationPortfolioRisks. This is NOT a full strategy-run integration —
    // run-decision-programs aggregation is not exercised; that lives elsewhere.
    const { evaluateOrchestrationPortfolioRisks } = await import(
      '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
    )
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithMaxDrawdown(15)
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const drawdown = (result.ir.orchestrationPortfolioRisks ?? []).find(r => r.id === 'risk-max-drawdown')
    if (!drawdown) {
      throw new Error('expected risk-max-drawdown node in orchestrationPortfolioRisks')
    }

    // drawdownPct=16 > threshold=15 → should block both long and short
    const blocked = evaluateOrchestrationPortfolioRisks([drawdown], { drawdownPct: 16 })
    expect(blocked.blockEntryLong).toBe(true)
    expect(blocked.blockEntryShort).toBe(true)

    // drawdownPct=14 < threshold=15 → should not block
    const ok = evaluateOrchestrationPortfolioRisks([drawdown], { drawdownPct: 14 })
    expect(ok.blockEntryLong).toBe(false)
    expect(ok.blockEntryShort).toBe(false)
  })
})

// ─── position.dca_schedule ghost-atom fix (#1252) ────────────────────────────
//
// 验证 canonical-spec-v2-ir-compiler 正确透传 dca_schedule metadata：
//   - ADD_LONG action 出现在 ruleBlocks
//   - metadata.dcaSchedule 字段全量透传（maxCount / stateKey / capitalCap /
//     triggerMode / priceIntervalPct / timeIntervalMs / exitRule）
//   - multi-rule 不互盖；与 position 其他 atom 隔离
//     （OPEN_LONG / orchestrationPortfolioRisks / riskPolicy.guards）
//   - precision：priceIntervalPct toBeCloseTo 4 位小数
//   - exitRule 缺省 → IR compiler 不会人为补 cap_only 哨兵（透传 undefined）
//
// 本套测试仅覆盖 IR compiler 透传层；validation / fail-closed（maxCount=0、
// capitalCap 缺失等）属 canonical-spec-builder 职责，不在本文件范围。
// ─────────────────────────────────────────────────────────────────────────────

describe('canonicalSpecV2IrCompilerService position.dca_schedule', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 100 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1m'],
      },
      rules: [
        {
          id: 'entry-open',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  /** 向 spec 追加一条带 metadata.dcaSchedule 的 ADD_LONG entry rule */
  function pushDcaRule(
    spec: CanonicalStrategySpecV2,
    opts: {
      id?: string
      maxCount: number
      capitalCap: number
      triggerMode?: string
      priceIntervalPct?: number
      timeIntervalMs?: number
      exitRule?: Record<string, string>
      stateKey?: string
    },
  ): void {
    spec.rules.push({
      id: opts.id ?? 'dca-add-long',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG' }],
      metadata: {
        dcaSchedule: {
          maxCount: opts.maxCount,
          capitalCap: opts.capitalCap,
          stateKey: opts.stateKey ?? 'dca_fired_count',
          ...(opts.triggerMode !== undefined ? { triggerMode: opts.triggerMode } : {}),
          ...(opts.priceIntervalPct !== undefined ? { priceIntervalPct: opts.priceIntervalPct } : {}),
          ...(opts.timeIntervalMs !== undefined ? { timeIntervalMs: opts.timeIntervalMs } : {}),
          ...(opts.exitRule !== undefined ? { exitRule: opts.exitRule } : {}),
        },
      },
    })
  }

  // ── 1. happy path: ADD_LONG 出现在 ruleBlocks ────────────────────────────

  it('compile() emits ADD_LONG action in ruleBlocks for a dca_schedule rule', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { maxCount: 3, capitalCap: 1000, triggerMode: 'price_interval', priceIntervalPct: 5, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const allKinds = ir.ruleBlocks.flatMap(b => b.actions.map(a => a.kind))
    expect(allKinds).toContain('ADD_LONG')
  })

  // ── 2. metadata.dcaSchedule maxCount + stateKey 透传 ─────────────────────

  it('metadata.dcaSchedule carries maxCount and stateKey verbatim', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    // 用非 helper 默认值（'custom_dca_state'）才能真测到「透传」语义
    pushDcaRule(spec, { maxCount: 4, capitalCap: 2000, stateKey: 'custom_dca_state', exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(dcaBlock).toBeDefined()
    expect(dcaBlock?.metadata?.dcaSchedule?.maxCount).toBe(4)
    expect(dcaBlock?.metadata?.dcaSchedule?.stateKey).toBe('custom_dca_state')
  })

  // ── 3. triggerMode + priceIntervalPct 精确透传 ───────────────────────────

  it('metadata.dcaSchedule carries triggerMode and priceIntervalPct with 4-decimal precision', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    // 断言 priceIntervalPct toBeCloseTo 4 位小数（IR compiler 仅透传，
    // toFixed 由上游 spec-builder 负责；此处直接给 4 位小数字面量）
    pushDcaRule(spec, {
      maxCount: 3,
      capitalCap: 1000,
      triggerMode: 'price_interval',
      priceIntervalPct: 5.1234,
      exitRule: { type: 'cap_only' },
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(dcaBlock?.metadata?.dcaSchedule?.triggerMode).toBe('price_interval')
    expect(dcaBlock?.metadata?.dcaSchedule?.priceIntervalPct).toBeCloseTo(5.1234, 4)
  })

  // ── 4. timeIntervalMs 透传 ───────────────────────────────────────────────

  it('metadata.dcaSchedule carries timeIntervalMs for time_interval mode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    const dayMs = 24 * 60 * 60 * 1000
    pushDcaRule(spec, {
      maxCount: 5,
      capitalCap: 500,
      triggerMode: 'time_interval',
      timeIntervalMs: dayMs,
      exitRule: { type: 'cap_only' },
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(dcaBlock?.metadata?.dcaSchedule?.triggerMode).toBe('time_interval')
    expect(dcaBlock?.metadata?.dcaSchedule?.timeIntervalMs).toBe(dayMs)
  })

  // ── 5. exitRule 透传（非空时） ────────────────────────────────────────────

  it('metadata.dcaSchedule carries exitRule when explicitly set', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, {
      maxCount: 3,
      capitalCap: 1000,
      exitRule: { type: 'stop_on_break_previous_low', reference: 'previous_low' },
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    const exitRule = dcaBlock?.metadata?.dcaSchedule?.exitRule as Record<string, string> | undefined
    expect(exitRule?.type).toBe('stop_on_break_previous_low')
    expect(exitRule?.reference).toBe('previous_low')
  })

  // ── 6. exitRule 缺省 → IR compiler 不会人为补 cap_only 哨兵 ─────────────

  it('metadata.dcaSchedule exitRule stays undefined when spec omits it (compiler does not inject sentinel)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    // 真正不传 exitRule：helper 的 spread 会跳过该字段，断言 compiler 不会替我们补默认
    pushDcaRule(spec, {
      maxCount: 3,
      capitalCap: 1000,
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(dcaBlock).toBeDefined()
    expect(dcaBlock?.metadata?.dcaSchedule?.exitRule).toBeUndefined()
  })

  // ── 7. multi-rule: 2 条 dca_schedule 规则不互相覆盖 ─────────────────────

  it('two dca_schedule rules in the same spec each appear independently in ruleBlocks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { id: 'dca-rule-a', maxCount: 3, capitalCap: 1000, triggerMode: 'price_interval', priceIntervalPct: 5, exitRule: { type: 'cap_only' } })
    pushDcaRule(spec, { id: 'dca-rule-b', maxCount: 5, capitalCap: 2000, triggerMode: 'time_interval', timeIntervalMs: 3600000, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlocks = ir.ruleBlocks.filter(b => b.metadata?.dcaSchedule)
    expect(dcaBlocks.length).toBeGreaterThanOrEqual(2)
    const maxCounts = dcaBlocks.map(b => b.metadata?.dcaSchedule?.maxCount)
    expect(maxCounts).toContain(3)
    expect(maxCounts).toContain(5)
  })

  // ── 8. 混合隔离：与 OPEN_LONG 规则共存，dca 不进入其他规则的 metadata ────

  it('dca_schedule metadata does not contaminate sibling OPEN_LONG ruleBlocks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { maxCount: 3, capitalCap: 1000, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const openBlocks = ir.ruleBlocks.filter(b => b.actions.some(a => a.kind === 'OPEN_LONG'))
    for (const block of openBlocks) {
      expect(block.metadata?.dcaSchedule).toBeUndefined()
    }
  })

  // ── 9. dca_schedule 规则不进入 orchestrationPortfolioRisks ──────────────

  it('dca_schedule rule does NOT appear in orchestrationPortfolioRisks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { id: 'dca-add-long', maxCount: 3, capitalCap: 1000, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const portfolioRiskIds = (ir.orchestrationPortfolioRisks ?? []).map(r => r.id)
    expect(portfolioRiskIds).not.toContain('dca-add-long')
  })

  // ── 10. dca_schedule 规则不进入 riskPolicy.guards ────────────────────────

  it('dca_schedule rule does NOT appear in riskPolicy.guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { id: 'dca-add-long', maxCount: 3, capitalCap: 1000, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const guardIds = ir.riskPolicy.guards.map(g => g.id)
    expect(guardIds).not.toContain('dca-add-long')
    expect(guardIds).not.toContain('guard_dca-add-long')
  })

  // ── 11. capitalCap 透传（数字类型） ──────────────────────────────────────

  it('metadata.dcaSchedule carries capitalCap as number', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { maxCount: 2, capitalCap: 500, exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(typeof dcaBlock?.metadata?.dcaSchedule?.capitalCap).toBe('number')
    expect(dcaBlock?.metadata?.dcaSchedule?.capitalCap).toBe(500)
  })

  // ── 12. signal triggerMode 无 interval 字段 ──────────────────────────────

  it('signal triggerMode does not attach priceIntervalPct or timeIntervalMs', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    pushDcaRule(spec, { maxCount: 3, capitalCap: 1000, triggerMode: 'signal', exitRule: { type: 'cap_only' } })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const dcaBlock = ir.ruleBlocks.find(b => b.metadata?.dcaSchedule)
    expect(dcaBlock?.metadata?.dcaSchedule?.triggerMode).toBe('signal')
    expect(dcaBlock?.metadata?.dcaSchedule?.priceIntervalPct).toBeUndefined()
    expect(dcaBlock?.metadata?.dcaSchedule?.timeIntervalMs).toBeUndefined()
  })
})

// action.add_position ghost-atom fix: compile-time validation + IR output contract
// ---------------------------------------------------------------------------
describe('canonicalSpecV2IrCompilerService action.add_position', () => {
  const fallback = {
    exchange: 'okx' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '15m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 10 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['15m'],
      },
      rules: [
        {
          id: 'entry-open-long',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  function buildSpecWithAddPosition(
    id: string,
    addMode: string,
    addRatio: number,
    side: 'long' | 'short' = 'long',
  ): CanonicalStrategySpecV2 {
    const spec = buildBaseSpec()
    spec.rules.push({
      id,
      phase: 'entry',
      sideScope: side,
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: side === 'short' ? 'ADD_SHORT' : 'ADD_LONG', sizing: { mode: 'RATIO', value: addRatio * 100 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode,
          addRatio: Number(addRatio.toFixed(4)),
          maxLayers: 3,
        },
      },
    })
    return spec
  }

  // -------------------------------------------------------------------------
  // 1. happy path: ADD_LONG 出现在 ruleBlocks
  // -------------------------------------------------------------------------
  it('happy path: ADD_LONG appears in ruleBlocks for signal_confirm addMode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-signal', 'signal_confirm', 0.2)
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const kinds = ir.ruleBlocks.flatMap(r => r.actions.map(a => a.kind))
    expect(kinds).toContain('ADD_LONG')
  })

  // -------------------------------------------------------------------------
  // 2. happy path: ADD_SHORT 出现在 ruleBlocks（short 侧）
  // -------------------------------------------------------------------------
  it('happy path: ADD_SHORT appears in ruleBlocks for short-side add_position', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-short', 'signal_confirm', 0.2, 'short')
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const kinds = ir.ruleBlocks.flatMap(r => r.actions.map(a => a.kind))
    expect(kinds).toContain('ADD_SHORT')
  })

  // -------------------------------------------------------------------------
  // 3. metadata 完整透传：addMode + addRatio 出现在 IR ruleBlock metadata
  // -------------------------------------------------------------------------
  it('IR ruleBlock metadata.addPosition transports addMode and addRatio', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-meta', 'profit_pct', 0.3)
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const addRule = ir.ruleBlocks.find(r => r.id === 'add-pos-meta')
    expect(addRule).toBeDefined()
    expect(addRule?.metadata?.addPosition?.addMode).toBe('profit_pct')
    expect(addRule?.metadata?.addPosition?.addRatio).toBeCloseTo(0.3, 4)
    expect(addRule?.metadata?.addPosition?.stateKey).toBe('pyramiding_layer_count')
  })

  // -------------------------------------------------------------------------
  // 4. precision: addRatio toFixed(4) 精度锁定
  // -------------------------------------------------------------------------
  it('precision: addRatio is stored with 4-decimal precision', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-precision', 'drawdown_pct', 0.1234)
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const addRule = ir.ruleBlocks.find(r => r.id === 'add-pos-precision')
    expect(addRule?.metadata?.addPosition?.addRatio).toBeCloseTo(0.1234, 4)
  })

  // -------------------------------------------------------------------------
  // 5. multi-rule: 2 条 add_position 规则互不干扰
  // -------------------------------------------------------------------------
  it('multi-rule: two add_position rules both appear in ruleBlocks independently', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-1', 'signal_confirm', 0.2)
    spec.rules.push({
      id: 'add-pos-2',
      phase: 'entry',
      sideScope: 'long',
      priority: 140,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 30 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode: 'profit_pct',
          addRatio: 0.3,
          maxLayers: 2,
        },
      },
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const addRule1 = ir.ruleBlocks.find(r => r.id === 'add-pos-1')
    const addRule2 = ir.ruleBlocks.find(r => r.id === 'add-pos-2')
    expect(addRule1).toBeDefined()
    expect(addRule2).toBeDefined()
    expect(addRule1?.metadata?.addPosition?.addMode).toBe('signal_confirm')
    expect(addRule2?.metadata?.addPosition?.addMode).toBe('profit_pct')
  })

  // -------------------------------------------------------------------------
  // 6. 混合隔离: add_position 与 OPEN_LONG / REDUCE_LONG 同 spec 不互相污染
  // -------------------------------------------------------------------------
  it('isolation: add_position rule does not pollute OPEN_LONG or REDUCE_LONG rules', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-mixed', 'signal_confirm', 0.2)
    spec.rules.push({
      id: 'reduce-exit',
      phase: 'exit',
      sideScope: 'long',
      priority: 80,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'REDUCE_LONG', sizing: { mode: 'RATIO', value: 0.5 } }],
    })
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })

    const openRule = ir.ruleBlocks.find(r => r.id === 'entry-open-long')
    const addRule = ir.ruleBlocks.find(r => r.id === 'add-pos-mixed')
    const reduceRule = ir.ruleBlocks.find(r => r.id === 'reduce-exit')

    expect(openRule?.actions.every(a => a.kind === 'OPEN_LONG')).toBe(true)
    expect(addRule?.metadata?.addPosition?.addMode).toBe('signal_confirm')
    expect(reduceRule?.metadata?.addPosition).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 7. fail-closed: addMode 缺失时 compile 抛出
  // -------------------------------------------------------------------------
  it('fail-closed: missing addMode throws codegen.canonical_spec_v2_add_position_invalid_addMode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'add-pos-no-mode',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          // intentionally no addMode
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_add_position_invalid_addMode/,
    )
  })

  // -------------------------------------------------------------------------
  // 8. fail-closed: addMode 为空字符串时 compile 抛出
  // -------------------------------------------------------------------------
  it('fail-closed: empty string addMode throws codegen.canonical_spec_v2_add_position_invalid_addMode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'add-pos-empty-mode',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode: '',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_add_position_invalid_addMode/,
    )
  })

  // -------------------------------------------------------------------------
  // 9. fail-closed: addRatio > 1 时 compile 抛出
  // -------------------------------------------------------------------------
  it('fail-closed: addRatio > 1 (accidental percentage form) throws codegen.canonical_spec_v2_add_position_invalid_addRatio', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'add-pos-bad-ratio',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode: 'signal_confirm',
          addRatio: 20, // accidental percentage instead of 0.20
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_add_position_invalid_addRatio/,
    )
  })

  // -------------------------------------------------------------------------
  // 10. fail-closed: addRatio = 0 时 compile 抛出
  // -------------------------------------------------------------------------
  it('fail-closed: addRatio = 0 throws codegen.canonical_spec_v2_add_position_invalid_addRatio', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'add-pos-zero-ratio',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode: 'profit_pct',
          addRatio: 0,
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_add_position_invalid_addRatio/,
    )
  })

  // -------------------------------------------------------------------------
  // 11. addRatio = 1.0 (100%) 是合法的边界值
  // -------------------------------------------------------------------------
  it('boundary: addRatio = 1.0 is valid and does not throw', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-full', 'signal_confirm', 1.0)
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).not.toThrow()
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const addRule = ir.ruleBlocks.find(r => r.id === 'add-pos-full')
    expect(addRule?.metadata?.addPosition?.addRatio).toBe(1)
  })

  // -------------------------------------------------------------------------
  // 12. ADD_LONG 不进入 orchestrationPortfolioRisks 或 riskPolicy.guards
  // -------------------------------------------------------------------------
  it('isolation: add_position rule does not leak into orchestrationPortfolioRisks or riskPolicy.guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAddPosition('add-pos-leak-check', 'drawdown_pct', 0.15)
    const { ir } = compiler.compile({ canonicalSpec: spec, fallback })
    const portfolioRiskIds = (ir.orchestrationPortfolioRisks ?? []).map(r => r.id)
    expect(portfolioRiskIds).not.toContain('add-pos-leak-check')
    const guardIds = ir.riskPolicy.guards.map(g => g.id)
    expect(guardIds.some(id => id.includes('add-pos-leak-check'))).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 13. 规则无 metadata.addPosition 时（手写 ADD_LONG）不触发验证
  // -------------------------------------------------------------------------
  it('non-lifecycle ADD_LONG without addPosition metadata compiles without throw', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'raw-add-long',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      // ADD_LONG without lifecycle metadata — no addPosition key
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // 14. metadata.addPosition 存在但 actions 无 ADD_LONG/ADD_SHORT → 跳过验证
  // -------------------------------------------------------------------------
  it('metadata.addPosition with no ADD action is silently skipped (covers hasAddAction guard)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'odd-shape-rule',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      // metadata.addPosition present but actions list has no ADD_LONG/ADD_SHORT
      actions: [{ type: 'OPEN_LONG' }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          // no addMode — would fail if validation were triggered
        },
      },
    })
    // hasAddAction guard returns early: no throw expected
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // 15. addRatio = NaN → compile 一定 throw（covers Number.isFinite guard）
  //
  // NaN 在 spec 中会被 CanonicalSpecV2DigestService.hash() 内的 canonicalSerialize
  // 先于 tryCompileActionAddPosition 处理，抛出 "non-finite numbers are not allowed"。
  // 两条路径都是 fail-closed：要么 digest 拒绝，要么 addRatio 验证拒绝。
  // 此处只断言 compile() 抛出，不指定具体 error message。
  // -------------------------------------------------------------------------
  it('fail-closed: addRatio = NaN causes compile to throw (digest or addRatio guard)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'add-pos-nan-ratio',
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'ADD_LONG', sizing: { mode: 'RATIO', value: 20 } }],
      metadata: {
        addPosition: {
          stateKey: 'pyramiding_layer_count',
          addMode: 'signal_confirm',
          addRatio: Number.NaN,
        },
      },
    })
    // NaN is always rejected: either by canonical-serialize (digest) or by
    // the addRatio Number.isFinite guard in tryCompileActionAddPosition.
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canonicalSpecV2IrCompilerService action.reverse_position
// 7 件套：compile() 直接喂入 CanonicalStrategySpecV2，不走 seed extractor
// ─────────────────────────────────────────────────────────────────────────────

describe('canonicalSpecV2IrCompilerService action.reverse_position', () => {
  const fallback = {
    exchange: 'okx' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '15m',
      },
      indicators: [],
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
          id: 'entry-close-above-open',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  function buildSpecWithReversePosition(opts: {
    fromSide: 'long' | 'short'
    toSide: 'long' | 'short'
    sameBarPolicy?: 'allow' | 'next_bar_only'
    sizingSource?: 'current_position' | 'fixed' | 'position_sizing'
    ruleId?: string
  }): CanonicalStrategySpecV2 {
    const {
      fromSide,
      toSide,
      sameBarPolicy = 'next_bar_only',
      sizingSource = 'fixed',
      ruleId = 'exit-reverse-long-short',
    } = opts
    const spec = buildBaseSpec()
    spec.rules.push({
      id: ruleId,
      phase: 'exit',
      sideScope: fromSide,
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [
        { type: fromSide === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT' },
        {
          type: toSide === 'long' ? 'OPEN_LONG' : 'OPEN_SHORT',
          // sizingSource='current_position': 显式注入 sizing+quantityMode 使下游翻译为 position_pct
          // sizingSource='fixed'/'position_sizing': 不注入 sizing，依赖 spec.sizing（RATIO:0.1）兜底
          ...(sizingSource === 'current_position'
            ? { sizing: { mode: 'RATIO', value: 100 }, params: { quantityMode: 'position_pct' } }
            : {}),
        },
      ],
      metadata: {
        reversePosition: { fromSide, toSide, sameBarPolicy, sizingSource },
      },
    })
    return spec
  }

  // ─── happy path ────────────────────────────────────────────────────────────

  it('compile() happy path: long→short produces CLOSE_LONG + OPEN_SHORT in ruleBlocks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'long', toSide: 'short' })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    expect(reverseBlock).toBeDefined()
    const kinds = reverseBlock!.actions.map(a => a.kind)
    expect(kinds).toContain('CLOSE_LONG')
    expect(kinds).toContain('OPEN_SHORT')
  })

  it('compile() happy path: short→long produces CLOSE_SHORT + OPEN_LONG in ruleBlocks', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'short', toSide: 'long' })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    expect(reverseBlock).toBeDefined()
    const kinds = reverseBlock!.actions.map(a => a.kind)
    expect(kinds).toContain('CLOSE_SHORT')
    expect(kinds).toContain('OPEN_LONG')
  })

  it('metadata.reversePosition is preserved in IR ruleBlock (fromSide, toSide, sameBarPolicy, sizingSource)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({
      fromSide: 'long',
      toSide: 'short',
      sameBarPolicy: 'allow',
      sizingSource: 'current_position',
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    expect(reverseBlock).toBeDefined()
    expect(reverseBlock!.metadata?.reversePosition?.fromSide).toBe('long')
    expect(reverseBlock!.metadata?.reversePosition?.toSide).toBe('short')
    expect(reverseBlock!.metadata?.reversePosition?.sameBarPolicy).toBe('allow')
    expect(reverseBlock!.metadata?.reversePosition?.sizingSource).toBe('current_position')
  })

  it('CLOSE action precedes OPEN action in same ruleBlock (order preserved)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'long', toSide: 'short' })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    expect(reverseBlock).toBeDefined()
    const kinds = reverseBlock!.actions.map(a => a.kind)
    const closeIdx = kinds.indexOf('CLOSE_LONG')
    const openIdx = kinds.indexOf('OPEN_SHORT')
    expect(closeIdx).toBeGreaterThanOrEqual(0)
    expect(openIdx).toBeGreaterThanOrEqual(0)
    expect(closeIdx).toBeLessThan(openIdx)
  })

  it('sizingSource=current_position → OPEN action quantity.mode is position_pct', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({
      fromSide: 'long',
      toSide: 'short',
      sizingSource: 'current_position',
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    const openAction = reverseBlock?.actions.find(a => a.kind === 'OPEN_SHORT')
    expect(openAction?.quantity?.mode).toBe('position_pct')
  })

  it('reverse_position node does NOT appear in orchestrationPortfolioRisks or riskPolicy.guards', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'long', toSide: 'short' })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const ruleIds = (result.ir.orchestrationPortfolioRisks ?? []).map(r => r.id)
    expect(ruleIds).not.toContain('exit-reverse-long-short')
    const guardIds = (result.ir.riskPolicy?.guards ?? []).map(g => g.id)
    expect(guardIds).not.toContain('exit-reverse-long-short')
  })

  // ─── multi-rule: 2 reverse_position rules coexist without overwriting each other ──

  it('multi-rule: two reverse_position rules both appear in ruleBlocks independently', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'long', toSide: 'short', ruleId: 'reverse-r1' })
    spec.rules.push({
      id: 'reverse-r2',
      phase: 'exit',
      sideScope: 'short',
      priority: 140,
      condition: {
        kind: 'expression',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [
        { type: 'CLOSE_SHORT' },
        { type: 'OPEN_LONG' },
      ],
      metadata: {
        reversePosition: { fromSide: 'short', toSide: 'long', sameBarPolicy: 'allow', sizingSource: 'fixed' },
      },
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const r1 = result.ir.ruleBlocks.find(r => r.id === 'reverse-r1')
    const r2 = result.ir.ruleBlocks.find(r => r.id === 'reverse-r2')
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!.metadata?.reversePosition?.fromSide).toBe('long')
    expect(r2!.metadata?.reversePosition?.fromSide).toBe('short')
  })

  // ─── 混合隔离: reverse_position 与其他 action 同 spec 不互相干扰 ────────────

  it('mixed spec isolation: reverse_position rule does not bleed into reduce_position rule', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({ fromSide: 'long', toSide: 'short', ruleId: 'reverse-rule' })
    // 添加一个普通 reduce_position 规则
    spec.rules.push({
      id: 'reduce-rule',
      phase: 'exit',
      sideScope: 'long',
      priority: 130,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG', sizing: { mode: 'RATIO', value: 0.5 }, params: { lifecycle: true } }],
      metadata: { addPosition: undefined },
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'reverse-rule')
    const reduceBlock = result.ir.ruleBlocks.find(r => r.id === 'reduce-rule')
    // reverse rule 有 reversePosition metadata
    expect(reverseBlock?.metadata?.reversePosition).toBeDefined()
    // reduce rule 没有 reversePosition metadata
    expect(reduceBlock?.metadata?.reversePosition).toBeUndefined()
  })

  // ─── fail-closed: invalid fields throw with correct error codes ──────────

  it('fail-closed: invalid fromSide throws codegen.canonical_spec_v2_reverse_position_invalid_from_side', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'bad-from-side',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_SHORT' }],
      metadata: {
        reversePosition: {
          fromSide: 'both' as unknown as 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'fixed',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_reverse_position_invalid_from_side/,
    )
  })

  it('fail-closed: invalid toSide throws codegen.canonical_spec_v2_reverse_position_invalid_to_side', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'bad-to-side',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_SHORT' }],
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'both' as unknown as 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'fixed',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_reverse_position_invalid_to_side/,
    )
  })

  it('fail-closed: fromSide === toSide throws codegen.canonical_spec_v2_reverse_position_invalid_same_side', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'same-side',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_LONG' }],
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'long',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'fixed',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_reverse_position_invalid_same_side/,
    )
  })

  it('fail-closed: invalid sameBarPolicy throws codegen.canonical_spec_v2_reverse_position_invalid_same_bar_policy', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'bad-same-bar-policy',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_SHORT' }],
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'immediate' as unknown as 'allow',
          sizingSource: 'fixed',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_reverse_position_invalid_same_bar_policy/,
    )
  })

  it('fail-closed: invalid sizingSource throws codegen.canonical_spec_v2_reverse_position_invalid_sizing_source', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'bad-sizing-source',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_SHORT' }],
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'unknown' as unknown as 'fixed',
        },
      },
    })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
      /codegen\.canonical_spec_v2_reverse_position_invalid_sizing_source/,
    )
  })

  // ─── precision: sizingSource=fixed → OPEN action quantity uses spec sizing ──

  it('precision: sizingSource=fixed → OPEN action quantity is derived from spec sizing (not position_pct)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithReversePosition({
      fromSide: 'long',
      toSide: 'short',
      sizingSource: 'fixed',
    })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const reverseBlock = result.ir.ruleBlocks.find(r => r.id === 'exit-reverse-long-short')
    const openAction = reverseBlock?.actions.find(a => a.kind === 'OPEN_SHORT')
    expect(openAction).toBeDefined()
    expect(openAction?.quantity?.mode).not.toBe('position_pct')
  })

  // ─── 命名前缀稳定性 ────────────────────────────────────────────────────────

  it('naming stability: error codes use codegen.canonical_spec_v2_reverse_position_ prefix', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildBaseSpec()
    spec.rules.push({
      id: 'naming-check',
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [{ type: 'CLOSE_LONG' }, { type: 'OPEN_SHORT' }],
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'long',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'fixed',
        },
      },
    })
    let errorCode = ''
    try {
      compiler.compile({ canonicalSpec: spec, fallback })
    }
    catch (e) {
      errorCode = (e as Error).message
    }
    expect(errorCode).toMatch(/^codegen\.canonical_spec_v2_reverse_position_/)
  })
})

// ---------------------------------------------------------------------------
// P3 ghost-atom 修复 (Issue #1262): indicator.cross_over / indicator.cross_under
// indicator.threshold_gte / indicator.threshold_lte — phase='gate' IR-compiler
// 直接识别（绕过 canonical-spec-builder rewrite）。
// ---------------------------------------------------------------------------
describe('canonicalSpecV2IrCompilerService indicator.cross_* / threshold_* (P3 ghost-atom #1262)', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  function buildBaseSpec(): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '1m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['1m'] },
      rules: [
        {
          id: 'entry-close-above-open',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'expression',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  function buildSpecWithIndicatorGate(
    ruleId: string,
    atomKey:
      | 'indicator.cross_over'
      | 'indicator.cross_under'
      | 'indicator.threshold_gte'
      | 'indicator.threshold_lte',
    params: Record<string, string | number | boolean>,
    value: number,
    op: 'GTE' | 'LTE' | 'GT' | 'LT' = 'GTE',
  ): CanonicalStrategySpecV2 {
    const spec = buildBaseSpec()
    spec.rules.push({
      id: ruleId,
      phase: 'gate',
      sideScope: 'both',
      priority: 100,
      condition: {
        kind: 'atom',
        key: atomKey,
        semanticScope: 'market',
        op,
        value,
        params,
      },
      actions: [{ type: 'BLOCK_NEW_ENTRY' }],
    })
    return spec
  }

  // -------------------------------------------------------------------------
  // indicator.cross_over
  // -------------------------------------------------------------------------
  describe('indicator.cross_over', () => {
    it('compile() entry — SMA cross_over 产生 EXPRESSION_GUARD + CROSS_OVER predicate + SMA fast/slow series', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-sma-cross-over',
        'indicator.cross_over',
        { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-sma-cross-over')
      expect(guard).toBeDefined()
      expect(guard?.kind).toBe('EXPRESSION_GUARD')
      expect(guard?.onBreach).toBe('BLOCK_NEW_ENTRY')
      const predicateRef = (guard as { predicateRef?: string }).predicateRef
      expect(predicateRef).toBeTruthy()
      const predicate = result.ir.signalCatalog.predicates.find(p => p.id === predicateRef)
      expect(predicate?.kind).toBe('CROSS_OVER')
      const smaSeries = result.ir.signalCatalog.series.filter(s => s.kind === 'SMA')
      expect(smaSeries.length).toBe(2)
      expect(smaSeries.map(s => s.params?.period as number).sort((a, b) => a - b)).toEqual([20, 50])
    })

    it('indicator=ema 路由到 EMA series', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-ema-cross-over',
        'indicator.cross_over',
        { indicator: 'ema', fastPeriod: 12, slowPeriod: 26 },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const emaSeries = result.ir.signalCatalog.series.filter(s => s.kind === 'EMA')
      expect(emaSeries.length).toBe(2)
      expect(emaSeries.map(s => s.params?.period as number).sort((a, b) => a - b)).toEqual([12, 26])
    })

    it('indicator=rsi 路由到 RSI × const(value)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-rsi-cross-over',
        'indicator.cross_over',
        { indicator: 'rsi', period: 14 },
        30,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const rsi = result.ir.signalCatalog.series.find(s => s.kind === 'RSI')
      expect(rsi).toBeDefined()
      expect(rsi?.params?.period).toBe(14)
      const constSeries = result.ir.signalCatalog.series.filter(s => s.kind === 'CONST')
      expect(constSeries.some(s => (s as { value?: number }).value === 30)).toBe(true)
    })

    it('indicator=macd 路由到 MACD_LINE × MACD_SIGNAL + CROSS_OVER predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-macd-cross-over',
        'indicator.cross_over',
        { indicator: 'macd' },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const line = result.ir.signalCatalog.series.find(s => s.kind === 'MACD_LINE')
      const sig = result.ir.signalCatalog.series.find(s => s.kind === 'MACD_SIGNAL')
      expect(line).toBeDefined()
      expect(sig).toBeDefined()
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-macd-cross-over')
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      expect(predicate?.kind).toBe('CROSS_OVER')
    })

    it('multi-rule 不互盖 — 两条 indicator.cross_over 各落各的 guard', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push(
        {
          id: 'gate-sma-fast',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 5, slowPeriod: 13 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
        {
          id: 'gate-sma-slow',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 20, slowPeriod: 60 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
      expect(guardIds).toContain('guard_gate-sma-fast')
      expect(guardIds).toContain('guard_gate-sma-slow')
      const smaPeriods = result.ir.signalCatalog.series
        .filter(s => s.kind === 'SMA')
        .map(s => s.params?.period as number)
        .sort((a, b) => a - b)
      expect(smaPeriods).toEqual([5, 13, 20, 60])
    })

    it('混合隔离 — 与 volume.threshold gate 共存互不串味', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push(
        {
          id: 'gate-cross',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
        {
          id: 'gate-volume',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'volume.threshold',
            semanticScope: 'market',
            op: 'GT',
            value: 1000,
            params: { metric: 'base_volume' },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
      expect(guardIds).toContain('guard_gate-cross')
      expect(guardIds).toContain('guard_gate-volume')
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'VOLUME')).toBe(true)
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'SMA')).toBe(true)
    })

    it('fail-closed — indicator 缺 fastPeriod 抛 invalid_fast_period', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-bad',
        'indicator.cross_over',
        { indicator: 'sma', slowPeriod: 50 },
        1,
      )
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_cross_invalid_fast_period/,
      )
    })

    it('fail-closed — indicator 名未知抛 invalid_indicator', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-bad-ind',
        'indicator.cross_over',
        { indicator: 'unknown_kind', fastPeriod: 20, slowPeriod: 50 },
        1,
      )
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_cross_invalid_indicator/,
      )
    })

    it('fail-closed — rsi 路由 value 缺失抛 invalid_value', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push({
        id: 'gate-rsi-no-value',
        phase: 'gate',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'indicator.cross_over',
          semanticScope: 'market',
          op: 'GTE',
          params: { indicator: 'rsi', period: 14 },
        } as CanonicalStrategySpecV2['rules'][number]['condition'],
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      })
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_cross_invalid_value/,
      )
    })
  })

  // -------------------------------------------------------------------------
  // indicator.cross_under
  // -------------------------------------------------------------------------
  describe('indicator.cross_under', () => {
    it('compile() entry — SMA cross_under 产生 CROSS_UNDER predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-sma-cross-under',
        'indicator.cross_under',
        { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-sma-cross-under')
      expect(guard).toBeDefined()
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      expect(predicate?.kind).toBe('CROSS_UNDER')
    })

    it('indicator=ema 路由 EMA', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-ema-cross-under',
        'indicator.cross_under',
        { indicator: 'ema', fastPeriod: 9, slowPeriod: 21 },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const ema = result.ir.signalCatalog.series.filter(s => s.kind === 'EMA')
      expect(ema.length).toBe(2)
    })

    it('indicator=rsi 路由到 RSI × const(value) + CROSS_UNDER predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-rsi-cross-under',
        'indicator.cross_under',
        { indicator: 'rsi', period: 14 },
        70,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-rsi-cross-under')
      expect(guard).toBeDefined()
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      expect(predicate?.kind).toBe('CROSS_UNDER')
      const rsi = result.ir.signalCatalog.series.find(s => s.kind === 'RSI')
      expect(rsi?.params?.period).toBe(14)
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'CONST' && (s as { value?: number }).value === 70)).toBe(true)
    })

    it('indicator=macd 路由 MACD_LINE × MACD_SIGNAL + CROSS_UNDER predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-macd-cross-under',
        'indicator.cross_under',
        { indicator: 'macd' },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'MACD_LINE')).toBe(true)
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'MACD_SIGNAL')).toBe(true)
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-macd-cross-under')
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      expect(predicate?.kind).toBe('CROSS_UNDER')
    })

    it('multi-rule 不互盖 — cross_under 与 cross_over 共存', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push(
        {
          id: 'gate-cross-over',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
        {
          id: 'gate-cross-under',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_under',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const predicateKinds = result.ir.signalCatalog.predicates.map(p => p.kind).sort()
      expect(predicateKinds).toContain('CROSS_OVER')
      expect(predicateKinds).toContain('CROSS_UNDER')
    })

    it('precision — SMA series period 数值精确，未被默认值污染', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-sma-precision',
        'indicator.cross_under',
        { indicator: 'sma', fastPeriod: 7, slowPeriod: 99 },
        1,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const periods = result.ir.signalCatalog.series
        .filter(s => s.kind === 'SMA')
        .map(s => s.params?.period as number)
        .sort((a, b) => a - b)
      expect(periods).toEqual([7, 99])
    })

    it('fail-closed — slowPeriod=0 抛 invalid_slow_period', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-bad',
        'indicator.cross_under',
        { indicator: 'sma', fastPeriod: 20, slowPeriod: 0 },
        1,
      )
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_cross_invalid_slow_period/,
      )
    })
  })

  // -------------------------------------------------------------------------
  // indicator.threshold_gte
  // -------------------------------------------------------------------------
  describe('indicator.threshold_gte', () => {
    it('compile() entry — RSI threshold_gte 产生 EXPRESSION_GUARD + flipped LT predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-rsi-th-gte',
        'indicator.threshold_gte',
        { indicator: 'rsi', period: 14 },
        70,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-rsi-th-gte')
      expect(guard).toBeDefined()
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      // gate "通过条件 GTE" → guard 触发条件 LT（flipGateOperator）
      expect(predicate?.kind).toBe('LT')
      const rsi = result.ir.signalCatalog.series.find(s => s.kind === 'RSI')
      expect(rsi?.params?.period).toBe(14)
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'CONST' && (s as { value?: number }).value === 70)).toBe(true)
    })

    it('indicator=sma 路由 SMA × const', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-sma-th-gte',
        'indicator.threshold_gte',
        { indicator: 'sma', period: 50 },
        100,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const sma = result.ir.signalCatalog.series.find(s => s.kind === 'SMA')
      expect(sma?.params?.period).toBe(50)
      expect(result.ir.signalCatalog.series.some(s => s.kind === 'CONST' && (s as { value?: number }).value === 100)).toBe(true)
    })

    it('indicator=ema 路由 EMA × const', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-ema-th-gte',
        'indicator.threshold_gte',
        { indicator: 'ema', period: 21 },
        50,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const ema = result.ir.signalCatalog.series.find(s => s.kind === 'EMA')
      expect(ema?.params?.period).toBe(21)
    })

    it('multi-rule — 两条 threshold_gte 各落各 guard + 各产生独立 RSI series（不同 period）', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      for (const [ruleId, period, value] of [
        ['gate-th-a', 14, 70],
        ['gate-th-b', 21, 80],
      ] as const) {
        spec.rules.push({
          id: ruleId,
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.threshold_gte',
            semanticScope: 'market',
            op: 'GTE',
            value,
            params: { indicator: 'rsi', period },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        })
      }
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
      expect(guardIds).toContain('guard_gate-th-a')
      expect(guardIds).toContain('guard_gate-th-b')
      const rsiPeriods = result.ir.signalCatalog.series
        .filter(s => s.kind === 'RSI')
        .map(s => s.params?.period as number)
        .sort((a, b) => a - b)
      expect(rsiPeriods).toEqual([14, 21])
    })

    it('fail-closed — value 缺失抛 invalid_value', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push({
        id: 'gate-bad',
        phase: 'gate',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'indicator.threshold_gte',
          semanticScope: 'market',
          op: 'GTE',
          params: { indicator: 'rsi', period: 14 },
        } as CanonicalStrategySpecV2['rules'][number]['condition'],
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      })
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_threshold_invalid_value/,
      )
    })

    it('fail-closed — indicator=macd 拒绝（不支持 threshold 语义）', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-bad-macd-th',
        'indicator.threshold_gte',
        { indicator: 'macd' },
        50,
      )
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_threshold_invalid_indicator/,
      )
    })
  })

  // -------------------------------------------------------------------------
  // indicator.threshold_lte
  // -------------------------------------------------------------------------
  describe('indicator.threshold_lte', () => {
    it('compile() entry — RSI threshold_lte 产生 flipped GT predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-rsi-th-lte',
        'indicator.threshold_lte',
        { indicator: 'rsi', period: 14 },
        30,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guard = result.ir.riskPolicy.guards.find(g => g.id === 'guard_gate-rsi-th-lte')
      const predicate = result.ir.signalCatalog.predicates.find(
        p => p.id === (guard as { predicateRef?: string }).predicateRef,
      )
      // gate "通过条件 LTE" → guard 触发条件 GT
      expect(predicate?.kind).toBe('GT')
      const rsi = result.ir.signalCatalog.series.find(s => s.kind === 'RSI')
      expect(rsi?.params?.period).toBe(14)
    })

    it('indicator=sma 路由 SMA × const', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-sma-th-lte',
        'indicator.threshold_lte',
        { indicator: 'sma', period: 200 },
        50,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const sma = result.ir.signalCatalog.series.find(s => s.kind === 'SMA')
      expect(sma?.params?.period).toBe(200)
    })

    it('multi-rule 不互盖 — threshold_gte 与 threshold_lte 共存', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push(
        {
          id: 'gate-th-gte',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.threshold_gte',
            semanticScope: 'market',
            op: 'GTE',
            value: 70,
            params: { indicator: 'rsi', period: 14 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
        {
          id: 'gate-th-lte',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.threshold_lte',
            semanticScope: 'market',
            op: 'LTE',
            value: 30,
            params: { indicator: 'rsi', period: 14 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const kinds = result.ir.signalCatalog.predicates.map(p => p.kind)
      expect(kinds).toContain('LT')
      expect(kinds).toContain('GT')
    })

    it('precision — value=29.5 fractional 不被丢失（toFixed(4) 友好）', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-rsi-th-precision',
        'indicator.threshold_lte',
        { indicator: 'rsi', period: 14 },
        29.5,
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const constSeries = result.ir.signalCatalog.series.filter(s => s.kind === 'CONST')
      expect(
        constSeries.some(s => Number(Number((s as { value?: number }).value).toFixed(4)) === 29.5),
      ).toBe(true)
    })

    it('混合隔离 — 与 indicator.cross_over 共存', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildBaseSpec()
      spec.rules.push(
        {
          id: 'gate-cross',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            semanticScope: 'market',
            op: 'GTE',
            value: 1,
            params: { indicator: 'sma', fastPeriod: 20, slowPeriod: 50 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
        {
          id: 'gate-th-lte',
          phase: 'gate',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'indicator.threshold_lte',
            semanticScope: 'market',
            op: 'LTE',
            value: 30,
            params: { indicator: 'rsi', period: 14 },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        },
      )
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
      expect(guardIds).toContain('guard_gate-cross')
      expect(guardIds).toContain('guard_gate-th-lte')
    })

    it('fail-closed — period=-1 抛 invalid_period', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = buildSpecWithIndicatorGate(
        'gate-bad-period',
        'indicator.threshold_lte',
        { indicator: 'rsi', period: -1 },
        30,
      )
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_indicator_threshold_invalid_period/,
      )
    })
  })
})
