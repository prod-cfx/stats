import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { SemanticAtomInvariantService } from '../semantic-atom-invariant.service'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'

describe('SemanticAtomInvariantService', () => {
  const service = new SemanticAtomInvariantService()

  function buildSemanticState(): SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-on-start',
          key: 'execution.on_start',
          phase: 'entry',
          sideScope: 'long',
          params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-rise-prev-close',
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' },
          status: 'locked',
          source: 'user_explicit',
          evidence: { text: '价格相对前收盘上涨 1% 时卖出', source: 'user_explicit' },
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ORDIUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-23T00:00:00.000Z',
    }
  }

  function compile(state: SemanticState) {
    const builder = new CanonicalSpecBuilderService()
    const canonicalSpec = builder.buildFromNormalizedIntent(
      {
        market: { exchange: 'okx', marketType: 'spot', defaultTimeframe: '1h' },
        symbols: ['ORDIUSDT'],
        timeframes: ['1h'],
      },
      buildNormalizedIntentFromSemanticState(state),
    )
    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: { exchange: 'okx', symbol: 'ORDIUSDT', baseTimeframe: '1h', positionPct: 10 },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    return { canonicalSpec, ir: compiled.ir, ast }
  }

  function driftPriceChangePredicate(ast: StrategyAstV1): StrategyAstV1 {
    const exitProgram = ast.decisionPrograms.find(program =>
      program.phase === 'exit'
      && program.actions.some(action => action.kind === 'CLOSE_LONG')
    )
    const predicate = ast.exprPool.find(expr => expr.id === exitProgram?.when)

    return {
      ...ast,
      exprPool: ast.exprPool.map((expr) => {
        if (expr.id === predicate?.id && expr.nodeType === 'predicate') {
          return { ...expr, payload: { ...expr.payload, kind: 'LTE' as const } }
        }
        if (predicate?.deps.includes(expr.id) && expr.nodeType === 'series' && expr.payload.kind === 'CONST') {
          return { ...expr, payload: { ...expr.payload, value: -0.01 } }
        }
        return expr
      }),
    }
  }

  it('passes when previous-close rise close-long compiles to GTE 0.01', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when previous-close rise close-long drifts to LTE -0.01', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)
    const driftedAst = driftPriceChangePredicate(ast)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast: driftedAst })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })
})
