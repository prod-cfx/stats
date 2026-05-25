import type { ExprNode, StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { ActionDef, CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpec } from '../../types/canonical-strategy-spec'
import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import type { SemanticAtomContract, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { SemanticAtomInvariantService } from '../semantic-atom-invariant.service'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'

describe('SemanticAtomInvariantService', () => {
  const service = new SemanticAtomInvariantService()

  const atom = (key: string, params: Record<string, unknown> = {}): AtomExprAtom => ({
    kind: 'atom',
    key,
    params,
  })

  const rule = (input: {
    id: string
    phase: SemanticRule['phase']
    sideScope: SemanticRule['sideScope']
    condition: SemanticRule['condition']
    actions?: AtomExprAtom[]
    positions?: AtomExprAtom[]
    programs?: AtomExprAtom[]
  }): SemanticRule => ({
    id: input.id,
    phase: input.phase,
    sideScope: input.sideScope,
    condition: input.condition,
    effects: {
      actions: input.actions ?? [],
      risks: [],
      positions: input.positions ?? [],
      orchestration: [],
      programs: input.programs ?? [],
    },
  })

  const replaceGridProgramRuleParams = (state: SemanticState, params: Record<string, unknown>): void => {
    state.rules = state.rules?.map(existingRule =>
      existingRule.id === 'grid-program'
        ? {
            ...existingRule,
            effects: {
              ...existingRule.effects,
              programs: [atom('program.fixed_grid_gated', params)],
            },
          }
        : existingRule,
    )
  }

  const replaceGridProgramBudgetRuleParams = (state: SemanticState, params: Record<string, unknown>): void => {
    state.rules = state.rules?.map(existingRule =>
      existingRule.id === 'grid-program'
        ? {
            ...existingRule,
            effects: {
              ...existingRule.effects,
              positions: [atom('position.per_order_budget', params)],
            },
          }
        : existingRule,
    )
  }

  function buildSemanticState(): SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
      trigger: [
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
      action: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      rules: [
        rule({
          id: 'entry-on-start',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('execution.on_start', { timing: 'on_start', orderType: 'market', occurrence: 'once' }),
          actions: [atom('action.open_long')],
        }),
        rule({
          id: 'exit-rise-prev-close',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' }),
          actions: [atom('action.close_long')],
        }),
      ],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
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
      trigger: [...state.trigger, secondTrigger],
      rules: [
        ...(state.rules ?? []),
        rule({
          id: 'exit-rise-prev-close-2',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'up', valuePct: 2, basis: 'prev_close', window: '1h' }),
          actions: [atom('action.close_long')],
        }),
      ],
    }
  }

  function buildSemanticStateWithoutTriggerWindow(): SemanticState {
    const state = buildSemanticState()
    return {
      ...state,
      trigger: state.trigger.map(trigger =>
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
      rules: state.rules?.map(rule =>
        rule.id === 'exit-rise-prev-close'
          ? { ...rule, condition: atom('price.percent_change', { direction: 'up', valuePct: 1, basis: 'prev_close' }) }
          : rule,
      ),
    }
  }

  function buildBothSideExitSemanticState(): SemanticState {
    const state = buildSemanticState()
    return {
      ...state,
      trigger: state.trigger.map(trigger =>
        trigger.key === 'price.percent_change'
          ? { ...trigger, sideScope: 'both' as const }
          : trigger,
      ),
      action: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
      ],
      rules: [
        rule({
          id: 'entry-on-start',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('execution.on_start', { timing: 'on_start', orderType: 'market', occurrence: 'once' }),
          actions: [atom('action.open_long')],
        }),
        rule({
          id: 'exit-rise-prev-close',
          phase: 'exit',
          sideScope: 'both',
          condition: atom('price.percent_change', { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' }),
          actions: [atom('action.close_long'), atom('action.close_short')],
        }),
      ],
      position: {
        ...state.position!,
        positionMode: 'long_short',
      },
    }
  }

  function buildCloseOpenExpressionSemanticState(): SemanticState {
    const entryExpression = {
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'series', source: 'bar', field: 'open' },
    }
    const exitExpression = {
      kind: 'predicate',
      op: 'LT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'series', source: 'bar', field: 'open' },
    }
    return {
      version: 1,
      families: ['single-leg'],
      trigger: [
        {
          id: 'entry-close-gt-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: entryExpression,
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
            expression: exitExpression,
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      rules: [
        rule({
          id: 'entry-close-gt-open',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('condition.expression', { expression: entryExpression }),
          actions: [atom('action.open_long')],
          positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        }),
        rule({
          id: 'exit-close-lt-open',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('condition.expression', { expression: exitExpression }),
          actions: [atom('action.close_long')],
          positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        }),
      ],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
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
    const expression = {
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
    }
    return {
      ...state,
      trigger: state.trigger.map(trigger =>
        trigger.id === 'entry-close-gt-open'
          ? {
              ...trigger,
              params: {
                expression,
              },
            }
          : trigger,
      ),
      rules: state.rules?.map(rule =>
        rule.id === 'entry-close-gt-open'
          ? { ...rule, condition: atom('condition.expression', { expression }) }
          : rule,
      ),
    }
  }

  function buildOrNotExpressionSemanticState(): SemanticState {
    const state = buildCloseOpenExpressionSemanticState()
    const expression = {
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
    }
    return {
      ...state,
      trigger: state.trigger.map(trigger =>
        trigger.id === 'entry-close-gt-open'
          ? {
              ...trigger,
              params: {
                expression,
              },
            }
          : trigger,
      ),
      rules: state.rules?.map(rule =>
        rule.id === 'entry-close-gt-open'
          ? { ...rule, condition: atom('condition.expression', { expression }) }
          : rule,
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
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
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
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
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
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }

    return {
      version: 1,
      families: ['single-leg'],
      trigger: [
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
      action: [
        {
          id: 'maintain-grid',
          key: 'maintain_grid',
          status: 'locked',
          source: 'user_explicit',
          contracts: [orderProgramContract],
        },
      ],
      rules: [
        rule({
          id: 'grid-program',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start', { timing: 'on_start', orderType: 'market', occurrence: 'once' }),
          positions: [atom('position.per_order_budget', { value: 20, asset: 'USDT' })],
          programs: [atom('program.fixed_grid_gated', {
            lower: 60000,
            upper: 80000,
            gridIntervals: 10,
            gridCount: 11,
            absoluteSpacing: 2000,
            spacingMode: 'arithmetic',
            recycleOnFill: true,
            cancelOnStop: true,
          })],
        }),
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
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
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

  it('passes when percent-spaced fixed grid order programs derive level count without semantic gridCount', () => {
    const state = buildContractOrderProgramSemanticState()
    const levelSet = state.trigger[0]?.contracts?.[0]?.capabilities[0]
    if (levelSet) {
      levelSet.shape = {
        lower: 79200,
        upper: 80200,
        spacingPct: 0.1,
        spacingMode: 'arithmetic',
      }
      replaceGridProgramRuleParams(state, levelSet.shape)
    }
    if (state.action[0]?.contracts?.[0]) {
      state.action[0].contracts[0].requires = []
    }
    if (state.position?.contracts?.[0]?.capabilities[0]) {
      state.position.contracts[0].capabilities = state.position.contracts[0].capabilities.filter(capability =>
        !(capability.domain === 'capital' && capability.verb === 'allocate'),
      )
      state.position = {
        ...state.position,
        mode: 'fixed_ratio',
        value: 10,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      }
    }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms : []).toHaveLength(1)
    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms?.[0]?.levelSet : null).toEqual(expect.objectContaining({
      lower: 79200,
      upper: 80200,
      spacingPct: 0.1,
    }))
    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms?.[0]?.levelSet : null).not.toHaveProperty('gridCount')
    expect(ir.orderPrograms[0]?.maxWorkingOrders).toBe(13)
    expect(ast.orderPrograms[0]?.payload.maxWorkingOrders).toBe(13)
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('passes condition grid.range_rebalance as rules-only order program with ratio sizing', () => {
    const base = buildSemanticState()
    const state: SemanticState = {
      ...base,
      trigger: [],
      action: [],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
      },
      rules: [
        rule({
          id: 'program-bidirectional-grid-range',
          phase: 'entry',
          sideScope: 'both',
          condition: atom('grid.range_rebalance', {
            rangeLower: 60000,
            rangeUpper: 80000,
            stepPct: 0.5,
            sideMode: 'both',
            perGridSizing: 10,
            breakoutAction: 'continue',
          }),
        }),
      ],
    }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(canonicalSpec.version === 2 ? canonicalSpec.orderPrograms : []).toHaveLength(1)
    expect(ir.orderPrograms).toEqual([
      expect.objectContaining({
        quantity: { mode: 'pct_equity', value: 10 },
      }),
    ])
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.order_program',
        status: 'passed',
        level: 'critical',
      }),
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
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
    const levelSet = state.trigger[0]?.contracts?.[0]?.capabilities[0]
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
      replaceGridProgramRuleParams(state, levelSet.shape)
    }
    if (state.position?.contracts?.[0]?.capabilities[0]) {
      state.position.contracts[0].capabilities[0].shape = { value: 10, asset: 'USDT' }
      state.position = {
        ...state.position,
        value: 10,
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      }
      replaceGridProgramBudgetRuleParams(state, { value: 10, asset: 'USDT' })
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
    const levelSet = state.trigger[0]?.contracts?.[0]?.capabilities[0]
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

  it('ignores flat conflicting level_set contracts when rules-only order program is authoritative', () => {
    let state = buildContractOrderProgramSemanticState()
    const canonicalState = buildContractOrderProgramSemanticState()
    const triggerContract = state.trigger[0]?.contracts?.[0]
    if (triggerContract) {
      const updatedTrigger = {
        ...state.trigger[0]!,
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
      state = {
        ...state,
        trigger: [updatedTrigger, ...state.trigger.slice(1)],
      }
    }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(canonicalState)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
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
      ...buildSemanticState(),
      position: {
        mode: 'fixed_quote',
        value: 10,
        sizing: { kind: 'quote' as const, value: 10, asset: 'USDC' as const },
        positionMode: 'long_only',
        status: 'locked' as const,
        source: 'user_explicit' as const,
      },
      rules: [{
        id: 'entry-usdc-budget',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        condition: { kind: 'atom' as const, key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
          risks: [],
          positions: [{ kind: 'atom' as const, key: 'position.per_order_budget', params: { value: 10, asset: 'USDC' } }],
          orchestration: [],
          programs: [],
        },
      }],
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

  it('keeps position sizing when rules-tree projection uses dotted action atom keys', () => {
    const baseState = buildSemanticState()
    const state: SemanticState = {
      ...baseState,
      action: [
        { id: 'open-long', key: 'action.open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'action.close_long', status: 'locked', source: 'user_explicit' },
      ],
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('ignores ordinary add-position sizing when checking main position sizing contract', () => {
    const state: SemanticState = {
      ...buildSemanticState(),
      rules: [
        rule({
          id: 'entry-open-long',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('price.breakout_up', { period: 1 }),
          actions: [atom('action.open_long')],
        }),
        rule({
          id: 'entry-profit-add',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'up', valuePct: 3, basis: 'entry_avg_price' }),
          actions: [atom('action.add_position', {
            addMode: 'profit_pct',
            profitThreshold: 3,
            sizing: { kind: 'ratio', value: 0.5, unit: 'ratio' },
          })],
          positions: [atom('position.pyramiding_limit', { maxLayers: 3 })],
        }),
        rule({
          id: 'exit-close-long',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'down', valuePct: 5, basis: 'entry_avg_price' }),
          actions: [atom('action.close_long')],
        }),
      ],
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
      }),
    ]))
  })

  it('ignores stale top-level position sizing for lifecycle-only DCA rules', () => {
    const state: SemanticState = {
      ...buildSemanticState(),
      position: {
        mode: 'fixed_ratio',
        value: 0.05,
        sizing: { kind: 'ratio', value: 0.05, unit: 'ratio' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [
        rule({
          id: 'program-dca',
          phase: 'program',
          sideScope: 'long',
          condition: atom('execution.on_start', { timing: 'on_start' }),
          positions: [atom('position.dca_schedule', {
            interval: '1d',
            perOrderBudget: 100,
            maxOrders: 2,
          })],
        }),
        rule({
          id: 'entry-drawdown-add',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'down', valuePct: 5, basis: 'entry_avg_price' }),
          actions: [atom('action.add_position', {
            addMode: 'drawdown_pct',
            drawdownThreshold: 5,
            sizing: { kind: 'quote', value: 200, asset: 'USDT' },
          })],
        }),
        rule({
          id: 'exit-drop',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'down', valuePct: 5, basis: 'entry_avg_price' }),
          actions: [atom('action.close_long')],
        }),
      ],
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks.some(check => check.key === 'semantic_contract.position_sizing')).toBe(false)
  })

  it('keeps position sizing for rules-tree projected EMA cross flat actions', () => {
    const baseState = buildSemanticState()
    const state: SemanticState = {
      ...baseState,
      trigger: [
        {
          id: 'entry-ema-cross-cond-0',
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-ema-cross-cond-0',
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [
        { id: 'entry-ema-cross-eff-0', key: 'action.open_long', params: {}, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'exit-ema-cross-eff-0', key: 'action.close_long', params: {}, status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      rules: [
        rule({
          id: 'entry-ema-cross',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('indicator.cross_over', { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
          actions: [atom('action.open_long')],
        }),
        rule({
          id: 'exit-ema-cross',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('indicator.cross_under', { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
          actions: [atom('action.close_long')],
        }),
      ],
      risk: [],
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_contract.position_sizing',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('normalizes percent-change direction when valuePct is positive for a down move', () => {
    const baseState = buildSemanticState()
    const state: SemanticState = {
      ...baseState,
      trigger: [
        {
          id: 'entry-price-drop-cond-0',
          key: 'price.percent_change',
          phase: 'entry',
          sideScope: 'long',
          params: { direction: 'down', valuePct: 1, window: '3m' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-take-profit-pct-cond-0',
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: { direction: 'up', valuePct: 2, basis: 'entry_avg_price', window: '15m' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [
        { id: 'open-long', key: 'action.open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close-long', key: 'action.close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      rules: [
        rule({
          id: 'entry-price-drop-cond-0',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'down', valuePct: 1, basis: 'prev_close', window: '3m' }),
          actions: [atom('action.open_long')],
        }),
        rule({
          id: 'exit-take-profit-pct-cond-0',
          phase: 'exit',
          sideScope: 'long',
          condition: atom('price.percent_change', { direction: 'up', valuePct: 2, basis: 'entry_avg_price', window: '15m' }),
          actions: [atom('action.close_long')],
        }),
      ],
    }
    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)

    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('detects inferred generic expression drift once the trigger is locked', () => {
    const baseState = buildCloseOpenExpressionSemanticState()
    const state = {
      ...baseState,
      trigger: baseState.trigger.map(trigger => ({
        ...trigger,
        source: 'inferred' as const,
      })),
    }
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

  // PR3.8: 投影后 state.position.sizing 填充，invariant 不报 sizing missing
  it('PR3.8: invariant passes position_sizing check when position.sizing is derived from action per_order_budget', () => {
    // Simulate state after PR3.7 projection: position.sizing is derived from action budget
    const state: SemanticState = {
      ...buildSemanticState(),
      position: {
        sizing: { kind: 'quote', value: 100, asset: 'USDT' },
        mode: 'fixed_quote',
        value: 100,
        positionMode: 'long_only',
        status: 'locked',
        source: 'derived',
        openSlots: [],
      },
      rules: [{
        id: 'entry-derived-budget',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [{ kind: 'atom', key: 'position.per_order_budget', params: { value: 100, asset: 'USDT' } }],
          orchestration: [],
          programs: [],
        },
      }],
    }

    const { canonicalSpec, ir, ast } = compileFromSemanticState(state)
    const checks = service.validate({ semanticState: state, canonicalSpec, ir, ast })

    // sizing check should pass (not fail) — projection filled in the correct value
    const sizingChecks = checks.filter(c => c.key === 'semantic_contract.position_sizing')
    expect(sizingChecks.length).toBeGreaterThan(0)
    expect(sizingChecks.every(c => c.status === 'passed')).toBe(true)
  })
})
