import type { CanonicalConditionNode, CanonicalRuleSideScope, CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type {
  SemanticExpression,
  SemanticExpressionOperand,
  SemanticPositionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import type { StrategyRuleBasis } from '../types/strategy-logic-snapshot'
import type { StrategyIR } from '../types/strategy-ir'
import type {
  NormalizedGridIntent,
  NormalizedRiskAtom,
  NormalizedTriggerAtom,
  StrategyNormalizedIntent,
} from '../types/strategy-normalized-intent'
import { Injectable } from '@nestjs/common'
import { CANONICAL_RULE_KEYS, DEFAULT_INDICATOR_PARAMS } from '../constants/canonical-strategy-capabilities'
import {
  buildStrategyRuleDrafts,
  resolveStrategyDefaultTimeframe,
  resolveRequiredRuleTimeframes,
  resolveRulePhaseDefaultTimeframe,
} from './rule-draft-projection'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'
import { normalizeRiskSemantics } from './semantic-state-normalization'
import { StrategyIrCanonicalAdapterService } from './strategy-ir-canonical-adapter.service'
import { normalizeLegacyPositionSizing, validateSemanticExpressionContract, validateSemanticPositionContract, validateSemanticRiskContract } from './strategy-semantic-contracts'

interface StrategyLogicSnapshotInput {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
  entryRuleBases?: unknown
  exitRuleBases?: unknown
  entryRuleDrafts?: unknown
  exitRuleDrafts?: unknown
  market?: unknown
}

interface NormalizedIntentCompileContext {
  symbols?: unknown
  timeframes?: unknown
  market?: unknown
}

@Injectable()
export class CanonicalSpecBuilderService {
  constructor(
    private readonly strategyIrCanonicalAdapter: StrategyIrCanonicalAdapterService = new StrategyIrCanonicalAdapterService(),
  ) {}

  build(checklist: StrategyLogicSnapshotInput): CanonicalStrategySpecV2 {
    const normalizedLogicSnapshot = checklist as StrategyLogicSnapshotInput & Parameters<typeof buildStrategyRuleDrafts>[0]
    const ruleDrafts = buildStrategyRuleDrafts(normalizedLogicSnapshot)
    const entryRules = Array.isArray(checklist.entryRules) ? checklist.entryRules : []
    const exitRules = Array.isArray(checklist.exitRules) ? checklist.exitRules : []
    const riskRules = checklist.riskRules && typeof checklist.riskRules === 'object' && !Array.isArray(checklist.riskRules)
      ? checklist.riskRules as Record<string, unknown>
      : {}
    const entryTexts = entryRules.map(item => String(item))
    const exitTexts = exitRules.map(item => String(item))
    const sharedGridParams = this.resolveGridParams([...entryTexts, ...exitTexts].join(' '))
    const sizing = this.resolveSizing(riskRules)
    const market = this.resolveMarket(normalizedLogicSnapshot, riskRules, ruleDrafts)
    const indicators = this.resolveIndicators(entryTexts, exitTexts, riskRules)
    const requiredTimeframes = resolveRequiredRuleTimeframes(ruleDrafts, market.defaultTimeframe)
    const dominantEntrySideScope = this.resolveDominantEntrySideScope(entryTexts)

    const rules: CanonicalRuleV2[] = []

    entryTexts.forEach((ruleText, index) => {
      const openAction = this.detectOpenAction(ruleText)
      const priceChangeRule = this.buildPriceChangeRule({
        ruleText,
        index,
        phase: 'entry',
        actionType: openAction?.type ?? null,
        sideScope: openAction?.sideScope ?? null,
        sizing,
        ruleDraft: ruleDrafts.entry[index],
      })
      if (priceChangeRule) {
        rules.push(priceChangeRule)
        return
      }
      const gridEntryRule = this.buildGridRule({
        ruleText,
        index,
        phase: 'entry',
        actionType: openAction?.type ?? null,
        sideScope: openAction?.sideScope ?? null,
        sizing,
        sharedGridParams,
        ruleDraft: ruleDrafts.entry[index],
      })
      if (gridEntryRule) {
        rules.push(gridEntryRule)
        return
      }

      if (this.isBreakoutRule(ruleText)) {
        const breakoutRule = this.buildBreakoutRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction?.type ?? 'OPEN_LONG',
          sideScope: openAction?.sideScope ?? 'long',
          sizing,
        })
        if (breakoutRule) {
          rules.push(breakoutRule)
          return
        }
      }

      if (!openAction) return

      if (this.isMovingAverageRule(ruleText)) {
        const movingAverageRule = this.buildMovingAverageRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (movingAverageRule) {
          rules.push(movingAverageRule)
        }
      }

      if (this.isRsiRule(ruleText)) {
        const rsiRule = this.buildRsiRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (rsiRule) {
          rules.push(rsiRule)
        }
      }

      if (this.isMacdRule(ruleText)) {
        const macdRule = this.buildMacdRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (macdRule) {
          rules.push(macdRule)
        }
      }

      if (/上轨|upper/i.test(ruleText)) {
        rules.push({
          id: `entry-upper-${index + 1}`,
          phase: 'entry',
          sideScope: openAction.sideScope,
          priority: 200 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.upper_break',
            semanticScope: 'market',
            op: 'CROSS_OVER',
          },
          actions: [this.buildOpenAction(openAction.type, sizing)],
        })
      }

      if (/下轨|lower/i.test(ruleText)) {
        rules.push({
          id: `entry-lower-${index + 1}`,
          phase: 'entry',
          sideScope: openAction.sideScope,
          priority: 190 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.lower_break',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
          },
          actions: [this.buildOpenAction(openAction.type, sizing)],
        })
      }
    })

    exitTexts.forEach((ruleText, index) => {
      const closeAction = this.detectCloseAction(ruleText, dominantEntrySideScope)
      const priceChangeRule = this.buildPriceChangeRule({
        ruleText,
        index,
        phase: 'exit',
        actionType: closeAction?.type ?? null,
        sideScope: closeAction?.sideScope ?? null,
        sizing,
        ruleDraft: ruleDrafts.exit[index],
      })
      if (priceChangeRule) {
        rules.push(priceChangeRule)
        return
      }
      const gridExitRule = this.buildGridRule({
        ruleText,
        index,
        phase: 'exit',
        actionType: null,
        sideScope: null,
        sizing,
        sharedGridParams,
        ruleDraft: ruleDrafts.exit[index],
      })
      if (gridExitRule) {
        rules.push(gridExitRule)
        return
      }

      if (closeAction && this.isMovingAverageRule(ruleText)) {
        const movingAverageRule = this.buildMovingAverageRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (movingAverageRule) {
          rules.push(movingAverageRule)
        }
      }

      if (closeAction && this.isRsiRule(ruleText)) {
        const rsiRule = this.buildRsiRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (rsiRule) {
          rules.push(rsiRule)
        }
      }

      if (closeAction && this.isMacdRule(ruleText)) {
        const macdRule = this.buildMacdRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (macdRule) {
          rules.push(macdRule)
        }
      }

      if (closeAction && this.isBreakoutRule(ruleText)) {
        const breakoutRule = this.buildBreakoutRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (breakoutRule) {
          rules.push(breakoutRule)
        }
      }

      if (/中轨|ma20|均线20|middle/i.test(ruleText)) {
        rules.push({
          id: `exit-middle-${index + 1}`,
          phase: 'exit',
          sideScope: 'both',
          priority: 140 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.middle_revert',
            semanticScope: 'market',
          },
          actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
        })
      }
    })

    const stopLossPct = this.resolveStopLossPct(riskRules)
    const stopLossBasis = this.resolveRiskBasis(
      typeof riskRules.stopLoss === 'string' ? riskRules.stopLoss : stopLossPct !== null ? `止损 ${stopLossPct}%` : null,
      riskRules.stopLossBasis,
    )
    if (stopLossPct !== null && this.isExecutablePercentRiskBasis(stopLossBasis)) {
      rules.push({
        id: 'risk-stop-loss',
        phase: 'risk',
        sideScope: 'both',
        priority: 120,
        condition: {
          kind: 'atom',
          key: 'position_loss_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((stopLossPct / 100).toFixed(4)),
          ...(stopLossBasis ? { params: { basis: stopLossBasis } } : {}),
        },
        actions: [{ type: 'FORCE_EXIT' }],
        ...(stopLossBasis ? { metadata: { basis: stopLossBasis } } : {}),
      })
    }

    const takeProfitRule = this.resolveTakeProfitRule(
      [...exitTexts, ...Object.values(riskRules).map(item => String(item))],
      riskRules,
      dominantEntrySideScope,
    )
    const takeProfitBasis = this.resolveRiskBasis(
      typeof riskRules.takeProfit === 'string'
        ? riskRules.takeProfit
        : takeProfitRule ? `止盈 ${takeProfitRule.pct}%` : null,
      riskRules.takeProfitBasis,
    )
    if (takeProfitRule && this.isExecutablePercentRiskBasis(takeProfitBasis)) {
      rules.push({
        id: 'risk-take-profit',
        phase: 'risk',
        sideScope: takeProfitRule.sideScope,
        priority: 115,
        condition: {
          kind: 'atom',
          key: 'risk.take_profit_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((takeProfitRule.pct / 100).toFixed(4)),
          ...(takeProfitBasis ? { params: { basis: takeProfitBasis } } : {}),
        },
        actions: takeProfitRule.actions,
        ...(takeProfitBasis ? { metadata: { basis: takeProfitBasis } } : {}),
      })
    }

    const trailingStopRule = this.resolveTrailingStopRule([...exitTexts, ...Object.values(riskRules).map(item => String(item))])
    if (trailingStopRule) {
      rules.push({
        id: 'risk-trailing-stop',
        phase: 'risk',
        sideScope: trailingStopRule.sideScope,
        priority: 114,
        condition: {
          kind: 'atom',
          key: 'risk.trailing_stop_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((trailingStopRule.pct / 100).toFixed(4)),
        },
        actions: trailingStopRule.actions,
      })
    }

    const timeStopRule = this.resolveTimeStopRule(exitTexts)
    if (timeStopRule) {
      rules.push({
        id: 'exit-time-stop-bars',
        phase: 'exit',
        sideScope: timeStopRule.sideScope,
        priority: 113,
        condition: {
          kind: 'atom',
          key: 'risk.time_stop_bars',
          semanticScope: 'position',
          op: 'GTE',
          value: timeStopRule.bars,
        },
        actions: timeStopRule.actions,
      })
    }

    const earlyStopText = typeof riskRules.earlyStop === 'string' ? riskRules.earlyStop : ''
    const outsideBandSourceText = [
      ...exitTexts,
      earlyStopText,
    ].find(text => /连续\s*3|3\s*根/.test(text) && /轨外|outside/i.test(text)) ?? ''

    if (outsideBandSourceText) {
      const outsideBandActions = this.resolveOutsideBandRiskActions(outsideBandSourceText)

      if (outsideBandActions) {
        rules.push({
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
          actions: outsideBandActions,
          metadata: { source: outsideBandSourceText === earlyStopText ? 'riskRules.earlyStop' : 'exitRules' },
        })
      }
    }

    const spec: CanonicalStrategySpecV2 = {
      version: 2,
      market,
      indicators,
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      rules,
    }

    return spec
  }

  buildFromNormalizedIntent(
    context: NormalizedIntentCompileContext,
    normalizedIntent: StrategyNormalizedIntent,
  ): CanonicalStrategySpecV2 {
    const riskRules = 'riskRules' in context && context.riskRules && typeof context.riskRules === 'object' && !Array.isArray(context.riskRules)
      ? context.riskRules as Record<string, unknown>
      : {}
    const market = this.resolveNormalizedIntentMarket(context)
    const sizing = this.resolveSizingFromNormalizedIntent(normalizedIntent) ?? this.resolveSizing(riskRules)
    const requiredTimeframes = this.resolveNormalizedRequiredTimeframes(normalizedIntent, context, market.defaultTimeframe)
    const indicators = this.resolveIndicatorsFromNormalizedIntent(normalizedIntent)
    const rules = this.buildRulesFromNormalizedIntent({
      normalizedIntent,
      sizing,
      defaultTimeframe: market.defaultTimeframe ?? requiredTimeframes[0] ?? null,
    })

    return {
      version: 2,
      market,
      indicators,
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      rules,
      metadata: {
        normalized: {
          source: 'normalized-intent',
          semanticViewSource: 'normalized-canonical-truth',
          intent: normalizedIntent,
        },
      },
    }
  }

  buildFromStrategyIr(strategyIr: StrategyIR): CanonicalStrategySpecV2 {
    return this.strategyIrCanonicalAdapter.adapt(strategyIr)
  }

  buildFromSemanticState(state: SemanticState): CanonicalStrategySpecV2 {
    const market = this.resolveSemanticStateMarket(state)
    const sizing = this.resolveSizingFromSemanticState(state.position)

    const rules = this.buildRulesFromSemanticState(state, sizing)
    const requiredTimeframes = this.resolveSemanticStateRequiredTimeframes(rules, market.defaultTimeframe)

    return {
      version: 2,
      market,
      indicators: this.resolveIndicatorsFromSemanticTriggers(state.triggers),
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      rules,
    }
  }

  private resolveSemanticStateMarket(state: SemanticState): CanonicalStrategySpecV2['market'] {
    const exchange = this.readLockedContextSlotString(state.contextSlots.exchange)?.toLowerCase() ?? null
    const marketType = this.readLockedContextSlotString(state.contextSlots.marketType)?.toLowerCase() ?? null

    return {
      exchange: exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid' ? exchange : null,
      symbol: this.readLockedContextSlotString(state.contextSlots.symbol),
      marketType: marketType === 'spot' || marketType === 'perp' ? marketType : null,
      defaultTimeframe: this.readLockedContextSlotString(state.contextSlots.timeframe),
    }
  }

  private readLockedContextSlotString(slot: SemanticSlotState | null): string | null {
    if (slot?.status !== 'locked' || typeof slot.value !== 'string') {
      return null
    }
    const value = slot.value.trim()
    return value.length > 0 ? value : null
  }

  private resolveSizingFromSemanticState(
    position: SemanticPositionState | null,
  ): CanonicalStrategySpecV2['sizing'] {
    if (!position || position.status !== 'locked' || !validateSemanticPositionContract(position).ok) {
      return null
    }

    const sizing = normalizeLegacyPositionSizing(position)
    if (!sizing) {
      return null
    }

    if (sizing.kind === 'quote') {
      return { mode: 'QUOTE', value: sizing.value, asset: sizing.asset }
    }
    if (sizing.kind === 'base') {
      return { mode: 'QTY', value: sizing.value, asset: sizing.asset }
    }

    return { mode: 'RATIO', value: sizing.value }
  }

  private buildRulesFromSemanticState(
    state: SemanticState,
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2[] {
    const actionKeys = new Set(state.actions
      .filter(action => action.status === 'locked')
      .map(action => action.key))
    const counters: Record<'entry' | 'exit' | 'gate', number> = {
      entry: 0,
      exit: 0,
      gate: 0,
    }
    const rules: CanonicalRuleV2[] = []
    const defaultTimeframe = this.readLockedContextSlotString(state.contextSlots.timeframe)
    const gateConditions = state.triggers
      .filter(trigger => trigger.status === 'locked' && trigger.phase === 'gate')
      .map(trigger => trigger.key === 'condition.expression'
        ? this.buildConditionFromSemanticExpressionTrigger(trigger)
        : this.buildConditionFromSemanticTriggerContract(trigger, defaultTimeframe))
      .filter((condition): condition is CanonicalConditionNode => condition !== null)
      .filter(condition => !this.isNoPositionGateCondition(condition))

    for (const trigger of state.triggers) {
      if (trigger.status !== 'locked') {
        continue
      }
      if (trigger.phase !== 'entry' && trigger.phase !== 'exit' && trigger.phase !== 'gate') {
        continue
      }
      if (trigger.key === 'grid.range_rebalance') {
        rules.push(...this.buildGridRulesFromSemanticTrigger({
          trigger,
          sizing,
          defaultTimeframe,
          gateConditions,
        }))
        continue
      }

      const condition = trigger.key === 'condition.expression'
        ? this.buildConditionFromSemanticExpressionTrigger(trigger)
        : this.buildConditionFromSemanticTriggerContract(trigger, defaultTimeframe)
      if (!condition) {
        continue
      }
      if (trigger.phase === 'gate' && !this.isNoPositionGateCondition(condition)) {
        continue
      }

      const actions = this.buildActionsForSemanticTrigger(trigger, actionKeys, sizing)
      if (actions.length === 0) {
        continue
      }
      const ruleCondition = trigger.phase === 'gate'
        ? condition
        : trigger.phase === 'entry'
          ? this.attachSemanticGateConditions(condition, gateConditions)
          : condition

      for (const ruleVariant of this.splitSemanticRuleVariants(trigger, actions)) {
        counters[trigger.phase] += 1
        rules.push({
          id: `semantic-${trigger.phase}-${counters[trigger.phase]}`,
          phase: trigger.phase,
          sideScope: ruleVariant.sideScope,
          priority: this.resolveSemanticRulePriority(trigger.phase, counters[trigger.phase]),
          condition: ruleCondition,
          actions: ruleVariant.actions,
        })
      }
    }

    rules.push(...this.buildRiskRulesFromSemanticState(state.risk, state.position))

    return rules
  }

  private attachSemanticGateConditions(
    condition: CanonicalConditionNode,
    gateConditions: CanonicalConditionNode[],
  ): CanonicalConditionNode {
    if (gateConditions.length === 0) {
      return condition
    }

    return {
      kind: 'AND',
      children: [condition, ...gateConditions],
    }
  }

  private isNoPositionGateCondition(condition: CanonicalConditionNode): boolean {
    return condition.kind === 'atom'
      && condition.key === 'position.has_position'
      && condition.op === 'EQ'
      && condition.value === false
  }

  private buildConditionFromSemanticExpressionTrigger(
    trigger: SemanticTriggerState,
  ): CanonicalConditionNode | null {
    const expression = trigger.params.expression
    if (!this.isValidSemanticExpression(expression)) {
      return null
    }

    if (trigger.phase === 'gate') {
      const noPositionGate = this.buildNoPositionGateCondition(expression, trigger.sideScope)
      if (noPositionGate) {
        return noPositionGate
      }
    }

    return this.buildConditionFromSemanticExpression(expression)
  }

  private buildNoPositionGateCondition(
    expression: SemanticExpression,
    sideScope: SemanticTriggerState['sideScope'],
  ): CanonicalConditionNode | null {
    const noPositionSide = this.resolveNoPositionGateSide(expression)
    if (!noPositionSide) {
      return null
    }

    return {
      kind: 'atom',
      key: 'position.has_position',
      semanticScope: 'position',
      op: 'EQ',
      value: false,
      params: {
        side: noPositionSide === 'both' ? 'both' : sideScope ?? noPositionSide,
      },
    }
  }

  private resolveNoPositionGateSide(expression: SemanticExpression): 'long' | 'short' | 'both' | null {
    if (expression.kind === 'NOT') {
      const child = expression.children[0]
      return child && this.isHasPositionPredicate(child, true)
        ? this.resolveHasPositionPredicateSide(child)
        : null
    }

    return this.isHasPositionPredicate(expression, false)
      ? this.resolveHasPositionPredicateSide(expression)
      : null
  }

  private isHasPositionPredicate(
    expression: SemanticExpression,
    expectedValue: boolean,
  ): expression is Extract<SemanticExpression, { kind: 'predicate' }> {
    if (expression.kind !== 'predicate' || expression.op !== 'EQ') {
      return false
    }

    return (
      this.isHasPositionOperand(expression.left)
      && this.isBooleanConstantOperand(expression.right, expectedValue)
    ) || (
      this.isBooleanConstantOperand(expression.left, expectedValue)
      && this.isHasPositionOperand(expression.right)
    )
  }

  private resolveHasPositionPredicateSide(
    expression: Extract<SemanticExpression, { kind: 'predicate' }>,
  ): 'long' | 'short' | 'both' {
    if (this.isHasPositionOperand(expression.left)) {
      return expression.left.side ?? 'both'
    }
    if (this.isHasPositionOperand(expression.right)) {
      return expression.right.side ?? 'both'
    }
    return 'both'
  }

  private isHasPositionOperand(
    operand: SemanticExpressionOperand,
  ): operand is Extract<SemanticExpressionOperand, { kind: 'position' }> {
    return operand.kind === 'position' && operand.field === 'has_position'
  }

  private isBooleanConstantOperand(
    operand: SemanticExpressionOperand,
    expectedValue: boolean,
  ): operand is Extract<SemanticExpressionOperand, { kind: 'constant' }> {
    return operand.kind === 'constant' && operand.value === expectedValue
  }

  private buildConditionFromSemanticTriggerContract(
    trigger: SemanticTriggerState,
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    return this.buildConditionFromNormalizedTrigger({
      key: trigger.key as NormalizedTriggerAtom['key'],
      phase: trigger.phase,
      sideScope: trigger.sideScope,
      params: trigger.params as Record<string, string | number | boolean>,
      closureStatus: 'closed',
      unresolvedSlots: [],
    }, defaultTimeframe)
  }

  private buildConditionFromSemanticExpression(expression: SemanticExpression): CanonicalConditionNode | null {
    if (expression.kind === 'predicate') {
      return {
        kind: 'expression',
        op: expression.op,
        left: expression.left,
        right: expression.right,
      }
    }

    const children = expression.children
      .map(child => this.buildConditionFromSemanticExpression(child))
      .filter((condition): condition is CanonicalConditionNode => condition !== null)
    if (children.length === 0) {
      return null
    }

    return {
      kind: expression.kind,
      children,
    }
  }

  private isValidSemanticExpression(expression: unknown): expression is SemanticExpression {
    return validateSemanticExpressionContract(expression as SemanticExpression).ok
  }

  private buildActionsForSemanticTrigger(
    trigger: SemanticTriggerState,
    actionKeys: Set<string>,
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2['actions'] {
    const actions: CanonicalRuleV2['actions'] = []
    const sideScope = trigger.sideScope ?? 'long'

    if (trigger.phase === 'entry') {
      if ((sideScope === 'long' || sideScope === 'both') && (actionKeys.has('open_long') || trigger.key === 'execution.on_start')) {
        actions.push(this.buildOpenAction('OPEN_LONG', sizing))
      }
      if ((sideScope === 'short' || sideScope === 'both') && (actionKeys.has('open_short') || trigger.key === 'execution.on_start')) {
        actions.push(this.buildOpenAction('OPEN_SHORT', sizing))
      }
    }

    if (trigger.phase === 'exit') {
      if ((sideScope === 'long' || sideScope === 'both') && actionKeys.has('close_long')) {
        actions.push({ type: 'CLOSE_LONG' })
      }
      if ((sideScope === 'short' || sideScope === 'both') && actionKeys.has('close_short')) {
        actions.push({ type: 'CLOSE_SHORT' })
      }
    }

    if (trigger.phase === 'gate') {
      actions.push({ type: 'BLOCK_NEW_ENTRY' })
    }

    return actions
  }

  private resolveIndicatorsFromSemanticTriggers(
    triggers: SemanticTriggerState[],
  ): CanonicalStrategySpecV2['indicators'] {
    const normalizedLikeIntent = {
      triggers: triggers
        .filter(trigger => trigger.status === 'locked')
        .map(trigger => ({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope,
          params: trigger.params,
          closureStatus: 'closed' as const,
          unresolvedSlots: [],
        })) as NormalizedTriggerAtom[],
      grid: null,
    } as StrategyNormalizedIntent

    return this.resolveIndicatorsFromNormalizedIntent(normalizedLikeIntent)
  }

  private resolveSemanticStateRequiredTimeframes(
    rules: CanonicalRuleV2[],
    defaultTimeframe: string | null | undefined,
  ): string[] {
    const ordered: string[] = []
    const add = (value: unknown) => {
      if (typeof value !== 'string' || value.trim().length === 0) return
      const timeframe = value.trim()
      if (!ordered.includes(timeframe)) {
        ordered.push(timeframe)
      }
    }

    add(defaultTimeframe)
    for (const rule of rules) {
      this.collectConditionTimeframes(rule.condition, add)
    }

    return ordered
  }

  private collectConditionTimeframes(
    condition: CanonicalConditionNode,
    add: (value: unknown) => void,
  ): void {
    if (condition.kind === 'atom') {
      add(condition.params?.timeframe)
      return
    }

    if (condition.kind === 'expression') {
      this.collectExpressionOperandTimeframes(condition.left, add)
      this.collectExpressionOperandTimeframes(condition.right, add)
      return
    }

    for (const child of condition.children) {
      this.collectConditionTimeframes(child, add)
    }
  }

  private collectExpressionOperandTimeframes(
    operand: SemanticExpressionOperand,
    add: (value: unknown) => void,
  ): void {
    if (operand.kind === 'series') {
      add(operand.timeframe)
    }
    if (operand.kind === 'indicator') {
      add(operand.params.timeframe)
    }
  }

  private splitSemanticRuleVariants(
    trigger: SemanticTriggerState,
    actions: CanonicalRuleV2['actions'],
  ): Array<{ sideScope: CanonicalRuleV2['sideScope']; actions: CanonicalRuleV2['actions'] }> {
    if (
      trigger.phase !== 'entry'
      || trigger.sideScope !== 'both'
      || !actions.some(action => action.type === 'OPEN_LONG')
      || !actions.some(action => action.type === 'OPEN_SHORT')
    ) {
      return [{ sideScope: trigger.sideScope, actions }]
    }

    return [
      { sideScope: 'long', actions: actions.filter(action => action.type === 'OPEN_LONG') },
      { sideScope: 'short', actions: actions.filter(action => action.type === 'OPEN_SHORT') },
    ]
  }

  private buildRiskRulesFromSemanticState(
    risks: SemanticRiskState[],
    position: SemanticPositionState | null,
  ): CanonicalRuleV2[] {
    const normalizedRisks = normalizeRiskSemantics(risks)
    const sideScope = this.resolveSemanticRiskSideScope(position)
    const rules: CanonicalRuleV2[] = []
    let priority = 120

    for (const risk of normalizedRisks) {
      if (risk.status !== 'locked' || !validateSemanticRiskContract(risk).ok) {
        continue
      }
      if (risk.key === 'risk.condition_expression') {
        if (risk.params.capabilityStatus !== 'supported') {
          continue
        }
        const condition = this.isValidSemanticExpression(risk.params.condition)
          ? this.buildConditionFromSemanticExpression(risk.params.condition)
          : null
        const actions = this.buildActionsForSemanticRiskExpression(risk, sideScope)
        if (!condition || actions.length === 0) {
          continue
        }

        rules.push({
          id: `semantic-${risk.id || `risk-expression-${priority}`}`,
          phase: 'risk',
          sideScope,
          priority: priority--,
          condition,
          actions,
          metadata: {
            semanticKey: risk.key,
            scope: risk.params.scope,
            effect: risk.params.effect,
            capabilityStatus: risk.params.capabilityStatus,
            unsupportedReason: risk.params.unsupportedReason,
          },
        })
        continue
      }
      if (risk.key !== 'risk.stop_loss_pct' && risk.key !== 'risk.take_profit_pct') {
        continue
      }

      const valuePct = typeof risk.params.valuePct === 'number' ? risk.params.valuePct : null
      if (valuePct === null || !Number.isFinite(valuePct)) {
        continue
      }
      if (!this.isExecutablePercentRiskBasis(risk.params.basis)) {
        continue
      }

      rules.push({
        id: risk.key === 'risk.stop_loss_pct' ? 'semantic-risk-stop-loss' : 'semantic-risk-take-profit',
        phase: 'risk',
        sideScope,
        priority: priority--,
        condition: {
          kind: 'atom',
          key: risk.key === 'risk.stop_loss_pct' ? CANONICAL_RULE_KEYS.positionLossPct : risk.key,
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          ...(typeof risk.params.basis === 'string' ? { params: { basis: risk.params.basis } } : {}),
        },
        actions: [{ type: 'FORCE_EXIT' }],
      })
    }

    return rules
  }

  private buildActionsForSemanticRiskExpression(
    risk: SemanticRiskState,
    sideScope: 'long' | 'short' | 'both',
  ): CanonicalRuleV2['actions'] {
    const effect = risk.params.effect
    const effectType = effect && typeof effect === 'object' && 'type' in effect
      ? (effect as { type?: unknown }).type
      : null

    if (effectType === 'pause_strategy') {
      return [{ type: 'BLOCK_NEW_ENTRY' }]
    }

    if (effectType === 'reduce_position') {
      const reducePct = effect && typeof effect === 'object' && typeof (effect as { reducePct?: unknown }).reducePct === 'number'
        ? (effect as { reducePct: number }).reducePct
        : 50
      const sizing = { mode: 'RATIO' as const, value: reducePct }
      if (sideScope === 'long') {
        return [{ type: 'REDUCE_LONG', sizing }]
      }
      if (sideScope === 'short') {
        return [{ type: 'REDUCE_SHORT', sizing }]
      }
      return [
        { type: 'REDUCE_LONG', sizing },
        { type: 'REDUCE_SHORT', sizing },
      ]
    }

    if (effectType === 'notify_only') {
      return []
    }

    return [{ type: 'FORCE_EXIT' }]
  }

  private isExecutablePercentRiskBasis(rawBasis: unknown): boolean {
    return rawBasis === undefined || rawBasis === 'entry_avg_price'
  }

  private resolveSemanticRiskSideScope(position: SemanticPositionState | null): 'long' | 'short' | 'both' {
    if (position?.positionMode === 'long_only') {
      return 'long'
    }
    if (position?.positionMode === 'short_only') {
      return 'short'
    }
    return 'both'
  }

  private resolveSemanticRulePriority(phase: 'entry' | 'exit' | 'gate', index: number): number {
    if (phase === 'entry') {
      return 210 - index
    }
    if (phase === 'exit') {
      return 140 - index
    }
    return 90 - index
  }

  private detectOpenAction(ruleText: string): { type: 'OPEN_LONG' | 'OPEN_SHORT'; sideScope: 'long' | 'short' } | null {
    if (/做空|空单|开空|卖出开空|short/i.test(ruleText)) {
      return { type: 'OPEN_SHORT', sideScope: 'short' }
    }
    if (/做多|多单|开多|买入|买进|开仓|long/i.test(ruleText)) {
      return { type: 'OPEN_LONG', sideScope: 'long' }
    }
    return null
  }

  private detectCloseAction(
    ruleText: string,
    fallbackSideScope: 'long' | 'short' | null = null,
  ): { type: 'CLOSE_LONG' | 'CLOSE_SHORT'; sideScope: 'long' | 'short' } | null {
    if (/平空|空单止盈|买回|回补|close\s*short/i.test(ruleText)) {
      return { type: 'CLOSE_SHORT', sideScope: 'short' }
    }
    if (/平多|多单止盈|close\s*long/i.test(ruleText)) {
      return { type: 'CLOSE_LONG', sideScope: 'long' }
    }
    if (/卖出|平仓|离场|出场/.test(ruleText)) {
      if (fallbackSideScope === 'short') {
        return { type: 'CLOSE_SHORT', sideScope: 'short' }
      }
      if (fallbackSideScope === 'long') {
        return { type: 'CLOSE_LONG', sideScope: 'long' }
      }
      return null
    }
    return null
  }

  private resolveDominantEntrySideScope(entryRules: string[]): 'long' | 'short' | null {
    const scoped = entryRules
      .map((rule) => {
        const explicit = this.detectOpenAction(rule)?.sideScope ?? null
        if (explicit) {
          return explicit
        }
        if (/买入|买进|开仓|入场/.test(rule)) {
          return 'long'
        }
        return null
      })
      .filter((side): side is 'long' | 'short' => side === 'long' || side === 'short')

    if (scoped.length === 0) {
      return null
    }

    const unique = [...new Set(scoped)]
    return unique.length === 1 ? unique[0] ?? null : null
  }

  private resolveStopLossPct(riskRules: Record<string, unknown>): number | null {
    const stopLossPct = typeof riskRules.stopLossPct === 'number'
      ? riskRules.stopLossPct
      : typeof riskRules.stopLoss === 'number'
        ? riskRules.stopLoss
        : null

    if (typeof stopLossPct !== 'number' || !Number.isFinite(stopLossPct) || stopLossPct <= 0 || stopLossPct > 100) {
      return null
    }

    return stopLossPct
  }

  private resolveRiskBasis(
    ruleText: string | null,
    explicitBasis: unknown,
  ): StrategyRuleBasis['kind'] | null {
    if (typeof explicitBasis === 'string' && explicitBasis.trim()) {
      return explicitBasis.trim() as StrategyRuleBasis['kind']
    }
    if (!ruleText?.trim()) {
      return null
    }
    return resolveDefaultRiskBasis(ruleText, null)
  }

  private resolveSizing(riskRules: Record<string, unknown>): { mode: 'RATIO'; value: number } | null {
    const hasPositionPct = typeof riskRules.positionPct === 'number'
    if (!hasPositionPct) return null

    const rawPositionPct = typeof riskRules.positionPct === 'number' ? riskRules.positionPct : 10
    const ratioValue = rawPositionPct > 1 ? rawPositionPct / 100 : rawPositionPct
    return {
      mode: 'RATIO',
      value: Number(ratioValue.toFixed(4)),
    }
  }

  private resolveMarket(
    checklist: StrategyLogicSnapshotInput,
    riskRules: Record<string, unknown>,
    ruleDrafts: ReturnType<typeof buildStrategyRuleDrafts>,
  ): CanonicalStrategySpecV2['market'] {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const market = checklist.market && typeof checklist.market === 'object' && !Array.isArray(checklist.market)
      ? checklist.market as Record<string, unknown>
      : null
    const rawSymbol = typeof symbols[0] === 'string' ? canonicalizeStrategySymbolInput(symbols[0]) ?? '' : ''
    const rawTimeframe = resolveRulePhaseDefaultTimeframe(
      ruleDrafts.entry,
      resolveStrategyDefaultTimeframe(checklist as Parameters<typeof resolveStrategyDefaultTimeframe>[0]),
    ) ?? ruleDrafts.exit.find(draft => draft.timeframe)?.timeframe ?? ''
    const riskExchange = typeof riskRules.exchange === 'string' ? riskRules.exchange.trim().toLowerCase() : ''
    const riskMarketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''
    const marketExchange = typeof market?.exchange === 'string' ? market.exchange.trim().toLowerCase() : ''
    const marketType = typeof market?.marketType === 'string' ? market.marketType.trim().toLowerCase() : ''

    return {
      exchange: marketExchange === 'okx' || marketExchange === 'hyperliquid' || marketExchange === 'binance'
        ? marketExchange
        : (riskExchange === 'okx' || riskExchange === 'hyperliquid' || riskExchange === 'binance'
            ? riskExchange
            : 'binance'),
      symbol: rawSymbol || null,
      marketType: marketType === 'perp' ? 'perp' : (riskMarketType === 'perp' ? 'perp' : 'spot'),
      defaultTimeframe: rawTimeframe || null,
    }
  }

  private resolveIndicators(
    entryTexts: string[],
    exitTexts: string[],
    riskRules: Record<string, unknown>,
  ): CanonicalStrategySpecV2['indicators'] {
    const riskTexts = Object.values(riskRules)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    const allTexts = [...entryTexts, ...exitTexts, ...riskTexts]

    const indicators: CanonicalStrategySpecV2['indicators'] = []
    const pushIndicator = (indicator: CanonicalStrategySpecV2['indicators'][number]) => {
      if (!indicators.some(item => item.kind === indicator.kind)) {
        indicators.push(indicator)
      }
    }
    const hasDonchianBreakout = allTexts.some(text => /唐奇安|donchian/iu.test(text))
      && allTexts.some(text => /上轨|下轨|breakout|breakdown|highest|lowest/iu.test(text))
    const hasBollingerSemantics = !hasDonchianBreakout
      && allTexts.some(text => /布林|bollinger|上轨|下轨|中轨|upper\s*band|lower\s*band|middle\s*band/iu.test(text))
    const bollingerParams = this.resolveBollingerParams(allTexts)
    const movingAverageConfig = this.resolveMovingAverageConfig(allTexts)
    const macdParams = this.resolveMacdParams(allTexts)

    if (hasBollingerSemantics) {
      pushIndicator({
        kind: 'bollingerBands',
        params: { ...bollingerParams },
      })
    }

    if (!hasBollingerSemantics && allTexts.some(text => this.isMovingAverageRule(text))) {
      pushIndicator({
        kind: movingAverageConfig.kind,
        params: movingAverageConfig.params,
      })
    }

    if (allTexts.some(text => /\brsi\b|相对强弱|超买|超卖/iu.test(text))) {
      pushIndicator({
        kind: 'rsi',
        params: { period: this.resolveRsiPeriod(allTexts) },
      })
    }

    if (allTexts.some(text => /\bmacd\b|指数平滑异同|快线|慢线/iu.test(text))) {
      pushIndicator({
        kind: 'macd',
        params: { ...macdParams },
      })
    }

    if (hasDonchianBreakout) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'breakout' },
      })
    }

    if (allTexts.some(text => /网格/u.test(text))) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'grid' },
      })
    }

    return indicators
  }

  private resolveOutsideBandRiskActions(text: string): CanonicalRuleV2['actions'] | null {
    if (/全平|全部平仓|直接平仓|清仓|强平|force\s*exit|force\s*close/iu.test(text)) {
      return [{ type: 'FORCE_EXIT' }]
    }

    if (/减仓|reduce/iu.test(text)) {
      return [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }]
    }

    return null
  }

  private buildOpenAction(
    type: 'OPEN_LONG' | 'OPEN_SHORT',
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2['actions'][number] {
    if (!sizing) {
      return { type }
    }

    return {
      type,
      sizing,
    }
  }

  private isMovingAverageRule(text: string): boolean {
    return /均线|moving average|\bsma\b|\bema\b|sma\s*\d+|ema\s*\d+|ma\s*\d+|\d+\s*日线/iu.test(text)
      || ((/金叉|死叉|上穿|下穿/u.test(text)) && /均线|\bma\b|\bsma\b|\bema\b|sma\s*\d+|ema\s*\d+|ma\s*\d+|\d+\s*日线/i.test(text))
  }

  private isRsiRule(text: string): boolean {
    return /\brsi\b|相对强弱|超买|超卖/iu.test(text)
  }

  private isMacdRule(text: string): boolean {
    return /\bmacd\b|指数平滑异同|快线|慢线/iu.test(text)
  }

  private isBreakoutRule(text: string): boolean {
    return /前高|前低|最高价|最低价|通道上轨|通道下轨|关键阻力|阻力位|关键支撑|支撑位|唐奇安|donchian|breakout|breakdown|highest|lowest/i.test(text)
  }

  private buildMovingAverageRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const ruleKey = /金叉|上穿|突破/u.test(input.ruleText)
      ? 'ma.golden_cross'
      : /死叉|下穿|跌破/u.test(input.ruleText)
          ? 'ma.death_cross'
          : null
    if (!ruleKey) return null

    const operator = ruleKey === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER'
    const movingAverageConfig = this.resolveMovingAverageConfig([input.ruleText])

    return {
      id: `${input.phase}-${ruleKey.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 200 - input.index : 140 - input.index,
      condition: {
        kind: 'atom',
        key: ruleKey,
        semanticScope: 'market',
        op: operator,
        params: {
          indicator: movingAverageConfig.kind,
          ...movingAverageConfig.params,
        },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildRsiRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const threshold = this.resolveRsiThreshold(input.ruleText)
    if (!threshold) return null

    return {
      id: `${input.phase}-${threshold.key.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 180 - input.index : 130 - input.index,
      condition: {
        kind: 'atom',
        key: threshold.key,
        semanticScope: 'market',
        op: threshold.op,
        value: threshold.value,
        params: { period: this.resolveRsiPeriod([input.ruleText]) },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildMacdRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const ruleKey = /金叉|上穿/u.test(input.ruleText)
      ? CANONICAL_RULE_KEYS.macdGoldenCross
      : /死叉|下穿/u.test(input.ruleText)
          ? CANONICAL_RULE_KEYS.macdDeathCross
          : null
    if (!ruleKey) return null

    return {
      id: `${input.phase}-${ruleKey.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 175 - input.index : 125 - input.index,
      condition: {
        kind: 'atom',
        key: ruleKey,
        semanticScope: 'market',
        op: ruleKey === CANONICAL_RULE_KEYS.macdGoldenCross ? 'CROSS_OVER' : 'CROSS_UNDER',
        params: { ...DEFAULT_INDICATOR_PARAMS.macd },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildGridRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null
    sideScope: 'long' | 'short' | null
    sizing: { mode: 'RATIO'; value: number } | null
    sharedGridParams: {
      rangeMin: number
      rangeMax: number
      stepPct: number
      levelCount: number
    } | null
    ruleDraft?: { timeframe: string | null } | undefined
  }): CanonicalRuleV2 | null {
    if (!/网格/u.test(input.ruleText)) return null

    const params = this.resolveGridParams(input.ruleText) ?? input.sharedGridParams
    if (!params) return null

    const semantics = this.resolveGridSemantics(input.ruleText, input.phase, input.actionType, input.sideScope)

    return {
      id: `${input.phase}-grid-level-touch-${input.index + 1}`,
      phase: input.phase,
      sideScope: semantics.sideScope,
      priority: input.phase === 'entry' ? 170 - input.index : 120 - input.index,
      condition: {
        kind: 'atom',
        key: 'grid.range_rebalance',
        semanticScope: 'market',
        op: semantics.op,
        params: {
          ...params,
          ...(input.ruleDraft?.timeframe ? { timeframe: input.ruleDraft.timeframe } : {}),
        },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(semantics.action as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: semantics.action as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
    }
  }

  private buildBreakoutRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const period = this.resolveBreakoutPeriod(input.ruleText)
    const isHighBreak = /前高|最高价|通道上轨|关键阻力|阻力位|唐奇安.*上轨|donchian.*upper|breakout|highest/i.test(input.ruleText)
    const isLowBreak = /前低|最低价|通道下轨|关键支撑|支撑位|唐奇安.*下轨|donchian.*lower|breakdown|lowest/i.test(input.ruleText)
    const key = isHighBreak
      ? 'breakout.channel_high_break'
      : (isLowBreak ? 'breakout.channel_low_break' : null)
    if (!key) return null

    return {
      id: `${input.phase}-${key.replace(/\./g, '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 165 - input.index : 118 - input.index,
      cooldownBars: input.phase === 'entry' ? this.resolveCooldownBars(input.ruleText) : undefined,
      condition: {
        kind: 'atom',
        key,
        semanticScope: 'market',
        op: key === 'breakout.channel_high_break' ? 'CROSS_OVER' : 'CROSS_UNDER',
        params: { period },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
    }
  }

  private buildPriceChangeRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null
    sideScope: 'long' | 'short' | null
    sizing: { mode: 'RATIO'; value: number } | null
    ruleDraft?: { timeframe: string | null, basis?: string | null } | undefined
  }): CanonicalRuleV2 | null {
    const timeframe = input.ruleDraft?.timeframe ?? this.extractRuleTimeframe(input.ruleText)
    const pctChange = this.extractPriceChangePct(input.ruleText)
    if (!timeframe || !pctChange || !input.actionType || !input.sideScope) {
      return null
    }

    const isDrop = pctChange.direction === 'drop'
    const numericPct = pctChange.value
    if (!Number.isFinite(numericPct) || numericPct <= 0) {
      return null
    }

    const normalizedValue = Number((numericPct / 100).toFixed(4))
    const explicitBasis = input.ruleDraft?.basis
    const usesPositionBasis = input.phase === 'exit' && (explicitBasis === 'entry_avg_price' || explicitBasis === 'position_pnl')
    return {
      id: `${input.phase}-price-change-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 210 - input.index : 135 - input.index,
      condition: {
        kind: 'atom',
        key: usesPositionBasis ? 'position_gain_pct' : 'price.change_pct',
        semanticScope: usesPositionBasis ? 'position' : 'market',
        op: isDrop ? 'LTE' : 'GTE',
        value: isDrop ? -normalizedValue : normalizedValue,
        params: {
          timeframe,
          lookbackBars: 1,
          ...(explicitBasis ? { basis: explicitBasis } : {}),
        },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
      ...(explicitBasis ? { metadata: { basis: explicitBasis } } : {}),
    }
  }

  private resolveSizingFromNormalizedIntent(
    normalizedIntent: StrategyNormalizedIntent,
  ): CanonicalStrategySpecV2['sizing'] {
    if (!normalizedIntent.position || !Number.isFinite(normalizedIntent.position.value)) {
      return null
    }

    if (normalizedIntent.position.mode === 'fixed_ratio') {
      return {
        mode: 'RATIO',
        value: Number(normalizedIntent.position.value.toFixed(4)),
      }
    }

    if (normalizedIntent.position.mode === 'fixed_quote') {
      return {
        mode: 'QUOTE',
        value: Number(normalizedIntent.position.value.toFixed(4)),
      }
    }

    return {
      mode: 'QTY',
      value: Number(normalizedIntent.position.value.toFixed(4)),
    }
  }

  private resolveNormalizedRequiredTimeframes(
    normalizedIntent: StrategyNormalizedIntent,
    context: NormalizedIntentCompileContext,
    fallbackTimeframe: string | null,
  ): string[] {
    const ordered = new Set<string>()
    const timeframes = Array.isArray(context.timeframes)
      ? context.timeframes
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
      : []

    for (const timeframe of timeframes) {
      ordered.add(timeframe)
    }

    for (const trigger of normalizedIntent.triggers) {
      const window = typeof trigger.params.window === 'string' ? trigger.params.window.trim() : ''
      if (window) {
        ordered.add(window)
      }
    }

    const defaultTimeframe = fallbackTimeframe?.trim()
    if (defaultTimeframe) {
      ordered.add(defaultTimeframe)
    }

    return [...ordered]
  }

  private resolveNormalizedIntentMarket(
    context: NormalizedIntentCompileContext,
  ): CanonicalStrategySpecV2['market'] {
    const symbols = Array.isArray(context.symbols) ? context.symbols : []
    const market = context.market && typeof context.market === 'object' && !Array.isArray(context.market)
      ? context.market as Record<string, unknown>
      : null
    const riskRules = 'riskRules' in context && context.riskRules && typeof context.riskRules === 'object' && !Array.isArray(context.riskRules)
      ? context.riskRules as Record<string, unknown>
      : {}
    const rawSymbol = typeof symbols[0] === 'string' ? symbols[0].trim().toUpperCase() : ''
    const marketExchange = typeof market?.exchange === 'string' ? market.exchange.trim().toLowerCase() : ''
    const marketType = typeof market?.marketType === 'string' ? market.marketType.trim().toLowerCase() : ''
    const riskExchange = typeof riskRules.exchange === 'string' ? riskRules.exchange.trim().toLowerCase() : ''
    const riskMarketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''
    const defaultTimeframe = typeof market?.defaultTimeframe === 'string' && market.defaultTimeframe.trim().length > 0
      ? market.defaultTimeframe.trim()
      : (Array.isArray(context.timeframes)
          ? context.timeframes.find((item): item is string => typeof item === 'string' && item.trim().length > 0)?.trim() ?? null
          : null)

    return {
      exchange: marketExchange === 'okx' || marketExchange === 'hyperliquid' || marketExchange === 'binance'
        ? marketExchange
        : (riskExchange === 'okx' || riskExchange === 'hyperliquid' || riskExchange === 'binance'
            ? riskExchange
            : 'binance'),
      symbol: rawSymbol || null,
      marketType: marketType === 'perp' ? 'perp' : (riskMarketType === 'perp' ? 'perp' : 'spot'),
      defaultTimeframe,
    }
  }

  private resolveIndicatorsFromNormalizedIntent(
    normalizedIntent: StrategyNormalizedIntent,
  ): CanonicalStrategySpecV2['indicators'] {
    const indicators: CanonicalStrategySpecV2['indicators'] = []
    const pushIndicator = (indicator: CanonicalStrategySpecV2['indicators'][number]) => {
      if (!indicators.some(item => item.kind === indicator.kind)) {
        indicators.push(indicator)
      }
    }

    for (const trigger of normalizedIntent.triggers) {
      switch (trigger.key) {
        case 'bollinger.touch_upper':
        case 'bollinger.touch_lower':
        case 'bollinger.touch_middle':
          pushIndicator({
            kind: 'bollingerBands',
            params: {
              period: typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
                ? trigger.params.period
                : DEFAULT_INDICATOR_PARAMS.bollingerBands.period,
              stdDev: typeof trigger.params.stdDev === 'number' && Number.isFinite(trigger.params.stdDev)
                ? trigger.params.stdDev
                : DEFAULT_INDICATOR_PARAMS.bollingerBands.stdDev,
            },
          })
          break
        case 'oscillator.rsi_gte':
        case 'oscillator.rsi_lte':
          pushIndicator({
            kind: 'rsi',
            params: {
              period: typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
                ? trigger.params.period
                : DEFAULT_INDICATOR_PARAMS.rsi.period,
            },
          })
          break
        case 'indicator.cross_over':
        case 'indicator.cross_under':
        case 'indicator.above':
        case 'indicator.below': {
          const indicator = typeof trigger.params.indicator === 'string'
            ? trigger.params.indicator.trim().toLowerCase()
            : ''
          if (indicator === 'macd') {
            pushIndicator({
              kind: 'macd',
              params: {
                fastPeriod: typeof trigger.params.fastPeriod === 'number' && Number.isFinite(trigger.params.fastPeriod)
                  ? trigger.params.fastPeriod
                  : DEFAULT_INDICATOR_PARAMS.macd.fastPeriod,
                slowPeriod: typeof trigger.params.slowPeriod === 'number' && Number.isFinite(trigger.params.slowPeriod)
                  ? trigger.params.slowPeriod
                  : DEFAULT_INDICATOR_PARAMS.macd.slowPeriod,
                signalPeriod: typeof trigger.params.signalPeriod === 'number' && Number.isFinite(trigger.params.signalPeriod)
                  ? trigger.params.signalPeriod
                  : DEFAULT_INDICATOR_PARAMS.macd.signalPeriod,
              },
            })
            break
          }
          if (indicator === 'rsi') {
            pushIndicator({
              kind: 'rsi',
              params: {
                period: typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
                  ? trigger.params.period
                  : DEFAULT_INDICATOR_PARAMS.rsi.period,
              },
            })
            break
          }
          if (indicator === 'ema') {
            pushIndicator({
              kind: 'ema',
              params: {
                fastPeriod: typeof trigger.params.fastPeriod === 'number' && Number.isFinite(trigger.params.fastPeriod)
                  ? trigger.params.fastPeriod
                  : 7,
                slowPeriod: typeof trigger.params.slowPeriod === 'number' && Number.isFinite(trigger.params.slowPeriod)
                  ? trigger.params.slowPeriod
                  : 21,
              },
            })
            break
          }
          if (indicator === 'ma' || indicator === 'sma' || indicator === 'indicator' || indicator.length === 0) {
            pushIndicator({
              kind: 'sma',
              params: {
                fastPeriod: typeof trigger.params.fastPeriod === 'number' && Number.isFinite(trigger.params.fastPeriod)
                  ? trigger.params.fastPeriod
                  : 7,
                slowPeriod: typeof trigger.params.slowPeriod === 'number' && Number.isFinite(trigger.params.slowPeriod)
                  ? trigger.params.slowPeriod
                  : 21,
                ...(typeof trigger.params['reference.period'] === 'number' && Number.isFinite(trigger.params['reference.period'])
                  ? { period: trigger.params['reference.period'] }
                  : {}),
              },
            })
          }
          break
        }
        case 'volatility.state':
          pushIndicator({
            kind: 'atr',
            params: { ...DEFAULT_INDICATOR_PARAMS.atr },
          })
          break
        default:
          break
      }
    }

    if (normalizedIntent.grid) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'grid' },
      })
    }

    if (normalizedIntent.triggers.some(trigger => trigger.key === 'price.breakout_up' || trigger.key === 'price.breakout_down')) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'breakout' },
      })
    }

    if (normalizedIntent.triggers.some(trigger => trigger.key === 'price.range_position_lte' || trigger.key === 'price.range_position_gte')) {
      pushIndicator({
        kind: 'custom',
        params: { atom: 'price.range_position' },
      })
    }

    return indicators
  }

  private buildRulesFromNormalizedIntent(input: {
    normalizedIntent: StrategyNormalizedIntent
    sizing: CanonicalStrategySpecV2['sizing']
    defaultTimeframe: string | null
  }): CanonicalRuleV2[] {
    const gateTriggers = input.normalizedIntent.triggers.filter(trigger => trigger.phase === 'gate')
    const rules: CanonicalRuleV2[] = []
    let entryPriority = 210
    let exitPriority = 140
    let riskPriority = 120

    for (const trigger of input.normalizedIntent.triggers) {
      if (trigger.phase !== 'entry' && trigger.phase !== 'exit') {
        continue
      }
      const phaseTrigger = trigger as NormalizedTriggerAtom & { phase: 'entry' | 'exit' }

      const rule = this.buildRuleFromNormalizedTrigger({
        trigger: phaseTrigger,
        gateTriggers,
        sizing: input.sizing,
        priority: phaseTrigger.phase === 'entry' ? entryPriority-- : exitPriority--,
        defaultTimeframe: input.defaultTimeframe,
      })
      if (rule) {
        rules.push(rule)
      }
    }

    if (input.normalizedIntent.grid) {
      rules.push(
        ...this.buildGridRulesFromNormalizedIntent({
          grid: input.normalizedIntent.grid,
          gateTriggers,
          sizing: input.sizing,
          startingEntryPriority: entryPriority,
          startingExitPriority: exitPriority,
          defaultTimeframe: input.defaultTimeframe,
        }),
      )
    }

    for (const riskAtom of input.normalizedIntent.risk) {
      const rule = this.buildRiskRuleFromNormalizedAtom(
        riskAtom,
        riskPriority--,
        input.normalizedIntent.position?.positionMode ?? null,
      )
      if (rule) {
        rules.push(rule)
      }
    }

    return rules
  }

  private buildRuleFromNormalizedTrigger(input: {
    trigger: NormalizedTriggerAtom & { phase: 'entry' | 'exit' }
    gateTriggers: NormalizedTriggerAtom[]
    sizing: CanonicalStrategySpecV2['sizing']
    priority: number
    defaultTimeframe: string | null
  }): CanonicalRuleV2 | null {
    const triggerCondition = this.buildConditionFromNormalizedTrigger(input.trigger, input.defaultTimeframe)
    if (!triggerCondition) {
      return null
    }

    const actions = this.buildActionsForNormalizedTrigger(input.trigger, input.sizing)
    if (actions.length === 0) {
      return null
    }

    const gateKeys = input.gateTriggers.map(trigger => trigger.key)
    return {
      id: `${input.trigger.phase}-${input.trigger.key.replace(/\./g, '-')}-${input.priority}`,
      phase: input.trigger.phase,
      sideScope: this.resolveNormalizedRuleSideScope(input.trigger, actions),
      priority: input.priority,
      condition: this.attachGateConditions(triggerCondition, input.gateTriggers),
      actions,
      metadata: {
        normalized: {
          source: 'normalized-intent',
          triggerKeys: [input.trigger.key],
          ...(gateKeys.length > 0 ? { gateKeys } : {}),
          actionKeys: actions.map(action => action.type),
          family: 'single-leg',
        },
      },
    }
  }

  private resolveNormalizedRuleSideScope(
    trigger: NormalizedTriggerAtom & { phase: 'entry' | 'exit' },
    actions: CanonicalRuleV2['actions'],
  ): CanonicalRuleSideScope | undefined {
    if (trigger.sideScope) {
      return trigger.sideScope
    }

    if (trigger.phase !== 'exit') {
      return undefined
    }

    const resolvedScopes = new Set<Exclude<CanonicalRuleSideScope, 'flat'>>()
    for (const action of actions) {
      if (action.type === 'OPEN_LONG' || action.type === 'CLOSE_LONG') {
        resolvedScopes.add('long')
      }
      if (action.type === 'OPEN_SHORT' || action.type === 'CLOSE_SHORT') {
        resolvedScopes.add('short')
      }
    }

    if (resolvedScopes.has('long') && resolvedScopes.has('short')) {
      return 'both'
    }

    return resolvedScopes.values().next().value
  }

  private buildGridRulesFromNormalizedIntent(input: {
    grid: NormalizedGridIntent
    gateTriggers: NormalizedTriggerAtom[]
    sizing: CanonicalStrategySpecV2['sizing']
    startingEntryPriority: number
    startingExitPriority: number
    defaultTimeframe: string | null
  }): CanonicalRuleV2[] {
    const rules: CanonicalRuleV2[] = []
    let entryPriority = input.startingEntryPriority
    let exitPriority = input.startingExitPriority
    const gridCondition = this.buildGridConditionFromNormalizedIntent(input.grid, input.defaultTimeframe)
    const gateKeys = input.gateTriggers.map(trigger => trigger.key)

    const buildRule = (
      phase: 'entry' | 'exit',
      sideScope: 'long' | 'short',
      op: 'LTE' | 'GTE',
      actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT',
    ): CanonicalRuleV2 => ({
      id: `${phase}-grid-range-rebalance-${sideScope}`,
      phase,
      sideScope,
      priority: phase === 'entry' ? entryPriority-- : exitPriority--,
      condition: this.attachGateConditions(
        {
          ...gridCondition,
          op,
        },
        input.gateTriggers,
      ),
      actions: [phase === 'entry'
        ? this.buildOpenAction(actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
      metadata: {
        normalized: {
          source: 'normalized-intent',
          triggerKeys: ['grid.range_rebalance'],
          ...(gateKeys.length > 0 ? { gateKeys } : {}),
          actionKeys: [actionType],
          family: 'grid.range_rebalance',
        },
      },
    })

    if (input.grid.sideMode === 'long_only' || input.grid.sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'long', 'LTE', 'OPEN_LONG'))
      rules.push(buildRule('exit', 'long', 'GTE', 'CLOSE_LONG'))
    }

    if (input.grid.sideMode === 'short_only' || input.grid.sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'short', 'GTE', 'OPEN_SHORT'))
      rules.push(buildRule('exit', 'short', 'LTE', 'CLOSE_SHORT'))
    }

    return rules
  }

  private buildGridRulesFromSemanticTrigger(input: {
    trigger: SemanticTriggerState
    sizing: CanonicalStrategySpecV2['sizing']
    defaultTimeframe: string | null
    gateConditions?: CanonicalConditionNode[]
  }): CanonicalRuleV2[] {
    const gridParams = this.resolveGridParamsFromSemanticTrigger(input.trigger, input.defaultTimeframe)
    if (!gridParams) {
      return []
    }

    const sideMode = this.resolveGridSideModeFromSemanticTrigger(input.trigger)
    const buildRule = (
      phase: 'entry' | 'exit',
      sideScope: 'long' | 'short',
      op: 'LTE' | 'GTE',
      actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT',
    ): CanonicalRuleV2 => {
      const condition: CanonicalConditionNode = {
        kind: 'atom',
        key: 'grid.range_rebalance',
        semanticScope: 'market',
        op,
        params: gridParams,
      }

      return {
        id: `semantic-${phase}-grid-range-rebalance-${sideScope}`,
        phase,
        sideScope,
        priority: phase === 'entry' ? 170 : 120,
        condition: phase === 'entry'
          ? this.attachSemanticGateConditions(condition, input.gateConditions ?? [])
          : condition,
        actions: [phase === 'entry'
          ? this.buildOpenAction(actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
          : { type: actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
        metadata: {
          semantic: {
            source: 'semantic-state',
            triggerKeys: [input.trigger.key],
            actionKeys: [actionType],
            family: 'grid.range_rebalance',
          },
        },
      }
    }

    const rules: CanonicalRuleV2[] = []
    if (sideMode === 'long_only' || sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'long', 'LTE', 'OPEN_LONG'))
      rules.push(buildRule('exit', 'long', 'GTE', 'CLOSE_LONG'))
    }
    if (sideMode === 'short_only' || sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'short', 'GTE', 'OPEN_SHORT'))
      rules.push(buildRule('exit', 'short', 'LTE', 'CLOSE_SHORT'))
    }

    return rules
  }

  private resolveGridParamsFromSemanticTrigger(
    trigger: SemanticTriggerState,
    defaultTimeframe: string | null,
  ): Record<string, number | string | boolean> | null {
    const lower = this.readSemanticGridNumber(trigger.params, 'rangeMin')
      ?? this.readSemanticGridNumber(trigger.params, 'rangeLower')
      ?? this.readSemanticGridRangeNumber(trigger.params, 'lower')
    const upper = this.readSemanticGridNumber(trigger.params, 'rangeMax')
      ?? this.readSemanticGridNumber(trigger.params, 'rangeUpper')
      ?? this.readSemanticGridRangeNumber(trigger.params, 'upper')
    const stepPct = this.readSemanticGridNumber(trigger.params, 'stepPct')

    if (
      lower === null
      || upper === null
      || stepPct === null
      || lower <= 0
      || upper <= lower
      || stepPct <= 0
    ) {
      return null
    }

    const normalizedStepPct = Number(stepPct.toFixed(4))
    return {
      rangeMin: lower,
      rangeMax: upper,
      stepPct: normalizedStepPct,
      levelCount: this.deriveGridLevelCount(lower, upper, normalizedStepPct),
      ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
      recycle: typeof trigger.params.recycle === 'boolean' ? trigger.params.recycle : true,
    }
  }

  private readSemanticGridNumber(
    params: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = params[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readSemanticGridRangeNumber(
    params: Record<string, unknown>,
    key: 'lower' | 'upper',
  ): number | null {
    const range = params.range
    if (!range || typeof range !== 'object' || Array.isArray(range)) {
      return null
    }

    const value = (range as Record<string, unknown>)[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private resolveGridSideModeFromSemanticTrigger(
    trigger: SemanticTriggerState,
  ): 'long_only' | 'short_only' | 'bidirectional' {
    const sideMode = trigger.params.sideMode
    if (sideMode === 'long_only' || sideMode === 'short_only' || sideMode === 'bidirectional') {
      return sideMode
    }

    if (trigger.sideScope === 'long') {
      return 'long_only'
    }
    if (trigger.sideScope === 'short') {
      return 'short_only'
    }

    return 'bidirectional'
  }

  private buildRiskRuleFromNormalizedAtom(
    riskAtom: NormalizedRiskAtom,
    priority: number,
    positionMode: StrategyNormalizedIntent['position']['positionMode'] | null,
  ): CanonicalRuleV2 | null {
    if (riskAtom.key === 'risk.stop_loss_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
      if (!this.isExecutablePercentRiskBasis(basis)) {
        return null
      }
      return {
        id: 'risk-stop-loss',
        phase: 'risk',
        sideScope: 'both',
        priority,
        condition: {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.positionLossPct,
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: { basis },
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          basis,
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: ['FORCE_EXIT'],
          },
        },
      }
    }

    if (riskAtom.key === 'risk.take_profit_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
      if (!this.isExecutablePercentRiskBasis(basis)) {
        return null
      }
      const actions = positionMode === 'short_only'
        ? [{ type: 'CLOSE_SHORT' as const }]
        : positionMode === 'long_only'
          ? [{ type: 'CLOSE_LONG' as const }]
          : [{ type: 'CLOSE_LONG' as const }, { type: 'CLOSE_SHORT' as const }]
      const sideScope = positionMode === 'short_only'
        ? 'short'
        : positionMode === 'long_only'
          ? 'long'
          : 'both'
      return {
        id: 'risk-take-profit',
        phase: 'risk',
        sideScope,
        priority,
        condition: {
          kind: 'atom',
          key: 'risk.take_profit_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: { basis },
        },
        actions,
        metadata: {
          basis,
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: actions.map(action => action.type),
          },
        },
      }
    }

    if (riskAtom.key === 'risk.max_drawdown_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      return {
        id: 'risk-max-drawdown',
        phase: 'risk',
        sideScope: 'both',
        priority,
        condition: {
          kind: 'atom',
          key: 'risk.max_drawdown_pct',
          semanticScope: 'portfolio',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: ['FORCE_EXIT'],
          },
        },
      }
    }

    if (riskAtom.key === 'risk.max_single_loss_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      return {
        id: 'risk-max-single-loss',
        phase: 'risk',
        sideScope: 'both',
        priority,
        condition: {
          kind: 'atom',
          key: 'risk.max_single_loss_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: ['FORCE_EXIT'],
          },
        },
      }
    }

    return null
  }

  private attachGateConditions(
    condition: CanonicalConditionNode,
    gateTriggers: NormalizedTriggerAtom[],
  ): CanonicalConditionNode {
    if (gateTriggers.length === 0) {
      return condition
    }

    return {
      kind: 'AND',
      children: [
        ...gateTriggers
          .map(trigger => this.buildConditionFromNormalizedTrigger(trigger, null))
          .filter((item): item is CanonicalConditionNode => item !== null),
        condition,
      ],
    }
  }

  private buildConditionFromNormalizedTrigger(
    trigger: NormalizedTriggerAtom,
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    switch (trigger.key) {
      case 'execution.on_start':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.executionOnStart,
          semanticScope: 'market',
        }
      case 'price.percent_change': {
        const valuePct = typeof trigger.params.valuePct === 'number' ? trigger.params.valuePct : null
        if (valuePct === null || !Number.isFinite(valuePct) || valuePct === 0) {
          return null
        }
        const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : undefined
        const usesPositionBasis = trigger.phase === 'exit' && (basis === 'entry_avg_price' || basis === 'position_pnl')
        const timeframe = typeof trigger.params.window === 'string' && trigger.params.window.trim()
          ? trigger.params.window.trim()
          : defaultTimeframe
        return {
          kind: 'atom',
          key: usesPositionBasis ? 'position_gain_pct' : 'price.change_pct',
          semanticScope: usesPositionBasis ? 'position' : 'market',
          op: valuePct < 0 ? 'LTE' : 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: {
            ...(timeframe ? { timeframe } : {}),
            lookbackBars: 1,
            ...(basis ? { basis } : {}),
          },
        }
      }
      case 'price.range_position_lte':
      case 'price.range_position_gte': {
        const thresholdPct = typeof trigger.params.thresholdPct === 'number'
          ? trigger.params.thresholdPct
          : null
        if (thresholdPct === null || !Number.isFinite(thresholdPct)) {
          return null
        }
        return {
          kind: 'atom',
          key: trigger.key,
          semanticScope: 'market',
          op: trigger.key === 'price.range_position_lte' ? 'LTE' : 'GTE',
          value: Number((thresholdPct / 100).toFixed(4)),
          params: {
            period: typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : 20,
            ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
          },
        }
      }
      case 'price.breakout_up':
        return {
          kind: 'atom',
          key: 'breakout.channel_high_break',
          semanticScope: 'market',
          op: 'CROSS_OVER',
          params: {
            period: typeof trigger.params.period === 'number' ? trigger.params.period : 20,
            ...(typeof trigger.params.reference === 'string' ? { reference: trigger.params.reference } : {}),
            ...(typeof trigger.params.bufferPct === 'number' ? { bufferPct: trigger.params.bufferPct } : {}),
          },
        }
      case 'price.breakout_down':
        return {
          kind: 'atom',
          key: 'breakout.channel_low_break',
          semanticScope: 'market',
          op: 'CROSS_UNDER',
          params: {
            period: typeof trigger.params.period === 'number' ? trigger.params.period : 20,
            ...(typeof trigger.params.reference === 'string' ? { reference: trigger.params.reference } : {}),
          },
        }
      case 'bollinger.touch_upper':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerUpperBreak,
          semanticScope: 'market',
          op: 'CROSS_OVER',
        }
      case 'bollinger.touch_lower':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerLowerBreak,
          semanticScope: 'market',
          op: 'CROSS_UNDER',
        }
      case 'bollinger.touch_middle':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerMiddleRevert,
          semanticScope: 'market',
        }
      case 'oscillator.rsi_lte':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.rsiThresholdLte,
          semanticScope: 'market',
          op: 'LTE',
          value: typeof trigger.params.value === 'number' ? trigger.params.value : 30,
          params: {
            period: typeof trigger.params.period === 'number'
              ? trigger.params.period
              : DEFAULT_INDICATOR_PARAMS.rsi.period,
          },
        }
      case 'oscillator.rsi_gte':
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.rsiThresholdGte,
          semanticScope: 'market',
          op: 'GTE',
          value: typeof trigger.params.value === 'number' ? trigger.params.value : 70,
          params: {
            period: typeof trigger.params.period === 'number'
              ? trigger.params.period
              : DEFAULT_INDICATOR_PARAMS.rsi.period,
          },
        }
      case 'indicator.cross_over':
      case 'indicator.cross_under': {
        const indicator = typeof trigger.params.indicator === 'string'
          ? trigger.params.indicator.trim().toLowerCase()
          : ''
        const operator = trigger.key === 'indicator.cross_over' ? 'CROSS_OVER' : 'CROSS_UNDER'
        if (indicator === 'macd') {
          return {
            kind: 'atom',
            key: trigger.key === 'indicator.cross_over' ? CANONICAL_RULE_KEYS.macdGoldenCross : CANONICAL_RULE_KEYS.macdDeathCross,
            semanticScope: 'market',
            op: operator,
            params: {
              fastPeriod: typeof trigger.params.fastPeriod === 'number'
                ? trigger.params.fastPeriod
                : DEFAULT_INDICATOR_PARAMS.macd.fastPeriod,
              slowPeriod: typeof trigger.params.slowPeriod === 'number'
                ? trigger.params.slowPeriod
                : DEFAULT_INDICATOR_PARAMS.macd.slowPeriod,
              signalPeriod: typeof trigger.params.signalPeriod === 'number'
                ? trigger.params.signalPeriod
                : DEFAULT_INDICATOR_PARAMS.macd.signalPeriod,
            },
          }
        }
        if (indicator === 'rsi') {
          return {
            kind: 'atom',
            key: trigger.key === 'indicator.cross_over' ? CANONICAL_RULE_KEYS.rsiCrossOver : CANONICAL_RULE_KEYS.rsiCrossUnder,
            semanticScope: 'market',
            op: operator,
            value: typeof trigger.params.value === 'number' ? trigger.params.value : 50,
            params: {
              period: typeof trigger.params.period === 'number'
                ? trigger.params.period
                : DEFAULT_INDICATOR_PARAMS.rsi.period,
            },
          }
        }
        const movingAverageIndicator = indicator === 'ema'
          ? 'ema'
          : (indicator === 'ma' || indicator === 'sma' || indicator.length === 0 ? 'sma' : indicator)
        return {
          kind: 'atom',
          key: trigger.key === 'indicator.cross_over' ? CANONICAL_RULE_KEYS.movingAverageGoldenCross : CANONICAL_RULE_KEYS.movingAverageDeathCross,
          semanticScope: 'market',
          op: operator,
          params: {
            indicator: movingAverageIndicator,
            ...(typeof trigger.params.fastPeriod === 'number' ? { fastPeriod: trigger.params.fastPeriod } : {}),
            ...(typeof trigger.params.slowPeriod === 'number' ? { slowPeriod: trigger.params.slowPeriod } : {}),
          },
        }
      }
      case 'indicator.above':
        return {
          kind: 'atom',
          key: 'indicator.above',
          semanticScope: 'market',
          op: 'GTE',
          params: {
            ...(typeof trigger.params.indicator === 'string' ? { indicator: trigger.params.indicator } : {}),
            ...(typeof trigger.params.referenceRole === 'string' ? { referenceRole: trigger.params.referenceRole } : {}),
            ...(typeof trigger.params['reference.period'] === 'number'
              ? { 'reference.period': trigger.params['reference.period'] }
              : {}),
          },
        }
      case 'indicator.below':
        return {
          kind: 'atom',
          key: 'indicator.below',
          semanticScope: 'market',
          op: 'LTE',
          params: {
            ...(typeof trigger.params.indicator === 'string' ? { indicator: trigger.params.indicator } : {}),
            ...(typeof trigger.params.referenceRole === 'string' ? { referenceRole: trigger.params.referenceRole } : {}),
            ...(typeof trigger.params['reference.period'] === 'number'
              ? { 'reference.period': trigger.params['reference.period'] }
              : {}),
          },
        }
      case 'trend.direction':
      case 'market.regime':
      case 'volatility.state':
        return {
          kind: 'atom',
          key: trigger.key,
          semanticScope: 'market',
          op: 'EQ',
          value: typeof trigger.params.value === 'string' ? trigger.params.value : undefined,
        }
      default:
        return null
    }
  }

  private buildActionsForNormalizedTrigger(
    trigger: NormalizedTriggerAtom,
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2['actions'] {
    if (trigger.phase === 'entry') {
      if (trigger.sideScope === 'short') {
        return [this.buildOpenAction('OPEN_SHORT', sizing)]
      }
      return [this.buildOpenAction('OPEN_LONG', sizing)]
    }

    if (trigger.phase === 'exit') {
      if (trigger.sideScope === 'short') {
        return [{ type: 'CLOSE_SHORT' }]
      }
      if (trigger.sideScope === 'both') {
        return [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }]
      }
      return [{ type: 'CLOSE_LONG' }]
    }

    return []
  }

  private buildGridConditionFromNormalizedIntent(
    grid: NormalizedGridIntent,
    defaultTimeframe: string | null,
  ): Extract<CanonicalConditionNode, { kind: 'atom' }> {
    const stepPct = Number(grid.stepPct.toFixed(4))
    return {
      kind: 'atom',
      key: 'grid.range_rebalance',
      semanticScope: 'market',
      params: {
        rangeMin: grid.range.lower,
        rangeMax: grid.range.upper,
        stepPct,
        levelCount: this.deriveGridLevelCount(grid.range.lower, grid.range.upper, stepPct),
        ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
        recycle: grid.recycle,
      },
    }
  }

  private deriveGridLevelCount(
    lower: number,
    upper: number,
    stepPct: number,
  ): number {
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(stepPct) || lower <= 0 || upper <= lower || stepPct <= 0) {
      return 2
    }

    const ratio = 1 + stepPct / 100
    if (ratio <= 1) {
      return 2
    }

    return Math.max(2, Math.floor(Math.log(upper / lower) / Math.log(ratio)) + 1)
  }

  private resolveRsiThreshold(text: string): {
    key:
      | typeof CANONICAL_RULE_KEYS.rsiThresholdLte
      | typeof CANONICAL_RULE_KEYS.rsiThresholdGte
      | typeof CANONICAL_RULE_KEYS.rsiCrossOver
      | typeof CANONICAL_RULE_KEYS.rsiCrossUnder
    op: 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
    value: number
  } | null {
    const operatorThreshold = text.match(/(?:<=|＜=|>=|＞=|低于|小于|高于|大于|上穿|下穿|突破|跌破)\s*(\d{1,3})/u)
    const numericTokens = Array.from(text.matchAll(/(\d{1,3})/g))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value) && value >= 0 && value <= 100)
    const explicitThreshold = operatorThreshold?.[1]
      ? Number(operatorThreshold[1])
      : numericTokens.length >= 2
      ? numericTokens[numericTokens.length - 1]
      : (numericTokens.length === 1 ? numericTokens[0] : null)
    const threshold = explicitThreshold
      ?? (/超卖/u.test(text) ? 30 : (/超买/u.test(text) ? 70 : null))

    if (threshold === null) return null

    if (/上穿|突破/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiCrossOver,
        op: 'CROSS_OVER',
        value: threshold,
      }
    }

    if (/下穿|跌破/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiCrossUnder,
        op: 'CROSS_UNDER',
        value: threshold,
      }
    }

    if (/<=|＜=|小于等于|低于|小于|超卖|低位/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiThresholdLte,
        op: 'LTE',
        value: threshold,
      }
    }

    if (/>=|＞=|大于等于|高于|大于|超买|高位/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiThresholdGte,
        op: 'GTE',
        value: threshold,
      }
    }

    return null
  }

  private resolveRsiPeriod(texts: string[]): number {
    for (const text of texts) {
      const matched = text.match(/(?:RSI|相对强弱)\D{0,4}(\d{1,2})/iu)
      if (matched?.[1]) {
        const period = Number(matched[1])
        if (Number.isFinite(period) && period > 0) {
          return period
        }
      }
    }

    return DEFAULT_INDICATOR_PARAMS.rsi.period
  }

  private extractRuleTimeframe(text: string): string | null {
    const matched = text.match(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/iu)
    if (!matched?.[1] || !matched[2]) {
      return null
    }
    const value = matched[1]
    const unit = matched[2].toLowerCase()
    if (unit === 'm' || unit === 'min' || unit === '分钟') return `${value}m`
    if (unit === 'h' || unit === '小时') return `${value}h`
    return `${value}d`
  }

  private extractPriceChangePct(
    text: string,
  ): { direction: 'drop' | 'rise'; value: number } | null {
    const percentPattern = /(下跌|跌|回撤|上涨|涨|反弹)\s*(?:(\d+(?:\.\d+)?)\s*%|百分之?\s*(\d+(?:\.\d+)?))/u
    const matched = text.match(percentPattern)
    if (!matched?.[1]) {
      return null
    }
    const rawValue = matched[2] ?? matched[3]
    if (!rawValue) {
      return null
    }

    return {
      direction: /下跌|跌|回撤/u.test(matched[1]) ? 'drop' : 'rise',
      value: Number(rawValue),
    }
  }

  private resolveBollingerParams(
    texts: string[],
  ): { period: number; stdDev: number } {
    for (const text of texts) {
      const matched = text.match(/布林带\s*[（(]\s*(\d{1,3})\s*[,，]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
      if (matched?.[1] && matched[2]) {
        return {
          period: Number(matched[1]),
          stdDev: Number(matched[2]),
        }
      }
    }

    for (const text of texts) {
      const middleMatch = text.match(/中轨\s*\(?(?:MA|ma)\s*(\d{1,3})\)?/u)
      if (middleMatch?.[1]) {
        return {
          period: Number(middleMatch[1]),
          stdDev: DEFAULT_INDICATOR_PARAMS.bollingerBands.stdDev,
        }
      }
    }

    return { ...DEFAULT_INDICATOR_PARAMS.bollingerBands }
  }

  private resolveMovingAverageConfig(
    texts: string[],
  ): {
    kind: 'sma' | 'ema'
    params: Record<string, number>
  } {
    for (const text of texts) {
      const pairMatch = text.match(/(?:EMA|ema|SMA|sma|MA|ma)?\s*(\d{1,3})\D{0,12}(?:EMA|ema|SMA|sma|MA|ma|日线|均线)\s*(\d{1,3})/u)
        ?? text.match(/(\d{1,3})\s*日线\D{0,12}(\d{1,3})\s*日线/u)
      if (pairMatch?.[1] && pairMatch[2]) {
        const first = Number(pairMatch[1])
        const second = Number(pairMatch[2])
        const fast = Math.min(first, second)
        const slow = Math.max(first, second)
        const kind = /\bema\b|EMA/u.test(text) ? 'ema' : 'sma'
        return {
          kind,
          params: { fastPeriod: fast, slowPeriod: slow },
        }
      }
    }

    return {
      kind: 'sma',
      params: { ...DEFAULT_INDICATOR_PARAMS.sma },
    }
  }

  private resolveMacdParams(
    texts: string[],
  ): { fastPeriod: number; slowPeriod: number; signalPeriod: number } {
    for (const text of texts) {
      const matched = text.match(/(?:MACD|macd)\s*[（(]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[)）]/u)
      if (matched?.[1] && matched[2] && matched[3]) {
        return {
          fastPeriod: Number(matched[1]),
          slowPeriod: Number(matched[2]),
          signalPeriod: Number(matched[3]),
        }
      }
    }

    return { ...DEFAULT_INDICATOR_PARAMS.macd }
  }

  private resolveGridParams(text: string): {
    rangeMin: number
    rangeMax: number
    stepPct: number
    levelCount: number
  } | null {
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.resolveGridStepPct(text)
    const levelMatch = text.match(/(?:共|总计)?\s*(\d+)\s*格/u)
    if (!rangeMatch?.[1] || !rangeMatch[2] || stepPct === null || !levelMatch?.[1]) {
      return null
    }

    return {
      rangeMin: Number(rangeMatch[1]),
      rangeMax: Number(rangeMatch[2]),
      stepPct,
      levelCount: Number(levelMatch[1]),
    }
  }

  private resolveGridStepPct(text: string): number | null {
    const percentMatch = text.match(/(?:步长|网格步长)\s*(\d+(?:\.\d+)?)\s*%/u)
    if (percentMatch?.[1]) {
      return Number(percentMatch[1])
    }

    const perMilleMatch = text.match(/千分之\s*(\d+(?:\.\d+)?)/u)
    if (perMilleMatch?.[1]) {
      return Number(perMilleMatch[1]) / 10
    }

    return null
  }

  private resolveGridSemantics(
    text: string,
    phase: 'entry' | 'exit',
    fallbackAction: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null,
    fallbackSideScope: 'long' | 'short' | null,
  ): {
    action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    op: 'LTE' | 'GTE'
  } {
    const upperBias = /上方网格|上轨|上沿|上层/u.test(text)
    const lowerBias = /下方网格|下轨|下沿|下层/u.test(text)
    const shortEntry = /做空|开空|卖出开空|sell short/u.test(text)
    const shortExit = /买回|平空|回补/u.test(text)

    if (phase === 'entry') {
      if (shortEntry || upperBias || fallbackAction === 'OPEN_SHORT' || fallbackSideScope === 'short') {
        return {
          action: 'OPEN_SHORT',
          sideScope: 'short',
          op: 'GTE',
        }
      }

      return {
        action: 'OPEN_LONG',
        sideScope: 'long',
        op: 'LTE',
      }
    }

    if (shortExit || lowerBias || fallbackAction === 'CLOSE_SHORT' || fallbackSideScope === 'short') {
      return {
        action: 'CLOSE_SHORT',
        sideScope: 'short',
        op: 'LTE',
      }
    }

    return {
      action: 'CLOSE_LONG',
      sideScope: 'long',
      op: upperBias ? 'GTE' : (lowerBias ? 'LTE' : 'GTE'),
    }
  }

  private resolveBreakoutPeriod(text: string): number {
    const matched = text.match(/前\s*(\d+)\s*根?K?线?/u)
    return matched?.[1] ? Number(matched[1]) : 20
  }

  private resolveCooldownBars(text: string): number | undefined {
    const matched = text.match(/冷却\s*(\d+)\s*根?K?线?/u)
    if (!matched?.[1]) return undefined
    const value = Number(matched[1])
    return Number.isFinite(value) && value > 0 ? value : undefined
  }

  private resolveTakeProfitRule(
    texts: string[],
    riskRules: Record<string, unknown> = {},
    fallbackSideScope: 'long' | 'short' | null = null,
  ): {
    pct: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    if (
      typeof riskRules.takeProfitPct === 'number'
      && Number.isFinite(riskRules.takeProfitPct)
      && riskRules.takeProfitPct > 0
    ) {
      return {
        pct: riskRules.takeProfitPct,
        ...this.resolveExitActionSemantics(
          typeof riskRules.takeProfit === 'string' && riskRules.takeProfit.trim()
            ? riskRules.takeProfit
            : (fallbackSideScope === 'short' ? '平空止盈' : fallbackSideScope === 'long' ? '平多止盈' : '止盈'),
        ),
      }
    }

    for (const text of texts) {
      const matched = text.match(/(?:止盈|take[_\s-]?profit)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu)
      if (matched?.[1]) {
        return {
          pct: Number(matched[1]),
          ...this.resolveExitActionSemantics(text),
        }
      }
      const fallback = text.match(/收益率\D{0,12}(?:达到|大于等于|>=|超过|≥)?\s*(\d+(?:\.\d+)?)\s*%/u)
      if (fallback?.[1] && /止盈/u.test(text)) {
        return {
          pct: Number(fallback[1]),
          ...this.resolveExitActionSemantics(text),
        }
      }
    }
    return null
  }

  private resolveTrailingStopRule(
    texts: string[],
  ): {
    pct: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    for (const text of texts) {
      const matched = text.match(/(?:移动止损|trailing[_\s-]?stop)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu)
      if (matched?.[1]) {
        return {
          pct: Number(matched[1]),
          sideScope: 'both',
          actions: [{ type: 'FORCE_EXIT' }],
        }
      }
    }
    return null
  }

  private resolveTimeStopRule(
    texts: string[],
  ): {
    bars: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    for (const text of texts) {
      const matched = text.match(/持仓(?:超过|达到)?\s*(\d+)\s*根?K?线?.{0,8}(?:平仓|平多|平空|离场|出场)/u)
      if (matched?.[1]) {
        return {
          bars: Number(matched[1]),
          ...this.resolveTimeStopActionSemantics(text),
        }
      }
      const fallback = text.match(/time[_\s-]?stop\D{0,8}(\d+)/iu)
      if (fallback?.[1]) {
        return {
          bars: Number(fallback[1]),
          ...this.resolveTimeStopActionSemantics(text),
        }
      }
    }
    return null
  }

  private resolveExitActionSemantics(
    text: string,
    options: { allowReduce?: boolean } = {},
  ): {
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } {
    const closeAction = this.detectCloseAction(text)
    const allowReduce = options.allowReduce !== false
    const reduceSizing = this.resolveReduceSizing(text)
    const wantsReduce = allowReduce && /减仓|部分止盈|partial/i.test(text)
    const hasExplicitLongCloseText = /平多|多单|close\s*long/i.test(text)
    const hasExplicitShortCloseText = /平空|空单|close\s*short|买回|回补/i.test(text)

    if (wantsReduce) {
      if (hasExplicitLongCloseText) {
        return {
          sideScope: 'long',
          actions: [{ type: 'REDUCE_LONG', ...(reduceSizing ? { sizing: reduceSizing } : {}) }],
        }
      }
      if (hasExplicitShortCloseText || closeAction?.sideScope === 'short') {
        return {
          sideScope: 'short',
          actions: [{ type: 'REDUCE_SHORT', ...(reduceSizing ? { sizing: reduceSizing } : {}) }],
        }
      }
      return {
        sideScope: 'both',
        actions: [
          { type: 'REDUCE_LONG', ...(reduceSizing ? { sizing: reduceSizing } : {}) },
          { type: 'REDUCE_SHORT', ...(reduceSizing ? { sizing: reduceSizing } : {}) },
        ],
      }
    }

    if (closeAction?.type === 'CLOSE_LONG') {
      return {
        sideScope: 'long',
        actions: [{ type: 'CLOSE_LONG' }],
      }
    }
    if (closeAction?.type === 'CLOSE_SHORT') {
      return {
        sideScope: 'short',
        actions: [{ type: 'CLOSE_SHORT' }],
      }
    }

    return {
      sideScope: 'both',
      actions: [{ type: 'FORCE_EXIT' }],
    }
  }

  private resolveReduceSizing(text: string): { mode: 'RATIO'; value: number } | null {
    if (/减半|一半|half/u.test(text)) {
      return { mode: 'RATIO', value: 0.5 }
    }

    const matched = text.match(/减仓\s*(\d+(?:\.\d+)?)\s*%/u)
    if (!matched?.[1]) return null
    const value = Number(matched[1])
    if (!Number.isFinite(value) || value <= 0) return null
    return {
      mode: 'RATIO',
      value: value > 1 ? Number((value / 100).toFixed(4)) : value,
    }
  }

  private resolveTimeStopActionSemantics(
    text: string,
  ): {
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } {
    const closeAction = this.detectCloseAction(text)
    if (closeAction?.type === 'CLOSE_LONG') {
      return {
        sideScope: 'long',
        actions: [{ type: 'CLOSE_LONG' }],
      }
    }
    if (closeAction?.type === 'CLOSE_SHORT') {
      return {
        sideScope: 'short',
        actions: [{ type: 'CLOSE_SHORT' }],
      }
    }

    return {
      sideScope: 'both',
      actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
    }
  }
}
