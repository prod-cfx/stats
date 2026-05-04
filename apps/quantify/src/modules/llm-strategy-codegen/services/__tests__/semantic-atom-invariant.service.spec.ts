import type { ExprNode, StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { ActionDef, CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpec } from '../../types/canonical-strategy-spec'
import type { SemanticAtomContract, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
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

  function buildSemanticStateWithoutTriggerWindow(): SemanticState {
    const state = buildSemanticState()
    return {
      ...state,
      triggers: state.triggers.map(trigger =>
        trigger.key === 'price.percent_change'
          ? {
              ...trigger,
              params: {
                direction: 'up',
                valuePct: 1,
                basis: 'prev_close',
              },
            }
          : trigger,
      ),
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

  function buildCloseOpenExpressionSemanticState(): SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
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
          id: 'exit-close-lt-open',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
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
  }

  function buildLogicalExpressionSemanticState(): SemanticState {
    const state = buildCloseOpenExpressionSemanticState()
    return {
      ...state,
      triggers: state.triggers.map(trigger =>
        trigger.id === 'entry-close-gt-open'
          ? {
              ...trigger,
              params: {
                expression: {
                  kind: 'AND',
                  children: [
                    {
                      kind: 'predicate',
                      op: 'GT',
                      left: { kind: 'series', source: 'bar', field: 'close' },
                      right: { kind: 'series', source: 'bar', field: 'open' },
                    },
                    {
                      kind: 'predicate',
                      op: 'LT',
                      left: { kind: 'series', source: 'bar', field: 'close' },
                      right: { kind: 'series', source: 'bar', field: 'high' },
                    },
                  ],
                },
              },
            }
          : trigger,
      ),
    }
  }

  function buildOrNotExpressionSemanticState(): SemanticState {
    const state = buildCloseOpenExpressionSemanticState()
    return {
      ...state,
      triggers: state.triggers.map(trigger =>
        trigger.id === 'entry-close-gt-open'
          ? {
              ...trigger,
              params: {
                expression: {
                  kind: 'OR',
                  children: [
                    {
                      kind: 'predicate',
                      op: 'GT',
                      left: { kind: 'series', source: 'bar', field: 'close' },
                      right: { kind: 'series', source: 'bar', field: 'open' },
                    },
                    {
                      kind: 'NOT',
                      children: [
                        {
                          kind: 'predicate',
                          op: 'LT',
                          left: { kind: 'series', source: 'bar', field: 'close' },
                          right: { kind: 'series', source: 'bar', field: 'low' },
                        },
                      ],
                    },
                  ],
                },
              },
            }
          : trigger,
      ),
    }
  }

  function buildContractOrderProgramSemanticState(): SemanticState {
    const levelSetContract: SemanticAtomContract = {
      id: 'trigger-grid-range',
      kind: 'trigger',
      capabilities: [
        {
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape: { lower: 60000, upper: 80000, gridIntervals: 10, gridCount: 11, absoluteSpacing: 2000, spacingMode: 'arithmetic' },
        },
      ],
      requires: [],
      params: {},
    }
    const orderProgramContract: SemanticAtomContract = {
      id: 'action-maintain-limit-ladder',
      kind: 'action',
      capabilities: [
        {
          domain: 'order_program',
          verb: 'maintain',
          object: 'limit_ladder',
          shape: { recycleOnFill: true, cancelOnStop: true },
        },
      ],
      requires: [
        { domain: 'price', verb: 'define', object: 'level_set' },
        { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
      ],
      params: {},
    }
    const budgetContract: SemanticAtomContract = {
      id: 'position-per-order-budget',
      kind: 'position',
      capabilities: [
        {
          domain: 'capital',
          verb: 'allocate',
          object: 'per_order_budget',
          shape: { value: 20, asset: 'USDT' },
        },
        {
          domain: 'exposure',
          verb: 'set',
          object: 'position_mode',
          shape: { mode: 'neutral' },
        },
      ],
      requires: [],
      params: {},
    }

    return {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'grid-range',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'both',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [levelSetContract],
        },
      ],
      actions: [
        {
          id: 'maintain-grid',
          key: 'maintain_grid',
          status: 'locked',
          source: 'user_explicit',
          contracts: [orderProgramContract],
        },
      ],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 20,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        contracts: [budgetContract],
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTC-USDT-SWAP', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
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

  function compileFromSemanticState(state: SemanticState) {
    const builder = new CanonicalSpecBuilderService()
    const canonicalSpec = builder.buildFromSemanticState(state)
    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1m', positionPct: 10 },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    return { canonicalSpec, ir: compiled.ir, ast }
  }

  function replaceOrderProgramWithOpenLong(ir: CanonicalStrategyIrV1): CanonicalStrategyIrV1 {
    const activeWhen = ir.orderPrograms[0]?.activeWhen ?? ir.signalCatalog.predicates[0]?.id ?? 'always'
    return {
      ...ir,
      orderPrograms: [],
      ruleBlocks: [
        ...ir.ruleBlocks,
        {
          id: 'contract_order_program_downgraded_to_open_long',
          phase: 'entry',
          when: activeWhen,
          priority: 100,
          actions: [{ kind: 'OPEN_LONG', quantity: ir.portfolio.sizing }],
        },
      ],
    }
  }

  function addWrappedOpenLongFallback(
    ir: CanonicalStrategyIrV1,
    join: 'AND' | 'OR' | 'NOT',
  ): CanonicalStrategyIrV1 {
    const activeWhen = ir.orderPrograms[0]?.activeWhen ?? ir.signalCatalog.predicates[0]?.id ?? 'always'
    const wrappedWhen = `test_wrapped_${join.toLowerCase()}_contract_order_program_active`
    return {
      ...ir,
      signalCatalog: {
        ...ir.signalCatalog,
        predicates: [
          ...ir.signalCatalog.predicates,
          {
            id: wrappedWhen,
            kind: join,
            args: [activeWhen],
          },
        ],
      },
      ruleBlocks: [
        ...ir.ruleBlocks,
        {
          id: `contract_order_program_downgraded_to_wrapped_${join.toLowerCase()}_open_long`,
          phase: 'entry',
          when: wrappedWhen,
          priority: 100,
          actions: [{ kind: 'OPEN_LONG', quantity: ir.portfolio.sizing }],
        },
      ],
    }
  }

  function addUnrelatedWrappedOpenLongFallback(ir: CanonicalStrategyIrV1): CanonicalStrategyIrV1 {
    const unrelatedWhen = ir.signalCatalog.predicates.find(predicate =>
      predicate.id !== ir.orderPrograms[0]?.activeWhen,
    )?.id ?? 'test_unrelated_active'
    const wrappedWhen = 'test_wrapped_unrelated_open_long'
    return {
      ...ir,
      signalCatalog: {
        ...ir.signalCatalog,
        predicates: [
          ...ir.signalCatalog.predicates,
          {
            id: wrappedWhen,
            kind: 'AND',
            args: [unrelatedWhen],
          },
        ],
      },
      ruleBlocks: [
        ...ir.ruleBlocks,
        {
          id: 'unrelated_wrapped_open_long',
          phase: 'entry',
          when: wrappedWhen,
          priority: 100,
          actions: [{ kind: 'OPEN_LONG', quantity: ir.portfolio.sizing }],
        },
      ],
    }
  }

  function addBuyFallbackDecisionToAst(ast: StrategyAstV1, ir: CanonicalStrategyIrV1): StrategyAstV1 {
    const activeWhen = ir.orderPrograms[0]?.activeWhen
    const whenExpr = ast.exprPool.find(expr => expr.sourceRef === activeWhen)
    if (!whenExpr) {
      throw new Error('expected order program active predicate in AST exprPool')
    }

    return {
      ...ast,
      decisionPrograms: [
        ...ast.decisionPrograms,
        {
          id: 'decision_test_contract_order_program_buy_fallback',
          sourceRef: 'contract_order_program_buy_fallback',
          phase: 'entry',
          when: whenExpr.id,
          priority: 100,
          actions: [
            { kind: 'BUY', quantity: ir.portfolio.sizing } as unknown as ActionDef,
          ],
        },
      ],
    }
  }

  function addWrappedBuyFallbackDecisionToAst(
    ast: StrategyAstV1,
    ir: CanonicalStrategyIrV1,
    join: 'AND' | 'OR' | 'NOT',
  ): StrategyAstV1 {
    const activeWhen = ir.orderPrograms[0]?.activeWhen
    const whenExpr = ast.exprPool.find(expr => expr.sourceRef === activeWhen)
    if (!whenExpr) {
      throw new Error('expected order program active predicate in AST exprPool')
    }

    const wrappedExpr: ExprNode = {
      id: `expr_test_wrapped_${join.toLowerCase()}_contract_order_program_active`,
      sourceRef: `test_wrapped_${join.toLowerCase()}_contract_order_program_active`,
      nodeType: 'predicate',
      payload: {
        id: `test_wrapped_${join.toLowerCase()}_contract_order_program_active`,
        kind: join,
        args: [whenExpr.sourceRef],
      },
      deps: [whenExpr.id],
    }

    return {
      ...ast,
      exprPool: [...ast.exprPool, wrappedExpr],
      decisionPrograms: [
        ...ast.decisionPrograms,
        {
          id: `decision_test_contract_order_program_wrapped_${join.toLowerCase()}_buy_fallback`,
          sourceRef: `contract_order_program_wrapped_${join.toLowerCase()}_buy_fallback`,
          phase: 'entry',
          when: wrappedExpr.id,
          priority: 100,
          actions: [
            { kind: 'BUY', quantity: ir.portfolio.sizing } as unknown as ActionDef,
          ],
        },
      ],
    }
  }

  function addUnrelatedWrappedBuyFallbackDecisionToAst(ast: StrategyAstV1, ir: CanonicalStrategyIrV1): StrategyAstV1 {
    const activeWhen = ir.orderPrograms[0]?.activeWhen
    const unrelatedExpr = ast.exprPool.find(expr =>
      expr.nodeType === 'predicate'
      && expr.sourceRef !== activeWhen,
    )
    if (!unrelatedExpr) {
      throw new Error('expected unrelated predicate in AST exprPool')
    }

    const wrappedExpr: ExprNode = {
      id: 'expr_test_wrapped_unrelated_buy_fallback',
      sourceRef: 'test_wrapped_unrelated_buy_fallback',
      nodeType: 'predicate',
      payload: {
        id: 'test_wrapped_unrelated_buy_fallback',
        kind: 'AND',
        args: [unrelatedExpr.sourceRef],
      },
      deps: [unrelatedExpr.id],
    }

    return {
      ...ast,
      exprPool: [...ast.exprPool, wrappedExpr],
      decisionPrograms: [
        ...ast.decisionPrograms,
        {
          id: 'decision_test_unrelated_wrapped_buy_fallback',
          sourceRef: 'unrelated_wrapped_buy_fallback',
          phase: 'entry',
          when: wrappedExpr.id,
          priority: 100,
          actions: [
            { kind: 'BUY', quantity: ir.portfolio.sizing } as unknown as ActionDef,
          ],
        },
      ],
    }
  }

  function driftCloseOpenExpressionAst(ast: StrategyAstV1): StrategyAstV1 {
    const entryProgram = ast.decisionPrograms.find(program =>
      program.phase === 'entry'
      && program.actions.some(action => action.kind === 'OPEN_LONG')
    )
    const predicate = ast.exprPool.find(expr => expr.id === entryProgram?.when)

    return {
      ...ast,
      exprPool: ast.exprPool.map((expr): ExprNode => {
        if (expr.id === predicate?.id && expr.nodeType === 'predicate') {
          return { ...expr, payload: { ...(expr.payload as PredicateDef), kind: 'LT' as const } }
        }
        return expr
      }),
    }
  }

  function driftLogicalExpressionLeafAst(ast: StrategyAstV1): StrategyAstV1 {
    const entryProgram = ast.decisionPrograms.find(program =>
      program.phase === 'entry'
      && program.actions.some(action => action.kind === 'OPEN_LONG')
    )
    const rootPredicate = ast.exprPool.find(expr => expr.id === entryProgram?.when)
    const leafPredicate = ast.exprPool.find(expr =>
      rootPredicate?.deps.includes(expr.id)
      && expr.nodeType === 'predicate'
      && (expr.payload as PredicateDef).kind === 'LT'
    )

    return {
      ...ast,
      exprPool: ast.exprPool.map((expr): ExprNode => {
        if (expr.id === leafPredicate?.id && expr.nodeType === 'predicate') {
          return { ...expr, payload: { ...(expr.payload as PredicateDef), kind: 'GT' as const } }
        }
        return expr
      }),
    }
  }

  function driftFirstLtExpressionLeafAst(ast: StrategyAstV1): StrategyAstV1 {
    const leafPredicate = ast.exprPool.find(expr =>
      expr.nodeType === 'predicate'
      && (expr.payload as PredicateDef).kind === 'LT'
    )

    return {
      ...ast,
      exprPool: ast.exprPool.map((expr): ExprNode => {
        if (expr.id === leafPredicate?.id && expr.nodeType === 'predicate') {
          return { ...expr, payload: { ...(expr.payload as PredicateDef), kind: 'GT' as const } }
        }
        return expr
      }),
    }
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

  it('passes when contract order program semantics survive canonicalSpec, IR, and AST', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms : []).toHaveLength(1)
    expect(ir.orderPrograms).toHaveLength(1)
    expect(ir.orderPrograms[0]?.maxWorkingOrders).toBe(11)
    expect(ast.orderPrograms).toHaveLength(1)
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when canonical contract order program drops normalized absolute spacing', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    if (canonicalSpec.version !== 2) {
      throw new Error('expected canonical spec v2')
    }
    const driftedCanonicalSpec: CanonicalStrategySpec = {
      ...canonicalSpec,
      orderPrograms: canonicalSpec.orderPrograms?.map(program => ({
        ...program,
        levelSet: {
          ...program.levelSet,
          absoluteSpacing: 2500,
        },
      })),
    }

    const checks = service.validate({ semanticState: state, canonicalSpec: driftedCanonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('passes when centered-percent contract order program semantics survive canonicalSpec, IR, and AST', () => {
    const state = buildContractOrderProgramSemanticState()
    const levelSet = state.triggers[0]?.contracts?.[0]?.capabilities[0]
    if (levelSet) {
      levelSet.shape = {
        mode: 'centered_percent_range',
        centerTiming: 'deployment',
        centerSource: 'last_price',
        halfRangePct: 0.4,
        gridIntervals: 10,
        gridCount: 11,
        spacingMode: 'arithmetic',
      }
    }
    if (state.position?.contracts?.[0]?.capabilities[0]) {
      state.position.contracts[0].capabilities[0].shape = { value: 10, asset: 'USDT' }
      state.position = {
        ...state.position,
        value: 10,
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      }
    }
    state.contextSlots.symbol = { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ETHUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true }
    state.contextSlots.marketType = { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true }
    state.contextSlots.timeframe = { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms : []).toHaveLength(1)
    expect(ir.orderPrograms).toHaveLength(1)
    expect(ast.orderPrograms).toHaveLength(1)
    expect(ast.topology.orderProgramOrder).toHaveLength(1)
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when centered-percent canonical density drifts from semantic grid intervals', () => {
    const state = buildContractOrderProgramSemanticState()
    const levelSet = state.triggers[0]?.contracts?.[0]?.capabilities[0]
    if (levelSet) {
      levelSet.shape = {
        mode: 'centered_percent_range',
        centerTiming: 'deployment',
        centerSource: 'last_price',
        halfRangePct: 0.4,
        gridIntervals: 10,
        gridCount: 11,
        spacingMode: 'arithmetic',
      }
    }
    if (state.position?.contracts?.[0]?.capabilities[0]) {
      state.position.contracts[0].capabilities[0].shape = { value: 10, asset: 'USDT' }
      state.position = {
        ...state.position,
        value: 10,
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      }
    }
    state.contextSlots.symbol = { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ETHUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true }
    state.contextSlots.marketType = { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true }
    state.contextSlots.timeframe = { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    if (canonicalSpec.version !== 2) {
      throw new Error('expected canonical spec v2')
    }
    const driftedCanonicalSpec: CanonicalStrategySpec = {
      ...canonicalSpec,
      orderPrograms: canonicalSpec.orderPrograms?.map(program => ({
        ...program,
        levelSet: {
          ...program.levelSet,
          gridIntervals: 9,
        },
      })),
    }

    const checks = service.validate({ semanticState: state, canonicalSpec: driftedCanonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('does not collapse conflicting level_set contracts that only differ by absolute spacing', () => {
    const state = buildContractOrderProgramSemanticState()
    const canonicalState = buildContractOrderProgramSemanticState()
    const triggerContract = state.triggers[0]?.contracts?.[0]
    if (triggerContract) {
      state.triggers[0] = {
        ...state.triggers[0]!,
        contracts: [
          triggerContract,
          {
            ...triggerContract,
            id: 'trigger-grid-range-different-spacing',
            capabilities: triggerContract.capabilities.map(capability =>
              capability.object === 'level_set'
                ? {
                    ...capability,
                    shape: {
                      ...capability.shape,
                      absoluteSpacing: 2500,
                    },
                  }
                : capability,
            ),
          },
        ],
      }
    }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(canonicalState)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when contract order program AST loses orderPrograms', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: { ...ast, orderPrograms: [] },
    })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when contract order program IR is downgraded to ordinary OPEN_LONG', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir } = compileFromSemanticState(state)
    const driftedIr = replaceOrderProgramWithOpenLong(ir)
    const driftedAst = new CanonicalStrategyAstCompilerService().compile(driftedIr)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir: driftedIr, ast: driftedAst })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'failed',
        level: 'critical',
      }),
    ]))
    expect(checks.some(check =>
      check.status === 'failed' && check.key === 'semantic_contract.order_program',
    )).toBe(true)
  })

  it.each(['AND', 'OR', 'NOT'] as const)(
    'fails when contract order program IR is downgraded to ordinary OPEN_LONG behind %s',
    (join) => {
      const state = buildContractOrderProgramSemanticState()
      const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
      const driftedIr = addWrappedOpenLongFallback(ir, join)

      const checks = service.validate({ semanticState: state, canonicalSpec, ir: driftedIr, ast })

      expect(checks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'semantic_contract.order_program',
          status: 'failed',
          level: 'critical',
        }),
      ]))
    },
  )

  it('fails when contract order program AST also contains ordinary BUY fallback action', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: addBuyFallbackDecisionToAst(ast, ir),
    })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'failed',
        level: 'critical',
      }),
    ]))
    expect(checks.some(check =>
      check.status === 'failed' && check.key === 'semantic_contract.order_program',
    )).toBe(true)
  })

  it.each(['AND', 'OR', 'NOT'] as const)(
    'fails when contract order program AST also contains ordinary BUY fallback action behind %s',
    (join) => {
      const state = buildContractOrderProgramSemanticState()
      const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

      const checks = service.validate({
        semanticState: state,
        canonicalSpec,
        ir,
        ast: addWrappedBuyFallbackDecisionToAst(ast, ir, join),
      })

      expect(checks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'semantic_contract.order_program',
          status: 'failed',
          level: 'critical',
        }),
      ]))
    },
  )

  it('passes when ordinary fallback actions depend on a different activeWhen', () => {
    const state = buildContractOrderProgramSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir: addUnrelatedWrappedOpenLongFallback(ir),
      ast: addUnrelatedWrappedBuyFallbackDecisionToAst(ast, ir),
    })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('detects generic expression drift', () => {
    const state = buildCloseOpenExpressionSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const passingChecks = service.validate({ semanticState: state, canonicalSpec, ir, ast })
    const driftChecks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: driftCloseOpenExpressionAst(ast),
    })

    expect(passingChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'passed',
        level: 'critical',
      }),
    ]))
    expect(driftChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'failed',
        level: 'critical',
        message: expect.stringMatching(/semantic expression drift/i),
      }),
    ]))
  })

  it('detects position sizing contract asset drift across canonical, IR and AST', () => {
    const state = {
      ...buildCloseOpenExpressionSemanticState(),
      position: {
        mode: 'fixed_quote',
        value: 10,
        sizing: { kind: 'quote' as const, value: 10, asset: 'USDC' as const },
        positionMode: 'long_only',
        status: 'locked' as const,
        source: 'user_explicit' as const,
      },
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const passingChecks = service.validate({ semanticState: state, canonicalSpec, ir, ast })
    const driftChecks = service.validate({
      semanticState: state,
      canonicalSpec: {
        ...canonicalSpec,
        sizing: { mode: 'QUOTE', value: 10 },
      },
      ir: {
        ...ir,
        portfolio: {
          ...ir.portfolio,
          sizing: { mode: 'fixed_quote', value: 10 },
        },
      },
      ast: {
        ...ast,
        decisionPrograms: ast.decisionPrograms.map(program => ({
          ...program,
          actions: program.actions.map(action =>
            action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT'
              ? { ...action, quantity: { mode: 'fixed_quote' as const, value: 10 } }
              : action,
          ),
        })),
      },
    })

    expect(passingChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
        level: 'critical',
      }),
    ]))
    expect(driftChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'failed',
        level: 'critical',
        message: expect.stringMatching(/position sizing contract drift/i),
      }),
    ]))
  })

  it('detects inferred generic expression drift once the trigger is locked', () => {
    const state = buildCloseOpenExpressionSemanticState()
    state.triggers = state.triggers.map(trigger => ({
      ...trigger,
      source: 'inferred',
    }))
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const driftChecks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: driftCloseOpenExpressionAst(ast),
    })

    expect(driftChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'failed',
        level: 'critical',
        message: expect.stringMatching(/semantic expression drift/i),
      }),
    ]))
  })

  it('detects logical generic expression leaf drift', () => {
    const state = buildLogicalExpressionSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const passingChecks = service.validate({ semanticState: state, canonicalSpec, ir, ast })
    const driftChecks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: driftLogicalExpressionLeafAst(ast),
    })

    expect(passingChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'passed',
        level: 'critical',
      }),
    ]))
    expect(driftChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'failed',
        level: 'critical',
        message: expect.stringMatching(/semantic expression drift/i),
      }),
    ]))
  })

  it('passes legal OR/NOT logical generic expression and still detects leaf drift', () => {
    const state = buildOrNotExpressionSemanticState()
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const passingChecks = service.validate({ semanticState: state, canonicalSpec, ir, ast })
    const driftChecks = service.validate({
      semanticState: state,
      canonicalSpec,
      ir,
      ast: driftFirstLtExpressionLeafAst(ast),
    })

    expect(passingChecks.filter(check => check.key === 'semantic_atom.expression')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'passed', level: 'critical' }),
      ]),
    )
    expect(passingChecks.filter(check => check.key === 'semantic_atom.expression')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'failed' }),
      ]),
    )
    expect(driftChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.expression',
        status: 'failed',
        level: 'critical',
        message: expect.stringMatching(/semantic expression drift/i),
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

  it('uses locked semantic context timeframe when the trigger omits window', () => {
    const state = buildSemanticStateWithoutTriggerWindow()
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

  it('fails timeframe drift when trigger omits window but semantic context is locked', () => {
    const state = buildSemanticStateWithoutTriggerWindow()
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
    const priceChecks = checks.filter(check => check.key === 'semantic_atom.price_percent_change')

    expect(priceChecks).toHaveLength(2)
    expect(priceChecks).toEqual([
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
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when a both-side percent-change trigger loses the short-side close action', () => {
    const state = buildBothSideExitSemanticState()
    const { canonicalSpec, ir, ast } = removeCloseShort(compile(state))

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })
    const priceChecks = checks.filter(check => check.key === 'semantic_atom.price_percent_change')

    expect(priceChecks).toHaveLength(2)
    expect(priceChecks).toEqual(expect.arrayContaining([
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
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })
})
