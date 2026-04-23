import type { ExprNode, StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpec } from '../../types/canonical-strategy-spec'
import type { SemanticState, SemanticTriggerState } from '../../types/semantic-state'
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

  function buildSemanticStateWithSecondExitTrigger(): SemanticState {
    const state = buildSemanticState()
    const secondTrigger: SemanticTriggerState = {
      id: 'exit-rise-prev-close-2',
      key: 'price.percent_change',
      phase: 'exit',
      sideScope: 'long',
      params: { direction: 'up', valuePct: 2, basis: 'prev_close', window: '1h' },
      status: 'locked',
      source: 'user_explicit',
      evidence: { text: '价格相对前收盘上涨 2% 时卖出', source: 'user_explicit' },
      openSlots: [],
    }

    return {
      ...state,
      triggers: [...state.triggers, secondTrigger],
    }
  }

  function buildBothSideExitSemanticState(): SemanticState {
    const state = buildSemanticState()
    return {
      ...state,
      triggers: state.triggers.map(trigger =>
        trigger.key === 'price.percent_change'
          ? { ...trigger, sideScope: 'both' as const }
          : trigger,
      ),
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
      ],
      position: {
        ...state.position!,
        positionMode: 'long_short',
      },
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
      exprPool: ast.exprPool.map((expr): ExprNode => {
        if (expr.id === predicate?.id && expr.nodeType === 'predicate') {
          return { ...expr, payload: { ...(expr.payload as PredicateDef), kind: 'LTE' as const } }
        }
        if (predicate?.deps.includes(expr.id) && expr.nodeType === 'series' && expr.payload.kind === 'CONST') {
          return { ...expr, payload: { ...(expr.payload as SeriesDef), value: -0.01 } }
        }
        return expr
      }),
    }
  }

  function driftCanonicalSpec(canonicalSpec: CanonicalStrategySpec): CanonicalStrategySpec {
    if (canonicalSpec.version !== 2) {
      return canonicalSpec
    }

    return {
      ...canonicalSpec,
      rules: canonicalSpec.rules.map(rule =>
        rule.phase === 'exit' && rule.actions.some(action => action.type === 'CLOSE_LONG')
          ? {
              ...rule,
              condition: {
                kind: 'atom' as const,
                key: 'price.change_pct',
                semanticScope: 'market' as const,
                op: 'LTE' as const,
                value: -0.01,
                params: { timeframe: '1h', lookbackBars: 1, basis: 'prev_close' },
              },
            }
          : rule,
      ),
    }
  }

  function driftCanonicalTimeframe(canonicalSpec: CanonicalStrategySpec): CanonicalStrategySpec {
    if (canonicalSpec.version !== 2) {
      return canonicalSpec
    }

    return {
      ...canonicalSpec,
      rules: canonicalSpec.rules.map(rule =>
        rule.phase === 'exit' && rule.actions.some(action => action.type === 'CLOSE_LONG')
          ? {
              ...rule,
              condition: {
                kind: 'atom' as const,
                key: 'price.change_pct',
                semanticScope: 'market' as const,
                op: 'GTE' as const,
                value: 0.01,
                params: { timeframe: '4h', lookbackBars: 1, basis: 'prev_close' },
              },
            }
          : rule,
      ),
    }
  }

  function driftIr(ir: CanonicalStrategyIrV1): CanonicalStrategyIrV1 {
    const exitRule = ir.ruleBlocks.find(rule =>
      rule.phase === 'exit'
      && rule.actions.some(action => action.kind === 'CLOSE_LONG')
    )
    const predicate = ir.signalCatalog.predicates.find(item => item.id === exitRule?.when)
    const constId = predicate?.args.find(arg =>
      ir.signalCatalog.series.some(series => series.id === arg && series.kind === 'CONST')
    )

    return {
      ...ir,
      signalCatalog: {
        ...ir.signalCatalog,
        series: ir.signalCatalog.series.map(series =>
          series.id === constId
            ? { ...series, value: -0.01 }
            : series,
        ),
        predicates: ir.signalCatalog.predicates.map(item =>
          item.id === predicate?.id
            ? { ...item, kind: 'LTE' as const }
            : item,
        ),
      },
    }
  }

  function driftIrLookback(ir: CanonicalStrategyIrV1): CanonicalStrategyIrV1 {
    return {
      ...ir,
      signalCatalog: {
        ...ir.signalCatalog,
        series: ir.signalCatalog.series.map(series =>
          series.kind === 'PRICE_CHANGE_PCT'
            ? { ...series, params: { ...(series.params ?? {}), lookbackBars: 2 } }
            : series,
        ),
      },
    }
  }

  function driftAstTimeframe(ast: StrategyAstV1): StrategyAstV1 {
    return {
      ...ast,
      exprPool: ast.exprPool.map((expr): ExprNode => {
        if (expr.nodeType === 'series' && expr.payload.kind === 'PRICE_CHANGE_PCT') {
          return { ...expr, payload: { ...(expr.payload as SeriesDef), timeframe: '4h' } }
        }
        return expr
      }),
    }
  }

  function removeCloseShort(input: ReturnType<typeof compile>): ReturnType<typeof compile> {
    const { canonicalSpec, ir, ast } = input
    const nextCanonicalSpec: CanonicalStrategySpec = canonicalSpec.version === 2
      ? {
          ...canonicalSpec,
          rules: canonicalSpec.rules.map(rule => ({
            ...rule,
            actions: rule.actions.filter(action => action.type !== 'CLOSE_SHORT'),
          })),
        }
      : canonicalSpec

    return {
      canonicalSpec: nextCanonicalSpec,
      ir: {
        ...ir,
        ruleBlocks: ir.ruleBlocks.map(rule => ({
          ...rule,
          actions: rule.actions.filter(action => action.kind !== 'CLOSE_SHORT'),
        })),
      },
      ast: {
        ...ast,
        decisionPrograms: ast.decisionPrograms.map(program => ({
          ...program,
          actions: program.actions.filter(action => action.kind !== 'CLOSE_SHORT'),
        })),
      },
    }
  }

  function addConflictingAstPriceChangePredicate(ast: StrategyAstV1): StrategyAstV1 {
    const exitProgram = ast.decisionPrograms.find(program =>
      program.phase === 'exit'
      && program.actions.some(action => action.kind === 'CLOSE_LONG')
    )
    const predicate = ast.exprPool.find(expr => expr.id === exitProgram?.when)
    const priceChangeExpr = ast.exprPool.find(expr =>
      predicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'PRICE_CHANGE_PCT'
    )
    const constExpr = ast.exprPool.find(expr =>
      predicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'CONST'
    )

    if (!exitProgram || !priceChangeExpr || !constExpr) {
      throw new Error('expected compiled exit price-change AST shape')
    }

    const conflictConst = {
      ...constExpr,
      id: 'expr_test_const_negative_0_01',
      sourceRef: 'const_-0_01',
      payload: { ...constExpr.payload, id: 'const_-0_01', value: -0.01 },
      deps: [],
    }
    const conflictPredicate = {
      id: 'expr_test_exit_price_change_conflict',
      sourceRef: 'exit-price-change-conflict',
      nodeType: 'predicate' as const,
      payload: {
        id: 'exit-price-change-conflict',
        kind: 'LTE' as const,
        args: [priceChangeExpr.sourceRef, conflictConst.sourceRef],
      },
      deps: [priceChangeExpr.id, conflictConst.id],
    }

    return {
      ...ast,
      exprPool: [
        ...ast.exprPool,
        conflictConst,
        conflictPredicate,
      ],
      decisionPrograms: [
        ...ast.decisionPrograms,
        {
          ...exitProgram,
          id: 'decision_test_exit_price_change_conflict',
          sourceRef: 'exit-price-change-conflict',
          when: conflictPredicate.id,
        },
      ],
    }
  }

  function wrapExitPriceChangeInBoolean(
    input: ReturnType<typeof compile>,
    join: 'AND' | 'OR' = 'AND',
  ): ReturnType<typeof compile> {
    const { canonicalSpec, ir, ast } = input
    if (canonicalSpec.version !== 2) {
      return input
    }

    const exitRule = ir.ruleBlocks.find(rule =>
      rule.phase === 'exit'
      && rule.actions.some(action => action.kind === 'CLOSE_LONG')
    )
    const entryRule = ir.ruleBlocks.find(rule =>
      rule.phase === 'entry'
      && rule.actions.some(action => action.kind === 'OPEN_LONG')
    )
    const exitProgram = ast.decisionPrograms.find(program =>
      program.phase === 'exit'
      && program.actions.some(action => action.kind === 'CLOSE_LONG')
    )
    const entryProgram = ast.decisionPrograms.find(program =>
      program.phase === 'entry'
      && program.actions.some(action => action.kind === 'OPEN_LONG')
    )
    const exitPredicate = ast.exprPool.find(expr => expr.id === exitProgram?.when)
    const entryPredicate = ast.exprPool.find(expr => expr.id === entryProgram?.when)

    if (!exitRule || !entryRule || !exitProgram || !entryProgram || !exitPredicate || !entryPredicate) {
      throw new Error('expected compiled entry and exit predicate shape')
    }

    const wrappedCanonicalSpec: CanonicalStrategySpec = {
      ...canonicalSpec,
      rules: canonicalSpec.rules.map(rule =>
        rule.phase === 'exit' && rule.actions.some(action => action.type === 'CLOSE_LONG')
          ? {
              ...rule,
              condition: {
                kind: join,
                children: [
                  rule.condition,
                  {
                    kind: 'atom' as const,
                    key: 'execution.on_start',
                    semanticScope: 'market' as const,
                  },
                ],
              },
            }
          : rule,
      ),
    }
    const wrappedIr: CanonicalStrategyIrV1 = {
      ...ir,
      signalCatalog: {
        ...ir.signalCatalog,
        predicates: [
          ...ir.signalCatalog.predicates,
          {
            id: 'exit_price_change_and_gate',
            kind: join,
            args: [exitRule.when, entryRule.when],
          },
        ],
      },
      ruleBlocks: ir.ruleBlocks.map(rule =>
        rule.id === exitRule.id
          ? { ...rule, when: 'exit_price_change_and_gate' }
          : rule,
      ),
    }
    const andExpr = {
      id: 'expr_test_exit_price_change_and_gate',
      sourceRef: 'exit_price_change_and_gate',
      nodeType: 'predicate' as const,
      payload: {
        id: 'exit_price_change_and_gate',
        kind: join,
        args: [exitPredicate.sourceRef, entryPredicate.sourceRef],
      },
      deps: [exitPredicate.id, entryPredicate.id],
    }
    const wrappedAst: StrategyAstV1 = {
      ...ast,
      exprPool: [...ast.exprPool, andExpr],
      decisionPrograms: ast.decisionPrograms.map(program =>
        program.id === exitProgram.id
          ? { ...program, when: andExpr.id }
          : program,
      ),
    }

    return { canonicalSpec: wrappedCanonicalSpec, ir: wrappedIr, ast: wrappedAst }
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

  it('fails when canonicalSpec drifts even if AST still matches', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec: driftCanonicalSpec(canonicalSpec), ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when IR drifts even if AST still matches', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir: driftIr(ir), ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when canonicalSpec uses the wrong timeframe even if direction and threshold match', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec: driftCanonicalTimeframe(canonicalSpec), ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when IR uses the wrong lookback even if direction and threshold match', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir: driftIrLookback(ir), ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when AST uses the wrong timeframe even if direction and threshold match', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast: driftAstTimeframe(ast) })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when AST has an extra conflicting same phase and action price-change predicate', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = compile(state)
    const conflictingAst = addConflictingAstPriceChangePredicate(ast)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast: conflictingAst })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('passes when price percent change is nested under AND gate predicates', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = wrapExitPriceChangeInBoolean(compile(state), 'AND')

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when price percent change is weakened under OR gate predicates', () => {
    const state = buildSemanticState()
    const { canonicalSpec, ir, ast } = wrapExitPriceChangeInBoolean(compile(state), 'OR')

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('passes two explicit same phase and action percent-change triggers with different thresholds', () => {
    const state = buildSemanticStateWithSecondExitTrigger()
    const { canonicalSpec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toHaveLength(2)
    expect(checks).toEqual([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
    ])
  })

  it('fails when a both-side percent-change trigger loses the short-side close action', () => {
    const state = buildBothSideExitSemanticState()
    const { canonicalSpec, ir, ast } = removeCloseShort(compile(state))

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toHaveLength(2)
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })
})
