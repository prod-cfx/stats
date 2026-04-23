import type { ExprNode, StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import type { CanonicalConditionAtom, CanonicalConditionNode, CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type { StrategyConsistencyCheck } from '../types/strategy-consistency-report'
import { Injectable } from '@nestjs/common'

type PriceChangeDirection = 'up' | 'down'
type PositionAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type PredicateKind = PredicateDef['kind']

interface PriceChangeSnapshot {
  id: string
  predicateKind: PredicateKind
  constValue: number | null
  hasPriceChangeSeries: boolean
}

interface LayerSnapshot {
  passed: boolean
  expectedBucket: PriceChangeSnapshot[]
  expected: PriceChangeSnapshot[]
  conflicts: PriceChangeSnapshot[]
  candidates: PriceChangeSnapshot[]
}

interface ExpectedSnapshot {
  triggerId: string
  action: PositionAction
  predicateKind: PredicateKind
  constValue: number
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
    const triggers = input.semanticState.triggers
      .filter(trigger => this.isBlockingPricePercentChangeTrigger(trigger))
    const triggersByBucket = new Map<string, SemanticTriggerState[]>()

    for (const trigger of triggers) {
      const action = this.expectedAction(trigger)
      const key = this.bucketKey(trigger.phase, action)
      const bucket = triggersByBucket.get(key) ?? []
      bucket.push(trigger)
      triggersByBucket.set(key, bucket)
    }

    return triggers.flatMap((trigger) => {
      const action = this.expectedAction(trigger)
      const bucket = triggersByBucket.get(this.bucketKey(trigger.phase, action)) ?? [trigger]
      return this.validatePricePercentChangeTrigger(trigger, bucket, input)
    })
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
    bucketTriggers: SemanticTriggerState[],
    input: {
      canonicalSpec: CanonicalStrategySpec
      ir: CanonicalStrategyIrV1
      ast: StrategyAstV1
    },
  ): StrategyConsistencyCheck {
    const expectedAction = this.expectedAction(trigger)
    const expected = this.buildExpectedSnapshot(trigger)
    const expectedBucket = bucketTriggers.map(bucketTrigger => this.buildExpectedSnapshot(bucketTrigger))
    const canonical = this.buildLayerSnapshot(
      this.findCanonicalPredicates(input.canonicalSpec, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const ir = this.buildLayerSnapshot(
      this.findIrPredicates(input.ir, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const ast = this.buildLayerSnapshot(
      this.findAstPredicates(input.ast, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const passed = canonical.passed && ir.passed && ast.passed

    return {
      key: 'semantic_atom.price_percent_change',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: {
        triggerId: trigger.id,
        phase: trigger.phase,
        action: expectedAction,
        predicateKind: expected.predicateKind,
        constValue: expected.constValue,
        basis: trigger.params.basis ?? 'prev_close',
      },
      actual: {
        canonical,
        ir,
        ast,
      },
      message: passed
        ? 'price.percent_change semantic atom matches canonicalSpec, IR, and AST.'
        : `price.percent_change semantic atom drift: expected ${expected.predicateKind} ${expected.constValue} in canonicalSpec, IR, and AST without undeclared conflicts.`,
    }
  }

  private buildExpectedSnapshot(trigger: SemanticTriggerState): ExpectedSnapshot {
    const direction = this.resolveDirection(trigger)
    const valuePct = this.readPositiveNumber(trigger.params.valuePct)
    const constValue = direction === 'down'
      ? -Number((valuePct / 100).toFixed(4))
      : Number((valuePct / 100).toFixed(4))

    return {
      triggerId: trigger.id,
      action: this.expectedAction(trigger),
      predicateKind: direction === 'down' ? 'LTE' : 'GTE',
      constValue,
    }
  }

  private buildLayerSnapshot(
    candidates: PriceChangeSnapshot[],
    expected: ExpectedSnapshot,
    expectedBucket: ExpectedSnapshot[],
  ): LayerSnapshot {
    const matchedExpected = candidates.filter(candidate => this.matchesExpected(
      candidate,
      expected,
    ))
    const conflicts = candidates.filter(candidate =>
      !expectedBucket.some(expectedCandidate => this.matchesExpected(candidate, expectedCandidate)),
    )

    return {
      passed: matchedExpected.length > 0 && conflicts.length === 0,
      expectedBucket: expectedBucket.map(item => ({
        id: item.triggerId,
        predicateKind: item.predicateKind,
        constValue: item.constValue,
        hasPriceChangeSeries: true,
      })),
      expected: matchedExpected,
      conflicts,
      candidates,
    }
  }

  private matchesExpected(
    candidate: PriceChangeSnapshot,
    expected: Pick<ExpectedSnapshot, 'predicateKind' | 'constValue'>,
  ): boolean {
    return candidate.predicateKind === expected.predicateKind
      && candidate.constValue === expected.constValue
      && candidate.hasPriceChangeSeries
  }

  private findCanonicalPredicates(
    canonicalSpec: CanonicalStrategySpec,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (canonicalSpec.version !== 2 || (phase !== 'entry' && phase !== 'exit')) {
      return []
    }

    return canonicalSpec.rules.flatMap(rule => {
      if (
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.type === action)
      ) {
        return this.collectPriceChangeAtoms(rule.condition).map(atom => ({
          id: rule.id,
          predicateKind: this.canonicalPredicateKind(atom.op),
          constValue: this.readNumber(atom.value),
          hasPriceChangeSeries: true,
        }))
      }
      return []
    })
  }

  private findIrPredicates(
    ir: CanonicalStrategyIrV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    const predicateById = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    const seriesById = new Map(ir.signalCatalog.series.map(series => [series.id, series]))
    return ir.ruleBlocks
      .filter(rule =>
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.kind === action),
      )
      .flatMap(rule => this.collectIrPriceChangePredicates(rule.when, predicateById, seriesById, new Set()))
  }

  private collectIrPriceChangePredicates(
    predicateId: string,
    predicateById: Map<string, PredicateDef>,
    seriesById: Map<string, SeriesDef>,
    seen: Set<string>,
  ): PriceChangeSnapshot[] {
    if (seen.has(predicateId)) {
      return []
    }
    seen.add(predicateId)

    const predicate = predicateById.get(predicateId)
    if (!predicate) {
      return []
    }

    const seriesArgs = predicate.args
      .map(arg => seriesById.get(arg))
      .filter((series): series is SeriesDef => series !== undefined)
    const hasPriceChangeSeries = seriesArgs.some(series => series.kind === 'PRICE_CHANGE_PCT')
    const nested = predicate.args.flatMap(arg =>
      this.collectIrPriceChangePredicates(arg, predicateById, seriesById, seen),
    )

    if (!hasPriceChangeSeries) {
      return nested
    }

    const constSeries = seriesArgs.find(series => series.kind === 'CONST')
    return [{
      id: predicate.id,
      predicateKind: predicate.kind,
      constValue: typeof constSeries?.value === 'number' ? constSeries.value : null,
      hasPriceChangeSeries,
    }, ...nested]
  }

  private findAstPredicates(
    ast: StrategyAstV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    return ast.decisionPrograms
      .filter(program =>
        program.phase === phase
        && program.actions.some(programAction => programAction.kind === action),
      )
      .flatMap(program => this.collectAstPriceChangePredicates(program.when, ast, new Set()))
  }

  private collectAstPriceChangePredicates(
    predicateExprId: string,
    ast: StrategyAstV1,
    seen: Set<string>,
  ): PriceChangeSnapshot[] {
    if (seen.has(predicateExprId)) {
      return []
    }
    seen.add(predicateExprId)

    const exprById = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    const predicateExpr = exprById.get(predicateExprId)
    if (!predicateExpr || predicateExpr.nodeType !== 'predicate' || !this.isPredicatePayload(predicateExpr.payload)) {
      return []
    }

    const depExprs = predicateExpr.deps
      .map(dep => exprById.get(dep))
      .filter((expr): expr is ExprNode => expr !== undefined)
    const constExpr = depExprs.find(expr => this.isSeriesKind(expr, 'CONST'))
    const priceChangeExpr = depExprs.find(expr => this.isSeriesKind(expr, 'PRICE_CHANGE_PCT'))
    const nested = depExprs
      .filter(expr => expr.nodeType === 'predicate')
      .flatMap(expr => this.collectAstPriceChangePredicates(expr.id, ast, seen))

    if (!priceChangeExpr) {
      return nested
    }
    const constValue = constExpr && this.isSeriesPayload(constExpr.payload) && typeof constExpr.payload.value === 'number'
      ? constExpr.payload.value
      : null

    return [{
      id: predicateExpr.sourceRef,
      predicateKind: predicateExpr.payload.kind,
      constValue,
      hasPriceChangeSeries: true,
    }, ...nested]
  }

  private collectPriceChangeAtoms(condition: CanonicalConditionNode): CanonicalConditionAtom[] {
    if (condition.kind === 'atom') {
      return condition.key === 'price.change_pct' ? [condition] : []
    }

    return condition.children.flatMap(child => this.collectPriceChangeAtoms(child))
  }

  private canonicalPredicateKind(op: CanonicalConditionAtom['op']): PredicateKind {
    switch (op) {
      case 'EQ':
      case 'LTE':
      case 'GTE':
      case 'CROSS_OVER':
      case 'CROSS_UNDER':
        return op
      default:
        return 'EQ'
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

  private bucketKey(phase: SemanticTriggerState['phase'], action: PositionAction): string {
    return `${phase}:${action}`
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
