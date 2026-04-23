import type { ExprNode, StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import type { CanonicalRuleV2, CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type { StrategyConsistencyCheck } from '../types/strategy-consistency-report'
import { Injectable } from '@nestjs/common'

type PriceChangeDirection = 'up' | 'down'
type PositionAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type PredicateKind = PredicateDef['kind']

interface PredicateSnapshot {
  predicateKind: PredicateKind
  constValue: number | null
  hasPriceChangeSeries: boolean
}

@Injectable()
export class SemanticAtomInvariantService {
  validate(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    return this.validatePricePercentChange(input)
  }

  private validatePricePercentChange(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    return input.semanticState.triggers
      .filter(trigger => this.isBlockingPricePercentChangeTrigger(trigger))
      .map(trigger => this.validatePricePercentChangeTrigger(trigger, input))
  }

  private isBlockingPricePercentChangeTrigger(trigger: SemanticTriggerState): boolean {
    const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
    return trigger.key === 'price.percent_change'
      && trigger.status === 'locked'
      && trigger.source === 'user_explicit'
      && basis === 'prev_close'
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
  }

  private validatePricePercentChangeTrigger(
    trigger: SemanticTriggerState,
    input: {
      canonicalSpec: CanonicalStrategySpec
      ir: CanonicalStrategyIrV1
      ast: StrategyAstV1
    },
  ): StrategyConsistencyCheck {
    const direction = this.resolveDirection(trigger)
    const valuePct = this.readPositiveNumber(trigger.params.valuePct)
    const expectedAction = this.expectedAction(trigger)
    const expectedPredicateKind: PredicateKind = direction === 'down' ? 'LTE' : 'GTE'
    const expectedConstValue = direction === 'down'
      ? -Number((valuePct / 100).toFixed(4))
      : Number((valuePct / 100).toFixed(4))
    const astPredicates = this.findAstPredicates(input.ast, trigger.phase, expectedAction)
    const passed = astPredicates.some(predicate =>
      predicate.predicateKind === expectedPredicateKind
      && predicate.constValue === expectedConstValue
      && predicate.hasPriceChangeSeries,
    )

    return {
      key: 'semantic_atom.price_percent_change',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: {
        triggerId: trigger.id,
        phase: trigger.phase,
        action: expectedAction,
        predicateKind: expectedPredicateKind,
        constValue: expectedConstValue,
        basis: trigger.params.basis ?? 'prev_close',
      },
      actual: {
        canonicalRules: this.findCanonicalRules(input.canonicalSpec, trigger.phase, expectedAction),
        irPredicates: this.findIrPredicates(input.ir, trigger.phase, expectedAction),
        astPredicates,
      },
      message: passed
        ? 'price.percent_change semantic atom matches canonical AST.'
        : `price.percent_change semantic atom drift: expected ${expectedPredicateKind} ${expectedConstValue}.`,
    }
  }

  private findCanonicalRules(
    canonicalSpec: CanonicalStrategySpec,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): Array<Pick<CanonicalRuleV2, 'id' | 'phase' | 'condition' | 'actions'>> {
    if (canonicalSpec.version !== 2 || (phase !== 'entry' && phase !== 'exit')) {
      return []
    }

    return canonicalSpec.rules
      .filter(rule =>
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.type === action),
      )
      .map(rule => ({
        id: rule.id,
        phase: rule.phase,
        condition: rule.condition,
        actions: rule.actions,
      }))
  }

  private findIrPredicates(
    ir: CanonicalStrategyIrV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PredicateDef[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    const predicateById = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    return ir.ruleBlocks
      .filter(rule =>
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.kind === action),
      )
      .map(rule => predicateById.get(rule.when))
      .filter((predicate): predicate is PredicateDef => predicate !== undefined)
  }

  private findAstPredicates(
    ast: StrategyAstV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PredicateSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    return ast.decisionPrograms
      .filter(program =>
        program.phase === phase
        && program.actions.some(programAction => programAction.kind === action),
      )
      .map(program => this.describeProgramPredicate(program.when, ast))
      .filter((snapshot): snapshot is PredicateSnapshot => snapshot !== null)
  }

  private describeProgramPredicate(predicateExprId: string, ast: StrategyAstV1): PredicateSnapshot | null {
    const exprById = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    const predicateExpr = exprById.get(predicateExprId)
    if (!predicateExpr || predicateExpr.nodeType !== 'predicate' || !this.isPredicatePayload(predicateExpr.payload)) {
      return null
    }

    const depExprs = predicateExpr.deps
      .map(dep => exprById.get(dep))
      .filter((expr): expr is ExprNode => expr !== undefined)
    const constExpr = depExprs.find(expr => this.isSeriesKind(expr, 'CONST'))
    const priceChangeExpr = depExprs.find(expr => this.isSeriesKind(expr, 'PRICE_CHANGE_PCT'))
    const constValue = constExpr && this.isSeriesPayload(constExpr.payload) && typeof constExpr.payload.value === 'number'
      ? constExpr.payload.value
      : null

    return {
      predicateKind: predicateExpr.payload.kind,
      constValue,
      hasPriceChangeSeries: priceChangeExpr !== undefined,
    }
  }

  private resolveDirection(trigger: SemanticTriggerState): PriceChangeDirection {
    const direction = trigger.params.direction
    if (direction === 'up' || direction === '上涨' || direction === '涨') return 'up'
    if (direction === 'down' || direction === '下跌' || direction === '跌') return 'down'

    return this.readNumber(trigger.params.valuePct) < 0 ? 'down' : 'up'
  }

  private expectedAction(trigger: SemanticTriggerState): PositionAction {
    if (trigger.phase === 'entry') {
      return trigger.sideScope === 'short' ? 'OPEN_SHORT' : 'OPEN_LONG'
    }
    return trigger.sideScope === 'short' ? 'CLOSE_SHORT' : 'CLOSE_LONG'
  }

  private isSeriesKind(expr: ExprNode, kind: SeriesDef['kind']): boolean {
    return expr.nodeType === 'series'
      && this.isSeriesPayload(expr.payload)
      && expr.payload.kind === kind
  }

  private isPredicatePayload(payload: ExprNode['payload']): payload is PredicateDef {
    return typeof payload === 'object'
      && payload !== null
      && 'args' in payload
      && Array.isArray(payload.args)
  }

  private isSeriesPayload(payload: ExprNode['payload']): payload is SeriesDef {
    return typeof payload === 'object'
      && payload !== null
      && 'kind' in payload
      && !('args' in payload)
      && !('anchorRef' in payload)
  }

  private readPositiveNumber(value: unknown): number {
    const numeric = Math.abs(this.readNumber(value))
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
}
