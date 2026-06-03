import type { CanonicalConditionNode, CanonicalOrchestrationGate, CanonicalOrchestrationLegScope, CanonicalOrchestrationPortfolioRisk, CanonicalOrchestrationProgram, CanonicalOrchestrationScope, CanonicalOrderProgramIntent, CanonicalRuleSideScope, CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { PositionLifecycleActionMetadata } from '../types/canonical-strategy-ir'
import { LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS } from '../types/canonical-strategy-ir'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityShape,
  SemanticExpression,
  SemanticExpressionOperand,
  SemanticOrchestrationDataSourceSchema,
  SemanticOrchestrationContract,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
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
  NormalizedTriggerAtomKey,
  StrategyNormalizedIntent,
} from '../types/strategy-normalized-intent'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { canonicalSerialize, parseTimeframeMs } from '@ai/shared/script-engine/compiled-runtime'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { extractAtrStopParams } from './atr-stop-params'
import type { AtomContractKey } from '../atom-contracts/atom-contract-types'
import { CANONICAL_RULE_KEYS, DEFAULT_INDICATOR_PARAMS } from '../constants/canonical-strategy-capabilities'
import { NORMALIZED_TRIGGER_ATOM_KEYS } from '../types/strategy-normalized-intent'
import {
  buildStrategyRuleDrafts,
  resolveStrategyDefaultTimeframe,
  resolveRequiredRuleTimeframes,
  resolveRulePhaseDefaultTimeframe,
} from './rule-draft-projection'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'
import { normalizeRiskSemantics, normalizeSemanticStateCombinationContracts } from './semantic-state-normalization'
import { StrategyIrCanonicalAdapterService } from './strategy-ir-canonical-adapter.service'
import { SemanticAtomContractService } from './semantic-atom-contract.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'
import { SemanticTriggerCombinationContractService } from './semantic-trigger-combination-contract.service'
import { PerTradeSizingResolver, scopeKey as sizingScopeKey } from './per-trade-sizing-resolver.service'
import type { SizingAnchor, SizingAxis } from './per-trade-sizing-resolver.service'
import type { CanonicalOrchestrationLegSizing, CanonicalOrchestrationLegSizingMode } from '../types/canonical-strategy-spec'
import { normalizeLegacyPositionSizing, validateSemanticExpressionContract, validateSemanticPositionContract, validateSemanticRiskContract } from './strategy-semantic-contracts'
import type { AtomExpr, AtomExprAtom, RuleEffectsByRole, SemanticRule } from '../types/atom-expr'
import { collectAtomLeaves, isRuleEffectsByRole, listRuleEffects } from '../types/atom-expr'
import type { RulesMainflowAtomFact, RulesMainflowLeaf, RulesMainflowView } from './rules-mainflow-reader.service'
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

// PR3b: 非 atom 字段路径的类型化引用（Issue #1279 AC-4）
// 这些 key 不在 ATOM_CONTRACT_REGISTRY,但恰好匹配 lint 规则的 prefix regex,
// 用 `as const` 标识符避开 Literal AST 检测。
const FIELD_KEY = {
  ACTION_REDUCE_POSITION: 'action.reduce_position',
  CONDITION_EXPRESSION: 'condition.expression',
  PORTFOLIO_RISK_SUBSTRATEGY_EXPOSURE_CAP: 'portfolioRisk.substrategy_exposure_cap',
  PORTFOLIO_RISK_SYMBOL_EXPOSURE_CAP: 'portfolioRisk.symbol_exposure_cap',
  PRICE_ROLLING_EXTREMA_BREAKOUT: 'price.rolling_extrema_breakout',
  RISK_ATR_MULTIPLE_STOP: 'risk.atr_multiple_stop',
  RISK_ATR_MULTIPLE_TAKE_PROFIT: 'risk.atr_multiple_take_profit',
  RISK_ATR_STOP: 'risk.atr_stop',
  RISK_ATR_TAKE_PROFIT: 'risk.atr_take_profit',
  RISK_CONDITION_EXPRESSION: 'risk.condition_expression',
  RISK_MAX_DRAWDOWN_PCT: 'risk.max_drawdown_pct',
  RISK_COOLDOWN: 'risk.cooldown',
  RISK_COOLDOWN_BARS: 'risk.cooldown_bars',
  RISK_MAX_LOSS_PER_TRADE: 'risk.max_loss_per_trade',
  RISK_MAX_SINGLE_LOSS_PCT: 'risk.max_single_loss_pct',
  RISK_REMEMBERED_LEVEL_STOP: 'risk.remembered_level_stop',
  RISK_STOP_LOSS_PCT: 'risk.stop_loss_pct',
  RISK_TAKE_PROFIT_PCT: 'risk.take_profit_pct',
  RISK_TRAILING_STOP_PCT: 'risk.trailing_stop_pct',
  POSITION_SIZING: 'position.sizing',
  POSITION_PER_ORDER_BUDGET: 'position.per_order_budget',
  POSITION_BUDGET_CAP: 'position.budget_cap',
  POSITION_LEVERAGE: 'position.leverage',
  POSITION_MAX_EXPOSURE_PCT: 'position.max_exposure_pct',
  VOLUME_RELATIVE_AVERAGE: 'volume.relative_average',
} as const

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
  semanticState?: unknown
}

interface NormalizedIntentCompileContext {
  symbols?: unknown
  timeframes?: unknown
  market?: unknown
}

type CapabilityCandidateResolution = {
  status: 'ok'
  capability: SemanticCapability | null
} | {
  status: 'conflict'
}
type SemanticTriggerCombinationGroup = ReturnType<SemanticTriggerCombinationContractService['resolveExecutableGroups']>[number]
interface ScopedSemanticGateCondition {
  sideScope: CanonicalRuleSideScope
  condition: CanonicalConditionNode
}

@Injectable()
export class CanonicalSpecBuilderService {
  constructor(
    private readonly strategyIrCanonicalAdapter: StrategyIrCanonicalAdapterService = new StrategyIrCanonicalAdapterService(),
    private readonly contracts: SemanticAtomContractService = new SemanticAtomContractService(),
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly triggerCombinationContracts: SemanticTriggerCombinationContractService = new SemanticTriggerCombinationContractService(),
    // #1186 PR2: 多锚 sizing 反填到 legScopes[*].legSizing 时使用
    private readonly sizingResolver: PerTradeSizingResolver = new PerTradeSizingResolver(),
    private readonly rulesMainflowReader: RulesMainflowReaderService = new RulesMainflowReaderService(),
  ) {}

  buildFromLegacyChecklistForTestsOnly(legacySnapshot: StrategyLogicSnapshotInput): CanonicalStrategySpecV2 {
    if (this.isSemanticState(legacySnapshot.semanticState)) {
      return this.buildFromSemanticState(legacySnapshot.semanticState, legacySnapshot.market)
    }

    const normalizedLogicSnapshot = legacySnapshot as StrategyLogicSnapshotInput & Parameters<typeof buildStrategyRuleDrafts>[0]
    const ruleDrafts = buildStrategyRuleDrafts(normalizedLogicSnapshot)
    const entryRules = Array.isArray(legacySnapshot.entryRules) ? legacySnapshot.entryRules : []
    const exitRules = Array.isArray(legacySnapshot.exitRules) ? legacySnapshot.exitRules : []
    const riskRules = legacySnapshot.riskRules && typeof legacySnapshot.riskRules === 'object' && !Array.isArray(legacySnapshot.riskRules)
      ? legacySnapshot.riskRules as Record<string, unknown>
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
    if (stopLossPct !== null) {
      const stopLossRule = this.buildPercentRiskCanonicalRule({
        id: 'risk-stop-loss',
        sideScope: dominantEntrySideScope,
        priority: 120,
        riskKey: 'risk.stop_loss_pct',
        valuePct: stopLossPct,
        basis: stopLossBasis,
        actions: [{ type: 'FORCE_EXIT' }],
      })
      if (stopLossRule) {
        rules.push(stopLossRule)
      }
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
    if (takeProfitRule) {
      const canonicalTakeProfitRule = this.buildPercentRiskCanonicalRule({
        id: 'risk-take-profit',
        sideScope: takeProfitRule.sideScope,
        priority: 115,
        riskKey: 'risk.take_profit_pct',
        valuePct: takeProfitRule.pct,
        basis: takeProfitBasis,
        actions: takeProfitRule.actions,
      })
      if (canonicalTakeProfitRule) {
        rules.push(canonicalTakeProfitRule)
      }
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
      orderPrograms: [],
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
      market: this.withRequiredMarketTimeframes(
        market,
        requiredTimeframes,
        normalizedIntent.triggers.some(trigger => this.readTriggerParamTimeframe(trigger.params)),
      ),
      indicators,
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      orderPrograms: [],
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
    return {
      ...this.strategyIrCanonicalAdapter.adapt(strategyIr),
      orderPrograms: [],
    }
  }

  private isSemanticState(value: unknown): value is SemanticState {
    return Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && (value as { version?: unknown }).version === 1
      && Array.isArray((value as { triggers?: unknown }).triggers)
      && Array.isArray((value as { actions?: unknown }).actions)
      && Array.isArray((value as { risk?: unknown }).risk),
    )
  }

  buildFromSemanticState(state: SemanticState, fallbackMarket?: unknown): CanonicalStrategySpecV2 {
    const rulesMainflowRoute = this.resolveSemanticRulesMainflowRoute(state)
    if (rulesMainflowRoute === 'typed') {
      return this.buildFromSemanticRulesMainflow(state, fallbackMarket)
    }

    throw new Error(`InvalidSemanticRulesMainflow: reason=${rulesMainflowRoute}`)
  }

  private resolveSemanticRulesMainflowRoute(state: SemanticState): 'empty_or_legacy' | 'typed' {
    const rules = state.rules ?? []
    if (rules.length === 0) {
      throw new Error('InvalidSemanticRulesMainflow: reason=rules_missing_or_empty')
    }

    const legacyRuleEntries = rules
      .map((rule, index) => ({ rule, index }))
      .filter(entry => !isRuleEffectsByRole(entry.rule.effects))
    if (legacyRuleEntries.length === 0) {
      return 'typed'
    }
    if (legacyRuleEntries.length === rules.length) {
      throw new Error('InvalidSemanticRulesMainflow: reason=legacy_effects_array')
    }

    const firstLegacy = legacyRuleEntries[0]
    throw new Error(
      `MixedSemanticRuleEffectsShape: legacy_effects_array ruleId=${firstLegacy.rule.id} ruleIndex=${firstLegacy.index}`,
    )
  }

  private buildFromSemanticRulesMainflow(state: SemanticState, fallbackMarket?: unknown): CanonicalStrategySpecV2 {
    const readResult = this.rulesMainflowReader.readMainflowRules(state.rules)
    if (readResult.ok !== true) {
      throw new Error(`InvalidSemanticRulesMainflow: reason=${readResult.reason} diagnostics=${readResult.diagnostics.join('; ')}`)
    }
    const mainflow = readResult.view
    const market = this.resolveSemanticStateMarket(state, fallbackMarket)
    const isMultiLeg = state.isMultiLeg === true
    // 单一真相源：state.position 是 semantic-atom-invariant 锁定的 sizing 权威；
    // rule.effects.positions 可能携带多条同义 sizing 叶子（如 quote + ratio），必须让位，
    // 否则会触发 validatePositionSizingContract → codegen.semantic_atom_drift。
    const sizing: CanonicalStrategySpecV2['sizing'] = isMultiLeg
      ? null
      : (
          this.resolveSizingFromSemanticState(state.position)
          ?? this.resolveSizingFromSemanticRulePositionLeaves(mainflow.byRole.position)
          ?? { mode: 'RATIO' as const, value: 0.1 }
        )
    const orderPrograms = this.buildOrderProgramsFromSemanticRulesMainflow(mainflow, state)
    const rules = this.buildCanonicalRulesFromSemanticRulesMainflow(mainflow, sizing, market.defaultTimeframe)
    const orchestrationPrograms = this.buildOrchestrationProgramsFromSemanticRulesMainflow(mainflow, state)
    const orchestrationGates = this.buildOrchestrationGatesFromSemanticRulesMainflow(mainflow, orchestrationPrograms)
    const orchestrationScopes = [
      ...this.buildProgramScopesFromSemanticRulesMainflow(orchestrationPrograms),
      ...this.buildOrchestrationScopesFromSemanticRulesMainflow(mainflow, market),
    ]
    const orchestrationPortfolioRisks = this.buildOrchestrationPortfolioRisksFromSemanticRulesMainflow(mainflow, orchestrationScopes)
    // Task C: contextSlots.timeframe 缺省但 effects-orchestration scope.timeframe 声明了 primaryTimeframe 时，
    // 通用提升首个 timeframe scope 的 primaryTimeframe 到 market.defaultTimeframe，
    // 避免下游 IR 回退到 compile-time baseTimeframe 而丢失编排声明的主周期。
    const effectiveMarket: CanonicalStrategySpecV2['market'] = ((): CanonicalStrategySpecV2['market'] => {
      if (market.defaultTimeframe !== null && market.defaultTimeframe !== '') return market
      const timeframeScope = orchestrationScopes.find(
        (scope): scope is Extract<CanonicalOrchestrationScope, { scopeKind: 'timeframe' }> => scope.scopeKind === 'timeframe',
      )
      const lifted = timeframeScope?.primaryTimeframe
      if (!lifted) return market
      return { ...market, defaultTimeframe: lifted }
    })()
    const baseRequiredTimeframes = this.resolveSemanticStateRequiredTimeframes(rules, effectiveMarket.defaultTimeframe)
    const requiredTimeframes = this.mergeTimeframeScopeIntoDataRequirements(baseRequiredTimeframes, orchestrationScopes)
    const hasOrchestration = orchestrationGates.length > 0
      || orchestrationPrograms.length > 0
      || orchestrationScopes.length > 0
      || orchestrationPortfolioRisks.length > 0

    return {
      version: 2,
      market: this.withRequiredMarketTimeframes(effectiveMarket, requiredTimeframes),
      indicators: [],
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      orderPrograms,
      rules,
      ...(hasOrchestration
        ? {
            orchestration: {
              ...(orchestrationGates.length > 0 ? { gates: orchestrationGates } : {}),
              ...(orchestrationPortfolioRisks.length > 0 ? { portfolioRisks: orchestrationPortfolioRisks } : {}),
              ...(orchestrationPrograms.length > 0 ? { programs: orchestrationPrograms } : {}),
              ...(orchestrationScopes.length > 0 ? { scopes: orchestrationScopes } : {}),
            },
          }
        : {}),
      metadata: {
        rulesHash: this.hashRulesMainflow(state.rules),
        rulesMainflow: {
          positionSourcePaths: mainflow.byRole.position.map(leaf => leaf.path),
        },
      },
    }
  }

  private hashRulesMainflow(rules: SemanticState['rules']): string {
    return createHash('sha256').update(canonicalSerialize(rules ?? [])).digest('hex')
  }

  private readSemanticTriggerFacts(state: SemanticState): SemanticTriggerState[] {
    return this.rulesMainflowReader.readFactsByRole(state, 'condition').map(fact => ({
      id: fact.id,
      key: fact.key,
      phase: fact.phase === 'entry' || fact.phase === 'exit' ? fact.phase : 'gate',
      sideScope: fact.sideScope,
      params: fact.params,
      status: fact.status,
      source: fact.source,
      openSlots: [...fact.openSlots],
      ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: 'user_explicit' as const } } : {}),
      ...this.optionalAtomContracts(fact),
    }))
  }

  private readSemanticActionFacts(state: SemanticState): SemanticActionState[] {
    return this.rulesMainflowReader.readFactsByRole(state, 'action').map(fact => ({
      id: fact.id,
      key: fact.key,
      params: fact.params,
      status: fact.status,
      source: fact.source,
      openSlots: [...fact.openSlots],
      ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: 'user_explicit' as const } } : {}),
      ...this.optionalAtomContracts(fact),
    }))
  }

  private readSemanticRiskFacts(state: SemanticState): SemanticRiskState[] {
    return this.rulesMainflowReader.readFactsByRole(state, 'risk').map(fact => ({
      id: fact.id,
      key: fact.key,
      params: fact.params,
      status: fact.status,
      source: fact.source,
      openSlots: [...fact.openSlots],
      ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: 'user_explicit' as const } } : {}),
      ...this.optionalAtomContracts(fact),
    }))
  }

  private readSemanticPositionConstraintFacts(state: SemanticState): SemanticPositionConstraintState[] {
    return this.rulesMainflowReader.readFactsByRole(state, 'position')
      .filter((fact): fact is RulesMainflowAtomFact & { key: SemanticPositionConstraintState['key'] } =>
        this.isSemanticPositionConstraintKey(fact.key),
      )
      .map(fact => ({
        id: fact.id,
        key: fact.key,
        params: fact.params,
        status: fact.status,
        source: fact.source,
        openSlots: [...fact.openSlots],
        ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: 'user_explicit' as const } } : {}),
        ...this.optionalAtomContracts(fact),
      }))
  }

  private readSemanticOrchestrationFacts(state: SemanticState): SemanticOrchestrationNode[] {
    return this.rulesMainflowReader.readFactsByRole(state, 'orchestration').map(fact => ({
      id: fact.id,
      kind: this.resolveOrchestrationKind(fact.key),
      key: fact.key,
      params: fact.params,
      status: fact.status,
      source: fact.source,
      openSlots: [...fact.openSlots],
      contracts: this.orchestrationContracts(fact),
      ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: 'user_explicit' as const } } : {}),
      ...this.orchestrationFieldsFromParams(fact.params),
    }))
  }

  private optionalAtomContracts(fact: RulesMainflowAtomFact): { contracts?: SemanticAtomContract[] } {
    const contracts = fact.contracts?.filter((contract): contract is SemanticAtomContract =>
      contract.kind === 'trigger'
      || contract.kind === 'action'
      || contract.kind === 'risk'
      || contract.kind === 'position'
      || contract.kind === 'context',
    ) ?? []
    return contracts.length > 0 ? { contracts } : {}
  }

  private orchestrationContracts(fact: RulesMainflowAtomFact): SemanticOrchestrationContract[] {
    return fact.contracts?.filter((contract): contract is SemanticOrchestrationContract =>
      contract.kind === 'scope'
      || contract.kind === 'gate'
      || contract.kind === 'program'
      || contract.kind === 'portfolioRisk',
    ) ?? []
  }

  private isSemanticPositionConstraintKey(key: string): key is SemanticPositionConstraintState['key'] {
    return key === 'position.pyramiding_limit'
      || key === 'position.max_exposure_pct'
      || key === 'position.dca_schedule'
      || key === 'grid.range_rebalance'
  }

  private resolveOrchestrationKind(key: string): SemanticOrchestrationNode['kind'] {
    if (key.startsWith('scope.')) return 'scope'
    if (key.startsWith('gate.')) return 'gate'
    if (key.startsWith('portfolioRisk.')) return 'portfolioRisk'
    return 'program'
  }

  private orchestrationFieldsFromParams(params: Record<string, unknown>): Partial<SemanticOrchestrationNode> {
    const fields: Partial<SemanticOrchestrationNode> = {}
    if (params.programKind === 'fixed_grid_gated' || params.programKind === 'dynamic_grid' || params.programKind === 'adaptive_volatility_grid' || params.programKind === 'event_listener') {
      fields.programKind = params.programKind
    }
    if (params.onDeactivate === 'cancel' || params.onDeactivate === 'keep' || params.onDeactivate === 'close') {
      fields.onDeactivate = params.onDeactivate
    }
    if (params.rebuildPolicy === 'static' || params.rebuildPolicy === 'anchor_on_state_change' || params.rebuildPolicy === 'atr_window' || params.rebuildPolicy === 'on_schema_version_bump') {
      fields.rebuildPolicy = params.rebuildPolicy
    }
    if (typeof params.activeWhenRef === 'string') {
      fields.activeWhenRef = params.activeWhenRef
    }
    if (this.isValidSemanticExpression(params.activeWhen)) {
      fields.activeWhen = params.activeWhen
    }
    return fields
  }

  private resolveProgramSizingFromTypedRuleEffects(
    effects: RuleEffectsByRole,
  ): NonNullable<SemanticOrchestrationNode['sizing']> | null {
    const positionLeaves = effects.positions.flatMap(effect => collectAtomLeaves(effect))
    for (const leaf of positionLeaves) {
      if (leaf.key === FIELD_KEY.POSITION_SIZING) {
        const sizing = this.resolveSemanticRulePositionSizing(leaf)
        if (!sizing) {
          continue
        }
        if (sizing.mode === 'QUOTE') return { mode: 'fixed_quote', value: sizing.value }
        if (sizing.mode === 'QTY') return { mode: 'fixed_base', value: sizing.value }
        return { mode: 'fixed_pct', value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(8)) : sizing.value }
      }
      if (leaf.key !== FIELD_KEY.POSITION_PER_ORDER_BUDGET) {
        continue
      }
      const value = this.readNumericParam(leaf.params.value)
      if (value === null || value <= 0) {
        continue
      }
      const asset = typeof leaf.params.asset === 'string' ? leaf.params.asset.trim().toUpperCase() : ''
      if (asset === 'USDT' || asset === 'USDC' || asset === 'USD' || asset === '') {
        return { mode: 'fixed_quote', value }
      }
      return { mode: 'fixed_base', value }
    }
    return null
  }

  private buildCanonicalRulesFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    sizing: CanonicalStrategySpecV2['sizing'],
    defaultTimeframe: string | null,
  ): CanonicalRuleV2[] {
    const canonicalRules: CanonicalRuleV2[] = []
    let riskPriority = 120

    for (const [ruleIndex, rule] of mainflow.rules.entries()) {
      if (rule.phase === 'entry' || rule.phase === 'exit') {
        const phase = rule.phase
        const effectsRiskLeavesForRule = mainflow.byRole.risk.filter(leaf => leaf.ruleId === rule.id)
        const isRiskKeyedExitCondition = phase === 'exit'
          && rule.condition.kind === 'atom'
          && this.isRulesMainflowExitRiskConditionAtom(rule.condition.key)
        if (isRiskKeyedExitCondition && effectsRiskLeavesForRule.length === 0) {
          const riskRule = this.buildCanonicalRiskRuleFromRuleEffectLeaf({
            leaf: rule.condition,
            rule,
            sourcePath: `rules[${ruleIndex}].condition`,
            priority: riskPriority,
          })
          if (!riskRule) {
            continue
          }
          canonicalRules.push(riskRule)
          riskPriority -= 1
          continue
        }
        if (isRiskKeyedExitCondition && effectsRiskLeavesForRule.length > 0) {
          // Effects.risks is authoritative; condition is evidence-only. Skip action emit; let effects.risks loop below handle all risks.
        }
        else {
        const split = this.splitPositionPresenceGatesFromSemanticRuleCondition(rule.condition)
        if (phase === 'entry') {
          for (const [gateIndex, gateAtom] of split.gateAtoms.entries()) {
            const gateCondition = this.buildConditionFromSemanticRuleAtom(gateAtom, 'gate', rule.sideScope, defaultTimeframe)
            if (!gateCondition || !this.isNoPositionGateCondition(gateCondition)) continue
            canonicalRules.push({
              id: `semantic-gate-${rule.id}-${gateIndex + 1}`,
              phase: 'gate',
              sideScope: rule.sideScope,
              priority: this.resolveSemanticRulePriority('gate', gateIndex + 1),
              condition: gateCondition,
              actions: [{ type: 'BLOCK_NEW_ENTRY' }],
              metadata: {
                normalized: {
                  source: 'normalized-intent',
                  triggerKeys: [gateAtom.key],
                  actionKeys: ['BLOCK_NEW_ENTRY'],
                  family: 'state-gated',
                },
                sourcePath: `rules[${ruleIndex}].condition`,
              },
            })
          }
        }
        if (!split.condition && phase === 'entry') continue
        const condition = split.condition
          ? this.buildConditionFromSemanticRuleExpr(split.condition, phase, rule.sideScope, defaultTimeframe)
          : null
        const actions = condition
          ? mainflow.byRole.action
              .filter(leaf => leaf.ruleId === rule.id)
              .flatMap((leaf) => {
                const actionLeaf = this.atomLeafFromMainflowLeaf(leaf)
                const builtActions = this.buildCanonicalActionsFromRuleEffectLeaf(actionLeaf, phase, sizing, leaf.path)
                if (builtActions.length === 0) {
                  if (this.isKnownCanonicalActionEffectLeaf(leaf.key)) {
                    return []
                  }
                  throw new Error(`UnsupportedSemanticRuleActionEffect: key=${leaf.key} sourcePath=${leaf.path}`)
                }
                return builtActions
                  .filter(action => this.actionMatchesRuleSideScope(action.type, rule.sideScope)
                    || leaf.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key
                    || leaf.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key)
                  .map(action => ({
                    ...action,
                    sourcePath: leaf.path,
                  }))
              })
          : []
        const normalizedActions = this.dedupeReversePositionImpliedOpenActions(actions)

        if (condition && normalizedActions.length > 0) {
          // #1633 staging s29 follow-up：mainflow byRole.action 路径也需要把
          //   `position.pyramiding_limit` effect + 入场 `price.percent_change`
          //   叶子的 valuePct 投射为 inert pyramidingHint，让 entry OPEN_LONG/SHORT
          //   编译脚本文本携带 `3%` / `50%` 数值证据；与 direct rule / trigger group
          //   两条路径保持同形。
          const hasOpenAction = normalizedActions.some(a => a.type === 'OPEN_LONG' || a.type === 'OPEN_SHORT')
          // #1633 staging30 s29：pyramiding_limit effect 可能挂在 *另一条*
          //   semantic rule 上（如 has_position → effects.positions[pyramiding_limit]）。
          //   只看当前 rule 会漏抽 layerSizing / profitThreshold / maxLayers。
          //   改为跨 mainflow.rules 聚合，profitThreshold 优先读 pyramiding params。
          const profitThresholdFallback = phase === 'entry' && hasOpenAction
            ? this.extractProfitThresholdFromSemanticCondition(rule.condition)
            : null
          const pyramidingHint = phase === 'entry' && hasOpenAction
            ? this.extractPyramidingHintFromSemanticRules(mainflow.rules, profitThresholdFallback)
            : undefined
          const reversePosition = phase === 'entry'
            ? this.buildReversePositionMetadataFromMainflowActionLeaves(mainflow.byRole.action.filter(leaf => leaf.ruleId === rule.id))
            : undefined
          canonicalRules.push({
            id: `semantic-${phase}-${rule.id}`,
            phase,
            sideScope: rule.sideScope,
            priority: this.resolveSemanticRulePriority(phase, ruleIndex + 1),
            condition,
            actions: normalizedActions,
            metadata: {
              normalized: {
                source: 'normalized-intent',
                triggerKeys: collectAtomLeaves(rule.condition).map(leaf => leaf.key),
                actionKeys: actions.map(action => action.type),
                family: 'single-leg',
              },
              sourcePath: `rules[${ruleIndex}]`,
              ...(pyramidingHint ? { pyramidingHint } : {}),
              ...(reversePosition ? { reversePosition } : {}),
            },
          })
        }
        }
      }

      for (const leaf of mainflow.byRole.risk.filter(leaf => leaf.ruleId === rule.id)) {
        if (leaf.key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key) {
          const partialTakeProfitRules = this.buildPartialTakeProfitRules(
            {
              id: `${rule.id}-${this.stableRulesPathId(leaf.path)}`,
              key: leaf.key,
              params: this.atomLeafFromMainflowLeaf(leaf).params,
              status: 'locked',
              source: 'user_explicit',
              ...(leaf.evidenceText ? { evidence: { text: leaf.evidenceText, source: 'user_explicit' as const } } : {}),
              openSlots: [],
            },
            rule.sideScope,
            riskPriority,
          )
          if (partialTakeProfitRules.length === 0) {
            throw new Error(`UnsupportedSemanticRuleRiskEffect: key=${leaf.key} sourcePath=${leaf.path}`)
          }
          canonicalRules.push(...partialTakeProfitRules.map(rule => ({
            ...rule,
            metadata: {
              ...rule.metadata,
              semanticKey: leaf.key,
              sourcePath: leaf.path,
            },
          })))
          riskPriority -= partialTakeProfitRules.length
          continue
        }
        if (leaf.key === ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key
          && this.ruleHasPartialTakeProfitAtThreshold(mainflow.byRole.risk, rule.id, leaf)) {
          continue
        }
        const riskRule = this.buildCanonicalRiskRuleFromRuleEffectLeaf({
          leaf: this.atomLeafFromMainflowLeaf(leaf),
          rule,
          sourcePath: leaf.path,
          priority: riskPriority,
        })
        if (!riskRule) {
          if (this.isOpenAtomicRiskEffectLeaf(leaf.key)) {
            continue
          }
          throw new Error(`UnsupportedSemanticRuleRiskEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        canonicalRules.push(riskRule)
        riskPriority -= 1
      }

      for (const leaf of mainflow.byRole.position.filter(leaf => leaf.ruleId === rule.id && leaf.key === 'position.dca_schedule')) {
        const sameRulePositionLeaves = mainflow.byRole.position.filter(positionLeaf => positionLeaf.ruleId === rule.id)
        canonicalRules.push(this.buildCanonicalDcaRuleFromRuleEffectLeaf({
          leaf: this.atomLeafFromMainflowLeaf(leaf),
          rule,
          sourcePath: leaf.path,
          priority: this.resolveSemanticRulePriority('entry', ruleIndex + 1),
          sameRulePositionLeaves,
        }))
      }

      for (const leaf of mainflow.byRole.position.filter(leaf => leaf.ruleId === rule.id && leaf.key === 'position.max_concurrent_positions')) {
        const count = this.readFiniteNumber(leaf.params.count)
        if (count === null || count <= 0) {
          throw new Error(`InvalidSemanticRulePositionEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        canonicalRules.push({
          id: `semantic-max-concurrent-${rule.id}-${this.stableRulesPathId(leaf.path)}`,
          phase: 'gate',
          sideScope: 'both',
          priority: riskPriority,
          condition: {
            kind: 'atom',
            key: leaf.key,
            semanticScope: 'portfolio',
            op: 'LT',
            value: count,
            params: { count },
          },
          actions: [{ type: 'BLOCK_NEW_ENTRY', atomKey: leaf.key, sourcePath: leaf.path }],
          metadata: {
            semanticKey: leaf.key,
            sourcePath: leaf.path,
          },
        })
        riskPriority -= 1
      }
    }

    return canonicalRules
  }

  private buildReversePositionMetadataFromMainflowActionLeaves(
    leaves: readonly RulesMainflowLeaf[],
  ): NonNullable<CanonicalRuleV2['metadata']>['reversePosition'] | undefined {
    const leaf = leaves.find(item => item.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key)
    if (!leaf) return undefined
    const fromSide = this.readSideParam(leaf.params.fromSide) ?? 'long'
    const toSide = this.readSideParam(leaf.params.toSide) ?? (fromSide === 'long' ? 'short' : 'long')
    return {
      fromSide,
      toSide,
      sameBarPolicy: this.readSameBarPolicy(leaf.params.sameBarPolicy),
      sizingSource: this.readReverseSizingSource(leaf.params.sizingSource),
    }
  }

  private isRulesMainflowExitRiskConditionAtom(key: string): boolean {
    return key === FIELD_KEY.RISK_STOP_LOSS_PCT
      || key === FIELD_KEY.RISK_TAKE_PROFIT_PCT
      || key === FIELD_KEY.RISK_ATR_STOP
      || key === FIELD_KEY.RISK_ATR_TAKE_PROFIT
      || key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP
      || key === FIELD_KEY.RISK_ATR_MULTIPLE_TAKE_PROFIT
      || key === FIELD_KEY.RISK_REMEMBERED_LEVEL_STOP
  }

  private isOpenAtomicRiskEffectLeaf(key: string): boolean {
    return key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP
      || key === FIELD_KEY.RISK_ATR_MULTIPLE_TAKE_PROFIT
      || key === FIELD_KEY.RISK_REMEMBERED_LEVEL_STOP
      || key === 'risk.kill_switch'
  }

  private ruleConditionReferencesPreviousExtrema(condition: AtomExpr): boolean {
    return collectAtomLeaves(condition).some(leaf =>
      leaf.key === 'price.previous_extrema_retest'
      || leaf.key === 'price.breakout_up'
      || leaf.key === 'price.breakout_down',
    )
  }

  private hasRulesMainflowOpenPositionAction(mainflow: RulesMainflowView): boolean {
    return mainflow.byRole.action.some(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['action.open_short'].key,
    )
  }

  private buildCanonicalDcaRuleFromRuleEffectLeaf(input: {
    leaf: AtomExprAtom
    rule: SemanticRule
    sourcePath: string
    priority: number
    sameRulePositionLeaves?: readonly RulesMainflowLeaf[]
  }): CanonicalRuleV2 {
    if (input.rule.phase !== 'entry' && input.rule.phase !== 'program') {
      throw new Error(`InvalidSemanticRulePositionEffect: key=${input.leaf.key} sourcePath=${input.sourcePath}`)
    }

    const condition = this.buildConditionFromSemanticRuleExpr(input.rule.condition, 'entry', input.rule.sideScope, null) ?? {
      kind: 'atom' as const,
      key: 'execution.on_start',
      semanticScope: 'market' as const,
      params: { timing: 'on_start' },
    }
    const sizing = this.resolveDcaScheduleSizing(input.leaf, input.sameRulePositionLeaves ?? []) ?? { mode: 'RATIO' as const, value: 0.1 }
    const metadata = this.buildDcaScheduleMetadataFromRuleEffectLeaf(input.leaf, input.sourcePath, input.sameRulePositionLeaves ?? [], sizing)
    if (!metadata) {
      throw new Error(`InvalidSemanticRulePositionEffect: key=${input.leaf.key} sourcePath=${input.sourcePath}`)
    }

    return {
      id: `semantic-dca-${input.rule.id}`,
      phase: 'entry',
      sideScope: input.rule.sideScope,
      priority: input.priority,
      condition,
      actions: [{
        type: input.rule.sideScope === 'short' ? 'ADD_SHORT' : 'ADD_LONG',
        sizing,
        atomKey: 'position.dca_schedule',
        sourcePath: input.sourcePath,
      }],
      metadata: {
        dcaSchedule: metadata,
        sourcePath: input.sourcePath,
        semanticKey: input.leaf.key,
      },
    }
  }

  private resolveDcaScheduleSizing(
    leaf: AtomExprAtom,
    sameRulePositionLeaves: readonly RulesMainflowLeaf[] = [],
  ): CanonicalStrategySpecV2['sizing'] {
    const perOrderSizing = this.resolveSemanticActionSizing(leaf.params.perOrderSizing)
    if (perOrderSizing && !this.isDcaSizingLikelyTriggerPollution(leaf, perOrderSizing)) {
      return perOrderSizing
    }
    const drawdownPerOrderSizing = this.resolveSemanticActionSizing(leaf.params.drawdownPerOrderSizing)
    if (drawdownPerOrderSizing) {
      return drawdownPerOrderSizing
    }
    const siblingSizing = this.resolveSizingFromSemanticRulePositionLeaves(
      sameRulePositionLeaves.filter(positionLeaf => positionLeaf.key !== 'position.dca_schedule'),
    )
    if (siblingSizing) {
      return siblingSizing
    }
    const value = this.readFiniteNumber(leaf.params.perOrderBudget)
    if (value !== null && value > 0) {
      return { mode: 'QUOTE', value }
    }
    return null
  }

  private buildDcaScheduleMetadataFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    sourcePath: string,
    sameRulePositionLeaves: readonly RulesMainflowLeaf[] = [],
    resolvedSizing: CanonicalStrategySpecV2['sizing'] = null,
  ): NonNullable<NonNullable<CanonicalRuleV2['metadata']>['dcaSchedule']> | null {
    const configuredMaxCount = this.readFiniteNumber(leaf.params.maxCount)
      ?? this.readFiniteNumber(leaf.params.maxOrders)
    const perOrderBudget = this.readFiniteNumber(leaf.params.perOrderBudget)
      ?? this.readFiniteNumber((resolvedSizing as { value?: unknown } | undefined)?.value)
      ?? this.readFiniteNumber((leaf.params.perOrderSizing as { value?: unknown } | undefined)?.value)
    const maxCount = configuredMaxCount ?? (perOrderBudget !== null ? 1 : null)
    const derivedCapitalCap = maxCount !== null && perOrderBudget !== null
      ? Math.round(maxCount * perOrderBudget * 1_000_000_000_000) / 1_000_000_000_000
      : null
    const capitalCap = this.readSameRuleBudgetCapValue(sameRulePositionLeaves)
      ?? this.readDcaCapitalCapValue(leaf.params.capitalCap)
      ?? this.readDcaCapitalCapValue(leaf.params.maxTotalQuote)
      ?? derivedCapitalCap
    if (maxCount === null || capitalCap === null) {
      return null
    }

    const triggerMode = typeof leaf.params.triggerMode === 'string' ? leaf.params.triggerMode : undefined
    const exitRule = leaf.params.exitRule && typeof leaf.params.exitRule === 'object' && !Array.isArray(leaf.params.exitRule)
      ? leaf.params.exitRule as Record<string, string>
      : undefined
    return {
      maxCount,
      capitalCap,
      stateKey: `dca_fired_count_${this.stableRulesPathId(sourcePath)}`,
      ...(triggerMode !== undefined ? { triggerMode } : {}),
      ...this.optionalNumberField('priceIntervalPct', this.readFiniteNumber(leaf.params.priceIntervalPct)),
      ...this.optionalNumberField('dropPct', this.readFiniteNumber(leaf.params.dropPct)),
      ...this.optionalNumberField('priceIntervalQuote', this.readFiniteNumber(leaf.params.priceIntervalQuote)),
      ...this.optionalNumberField('timeIntervalBars', this.readFiniteNumber(leaf.params.timeIntervalBars)),
      ...this.optionalNumberField('timeIntervalMs', this.readFiniteNumber(leaf.params.timeIntervalMs)),
      ...this.readDrawdownPerOrderSizing(leaf.params.drawdownPerOrderSizing),
      exitRule: exitRule ?? { type: 'cap_only' },
    }
  }

  private readDrawdownPerOrderSizing(
    raw: unknown,
  ): { drawdownPerOrderSizing: { kind: string; value: number; asset?: string } } | Record<string, never> {
    if (!raw || typeof raw !== 'object') return {}
    const rec = raw as { kind?: unknown; value?: unknown; asset?: unknown }
    if (typeof rec.kind !== 'string') return {}
    const value = this.readFiniteNumber(rec.value)
    if (value === null || value <= 0) return {}
    const asset = typeof rec.asset === 'string' ? rec.asset : undefined
    return { drawdownPerOrderSizing: { kind: rec.kind, value, ...(asset !== undefined ? { asset } : {}) } }
  }

  private isDcaSizingLikelyTriggerPollution(
    leaf: AtomExprAtom,
    sizing: NonNullable<CanonicalStrategySpecV2['sizing']>,
  ): boolean {
    if (sizing.mode !== 'QUOTE') return false
    const triggerPct = this.readFiniteNumber(leaf.params.priceIntervalPct)
      ?? this.readFiniteNumber(leaf.params.dropPct)
    return triggerPct !== null && Math.abs(triggerPct) === sizing.value
  }

  private readSameRuleBudgetCapValue(positionLeaves: readonly RulesMainflowLeaf[]): number | null {
    for (const leaf of positionLeaves) {
      if (leaf.key !== FIELD_KEY.POSITION_BUDGET_CAP) continue
      const value = this.readFiniteNumber(leaf.params.valueQuote)
        ?? this.readFiniteNumber(leaf.params.value)
        ?? this.readDcaCapitalCapValue(leaf.params.capitalCap)
      if (value !== null && value > 0) return value
    }
    return null
  }

  private buildCanonicalRiskRuleFromRuleEffectLeaf(input: {
    leaf: AtomExprAtom
    rule: SemanticRule
    sourcePath: string
    priority: number
  }): CanonicalRuleV2 | null {
    if (input.leaf.key === FIELD_KEY.RISK_ATR_STOP) {
      const atrParams = extractAtrStopParams(input.leaf.params)
      if (atrParams === null) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: 'both',
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_ATR_STOP,
          semanticScope: 'position',
          params: atrParams,
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key === FIELD_KEY.RISK_ATR_TAKE_PROFIT) {
      const multiple = typeof input.leaf.params.multiple === 'number' && Number.isFinite(input.leaf.params.multiple)
        ? input.leaf.params.multiple
        : typeof input.leaf.params.multiplier === 'number' && Number.isFinite(input.leaf.params.multiplier)
          ? input.leaf.params.multiplier
          : null
      if (multiple === null || multiple <= 0) return null
      const period = typeof input.leaf.params.period === 'number' && Number.isInteger(input.leaf.params.period) && input.leaf.params.period > 0
        ? input.leaf.params.period
        : 14
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: input.rule.sideScope,
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_ATR_TAKE_PROFIT,
          semanticScope: 'position',
          params: { period, multiple },
        },
        actions: this.buildAtrTakeProfitActions(input.rule.sideScope),
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (
      input.leaf.key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP
      || input.leaf.key === FIELD_KEY.RISK_ATR_MULTIPLE_TAKE_PROFIT
      || input.leaf.key === FIELD_KEY.RISK_REMEMBERED_LEVEL_STOP
    ) {
      const params = input.leaf.key === FIELD_KEY.RISK_REMEMBERED_LEVEL_STOP
        ? {
            ...input.leaf.params,
            ...(!this.readFirstStringParam(input.leaf.params, ['levelKey', 'memoryKey', 'rememberedLevelKey', 'referenceLevelKey'])
              && this.ruleConditionReferencesPreviousExtrema(input.rule.condition)
              ? { levelKey: 'previous_extrema' }
              : {}),
          }
        : input.leaf.params
      const riskRule = this.buildAtomicContractRiskRule({
        id: `${input.rule.id}-${input.priority}`,
        key: input.leaf.key,
        params,
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }, input.rule.sideScope, input.priority)
      return riskRule
        ? {
            ...riskRule,
            metadata: {
              ...riskRule.metadata,
              sourcePath: input.sourcePath,
            },
          }
        : null
    }
    if (input.leaf.key === FIELD_KEY.RISK_TRAILING_STOP_PCT) {
      const valuePct = this.readFiniteNumber(input.leaf.params.valuePct)
      if (valuePct === null || valuePct <= 0 || valuePct >= 100) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: input.rule.sideScope,
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_TRAILING_STOP_PCT,
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: typeof input.leaf.params.basis === 'string' ? { basis: input.leaf.params.basis } : {},
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key === FIELD_KEY.RISK_MAX_DRAWDOWN_PCT) {
      const rawValuePct = this.readFiniteNumber(input.leaf.params.valuePct)
      const valuePct = rawValuePct === null ? null : Math.abs(rawValuePct)
      if (valuePct === null || valuePct <= 0 || valuePct >= 100) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: 'both',
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_MAX_DRAWDOWN_PCT,
          semanticScope: 'portfolio',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
        },
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key === 'risk.daily_loss_limit') {
      const rawValuePct = this.readFiniteNumber(input.leaf.params.valuePct)
      const valuePct = rawValuePct === null ? null : Math.abs(rawValuePct)
      if (valuePct === null || valuePct <= 0 || valuePct >= 100) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: 'both',
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: 'risk.daily_loss_limit',
          semanticScope: 'portfolio',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: { valuePct },
        },
        actions: [{ type: 'BLOCK_NEW_ENTRY', atomKey: input.leaf.key, sourcePath: input.sourcePath }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key === 'risk.kill_switch') {
      return null
    }
    if (input.leaf.key === FIELD_KEY.RISK_COOLDOWN) {
      const durationBars = this.readFiniteNumber(input.leaf.params.durationBars)
        ?? this.readFiniteNumber(input.leaf.params.durationMinutes)
        ?? (this.readFiniteNumber(input.leaf.params.durationMs) !== null
          ? Math.max(1, Math.ceil((this.readFiniteNumber(input.leaf.params.durationMs) ?? 0) / 60_000))
          : null)
      const bars = durationBars === null ? 1 : durationBars
      if (!Number.isInteger(bars) || bars <= 0) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: 'both',
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_COOLDOWN_BARS,
          semanticScope: 'market',
          params: { bars },
        },
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key === FIELD_KEY.RISK_MAX_LOSS_PER_TRADE) {
      const valuePct = this.readFiniteNumber(input.leaf.params.valuePct)
      if (valuePct === null || valuePct <= 0 || valuePct >= 100) return null
      return {
        id: `semantic-risk-${input.rule.id}-${input.priority}`,
        phase: 'risk',
        sideScope: input.rule.sideScope,
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: FIELD_KEY.RISK_MAX_SINGLE_LOSS_PCT,
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
        },
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          semanticKey: input.leaf.key,
          sourcePath: input.sourcePath,
        },
      }
    }
    if (input.leaf.key !== FIELD_KEY.RISK_STOP_LOSS_PCT && input.leaf.key !== FIELD_KEY.RISK_TAKE_PROFIT_PCT) {
      return null
    }
    const valuePct = typeof input.leaf.params.valuePct === 'number' ? input.leaf.params.valuePct : null
    if (valuePct === null || !Number.isFinite(valuePct)) {
      return null
    }

    return this.buildPercentRiskCanonicalRule({
      id: `semantic-risk-${input.rule.id}-${input.priority}`,
      sideScope: input.rule.sideScope,
      priority: input.priority,
      riskKey: input.leaf.key,
      valuePct,
      basis: input.leaf.params.basis,
      actions: [{ type: 'FORCE_EXIT' }],
      metadata: {
        semanticKey: input.leaf.key,
        sourcePath: input.sourcePath,
      },
    })
  }

  private buildOrchestrationProgramsFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    state: SemanticState,
  ): CanonicalOrchestrationProgram[] {
    const programs: CanonicalOrchestrationProgram[] = []
    const leafCountByEffectPath = new Map<string, number>()
    for (const leaf of mainflow.byRole.program) {
      const rule = mainflow.rules[leaf.ruleIndex]
      if (!rule) continue
      const effectIndex = this.readRoleEffectIndexFromPath(leaf.path, 'programs') ?? 0
      const effectPath = `rules[${leaf.ruleIndex}].effects.programs[${effectIndex}]`
      const leafIndex = leafCountByEffectPath.get(effectPath) ?? 0
      leafCountByEffectPath.set(effectPath, leafIndex + 1)
      const enrichedLeaf = this.enrichProgramLeafFromRuleContext(this.atomLeafFromMainflowLeaf(leaf), rule)
      if (
        (leaf.key === 'program.fixed_grid' || leaf.key === 'program.fixed_grid_gated')
        && this.rulesMainflowGridOrderProgramOwnsRule(mainflow, leaf, state)
        && this.buildCanonicalFixedGridProgramFromRuleEffectLeaf(
          enrichedLeaf,
          `semantic-program-${rule.id}-${effectIndex}-${leafIndex}`,
          leaf.path,
          this.programGateIdForRuleEffectLeaf(leaf),
        ) === null
      ) {
        continue
      }
      const program = this.buildCanonicalProgramFromRuleEffectLeaf(
        enrichedLeaf,
        `semantic-program-${rule.id}-${effectIndex}-${leafIndex}`,
        leaf.path,
        this.programGateIdForRuleEffectLeaf(leaf),
      )
      if (program) {
        programs.push(program)
      }
    }
    return programs
  }

  private rulesMainflowGridOrderProgramOwnsRule(
    mainflow: RulesMainflowView,
    leaf: RulesMainflowLeaf,
    state: SemanticState,
  ): boolean {
    const positionLeaves = mainflow.byRole.position.filter(positionLeaf => positionLeaf.ruleId === leaf.ruleId)
    const effectBudget = this.projectCanonicalOrderProgramBudgetFromRulePositionLeaves(positionLeaves)
      ?? this.projectCanonicalOrderProgramBudgetFromGridLeaf(leaf, state)
    if (this.projectCanonicalOrderProgramLevelSetFromRuleProgramLeaf(leaf) && effectBudget) {
      return true
    }

    return mainflow.byRole.condition
      .filter(conditionLeaf => conditionLeaf.ruleId === leaf.ruleId && conditionLeaf.key === 'grid.range_rebalance')
      .some((conditionLeaf) => {
        const levelSet = this.projectCanonicalOrderProgramLevelSetFromRuleProgramLeaf(conditionLeaf)
        const budget = this.projectCanonicalOrderProgramBudgetFromRulePositionLeaves(positionLeaves)
          ?? this.projectCanonicalOrderProgramBudgetFromGridLeaf(conditionLeaf, state)
        return Boolean(levelSet && budget)
      })
  }

  private buildOrderProgramsFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    state: SemanticState,
  ): CanonicalOrderProgramIntent[] {
    const orderPrograms: CanonicalOrderProgramIntent[] = []
    const orchestrationProgramRuleIds = new Set(
      mainflow.byRole.program
        .filter(leaf => leaf.key === 'program.fixed_grid_gated')
        .filter(leaf => !this.rulesMainflowGridOrderProgramOwnsRule(mainflow, leaf, state))
        .map(leaf => leaf.ruleId),
    )
    const fallbackProgramLeaves = mainflow.byRole.program.filter(leaf => (
      leaf.key === 'program.fixed_grid_gated'
      && this.buildCanonicalFixedGridProgramFromRuleEffectLeaf(
        this.atomLeafFromMainflowLeaf(leaf),
        `semantic-order-program-probe-${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`,
        leaf.path,
        this.programGateIdForRuleEffectLeaf(leaf),
      ) === null
    ))
    const primary = [
      ...mainflow.byRole.program.filter(leaf => leaf.key === 'program.fixed_grid' && !orchestrationProgramRuleIds.has(leaf.ruleId)),
      ...fallbackProgramLeaves,
      ...mainflow.byRole.condition.filter(leaf => leaf.key === 'grid.range_rebalance' && !orchestrationProgramRuleIds.has(leaf.ruleId)),
    ]
    const primaryRuleIds = new Set(primary.map(leaf => leaf.ruleId))
    // #1633 rules-only: grid.range_rebalance bucket=positionConstraint → effects.positions → role='position'.
    // 仅当同一 ruleId 未被 program/condition 路径覆盖时回退到 position 路径，避免对
    // program_spot_centered_grid 等已有 program leaf 的策略重复声明，导致 levelSet 投影失败。
    const positionFallback = mainflow.byRole.position.filter(
      leaf => leaf.key === 'grid.range_rebalance' && !primaryRuleIds.has(leaf.ruleId),
    )
    const candidates = [...primary, ...positionFallback]
    const seen = new Set<string>()
    for (const leaf of candidates) {
      const seenKey = `${leaf.ruleId}:${leaf.key}:${this.stableRulesPathId(leaf.path)}`
      if (seen.has(seenKey)) continue
      seen.add(seenKey)

      const levelSet = this.projectCanonicalOrderProgramLevelSetFromRuleProgramLeaf(leaf)
      const budget = this.projectCanonicalOrderProgramBudgetFromRulePositionLeaves(
        mainflow.byRole.position.filter(positionLeaf => positionLeaf.ruleId === leaf.ruleId),
      ) ?? this.projectCanonicalOrderProgramBudgetFromGridLeaf(leaf, state)
      if (!levelSet || !budget) {
        continue
      }

      orderPrograms.push({
        id: `semantic-order-program-${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`,
        kind: 'contract_order_program',
        sourcePath: leaf.path,
        programKind: 'fixed_grid_gated',
        mode: this.resolveContractOrderProgramMode(null, state),
        levelSet,
        budget,
        orderType: 'limit',
        timeInForce: 'gtc',
        recycleOnFill: leaf.params.recycleOnFill !== false,
        cancelOnStop: leaf.params.cancelOnStop !== false,
      })
    }

    return orderPrograms
  }

  private projectCanonicalOrderProgramBudgetFromGridLeaf(
    leaf: RulesMainflowLeaf,
    state: SemanticState,
  ): CanonicalOrderProgramIntent['budget'] | null {
    const semanticSizing = this.resolveSizingFromSemanticState(state.position)
    if (semanticSizing?.mode === 'RATIO' && semanticSizing.value > 0) {
      return {
        mode: 'per_order_pct_equity',
        value: semanticSizing.value <= 1 ? Number((semanticSizing.value * 100).toFixed(8)) : semanticSizing.value,
      }
    }
    if (semanticSizing?.mode === 'QUOTE' && semanticSizing.value > 0) {
      return {
        mode: 'per_order_quote',
        value: semanticSizing.value,
        asset: semanticSizing.asset ?? 'USDT',
      }
    }

    const perGridSizing = this.readFiniteNumber(leaf.params.perGridSizing)
    if (perGridSizing !== null && perGridSizing > 0) {
      return {
        mode: 'per_order_quote',
        value: perGridSizing,
        asset: 'USDT',
      }
    }

    // #1691 staging30 s15: when grid is the sizing source (positionConstraint phases include 'sizing')
    // and the user provides no explicit per-grid quote and no semantic position.sizing,
    // derive a per-order percent-of-equity budget from the level count so the order program
    // can be emitted; downstream runtime computes concrete per-order quantity from equity.
    const lower = this.readFiniteNumber(leaf.params.lower)
      ?? this.readFiniteNumber(leaf.params.lowerBound)
      ?? this.readFiniteNumber(leaf.params.rangeLower)
    const upper = this.readFiniteNumber(leaf.params.upper)
      ?? this.readFiniteNumber(leaf.params.upperBound)
      ?? this.readFiniteNumber(leaf.params.rangeUpper)
    const stepPct = this.readFiniteNumber(leaf.params.spacingPct)
      ?? this.readFiniteNumber(leaf.params.stepPct)
    const explicitLevelCount = this.readFiniteNumber(leaf.params.gridCount)
      ?? this.readFiniteNumber(leaf.params.levelCount)
      ?? this.readFiniteNumber(leaf.params.levels)
      ?? this.readFiniteNumber(leaf.params.gridIntervals)

    const DEFAULT_LEVEL_COUNT = 10
    const MIN_LEVELS = 2
    const MAX_LEVELS = 200

    if (lower === null || upper === null || upper <= lower) return null

    // PR #1691 review M1+M2: explicit / computed level counts MUST NOT be silently
    // replaced by DEFAULT when out of [MIN_LEVELS, MAX_LEVELS] — a user writing
    // `levels: 500` expecting 500 levels would otherwise get budget=10/order (off by 50x).
    // Reject the leaf so upstream can surface a clarification instead of producing a
    // misleading order program. DEFAULT only applies when NEITHER explicit count NOR
    // stepPct is supplied (s15-class bare-minimum grid prompt).
    if (explicitLevelCount !== null && explicitLevelCount > 0) {
      const explicit = Math.floor(explicitLevelCount)
      if (explicit < MIN_LEVELS || explicit > MAX_LEVELS) return null
      return {
        mode: 'per_order_pct_equity',
        value: Number((100 / explicit).toFixed(8)),
      }
    }

    if (stepPct !== null && stepPct > 0) {
      const computed = Math.floor((upper - lower) / (lower * (stepPct / 100))) + 1
      if (computed < MIN_LEVELS || computed > MAX_LEVELS) return null
      return {
        mode: 'per_order_pct_equity',
        value: Number((100 / computed).toFixed(8)),
      }
    }

    // Neither explicit count nor stepPct provided — the level set is still derivable
    // from absolute bounds alone; emit a default per-equity budget so the orderProgram
    // can be issued. Downstream runtime resolves concrete per-order size from equity.
    return {
      mode: 'per_order_pct_equity',
      value: Number((100 / DEFAULT_LEVEL_COUNT).toFixed(8)),
    }
  }

  private projectCanonicalOrderProgramLevelSetFromRuleProgramLeaf(
    leaf: RulesMainflowLeaf,
  ): CanonicalOrderProgramIntent['levelSet'] | null {
    const mode = typeof leaf.params.mode === 'string' ? leaf.params.mode : null
    const spacingMode = leaf.params.spacingMode === 'geometric' ? 'geometric' : 'arithmetic'
    const gridIntervals = this.readFiniteNumber(leaf.params.gridIntervals)
    const gridCount = this.readFiniteNumber(leaf.params.gridCount)
      ?? this.readFiniteNumber(leaf.params.levelCount)
      ?? this.readFiniteNumber(leaf.params.levels)
    const absoluteSpacing = this.readFiniteNumber(leaf.params.absoluteSpacing)
    const spacingPct = this.readFiniteNumber(leaf.params.spacingPct)
      ?? this.readFiniteNumber(leaf.params.stepPct)
    const centerOffsetPct = this.readFiniteNumber(leaf.params.centerOffsetPct)
    const lower = this.readFiniteNumber(leaf.params.lower)
      ?? this.readFiniteNumber(leaf.params.lowerBound)
      ?? this.readFiniteNumber(leaf.params.rangeLower)
    const upper = this.readFiniteNumber(leaf.params.upper)
      ?? this.readFiniteNumber(leaf.params.upperBound)
      ?? this.readFiniteNumber(leaf.params.rangeUpper)

    // #1633 staging30 s09: 当 LLM/normalization 用占位 0 表示"未指定区间上下界"
    //   （lowerBound=0, upperBound=0），lower/upper 不是 null 但已退化（upper<=lower），
    //   原有 `(lower === null || upper === null)` 判定会跳过 centered_percent_range 分支，
    //   最终落到底部 absolute bounds 分支因 upper<=lower 返回 null → orderPrograms 空 →
    //   confirmGenerate 卡 DRAFTING。通用对策：把 absolute bounds 退化视作"无显式上下界"，
    //   只要 centerOffsetPct/halfRangePct 合法即采用 centered_percent_range 投影。
    const hasUsableAbsoluteBounds = lower !== null && upper !== null && upper > lower
    if (mode === 'centered_percent_range' || (centerOffsetPct !== null && centerOffsetPct > 0 && !hasUsableAbsoluteBounds)) {
      const halfRangePct = this.readFiniteNumber(leaf.params.halfRangePct) ?? centerOffsetPct
      if (halfRangePct === null || halfRangePct <= 0) return null

      return {
        mode: 'centered_percent_range',
        centerTiming: leaf.params.centerTiming === 'runtime' ? 'runtime' : 'deployment',
        centerSource: typeof leaf.params.centerSource === 'string' && leaf.params.centerSource.trim() !== ''
          ? leaf.params.centerSource.trim()
          : 'last_price',
        halfRangePct,
        ...(gridIntervals !== null ? { gridIntervals } : {}),
        ...(gridCount !== null ? { gridCount } : {}),
        ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
        ...(spacingPct !== null ? { spacingPct } : {}),
        spacingMode,
      }
    }

    if (lower === null || upper === null || upper <= lower) return null

    return {
      lower,
      upper,
      ...(gridIntervals !== null ? { gridIntervals } : {}),
      ...(gridCount !== null ? { gridCount } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(spacingPct !== null ? { spacingPct } : {}),
      spacingMode,
    }
  }

  private projectCanonicalOrderProgramBudgetFromRulePositionLeaves(
    leaves: readonly RulesMainflowLeaf[],
  ): CanonicalOrderProgramIntent['budget'] | null {
    for (const leaf of leaves) {
      if (leaf.key !== FIELD_KEY.POSITION_PER_ORDER_BUDGET) {
        continue
      }
      const value = this.readFiniteNumber(leaf.params.value)
      if (value === null || value <= 0) {
        continue
      }
      const asset = typeof leaf.params.asset === 'string' && leaf.params.asset.trim() !== ''
        ? leaf.params.asset.trim().toUpperCase()
        : 'USDT'
      return {
        mode: 'per_order_quote',
        value,
        asset,
      }
    }

    return null
  }

  private buildProgramGatesFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
  ): CanonicalOrchestrationGate[] {
    const gates: CanonicalOrchestrationGate[] = []
    const seen = new Set<string>()
    for (const leaf of mainflow.byRole.program) {
      const rule = mainflow.rules[leaf.ruleIndex]
      if (!rule) continue
      const gateId = this.programGateIdForRuleEffectLeaf(leaf)
      if (seen.has(gateId)) continue
      seen.add(gateId)
      gates.push({
        id: gateId,
        sourcePath: leaf.path,
        target: { phase: 'strategy' },
        activeWhen: this.buildProgramGateConditionFromRule(rule, leaf),
        effectWhenFalse: 'block_new_entries',
      })
    }
    return gates
  }

  private buildProgramScopesFromSemanticRulesMainflow(
    programs: readonly CanonicalOrchestrationProgram[],
  ): CanonicalOrchestrationScope[] {
    return programs
      .filter((program): program is Extract<CanonicalOrchestrationProgram, { programKind: 'event_listener' }> =>
        program.programKind === 'event_listener',
      )
      .map(program => ({
        id: program.sourceRef,
        scopeKind: 'dataSource',
        role: 'event',
        feedId: program.sourceRef,
        schemaRef: program.eventSchemaRef,
      }))
  }

  private buildOrchestrationScopesFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    market?: CanonicalStrategySpecV2['market'],
  ): CanonicalOrchestrationScope[] {
    const scopes: CanonicalOrchestrationScope[] = []
    for (const leaf of mainflow.byRole.orchestration) {
      const scope = this.buildCanonicalScopeFromRuleOrchestrationLeaf(leaf)
      if (scope) {
        scopes.push(scope)
        continue
      }
      if (leaf.key.startsWith('scope.')) {
        const knownScopeKeys = new Set(['scope.symbol', 'scope.leg', 'scope.timeframe', 'scope.dataSource', 'scope.subStrategy'])
        throw new Error(`${knownScopeKeys.has(leaf.key) ? 'Invalid' : 'Unsupported'}SemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
      }
    }
    const marketSymbol = typeof market?.symbol === 'string' ? market.symbol.trim() : ''
    if (marketSymbol !== '') {
      for (const leaf of mainflow.byRole.orchestration) {
        if (leaf.key !== FIELD_KEY.PORTFOLIO_RISK_SYMBOL_EXPOSURE_CAP) continue
        const boundRef = typeof leaf.params.boundSymbolScopeRef === 'string' ? leaf.params.boundSymbolScopeRef.trim() : ''
        if (boundRef !== '') continue
        const id = this.implicitSymbolScopeIdForRuleOrchestrationLeaf(leaf)
        if (scopes.some(scope => scope.id === id)) continue
        scopes.push({
          id,
          scopeKind: 'symbol',
          symbols: [marketSymbol],
          primarySymbol: marketSymbol,
          sourcePath: leaf.path,
        })
      }
    }
    return scopes.sort((a, b) => a.id.localeCompare(b.id))
  }

  private implicitSymbolScopeIdForRuleOrchestrationLeaf(leaf: RulesMainflowLeaf): string {
    return `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}-implicit-symbol-scope`
  }

  private isSupportedDataSourceSchemaRef(value: unknown): value is SemanticOrchestrationDataSourceSchema {
    return value === 'ohlcv'
      || value === 'orderbook'
      || value === 'funding'
      || value === 'open_interest'
      || value === 'liquidation'
      || value === 'webhook_event'
  }

  private buildCanonicalScopeFromRuleOrchestrationLeaf(
    leaf: RulesMainflowLeaf,
  ): CanonicalOrchestrationScope | null {
    const id = `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`
    switch (leaf.key) {
      case 'scope.symbol': {
        const symbols = Array.isArray(leaf.params.symbols)
          ? leaf.params.symbols.filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim() !== '').map(symbol => symbol.trim()).sort()
          : []
        if (symbols.length === 0) return null
        const scopeId = typeof leaf.params.scopeId === 'string' && leaf.params.scopeId.trim() !== ''
          ? leaf.params.scopeId.trim()
          : id
        const primarySymbol = typeof leaf.params.primarySymbol === 'string' && leaf.params.primarySymbol.trim() !== ''
          ? leaf.params.primarySymbol.trim()
          : undefined
        return {
          id: scopeId,
          scopeKind: 'symbol',
          symbols,
          ...(primarySymbol ? { primarySymbol } : {}),
          sourcePath: leaf.path,
        }
      }
      case 'scope.leg': {
        const legId = typeof leaf.params.legId === 'string' ? leaf.params.legId.trim() : ''
        const direction = leaf.params.direction
        const instrumentRef = typeof leaf.params.instrumentRef === 'string' ? leaf.params.instrumentRef.trim() : ''
        if (legId === '' || (direction !== 'long' && direction !== 'short') || instrumentRef === '') return null
        return {
          id,
          scopeKind: 'leg',
          legId,
          direction,
          instrumentRef,
          sourcePath: leaf.path,
        }
      }
      case 'scope.timeframe': {
        const primary = this.readFirstStringParam(leaf.params, ['primaryTimeframe', 'timeframe', 'primary', 'baseTimeframe'])
        const required = Array.isArray(leaf.params.requiredTimeframes)
          ? leaf.params.requiredTimeframes.filter((tf): tf is string => typeof tf === 'string' && tf.trim() !== '').map(tf => tf.trim())
          : []
        if (primary === '') return null
        return {
          id,
          scopeKind: 'timeframe',
          primaryTimeframe: primary,
          requiredTimeframes: [...required].sort((a, b) => (parseTimeframeMs(a) ?? 0) - (parseTimeframeMs(b) ?? 0)),
          alignmentPolicy: leaf.params.alignmentPolicy === 'tolerant' ? 'tolerant' : 'strict',
          sourcePath: leaf.path,
        }
      }
      case 'scope.dataSource': {
        const role = leaf.params.dataSourceRole ?? leaf.params.role
        const feedIdRaw = leaf.params.dataSourceFeedId ?? leaf.params.feedId
        const schemaRef = leaf.params.dataSourceSchemaRef ?? leaf.params.schemaRef
        if (
          (role !== 'primary' && role !== 'confirmation' && role !== 'event')
          || typeof feedIdRaw !== 'string'
          || feedIdRaw.trim() === ''
          || !this.isSupportedDataSourceSchemaRef(schemaRef)
        ) {
          return null
        }
        return {
          id,
          scopeKind: 'dataSource',
          role,
          feedId: feedIdRaw.trim(),
          schemaRef,
          sourcePath: leaf.path,
        }
      }
      case 'scope.subStrategy': {
        const subStrategyId = typeof leaf.params.subStrategyId === 'string' ? leaf.params.subStrategyId.trim() : ''
        if (subStrategyId === '') return null
        const positionHandling = leaf.params.positionHandlingOnDeactivate === 'close' ? 'close' : 'keep'
        const orderHandling = leaf.params.orderHandlingOnDeactivate === 'keep' ? 'keep' : 'cancel'
        const label = typeof leaf.params.subStrategyLabel === 'string' && leaf.params.subStrategyLabel.trim() !== ''
          ? leaf.params.subStrategyLabel.trim()
          : undefined
        return {
          id,
          scopeKind: 'subStrategy',
          subStrategyId,
          ...(label ? { subStrategyLabel: label } : {}),
          positionHandlingOnDeactivate: positionHandling,
          orderHandlingOnDeactivate: orderHandling,
          sourcePath: leaf.path,
        }
      }
      default:
        return null
    }
  }

  private buildOrchestrationPortfolioRisksFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    scopes: readonly CanonicalOrchestrationScope[] = [],
  ): CanonicalOrchestrationPortfolioRisk[] {
    const risks: CanonicalOrchestrationPortfolioRisk[] = []
    for (const leaf of mainflow.byRole.orchestration) {
      if (leaf.key === 'portfolioRisk.drawdown_block') {
        const thresholdPct = this.readFiniteNumber(leaf.params.thresholdPct)
        if (thresholdPct === null || thresholdPct <= 0 || thresholdPct > 100) {
          throw new Error(`InvalidSemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        risks.push({
          id: `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`,
          scope: 'portfolio',
          mode: leaf.params.mode === 'observe' ? 'observe' : 'enforce',
          thresholdPct,
          effectWhenTriggered: 'block_new_entries',
          sourcePath: leaf.path,
        })
        continue
      }
      if (leaf.key === FIELD_KEY.PORTFOLIO_RISK_SYMBOL_EXPOSURE_CAP) {
        const notionalCapPct = this.readFiniteNumber(leaf.params.notionalCapPct)
        const explicitSymbolScopeRef = typeof leaf.params.boundSymbolScopeRef === 'string'
          ? leaf.params.boundSymbolScopeRef.trim()
          : ''
        const implicitSymbolScopeRef = this.implicitSymbolScopeIdForRuleOrchestrationLeaf(leaf)
        const symbolScopeRef = explicitSymbolScopeRef !== ''
          ? explicitSymbolScopeRef
          : scopes.some(scope => scope.id === implicitSymbolScopeRef && scope.scopeKind === 'symbol')
            ? implicitSymbolScopeRef
            : ''
        const effectWhenTriggered = leaf.params.effectWhenTriggered === 'reduce_exposure'
          ? 'reduce_exposure'
          : 'block_new_entries'
        if (
          notionalCapPct === null
          || notionalCapPct <= 0
          || notionalCapPct > 100
          || symbolScopeRef === ''
        ) {
          throw new Error(`InvalidSemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        risks.push({
          id: `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`,
          scope: 'symbol',
          mode: leaf.params.mode === 'observe' ? 'observe' : 'enforce',
          notionalCapPct,
          symbolScopeRef,
          effectWhenTriggered,
          sourcePath: leaf.path,
        })
        continue
      }
      if (leaf.key === FIELD_KEY.PORTFOLIO_RISK_SUBSTRATEGY_EXPOSURE_CAP) {
        const notionalCapPct = this.readFiniteNumber(leaf.params.notionalCapPct)
        const subStrategyScopeRef = typeof leaf.params.boundSubStrategyScopeRef === 'string'
          ? leaf.params.boundSubStrategyScopeRef.trim()
          : ''
        const effectWhenTriggered = leaf.params.effectWhenTriggered
        if (
          notionalCapPct === null
          || notionalCapPct <= 0
          || notionalCapPct > 100
          || subStrategyScopeRef === ''
          || (effectWhenTriggered !== 'block_new_entries' && effectWhenTriggered !== 'pause_substrategy')
        ) {
          throw new Error(`InvalidSemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        risks.push({
          id: `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`,
          scope: 'subStrategy',
          mode: leaf.params.mode === 'observe' ? 'observe' : 'enforce',
          notionalCapPct,
          subStrategyScopeRef,
          effectWhenTriggered,
          sourcePath: leaf.path,
        })
        continue
      }
      if (leaf.key.startsWith('portfolioRisk.')) {
        throw new Error(`UnsupportedSemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
      }
      if (!leaf.key.startsWith('scope.') && !leaf.key.startsWith('gate.')) {
        throw new Error(`UnsupportedSemanticRuleOrchestrationEffect: key=${leaf.key} sourcePath=${leaf.path}`)
      }
    }
    return risks.sort((a, b) => a.id.localeCompare(b.id))
  }

  private buildOrchestrationGatesFromSemanticRulesMainflow(
    mainflow: RulesMainflowView,
    programs: CanonicalOrchestrationProgram[],
  ): CanonicalOrchestrationGate[] {
    const gates = this.buildProgramGatesFromSemanticRulesMainflow(mainflow)
      .filter(gate => programs.some(program => program.activeWhenRef === gate.id))

    const seenIds = new Set(gates.map(gate => gate.id))
    for (const leaf of mainflow.byRole.orchestration) {
      if (leaf.key !== 'gate.regime') continue
      const rule = mainflow.rules[leaf.ruleIndex]
      if (!rule || rule.phase !== 'entry') continue
      const condition = this.buildConditionFromSemanticRuleAtom(
        { kind: 'atom', key: leaf.key, params: leaf.params },
        'gate',
        rule.sideScope,
        null,
      )
      if (!condition) continue

      const id = `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      gates.push({
        id,
        target: { phase: 'entry', sideScope: rule.sideScope },
        activeWhen: condition,
        effectWhenFalse: 'block_new_entries',
        sourcePath: leaf.path,
      })
    }

    return gates.sort((a, b) => a.id.localeCompare(b.id))
  }

  private buildProgramGateConditionFromRule(
    rule: SemanticRule,
    leaf?: RulesMainflowLeaf,
  ): CanonicalConditionNode {
    if (
      leaf
      && (leaf.key === 'program.fixed_grid' || leaf.key === 'program.fixed_grid_gated')
      && this.isExecutionOnStartAtom(rule.condition)
    ) {
      return this.buildAlwaysActiveCondition()
    }
    if (rule.phase === 'entry' || rule.phase === 'exit') {
      const condition = this.buildConditionFromSemanticRuleExpr(rule.condition, rule.phase, rule.sideScope, null)
      if (condition) return condition
    }
    return {
      kind: 'atom',
      key: 'execution.on_start',
      semanticScope: 'market',
    }
  }

  private buildAlwaysActiveCondition(): CanonicalConditionNode {
    return {
      kind: 'expression',
      op: 'EQ',
      left: { kind: 'constant', value: 1 },
      right: { kind: 'constant', value: 1 },
    }
  }

  private isExecutionOnStartAtom(expr: AtomExpr): boolean {
    return expr.kind === 'atom' && expr.key === 'execution.on_start'
  }

  private programGateIdForRuleEffectLeaf(leaf: RulesMainflowLeaf): string {
    return `${leaf.ruleId}-${this.stableRulesPathId(leaf.path)}-active-gate`
  }

  private stableRulesPathId(path: string): string {
    return path.replace(/[^a-zA-Z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  }

  private buildCanonicalProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    const program = this.buildCanonicalProgramFromSupportedRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
    if (!program && (leaf.key === 'program.fixed_grid' || leaf.key === 'program.fixed_grid_gated')) {
      return null
    }
    if (!program) {
      throw new Error(`InvalidSemanticRuleProgramEffect: key=${leaf.key} sourcePath=${sourcePath}`)
    }
    return program
  }

  private enrichProgramLeafFromRuleContext(
    leaf: AtomExprAtom,
    rule: SemanticRule,
  ): AtomExprAtom {
    if (!isRuleEffectsByRole(rule.effects)) {
      return leaf
    }

    const sizing = this.resolveProgramSizingFromTypedRuleEffects(rule.effects)
      ?? this.resolveProgramSizingFromRuleProgramLeaf(leaf)
    const params = {
      ...this.defaultProgramParamsFromRuleContext(leaf, rule),
      ...leaf.params,
      ...(leaf.params.sizing || !sizing ? {} : { sizing }),
    }

    return { ...leaf, params }
  }

  private defaultProgramParamsFromRuleContext(
    leaf: AtomExprAtom,
    rule: SemanticRule,
  ): Record<string, unknown> {
    switch (leaf.key) {
      case 'program.dynamic_grid':
        return {
          anchorLookbackBars: this.readFiniteNumber(leaf.params.anchorLookbackBars)
            ?? this.readFiniteNumber(leaf.params.lookbackBars)
            ?? this.readFirstConditionNumericParam(rule.condition, ['lookbackBars', 'windowBars'])
            ?? 20,
          anchorSide: leaf.params.anchorSide === 'high' || leaf.params.anchorSide === 'low' || leaf.params.anchorSide === 'mid'
            ? leaf.params.anchorSide
            : 'mid',
          anchorDriftPct: this.readFiniteNumber(leaf.params.anchorDriftPct) ?? 10,
          rebuildMinIntervalSec: this.readFiniteNumber(leaf.params.rebuildMinIntervalSec) ?? 60,
          dynamicGridStep: this.readDynamicGridStepParam(leaf.params.dynamicGridStep)
            ?? { mode: 'pct', value: this.readFiniteNumber(leaf.params.stepPct) ?? 0.5 },
          levelCount: this.readFiniteNumber(leaf.params.levelCount) ?? this.readFiniteNumber(leaf.params.levels) ?? 10,
          onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
        }
      case 'program.fixed_grid':
      case 'program.fixed_grid_gated': {
        const grid = this.resolveGridParams(
          [leaf.evidence?.text, rule.evidence?.text]
            .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
            .join(' '),
        )
        return {
          ...(grid
            ? {
                lowerBound: grid.rangeMin,
                upperBound: grid.rangeMax,
                levelCount: grid.levelCount,
                stepPct: grid.stepPct,
              }
            : {}),
          onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
        }
      }
      case 'program.adaptive_volatility_grid':
        return {
          atrPeriod: this.readFiniteNumber(leaf.params.atrPeriod) ?? 14,
          atrMultiplier: this.readFiniteNumber(leaf.params.atrMultiplier) ?? 1.5,
          rangeMultiplier: this.readFiniteNumber(leaf.params.rangeMultiplier) ?? 3,
          atrDriftPct: this.readFiniteNumber(leaf.params.atrDriftPct) ?? 20,
          rebuildCooldownSec: this.readFiniteNumber(leaf.params.rebuildCooldownSec) ?? 300,
          minStepPct: this.readFiniteNumber(leaf.params.minStepPct) ?? 0.2,
          maxStepPct: this.readFiniteNumber(leaf.params.maxStepPct) ?? 2,
          levelCount: this.readFiniteNumber(leaf.params.levelCount) ?? 6,
          onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
        }
      case 'program.event_listener': {
        const signal = this.findConditionAtom(rule.condition, 'external.signal')
        const provider = typeof signal?.params.provider === 'string' && signal.params.provider.trim() !== ''
          ? signal.params.provider.trim()
          : 'webhook'
        return {
          eventSchemaRef: 'webhook_event',
          sourceRef: typeof leaf.params.sourceRef === 'string' && leaf.params.sourceRef.trim() !== ''
            ? leaf.params.sourceRef
            : `${provider}:default`,
          permissionScope: typeof leaf.params.permissionScope === 'string' && leaf.params.permissionScope.trim() !== ''
            ? leaf.params.permissionScope
            : `${provider}:default`,
          idempotencyKey: this.readEventListenerIdempotencyKeyParam(leaf.params.idempotencyKey) ?? { fieldPath: 'signalId' },
          dedupWindowMs: this.readFiniteNumber(leaf.params.dedupWindowMs) ?? 1000,
          expirationTtlMs: this.readFiniteNumber(leaf.params.expirationTtlMs) ?? 60000,
          expirationPolicy: leaf.params.expirationPolicy === 'escalate' ? 'escalate' : 'drop',
          rebuildPolicy: leaf.params.rebuildPolicy === 'on_schema_version_bump' ? 'on_schema_version_bump' : 'static',
          onDeactivate: leaf.params.onDeactivate === 'keep' ? 'keep' : 'cancel',
        }
      }
      default:
        return {}
    }
  }

  private readFirstConditionNumericParam(
    expr: AtomExpr,
    keys: readonly string[],
  ): number | null {
    for (const atom of collectAtomLeaves(expr)) {
      for (const key of keys) {
        const value = this.readFiniteNumber(atom.params[key])
        if (value !== null) return value
      }
    }
    return null
  }

  private findConditionAtom(
    expr: AtomExpr,
    key: string,
  ): AtomExprAtom | null {
    return collectAtomLeaves(expr).find(atom => atom.key === key) ?? null
  }

  private buildCanonicalProgramFromSupportedRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    switch (leaf.key) {
      case 'program.fixed_grid':
      case 'program.fixed_grid_gated':
        return this.buildCanonicalFixedGridProgramFromRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
      case 'program.dynamic_grid':
        return this.buildCanonicalDynamicGridProgramFromRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
      case 'program.adaptive_volatility_grid':
        return this.buildCanonicalAdaptiveVolatilityGridProgramFromRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
      case 'program.event_listener':
        return this.buildCanonicalEventListenerProgramFromRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
      case 'program.twap':
      case 'program.dca':
      case 'program.martingale':
      case 'program.rebalance':
      case 'program.iceberg':
        return this.buildCanonicalExecutionProgramFromRuleEffectLeaf(leaf, id, sourcePath, activeWhenRef)
      default:
        throw new Error(`UnsupportedSemanticRuleProgramEffect: key=${leaf.key} sourcePath=${sourcePath}`)
    }
  }

  private buildCanonicalExecutionProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram {
    const programKind = leaf.key.slice('program.'.length) as 'twap' | 'dca' | 'martingale' | 'rebalance' | 'iceberg'
    return {
      id,
      sourcePath,
      sourceAtomKey: leaf.key,
      programKind,
      activeWhenRef,
      onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
      rebuildPolicy: 'static',
      params: { ...leaf.params },
    }
  }

  private buildCanonicalFixedGridProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    const lowerBound = this.readFiniteNumber(leaf.params.lowerBound)
      ?? this.readFiniteNumber(leaf.params.rangeLower)
      ?? this.readFiniteNumber(leaf.params.lower)
    const upperBound = this.readFiniteNumber(leaf.params.upperBound)
      ?? this.readFiniteNumber(leaf.params.rangeUpper)
      ?? this.readFiniteNumber(leaf.params.upper)
    const anchorPrice = this.readFiniteNumber(leaf.params.anchorPrice)
      ?? (lowerBound !== null && upperBound !== null ? Number(((lowerBound + upperBound) / 2).toFixed(8)) : null)
    const levelCount = this.readFiniteNumber(leaf.params.levelCount)
      ?? this.readFiniteNumber(leaf.params.levels)
      ?? this.readFiniteNumber(leaf.params.gridCount)
    const absoluteSpacing = this.readFiniteNumber(leaf.params.absoluteSpacing)
    const stepPct = this.readFiniteNumber(leaf.params.stepPct)
      ?? this.readFiniteNumber(leaf.params.spacingPct)
      ?? (absoluteSpacing !== null && anchorPrice !== null
        ? Number(((absoluteSpacing / anchorPrice) * 100).toFixed(8))
        : null)
    if (anchorPrice === null || levelCount === null || stepPct === null) {
      return null
    }

    const node: SemanticOrchestrationNode = {
      id,
      kind: 'program',
      key: 'program.fixed_grid_gated',
      params: leaf.params,
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      programKind: 'fixed_grid_gated',
      activeWhenRef,
      onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
      rebuildPolicy: 'static',
      gridParams: {
        anchorPrice,
        levelCount,
        stepPct,
        ...(lowerBound !== null ? { lowerBound } : {}),
        ...(upperBound !== null ? { upperBound } : {}),
      },
      sizing: this.resolveProgramSizingFromRuleProgramLeaf(leaf),
    }
    const program = this.buildFixedGridGatedProgram(node)
    return program ? { ...program, sourcePath, sourceAtomKey: leaf.key } : null
  }

  private buildCanonicalDynamicGridProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    const step = this.readDynamicGridStepParam(leaf.params.dynamicGridStep)
    const node: SemanticOrchestrationNode = {
      id,
      kind: 'program',
      key: 'program.dynamic_grid',
      params: leaf.params,
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      programKind: 'dynamic_grid',
      activeWhenRef,
      onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
      rebuildPolicy: 'anchor_on_state_change',
      anchorLookbackBars: this.readFiniteNumber(leaf.params.anchorLookbackBars) ?? undefined,
      anchorSide: leaf.params.anchorSide === 'high' || leaf.params.anchorSide === 'low' || leaf.params.anchorSide === 'mid'
        ? leaf.params.anchorSide
        : undefined,
      anchorDriftPct: this.readFiniteNumber(leaf.params.anchorDriftPct) ?? undefined,
      rebuildMinIntervalSec: this.readFiniteNumber(leaf.params.rebuildMinIntervalSec) ?? undefined,
      dynamicGridStep: step ?? undefined,
      levelCount: this.readFiniteNumber(leaf.params.levelCount) ?? undefined,
      sizing: this.resolveProgramSizingFromRuleProgramLeaf(leaf),
    }
    const program = this.buildDynamicGridProgram(node)
    return program ? { ...program, sourcePath, sourceAtomKey: leaf.key } : null
  }

  private buildCanonicalAdaptiveVolatilityGridProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    const node: SemanticOrchestrationNode = {
      id,
      kind: 'program',
      key: 'program.adaptive_volatility_grid',
      params: leaf.params,
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      programKind: 'adaptive_volatility_grid',
      activeWhenRef,
      onDeactivate: leaf.params.onDeactivate === 'keep' || leaf.params.onDeactivate === 'close' ? leaf.params.onDeactivate : 'cancel',
      rebuildPolicy: 'atr_window',
      atrPeriod: this.readFiniteNumber(leaf.params.atrPeriod) ?? undefined,
      atrMultiplier: this.readFiniteNumber(leaf.params.atrMultiplier) ?? undefined,
      rangeMultiplier: this.readFiniteNumber(leaf.params.rangeMultiplier) ?? undefined,
      atrDriftPct: this.readFiniteNumber(leaf.params.atrDriftPct) ?? undefined,
      rebuildCooldownSec: this.readFiniteNumber(leaf.params.rebuildCooldownSec) ?? undefined,
      minStepPct: this.readFiniteNumber(leaf.params.minStepPct) ?? undefined,
      maxStepPct: this.readFiniteNumber(leaf.params.maxStepPct) ?? undefined,
      levelCount: this.readFiniteNumber(leaf.params.levelCount) ?? undefined,
      sizing: this.resolveProgramSizingFromRuleProgramLeaf(leaf),
    }
    const program = this.buildAdaptiveVolatilityGridProgram(node)
    return program ? { ...program, sourcePath, sourceAtomKey: leaf.key } : null
  }

  private buildCanonicalEventListenerProgramFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    id: string,
    sourcePath: string,
    activeWhenRef: string,
  ): CanonicalOrchestrationProgram | null {
    const node: SemanticOrchestrationNode = {
      id,
      kind: 'program',
      key: 'program.event_listener',
      params: leaf.params,
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      programKind: 'event_listener',
      activeWhenRef,
      onDeactivate: leaf.params.onDeactivate === 'keep' ? 'keep' : 'cancel',
      rebuildPolicy: leaf.params.rebuildPolicy === 'on_schema_version_bump' ? 'on_schema_version_bump' : 'static',
      eventSchemaRef: leaf.params.eventSchemaRef === 'webhook_event' ? 'webhook_event' : undefined,
      sourceRef: typeof leaf.params.sourceRef === 'string' ? leaf.params.sourceRef : undefined,
      permissionScope: typeof leaf.params.permissionScope === 'string' ? leaf.params.permissionScope : undefined,
      idempotencyKey: this.readEventListenerIdempotencyKeyParam(leaf.params.idempotencyKey) ?? undefined,
      dedupWindowMs: this.readFiniteNumber(leaf.params.dedupWindowMs) ?? undefined,
      expirationTtlMs: this.readFiniteNumber(leaf.params.expirationTtlMs) ?? undefined,
      expirationPolicy: leaf.params.expirationPolicy === 'escalate' ? 'escalate' : 'drop',
    }
    const program = this.buildEventListenerProgram(node)
    return program ? { ...program, sourcePath, sourceAtomKey: leaf.key } : null
  }

  private readDynamicGridStepParam(value: unknown): SemanticOrchestrationNode['dynamicGridStep'] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const mode = (value as { mode?: unknown }).mode
    const stepValue = this.readFiniteNumber((value as { value?: unknown }).value)
    if ((mode === 'pct' || mode === 'absolute') && stepValue !== null) {
      return { mode, value: stepValue }
    }
    return null
  }

  private readEventListenerIdempotencyKeyParam(value: unknown): SemanticOrchestrationNode['idempotencyKey'] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const fieldPath = (value as { fieldPath?: unknown }).fieldPath
    return typeof fieldPath === 'string' && fieldPath.trim() !== ''
      ? { fieldPath: fieldPath.trim() }
      : null
  }

  private resolveProgramSizingFromRuleProgramLeaf(
    leaf: AtomExprAtom,
  ): SemanticOrchestrationNode['sizing'] | undefined {
    const sizing = leaf.params.sizing
    if (sizing && typeof sizing === 'object' && !Array.isArray(sizing)) {
      const mode = (sizing as { mode?: unknown }).mode
      const value = this.readFiniteNumber((sizing as { value?: unknown }).value)
      if (
        (mode === 'fixed_quote' || mode === 'fixed_base' || mode === 'fixed_pct')
        && value !== null
        && value > 0
      ) {
        return { mode, value }
      }
    }

    const value = this.readFiniteNumber(leaf.params.value) ?? this.readFiniteNumber(leaf.params.perOrderBudget)
    if (value !== null && value > 0) {
      return { mode: 'fixed_quote', value }
    }
    return undefined
  }

  private resolveSizingFromSemanticRulePositionLeaves(
    positionLeaves: readonly RulesMainflowLeaf[],
  ): CanonicalStrategySpecV2['sizing'] {
    if (positionLeaves.length === 0) {
      return null
    }
    let resolved: CanonicalStrategySpecV2['sizing'] = null
    for (const leaf of positionLeaves) {
      if (
        leaf.key === 'position.dca_schedule'
        || leaf.key === 'position.pyramiding_limit'
        || leaf.key === FIELD_KEY.POSITION_MAX_EXPOSURE_PCT
        || leaf.key === 'position.max_concurrent_positions'
        || leaf.key === FIELD_KEY.POSITION_BUDGET_CAP
        || leaf.key === FIELD_KEY.POSITION_LEVERAGE
        || leaf.key === 'grid.range_rebalance'
      ) {
        continue
      }
      if (leaf.key !== FIELD_KEY.POSITION_PER_ORDER_BUDGET) {
        if (leaf.key !== FIELD_KEY.POSITION_SIZING && leaf.key !== 'position.fixed_notional') {
          throw new Error(`UnsupportedSemanticRulePositionEffect: key=${leaf.key} sourcePath=${leaf.path}`)
        }
        const sizing = leaf.key === 'position.fixed_notional'
          ? this.resolveSemanticActionSizing({ kind: 'quote', value: leaf.params.value, asset: leaf.params.asset })
          : this.resolveSemanticRulePositionSizing(leaf)
        if (!sizing) {
          continue
        }
        resolved ??= sizing
        continue
      }
      const value = this.readNumericParam(leaf.params.value)
      if (value === null || value <= 0) {
        throw new Error(`InvalidSemanticRulePositionEffect: key=${leaf.key} sourcePath=${leaf.path}`)
      }
      const asset = typeof leaf.params.asset === 'string' && leaf.params.asset.trim() !== ''
        ? leaf.params.asset.trim().toUpperCase()
        : undefined
      resolved ??= {
        mode: 'QUOTE',
        value,
        ...(asset ? { asset } : {}),
      }
    }
    return resolved
  }

  private resolveSemanticRulePositionSizing(
    leaf: Pick<RulesMainflowLeaf, 'params'>,
  ): CanonicalStrategySpecV2['sizing'] {
    const fromContract = this.resolveSemanticActionSizing(leaf.params.sizing)
    if (fromContract) return fromContract

    return this.resolveSemanticActionSizing({
      kind: leaf.params.kind,
      value: leaf.params.value,
      asset: leaf.params.asset,
    })
  }

  private atomLeafFromMainflowLeaf(leaf: RulesMainflowLeaf): AtomExprAtom {
    return {
      kind: 'atom',
      key: leaf.key,
      params: leaf.params,
      sideScope: leaf.sideScope,
      ...(leaf.evidenceText ? { evidence: { text: leaf.evidenceText } } : {}),
    }
  }

  private readRoleEffectIndexFromPath(
    path: string,
    role: keyof RuleEffectsByRole,
  ): number | null {
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const match = path.match(new RegExp(`\\.effects\\.${escapedRole}\\[(\\d+)\\]`, 'u'))
    if (!match?.[1]) return null
    const index = Number(match[1])
    return Number.isInteger(index) && index >= 0 ? index : null
  }

  private readNumericParam(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value !== 'string') {
      return null
    }
    const parsed = Number(value.trim().match(/^-?\d+(?:\.\d+)?/u)?.[0])
    return Number.isFinite(parsed) ? parsed : null
  }

  // Phase 5 S11 (#1112): scope.leg substrate
  // #1186 PR2: 多锚（state.isMultiLeg===true）路径用 PerTradeSizingResolver anchor 反填 legSizing；
  // 单腿/旧路径走 LLM 直供 legSizing fallback，零行为变更。
  private buildOrchestrationLegScopes(state: SemanticState): CanonicalOrchestrationLegScope[] {
    const nodes = this.readSemanticOrchestrationFacts(state)
    if (!nodes || nodes.length === 0) return []
    const isMultiLeg = state.isMultiLeg === true
    const anchorMap = isMultiLeg ? this.sizingResolver.resolve(state) : undefined
    const result: CanonicalOrchestrationLegScope[] = []
    for (const node of nodes) {
      if (
        node.kind !== 'scope'
        || node.status !== 'locked'
        || node.key !== 'scope.leg'
        || node.legScopeKind !== 'leg'
      ) continue
      const legId = typeof node.legId === 'string' ? node.legId.trim() : ''
      if (legId === '') continue
      if (node.direction !== 'long' && node.direction !== 'short') continue
      const instrumentRef = typeof node.instrumentRef === 'string' ? node.instrumentRef.trim() : ''
      if (instrumentRef === '') continue
      // 优先：多锚反填路径
      let legSizing: CanonicalOrchestrationLegSizing | undefined
      if (isMultiLeg && anchorMap) {
        legSizing = this.resolveLegSizingFromAnchor(anchorMap, node, state)
      }
      // Fallback：LLM 直供 legSizing（单腿场景或多锚 resolver 未匹配）
      if (!legSizing && node.legSizing) {
        const sizing = node.legSizing
        legSizing = {
          mode: sizing.mode,
          value: sizing.value,
          ...(typeof sizing.pairedLegId === 'string' && sizing.pairedLegId.trim() !== ''
            ? { pairedLegId: sizing.pairedLegId.trim() }
            : {}),
        }
      }
      result.push({
        id: node.id,
        scopeKind: 'leg',
        legId,
        direction: node.direction,
        instrumentRef,
        ...(legSizing ? { legSizing } : {}),
        ...(node.syncTriggerRequired === true ? { syncTriggerRequired: true } : {}),
      })
    }
    return result
  }

  /**
   * #1186 PR2: 把 PerTradeSizingResolver anchor 翻译成 CanonicalOrchestrationLegSizing。
   *
   * 匹配口径：以 LLM `legId` 为主映射到 `state.actions[*].id`（`SizingScope.kind==='action'` 时
   * `scope.id` 即 actionId）。fixture 显式提供 legId↔actionId 映射；找不到则跳过 + log.warn。
   */
  private resolveLegSizingFromAnchor(
    anchorMap: ReadonlyMap<string, SizingAnchor>,
    node: SemanticOrchestrationNode,
    state: SemanticState,
  ): CanonicalOrchestrationLegSizing | undefined {
    const legId = typeof node.legId === 'string' ? node.legId.trim() : ''
    if (legId === '') return undefined
    // 候选 actionId 集：直接 legId、或 actions 中 key 末尾命中 legId 的那个
    const candidateActionIds: string[] = []
    if (anchorMap.has(sizingScopeKey({ kind: 'action', id: legId }))) {
      candidateActionIds.push(legId)
    }
    for (const action of this.readSemanticActionFacts(state)) {
      if (action.id === legId) continue
      if (action.id.endsWith(legId) || action.key.endsWith(legId)) {
        candidateActionIds.push(action.id)
      }
    }
    let anchor: SizingAnchor | undefined
    for (const aid of candidateActionIds) {
      const a = anchorMap.get(sizingScopeKey({ kind: 'action', id: aid }))
      if (a && a.executionAnchored) { anchor = a; break }
    }
    if (!anchor || !anchor.normalized) {
      // eslint-disable-next-line no-console
      console.warn(`[canonical-spec-builder] multi-leg legId=${legId} 未匹配到 executionAnchored anchor，跳过 legSizing 反填`)
      return undefined
    }
    const mode = this.mapAnchorAxisToLegSizingMode(anchor.normalized.axis)
    if (mode === null) {
      // risk_budget axis: skip + warn
      // eslint-disable-next-line no-console
      console.warn(`[canonical-spec-builder] multi-leg legId=${legId} axis=${anchor.normalized.axis} 暂不支持映射到 legSizing，跳过`)
      return undefined
    }
    const out: CanonicalOrchestrationLegSizing = {
      mode,
      value: anchor.normalized.value,
    }
    if (typeof anchor.normalized.asset === 'string' && anchor.normalized.asset.trim() !== '') {
      out.asset = anchor.normalized.asset.trim()
    }
    return out
  }

  /**
   * #1186 PR2 (decision 3): SizingAxis → CanonicalOrchestrationLegSizingMode 映射。
   * 禁止把 base_qty 静默归入 fixed_quote。
   * - notional_quote → fixed_quote
   * - equity_ratio   → fixed_pct
   * - base_qty       → fixed_base（新增 mode）
   * - risk_budget    → null（跳过 + warn）
   */
  private mapAnchorAxisToLegSizingMode(axis: SizingAxis): CanonicalOrchestrationLegSizingMode | null {
    switch (axis) {
      case 'notional_quote':
        return 'fixed_quote'
      case 'equity_ratio':
        return 'fixed_pct'
      case 'base_qty':
        return 'fixed_base'
      case 'risk_budget':
        return null
    }
  }

  // Phase 5 S2 (#1104) + S3 (#1109) + S9 (#1110) + S10 (#1111): scope union substrate（symbol + timeframe + dataSource + subStrategy）
  // 输出 status='locked' scope；按 node.id 字典序，保证 byte-equal（含旧 v1 单/多 symbol scope 字节兼容）
  private buildOrchestrationScopes(state: SemanticState): CanonicalOrchestrationScope[] {
    const nodes = this.readSemanticOrchestrationFacts(state)
    if (!nodes || nodes.length === 0) {
      return []
    }
    const scopes: CanonicalOrchestrationScope[] = []
    for (const node of nodes) {
      if (node.kind !== 'scope' || node.status !== 'locked') continue

      // S2: scope.symbol
      if (node.key === 'scope.symbol' && node.symbolScopeKind === 'symbol') {
        const symbols = Array.isArray(node.symbols) ? node.symbols.filter((s): s is string => typeof s === 'string') : []
        if (symbols.length === 0) continue
        const trimmed = symbols.map((s) => s.trim())
        const sortedSymbols = [...trimmed].sort()
        const primary = typeof node.primarySymbol === 'string' ? node.primarySymbol.trim() : undefined
        scopes.push({
          id: node.id,
          scopeKind: 'symbol',
          symbols: sortedSymbols,
          ...(primary && primary !== '' ? { primarySymbol: primary } : {}),
        })
        continue
      }

      // S3: scope.timeframe
      if (node.key === 'scope.timeframe' && node.timeframeScopeKind === 'timeframe') {
        const primary = node.primaryTimeframe
        const required = Array.isArray(node.requiredTimeframes)
          ? node.requiredTimeframes.filter((tf): tf is string => typeof tf === 'string')
          : []
        if (typeof primary !== 'string' || required.length === 0) continue
        const alignmentPolicy = node.alignmentPolicy === 'tolerant' ? 'tolerant' : 'strict'
        // 按 timeframe ms 升序稳定排序
        const sortedRequired = [...required].sort(
          (a, b) => (parseTimeframeMs(a) ?? 0) - (parseTimeframeMs(b) ?? 0),
        )
        scopes.push({
          id: node.id,
          scopeKind: 'timeframe',
          primaryTimeframe: primary,
          requiredTimeframes: sortedRequired,
          alignmentPolicy,
        })
        continue
      }

      // S9: scope.dataSource — readiness 已保证 role/feedId/schemaRef 必填合法
      if (node.key === 'scope.dataSource' && node.dataSourceScopeKind === 'dataSource') {
        const role = node.dataSourceRole
        const feedIdRaw = node.dataSourceFeedId
        const schemaRef = node.dataSourceSchemaRef
        if (
          (role !== 'primary' && role !== 'confirmation' && role !== 'event')
          || typeof feedIdRaw !== 'string'
          || !this.isSupportedDataSourceSchemaRef(schemaRef)
        ) {
          continue
        }
        const feedId = feedIdRaw.trim()
        if (feedId === '') continue
        scopes.push({
          id: node.id,
          scopeKind: 'dataSource',
          role,
          feedId,
          schemaRef,
        })
        continue
      }

      // S10: scope.subStrategy
      if (node.key === 'scope.subStrategy' && node.subStrategyScopeKind === 'subStrategy') {
        const subStrategyId = typeof node.subStrategyId === 'string' ? node.subStrategyId.trim() : ''
        if (subStrategyId === '') continue
        const positionHandling = node.positionHandlingOnDeactivate
        const orderHandling = node.orderHandlingOnDeactivate
        if (
          (positionHandling !== 'close' && positionHandling !== 'keep')
          || (orderHandling !== 'cancel' && orderHandling !== 'keep')
        ) {
          continue
        }
        const label = typeof node.subStrategyLabel === 'string' ? node.subStrategyLabel.trim() : undefined
        scopes.push({
          id: node.id,
          scopeKind: 'subStrategy',
          subStrategyId,
          ...(label && label !== '' ? { subStrategyLabel: label } : {}),
          positionHandlingOnDeactivate: positionHandling,
          orderHandlingOnDeactivate: orderHandling,
        })
        continue
      }
    }
    return scopes.sort((a, b) => a.id.localeCompare(b.id))
  }

  // Phase 5 S3 (#1109): 把 scope.timeframe 声明的 (primary ∪ required) union dedup
  // 写入 spec.dataRequirements.requiredTimeframes，让既有 backtest HTF 拉数路径自动覆盖
  // critic Round 1 M6-R1 修正
  private mergeTimeframeScopeIntoDataRequirements(
    requiredTimeframes: string[],
    scopes: readonly CanonicalOrchestrationScope[],
  ): string[] {
    const tfScopes = scopes.filter(
      (s): s is CanonicalOrchestrationScope & { scopeKind: 'timeframe' } => s.scopeKind === 'timeframe',
    )
    if (tfScopes.length === 0) return requiredTimeframes
    const tfSet = new Set<string>(requiredTimeframes)
    for (const tfScope of tfScopes) {
      tfSet.add(tfScope.primaryTimeframe)
      tfScope.requiredTimeframes.forEach((tf) => tfSet.add(tf))
    }
    // 按 ms 升序稳定排序，保证 spec 输出 deterministic
    return [...tfSet].sort((a, b) => (parseTimeframeMs(a) ?? 0) - (parseTimeframeMs(b) ?? 0))
  }

  private buildOrchestrationPortfolioRisks(state: SemanticState): CanonicalOrchestrationPortfolioRisk[] {
    const nodes = this.readSemanticOrchestrationFacts(state)
    if (!nodes || nodes.length === 0) {
      return []
    }

    const risks: CanonicalOrchestrationPortfolioRisk[] = []
    for (const node of nodes) {
      if (node.kind !== 'portfolioRisk' || node.status !== 'locked') {
        continue
      }
      if (node.mode !== 'observe' && node.mode !== 'enforce') {
        continue
      }

      if (node.key === ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].key && node.scope === 'portfolio') {
        const thresholdPct = node.thresholdPct
        if (typeof thresholdPct !== 'number' || !Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct > 100) {
          continue
        }
        risks.push({
          id: node.id,
          scope: 'portfolio',
          mode: node.mode,
          thresholdPct,
          effectWhenTriggered: 'block_new_entries',
        })
        continue
      }

      // Phase 5 S8 (#1119): symbol exposure cap
      if (node.key === FIELD_KEY.PORTFOLIO_RISK_SYMBOL_EXPOSURE_CAP && node.scope === 'symbol') {
        const cap = node.notionalCapPct
        if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0 || cap > 100) continue
        if (node.effectWhenTriggered !== 'block_new_entries' && node.effectWhenTriggered !== 'reduce_exposure') continue
        const symbolScopeRef = node.boundSymbolScopeRef
        if (typeof symbolScopeRef !== 'string' || symbolScopeRef.trim() === '') continue
        risks.push({
          id: node.id,
          scope: 'symbol',
          mode: node.mode,
          notionalCapPct: cap,
          symbolScopeRef: symbolScopeRef.trim(),
          effectWhenTriggered: node.effectWhenTriggered,
        })
        continue
      }

      // Phase 5 S8 (#1119): substrategy exposure cap
      if (node.key === FIELD_KEY.PORTFOLIO_RISK_SUBSTRATEGY_EXPOSURE_CAP && node.scope === 'subStrategy') {
        const cap = node.notionalCapPct
        if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0 || cap > 100) continue
        if (node.effectWhenTriggered !== 'block_new_entries' && node.effectWhenTriggered !== 'pause_substrategy') continue
        const subStrategyScopeRef = node.boundSubStrategyScopeRef
        if (typeof subStrategyScopeRef !== 'string' || subStrategyScopeRef.trim() === '') continue
        risks.push({
          id: node.id,
          scope: 'subStrategy',
          mode: node.mode,
          notionalCapPct: cap,
          subStrategyScopeRef: subStrategyScopeRef.trim(),
          effectWhenTriggered: node.effectWhenTriggered,
        })
        continue
      }
    }

    // Sort by id for byte-equal stability
    return risks.sort((a, b) => a.id.localeCompare(b.id))
  }

  private buildOrchestrationGates(state: SemanticState): CanonicalOrchestrationGate[] {
    const nodes = this.readSemanticOrchestrationFacts(state)
    if (!nodes || nodes.length === 0) {
      return []
    }

    const gates: CanonicalOrchestrationGate[] = []
    for (const node of nodes) {
      if (
        node.kind === 'program'
        && node.status === 'locked'
        && node.key === 'program.fixed_grid_gated'
        && (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '')
      ) {
        gates.push({
          id: this.alwaysOnGateIdForProgram(node.id),
          target: { phase: 'entry', sideScope: 'both' },
          activeWhen: {
            kind: 'expression',
            op: 'EQ',
            left: { kind: 'constant', value: 1 },
            right: { kind: 'constant', value: 1 },
          },
          effectWhenFalse: 'block_new_entries',
        })
        continue
      }

      // Phase 5 S10 (#1111): gate 节点支持多 phase（gate.regime 仍是 entry；新加 phase=subStrategy）
      if (node.kind !== 'gate' || node.status !== 'locked') {
        continue
      }
      if (!node.activeWhen || !this.isValidSemanticExpression(node.activeWhen)) {
        continue
      }
      if (!node.target) {
        continue
      }

      const condition = this.buildConditionFromSemanticExpression(node.activeWhen)
      if (!condition) {
        continue
      }

      // Phase 5 S10 (#1111): phase=subStrategy 透传 target.subStrategyScopeRef + toSubStrategyScopeRef + effect
      if (node.target.phase === 'subStrategy') {
        const effect = node.effectWhenFalse
        if (effect !== 'pause_substrategy' && effect !== 'switch_substrategy') {
          continue
        }
        gates.push({
          id: node.id,
          target: node.target,
          activeWhen: condition,
          effectWhenFalse: effect,
        })
        continue
      }
      // phase=strategy 本 PR substrate 不支持，silent skip（留 issue #984 的第 5 项 strategy 子级 PR）
      if (node.target.phase === 'strategy') {
        continue
      }
      // 默认 phase=entry：保留 gate.regime 既有路径
      if (node.key !== 'gate.regime') {
        continue
      }

      gates.push({
        id: node.id,
        target: node.target,
        activeWhen: condition,
        effectWhenFalse: node.effectWhenFalse ?? 'block_new_entries',
      })
    }

    return gates
  }

  private buildOrchestrationPrograms(state: SemanticState): CanonicalOrchestrationProgram[] {
    const nodes = this.readSemanticOrchestrationFacts(state)
    if (!nodes || nodes.length === 0) {
      return []
    }

    const programs: CanonicalOrchestrationProgram[] = []
    for (const node of nodes) {
      if (node.kind !== 'program' || node.status !== 'locked') continue

      if (node.key === 'program.fixed_grid_gated') {
        const program = this.buildFixedGridGatedProgram(node)
        if (program) programs.push(program)
        continue
      }

      // Phase 5 S5 (#984)
      if (node.key === 'program.dynamic_grid') {
        const program = this.buildDynamicGridProgram(node)
        if (program) programs.push(program)
        continue
      }

      // Phase 5 S6 (#984)
      if (node.key === 'program.adaptive_volatility_grid') {
        const program = this.buildAdaptiveVolatilityGridProgram(node)
        if (program) programs.push(program)
        continue
      }

      // Phase 5 S12 (#1118)
      if (node.key === 'program.event_listener') {
        const program = this.buildEventListenerProgram(node)
        if (program) programs.push(program)
        continue
      }
    }

    return programs
  }

  private buildFixedGridGatedProgram(node: SemanticOrchestrationNode): CanonicalOrchestrationProgram | null {
    if (node.programKind !== 'fixed_grid_gated') return null
    if (node.rebuildPolicy !== 'static') return null
    if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') return null
    const activeWhenRef = typeof node.activeWhenRef === 'string' && node.activeWhenRef.trim() !== ''
      ? node.activeWhenRef.trim()
      : this.alwaysOnGateIdForProgram(node.id)

    const grid = node.gridParams
    if (!grid) return null
    const { anchorPrice, levelCount, stepPct, lowerBound, upperBound } = grid
    if (typeof anchorPrice !== 'number' || !Number.isFinite(anchorPrice) || anchorPrice <= 0) return null
    if (typeof levelCount !== 'number' || !Number.isInteger(levelCount) || levelCount < 2) return null
    if (typeof stepPct !== 'number' || !Number.isFinite(stepPct) || stepPct <= 0) return null
    if (lowerBound !== undefined) {
      if (typeof lowerBound !== 'number' || !Number.isFinite(lowerBound) || lowerBound <= 0) return null
      if (upperBound !== undefined && !(lowerBound < upperBound)) return null
    }
    if (upperBound !== undefined && (typeof upperBound !== 'number' || !Number.isFinite(upperBound) || upperBound <= 0)) {
      return null
    }

    const sizing = node.sizing
    if (!sizing) return null
    if (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct') return null
    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return null

    return {
      id: node.id,
      programKind: 'fixed_grid_gated',
      activeWhenRef,
      onDeactivate: node.onDeactivate,
      rebuildPolicy: 'static',
      gridParams: {
        anchorPrice,
        levelCount,
        stepPct,
        ...(lowerBound !== undefined ? { lowerBound } : {}),
        ...(upperBound !== undefined ? { upperBound } : {}),
      },
      sizing: { mode: sizing.mode, value: sizing.value },
    }
  }

  private alwaysOnGateIdForProgram(programId: string): string {
    return `${programId}-always-on-gate`
  }

  private buildDynamicGridProgram(node: SemanticOrchestrationNode): CanonicalOrchestrationProgram | null {
    if (node.programKind !== 'dynamic_grid') return null
    if (node.rebuildPolicy !== 'anchor_on_state_change') return null
    if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') return null
    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.length === 0) return null

    const lookback = node.anchorLookbackBars
    if (typeof lookback !== 'number' || !Number.isInteger(lookback) || lookback < 10 || lookback > 1000) return null
    if (node.anchorSide !== 'high' && node.anchorSide !== 'low' && node.anchorSide !== 'mid') return null
    const driftPct = node.anchorDriftPct
    if (typeof driftPct !== 'number' || !Number.isFinite(driftPct) || driftPct <= 0 || driftPct > 100) return null
    const minInterval = node.rebuildMinIntervalSec
    if (typeof minInterval !== 'number' || !Number.isInteger(minInterval) || minInterval < 60) return null

    const step = node.dynamicGridStep
    if (!step || (step.mode !== 'pct' && step.mode !== 'absolute')) return null
    if (typeof step.value !== 'number' || !Number.isFinite(step.value) || step.value <= 0) return null

    const levelCount = node.levelCount
    if (typeof levelCount !== 'number' || !Number.isInteger(levelCount) || levelCount < 2 || levelCount > 100) return null

    const sizing = node.sizing
    if (!sizing) return null
    if (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct') return null
    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return null

    return {
      id: node.id,
      programKind: 'dynamic_grid',
      activeWhenRef: node.activeWhenRef,
      onDeactivate: node.onDeactivate,
      rebuildPolicy: 'anchor_on_state_change',
      dynamicGridParams: {
        anchorLookbackBars: lookback,
        anchorSide: node.anchorSide,
        anchorDriftPct: driftPct,
        rebuildMinIntervalSec: minInterval,
        levelCount,
        step: { mode: step.mode, value: step.value },
      },
      sizing: { mode: sizing.mode, value: sizing.value },
    }
  }

  private buildAdaptiveVolatilityGridProgram(node: SemanticOrchestrationNode): CanonicalOrchestrationProgram | null {
    if (node.programKind !== 'adaptive_volatility_grid') return null
    if (node.rebuildPolicy !== 'atr_window') return null
    if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') return null
    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.length === 0) return null

    const isPositiveFinite = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0
    const isPositiveInt = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v > 0

    if (!isPositiveInt(node.atrPeriod) || node.atrPeriod < 2 || node.atrPeriod > 200) return null
    if (!isPositiveFinite(node.atrMultiplier)) return null
    if (!isPositiveFinite(node.rangeMultiplier)) return null
    if (
      typeof node.atrDriftPct !== 'number'
      || !Number.isFinite(node.atrDriftPct)
      || node.atrDriftPct <= 0
      || node.atrDriftPct > 100
    ) return null
    if (!isPositiveInt(node.rebuildCooldownSec) || node.rebuildCooldownSec < 300) return null
    if (!isPositiveFinite(node.minStepPct)) return null
    if (!isPositiveFinite(node.maxStepPct)) return null
    if (node.maxStepPct < node.minStepPct) return null
    if (
      typeof node.levelCount !== 'number'
      || !Number.isInteger(node.levelCount)
      || node.levelCount < 2
      || node.levelCount > 100
    ) return null

    const sizing = node.sizing
    if (!sizing) return null
    if (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct') return null
    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return null

    return {
      id: node.id,
      programKind: 'adaptive_volatility_grid',
      activeWhenRef: node.activeWhenRef,
      onDeactivate: node.onDeactivate,
      rebuildPolicy: 'atr_window',
      adaptiveGridParams: {
        atrPeriod: node.atrPeriod,
        atrMultiplier: node.atrMultiplier,
        rangeMultiplier: node.rangeMultiplier,
        atrDriftPct: node.atrDriftPct,
        rebuildCooldownSec: node.rebuildCooldownSec,
        minStepPct: node.minStepPct,
        maxStepPct: node.maxStepPct,
        levelCount: node.levelCount,
      },
      sizing: { mode: sizing.mode, value: sizing.value },
    }
  }

  // Phase 5 S12 (#1118): event_listener canonical builder
  //   readiness 已守门 16 重；builder 这里再做一遍轻量类型守卫确保 null-safe
  private buildEventListenerProgram(node: SemanticOrchestrationNode): CanonicalOrchestrationProgram | null {
    if (node.programKind !== 'event_listener') return null
    if (node.rebuildPolicy !== 'static' && node.rebuildPolicy !== 'on_schema_version_bump') return null
    if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep') return null
    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.length === 0) return null

    if (node.eventSchemaRef !== 'webhook_event') return null
    if (typeof node.sourceRef !== 'string' || node.sourceRef.trim() === '') return null
    if (typeof node.permissionScope !== 'string' || node.permissionScope.trim() === '') return null

    const idempotency = node.idempotencyKey
    if (!idempotency || typeof idempotency.fieldPath !== 'string' || idempotency.fieldPath.trim() === '') return null

    if (typeof node.dedupWindowMs !== 'number' || !Number.isInteger(node.dedupWindowMs)) return null
    if (typeof node.expirationTtlMs !== 'number' || !Number.isInteger(node.expirationTtlMs)) return null
    if (node.expirationPolicy !== 'drop' && node.expirationPolicy !== 'escalate') return null

    return {
      id: node.id,
      programKind: 'event_listener',
      activeWhenRef: node.activeWhenRef,
      onDeactivate: node.onDeactivate,
      rebuildPolicy: node.rebuildPolicy,
      eventSchemaRef: node.eventSchemaRef,
      sourceRef: node.sourceRef.trim(),
      permissionScope: node.permissionScope.trim(),
      idempotencyKey: { fieldPath: idempotency.fieldPath.trim() },
      dedupWindowMs: node.dedupWindowMs,
      expirationTtlMs: node.expirationTtlMs,
      expirationPolicy: node.expirationPolicy,
    }
  }

  private filterOrderProgramShadowRules(
    rules: CanonicalRuleV2[],
    orderPrograms: CanonicalOrderProgramIntent[],
  ): CanonicalRuleV2[] {
    if (orderPrograms.length === 0) {
      return rules
    }

    return rules.filter(rule => !this.isOrderProgramShadowRule(rule))
  }

  private isOrderProgramShadowRule(rule: CanonicalRuleV2): boolean {
    // Compatibility routing hint only. Readiness and clarification must be decided before this point by SemanticState contracts and openSlots.
    if (rule.metadata?.normalized?.family === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
      return true
    }

    return rule.condition.kind === 'atom' && rule.condition.key === 'grid.range_rebalance'
  }

  private buildBoundaryGuardRulesFromSemanticState(
    state: SemanticState,
    orderPrograms: CanonicalOrderProgramIntent[],
  ): CanonicalRuleV2[] {
    if (orderPrograms.length === 0) {
      return []
    }

    const hasBoundaryCancel = this.readSemanticRiskFacts(state).some(risk =>
      risk.status === 'locked'
      && risk.contracts?.some(contract =>
        contract.capabilities.some(capability =>
          capability.domain === 'guard'
          && capability.verb === 'enforce'
          && capability.object === 'boundary_cancel',
        ),
      ),
    )
    if (!hasBoundaryCancel) {
      return []
    }

    return orderPrograms.map((program, index): CanonicalRuleV2 => ({
      id: `semantic-boundary-guard-${index + 1}`,
      phase: 'risk',
      sideScope: 'both',
      priority: 110 - index,
      condition: {
        kind: 'NOT',
        children: [{
          kind: 'atom',
          key: 'order_program.active_range',
          params: { programId: program.id },
        }],
      },
      actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      metadata: {
        semanticKey: 'risk.boundary_guard',
        guard: 'boundary_cancel',
        cancelOrders: true,
        onBreach: 'HALT_STRATEGY',
      },
    }))
  }

  private conditionContainsAtom(condition: CanonicalRuleV2['condition'], key: string): boolean {
    if (condition.kind === 'atom') {
      return condition.key === key
    }

    if (condition.kind === 'expression') {
      return false
    }

    return condition.children.some(child => this.conditionContainsAtom(child, key))
  }

  private buildContractOrderPrograms(state: SemanticState): CanonicalOrderProgramIntent[] {
    const contracts = this.collectContracts(state)
    const resolution = this.contracts.resolve(contracts)
    if (!resolution.canCompileOrderProgram) {
      return []
    }

    const intent = this.toCanonicalOrderProgramIntent(resolution.capabilities, state)
    return intent ? [intent] : []
  }

  private collectContracts(state: SemanticState): SemanticAtomContract[] {
    return [
      ...this.readSemanticTriggerFacts(state).filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...this.readSemanticActionFacts(state).filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...this.readSemanticRiskFacts(state).filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...(state.position?.status === 'locked' ? state.position.contracts ?? [] : []),
      ...(state.position?.constraints ?? []).filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
    ]
  }

  private toCanonicalOrderProgramIntent(
    capabilities: readonly SemanticCapability[],
    state: SemanticState,
  ): CanonicalOrderProgramIntent | null {
    const levelSet = this.resolveUniqueCapability(
      capabilities,
      'price',
      'define',
      ['level_set'],
      capability => this.projectLevelSetCapabilityKey(capability),
    )
    const orderProgram = this.resolveUniqueCapability(
      capabilities,
      'order_program',
      'maintain',
      ['limit_ladder'],
      capability => this.projectLimitLadderCapabilityKey(capability),
    )
    const budget = this.resolveUniqueCapability(
      capabilities,
      'capital',
      'allocate',
      ['per_order_budget', 'total_budget'],
      capability => this.projectBudgetCapabilityKey(capability),
    )
    const exposure = this.resolveUniqueCapability(
      capabilities,
      'exposure',
      'set',
      ['position_mode'],
      capability => this.projectExposureCapabilityKey(capability),
    )

    if (
      levelSet.status === 'conflict'
      || orderProgram.status === 'conflict'
      || budget.status === 'conflict'
      || exposure.status === 'conflict'
      || !levelSet.capability
      || !orderProgram.capability
    ) {
      return null
    }

    const projectedLevelSet = this.projectCanonicalOrderProgramLevelSet(levelSet.capability)
    const projectedBudget = this.projectCanonicalOrderProgramBudget(budget.capability, state)
    if (
      !projectedLevelSet
      || !projectedBudget
    ) {
      return null
    }

    return {
      id: `contract-order-program-${orderProgram.capability.object}`,
      kind: 'contract_order_program',
      mode: this.resolveContractOrderProgramMode(exposure.capability, state),
      levelSet: projectedLevelSet,
      budget: {
        ...projectedBudget,
      },
      orderType: 'limit',
      timeInForce: 'gtc',
      recycleOnFill: this.readShapeBoolean(orderProgram.capability.shape, 'recycleOnFill') ?? true,
      cancelOnStop: this.readShapeBoolean(orderProgram.capability.shape, 'cancelOnStop') ?? true,
    }
  }

  private resolveUniqueCapability(
    capabilities: readonly SemanticCapability[],
    domain: SemanticCapability['domain'],
    verb: string,
    objects: readonly string[],
    projectionKey: (capability: SemanticCapability) => string,
  ): CapabilityCandidateResolution {
    const candidates = capabilities.filter(capability =>
      capability.domain === domain
      && capability.verb === verb
          && objects.includes(capability.object),
    )
    if (candidates.length === 0) {
      return { status: 'ok', capability: null }
    }

    const first = candidates[0]
    const firstKey = projectionKey(first)
    const hasConflict = candidates.some(candidate => projectionKey(candidate) !== firstKey)
    if (hasConflict) {
      return { status: 'conflict' }
    }

    return { status: 'ok', capability: first }
  }

  private normalizeLevelSetCapability(capability: SemanticCapability): SemanticCapability {
    if (capability.domain !== 'price' || capability.verb !== 'define' || capability.object !== 'level_set') {
      return capability
    }

    const result = this.shapeNormalizer.normalizeLevelSetShape(capability.shape)
    return result.status === 'valid'
      ? { ...capability, shape: result.shape }
      : capability
  }

  private projectLevelSetCapabilityKey(capability: SemanticCapability): string {
    const normalizedCapability = this.normalizeLevelSetCapability(capability)
    const mode = this.readShapeString(normalizedCapability.shape, 'mode')
    if (mode === 'centered_percent_range') {
      return this.stableProjectionKey({
        mode,
        centerTiming: this.readShapeString(normalizedCapability.shape, 'centerTiming') ?? 'deployment',
        centerSource: this.readShapeString(normalizedCapability.shape, 'centerSource') ?? 'last_price',
        halfRangePct: this.readShapeNumber(normalizedCapability.shape, 'halfRangePct'),
        gridIntervals: this.readShapeNumber(normalizedCapability.shape, 'gridIntervals'),
        gridCount: this.readShapeNumber(normalizedCapability.shape, 'gridCount'),
        absoluteSpacing: this.readShapeNumber(normalizedCapability.shape, 'absoluteSpacing'),
        spacingPct: this.readShapeNumber(normalizedCapability.shape, 'spacingPct'),
        spacingMode: this.readShapeString(normalizedCapability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
      })
    }

    return this.stableProjectionKey({
    mode: 'static_range',
      lower: this.readShapeNumber(normalizedCapability.shape, 'lower'),
      upper: this.readShapeNumber(normalizedCapability.shape, 'upper'),
      gridIntervals: this.readShapeNumber(normalizedCapability.shape, 'gridIntervals'),
      gridCount: this.readShapeNumber(normalizedCapability.shape, 'gridCount'),
      absoluteSpacing: this.readShapeNumber(normalizedCapability.shape, 'absoluteSpacing'),
      spacingPct: this.readShapeNumber(normalizedCapability.shape, 'spacingPct'),
      spacingMode: this.readShapeString(normalizedCapability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
    })
  }

  private projectCanonicalOrderProgramLevelSet(
    capability: SemanticCapability,
  ): CanonicalOrderProgramIntent['levelSet'] | null {
    const normalizedCapability = this.normalizeLevelSetCapability(capability)
    const spacingMode = this.readShapeString(normalizedCapability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic'
    const gridIntervals = this.readShapeNumber(normalizedCapability.shape, 'gridIntervals')
    const gridCount = this.readShapeNumber(normalizedCapability.shape, 'gridCount')
    const absoluteSpacing = this.readShapeNumber(normalizedCapability.shape, 'absoluteSpacing')
    const spacingPct = this.readShapeNumber(normalizedCapability.shape, 'spacingPct')
    const mode = this.readShapeString(normalizedCapability.shape, 'mode')

    if (mode === 'centered_percent_range') {
      const halfRangePct = this.readShapeNumber(normalizedCapability.shape, 'halfRangePct')
      if (halfRangePct === null || halfRangePct <= 0) {
        return null
      }

      return {
        mode: 'centered_percent_range',
        centerTiming: this.readShapeString(normalizedCapability.shape, 'centerTiming') === 'runtime' ? 'runtime' : 'deployment',
        centerSource: this.readShapeString(normalizedCapability.shape, 'centerSource') ?? 'last_price',
        halfRangePct,
        ...(gridIntervals !== null ? { gridIntervals } : {}),
        ...(gridCount !== null ? { gridCount } : {}),
        ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
        ...(spacingPct !== null ? { spacingPct } : {}),
        spacingMode,
      }
    }

    const lower = this.readShapeNumber(normalizedCapability.shape, 'lower')
    const upper = this.readShapeNumber(normalizedCapability.shape, 'upper')
    if (lower === null || upper === null || upper <= lower) {
      return null
    }

    return {
      lower,
      upper,
      ...(gridIntervals !== null ? { gridIntervals } : {}),
      ...(gridCount !== null ? { gridCount } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(spacingPct !== null ? { spacingPct } : {}),
      spacingMode,
    }
  }

  private projectCanonicalOrderProgramBudget(
    capability: SemanticCapability | null,
    state: SemanticState,
  ): CanonicalOrderProgramIntent['budget'] | null {
    if (capability) {
      const budgetValue = this.readShapeNumber(capability.shape, 'value')
      const budgetAsset = this.readShapeString(capability.shape, 'asset')
      if (budgetValue === null || budgetValue <= 0 || !budgetAsset) {
        return null
      }

      return {
        mode: capability.object === 'total_budget' ? 'total_quote' : 'per_order_quote',
        value: budgetValue,
        asset: budgetAsset,
      }
    }

    const sizing = state.position?.sizing
    if (sizing?.kind === 'ratio' && typeof sizing.value === 'number' && Number.isFinite(sizing.value) && sizing.value > 0) {
      return {
        mode: 'per_order_pct_equity',
        value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(8)) : sizing.value,
      }
    }

    if (sizing?.kind === 'quote' && typeof sizing.value === 'number' && Number.isFinite(sizing.value) && sizing.value > 0) {
      return {
        mode: 'per_order_quote',
        value: sizing.value,
        asset: sizing.asset ?? 'USDT',
      }
    }

    return null
  }

  private projectLimitLadderCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      orderType: 'limit',
      timeInForce: 'gtc',
      recycleOnFill: this.readShapeBoolean(capability.shape, 'recycleOnFill') ?? true,
      cancelOnStop: this.readShapeBoolean(capability.shape, 'cancelOnStop') ?? true,
    })
  }

  private projectBudgetCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      object: capability.object,
      value: this.readShapeNumber(capability.shape, 'value'),
      asset: this.readShapeString(capability.shape, 'asset'),
    })
  }

  private projectExposureCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      mode: this.readShapeString(capability.shape, 'mode'),
    })
  }

  private resolveContractOrderProgramMode(
    exposure: SemanticCapability | null,
    state: SemanticState,
  ): CanonicalOrderProgramIntent['mode'] {
    const marketType = this.readLockedContextSlotString(state.contextSlots.marketType)
    if (marketType !== 'perp') {
      return 'spot'
    }
    if (this.hasBothSideGridIntent(state)) {
      return 'perp_neutral'
    }

    const exposureMode = exposure ? this.readShapeString(exposure.shape, 'mode') : null
    if (exposureMode === 'long' || state.position?.positionMode === 'long_only') {
      return 'perp_long'
    }
    if (exposureMode === 'short' || state.position?.positionMode === 'short_only') {
      return 'perp_short'
    }
    return 'perp_neutral'
  }

  private hasBothSideGridIntent(state: SemanticState): boolean {
    const hasBothSideParams = (params: Record<string, unknown> | undefined): boolean =>
      params?.sideMode === 'both'
    for (const constraint of this.readSemanticPositionConstraintFacts(state)) {
      if (constraint.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key && hasBothSideParams(constraint.params)) {
        return true
      }
    }
    for (const rule of state.rules ?? []) {
      const leaves = [
        ...collectAtomLeaves(rule.condition),
        ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
      ]
      if (leaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key && hasBothSideParams(leaf.params))) {
        return true
      }
    }
    return false
  }

  private readShapeNumber(shape: SemanticCapabilityShape, key: string): number | null {
    const value = shape[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readShapeString(shape: SemanticCapabilityShape, key: string): string | null {
    const value = shape[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readTriggerParamTimeframe(params: Record<string, unknown>): string | null {
    const timeframe = params.timeframe
    return typeof timeframe === 'string' && timeframe.trim().length > 0 ? timeframe.trim() : null
  }

  private readSemanticReferencePeriod(params: Record<string, unknown>): number | null {
    const flat = this.readNumberParam(params['reference.period'])
    if (flat !== null) return flat
    const reference = this.readRecordParam(params.reference)
    return this.readNumberParam(reference?.period)
  }

  private readPriceCrossReferencePeriod(trigger: unknown): number | null {
    const evidenceRecord = trigger && typeof trigger === 'object' && !Array.isArray(trigger)
      ? (trigger as { evidence?: unknown }).evidence
      : null
    const evidence = evidenceRecord && typeof evidenceRecord === 'object' && !Array.isArray(evidenceRecord)
      ? (evidenceRecord as { text?: unknown }).text
      : null
    if (typeof evidence !== 'string' || !/价格|price|close/iu.test(evidence)) return null
    const periodMatches = [...evidence.matchAll(/(?:EMA|MA|SMA)\s*(\d{1,4})/giu)]
    if (periodMatches.length !== 1) return null
    const period = Number(periodMatches[0]?.[1])
    return Number.isFinite(period) && period > 0 ? period : null
  }

  private readShapeBoolean(shape: SemanticCapabilityShape, key: string): boolean | null {
    const value = shape[key]
    return typeof value === 'boolean' ? value : null
  }

  private stableProjectionKey(value: Record<string, number | string | boolean | null>): string {
    return JSON.stringify(Object.keys(value)
      .sort()
      .reduce<Record<string, number | string | boolean | null>>((acc, key) => {
        acc[key] = value[key] ?? null
        return acc
      }, {}))
  }

  private resolveSemanticStateMarket(state: SemanticState, fallbackMarket?: unknown): CanonicalStrategySpecV2['market'] {
    const exchange = this.readLockedContextSlotString(state.contextSlots.exchange)?.toLowerCase() ?? null
    const marketType = this.readLockedContextSlotString(state.contextSlots.marketType)?.toLowerCase() ?? null
    const fallback = fallbackMarket && typeof fallbackMarket === 'object' && !Array.isArray(fallbackMarket)
      ? fallbackMarket as Record<string, unknown>
      : {}
    const fallbackExchange = typeof fallback.exchange === 'string' ? fallback.exchange.toLowerCase() : null
    const fallbackMarketType = typeof fallback.marketType === 'string' ? fallback.marketType.toLowerCase() : null
    const fallbackSymbol = typeof fallback.symbol === 'string' && fallback.symbol.trim().length > 0
      ? fallback.symbol.trim()
      : null
    const fallbackTimeframe = typeof fallback.timeframe === 'string' && fallback.timeframe.trim().length > 0
      ? fallback.timeframe.trim()
      : null

    return {
      exchange: this.toCanonicalExchange(exchange) ?? this.toCanonicalExchange(fallbackExchange),
      symbol: this.readLockedContextSlotString(state.contextSlots.symbol) ?? fallbackSymbol,
      marketType: this.toCanonicalMarketType(marketType) ?? this.toCanonicalMarketType(fallbackMarketType),
      defaultTimeframe: this.readLockedContextSlotString(state.contextSlots.timeframe) ?? fallbackTimeframe,
    }
  }

  private toCanonicalExchange(value: string | null): CanonicalStrategySpecV2['market']['exchange'] {
    return value === 'binance' || value === 'okx' || value === 'hyperliquid' ? value : null
  }

  private toCanonicalMarketType(value: string | null): CanonicalStrategySpecV2['market']['marketType'] {
    return value === 'spot' || value === 'perp' ? value : null
  }

  private withRequiredMarketTimeframes(
    market: CanonicalStrategySpecV2['market'],
    requiredTimeframes: readonly string[],
    force = false,
  ): CanonicalStrategySpecV2['market'] {
    const timeframes = requiredTimeframes
      .map(timeframe => timeframe.trim())
      .filter((timeframe, index, list) => timeframe.length > 0 && list.indexOf(timeframe) === index)

    return force || timeframes.length > 1
      ? { ...market, timeframes }
      : market
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
    const semanticActions = this.readSemanticActionFacts(state)
    const semanticTriggers = this.readSemanticTriggerFacts(state)
    const semanticRisks = this.readSemanticRiskFacts(state)
    const semanticPositionConstraints = this.readSemanticPositionConstraintFacts(state)
    const actionKeys = new Set(semanticActions
      .filter(action => action.status === 'locked')
      .map(action => this.normalizeSemanticActionKey(action.key)))
    const counters: Record<'entry' | 'exit' | 'gate', number> = {
      entry: 0,
      exit: 0,
      gate: 0,
    }
    const rules: CanonicalRuleV2[] = []
    const defaultTimeframe = this.readLockedContextSlotString(state.contextSlots.timeframe)
    const directSemanticRuleIds = new Set<string>()
    const gateConditions = semanticTriggers
      .filter(trigger => trigger.status === 'locked' && trigger.phase === 'gate')
      .map((trigger): ScopedSemanticGateCondition | null => {
        const condition = trigger.key === 'condition.expression'
          ? this.buildConditionFromSemanticExpressionTrigger(trigger)
          : this.buildConditionFromSemanticTriggerContract(trigger, defaultTimeframe)
        if (!condition || this.isNoPositionGateCondition(condition) || this.isCompiledGateAtom(condition)) {
          return null
        }

        return {
          sideScope: trigger.sideScope ?? 'both',
          condition,
        }
      })
      .filter((gate): gate is ScopedSemanticGateCondition => gate !== null)

    // Issue #1383 真根因（通用 bug）：grid.range_rebalance 在 ATOM_CONTRACT_REGISTRY 是
    //   positionConstraint 桶（atom-contract-registry.ts:190），不是 trigger 桶。
    //   原实现仅在 condition facts 里找 grid，
    //   永远找不到，导致 dispatcher / builder 完美识别的 grid 参数（rangeLower/Upper/stepPct/sideMode）
    //   在 spec-builder 被丢弃，rebalance 规则数永远 0。
    //   通用解：先扫 position facts 把 grid atom 转 rebalance 规则；
    //   buildGridRulesFromSemanticTrigger 只读 key/params/sideScope，position fact
    //   全部具备，可直接复用。
    for (const constraint of semanticPositionConstraints) {
      if (constraint.status !== 'locked') continue
      if (constraint.key !== ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) continue
      rules.push(...this.buildGridRulesFromSemanticTrigger({
        trigger: constraint as unknown as SemanticTriggerState,
        sizing,
        defaultTimeframe,
        gateConditions,
      }))
    }

    for (const rule of state.rules ?? []) {
      const directRules = this.buildDirectCanonicalRulesFromSemanticRule(rule, sizing, defaultTimeframe)
      if (directRules.length === 0) continue
      directSemanticRuleIds.add(rule.id)
      rules.push(...directRules)
    }

    for (const triggerGroup of this.groupSemanticMultiTimeframeTriggers([...semanticTriggers])) {
      const trigger = triggerGroup[0]
      if (!trigger) {
        continue
      }
      if (trigger._provenance?.ruleId && directSemanticRuleIds.has(trigger._provenance.ruleId)) {
        continue
      }
      if (trigger.status !== 'locked') {
        continue
      }
      if (trigger.phase !== 'entry' && trigger.phase !== 'exit' && trigger.phase !== 'gate') {
        continue
      }
      if (trigger.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
        rules.push(...this.buildGridRulesFromSemanticTrigger({
          trigger,
          sizing,
          defaultTimeframe,
          gateConditions,
        }))
        continue
      }
      if (trigger.phase !== 'gate') {
        continue
      }

      const condition = this.buildConditionFromSemanticTriggerGroup(triggerGroup, defaultTimeframe)
      if (!condition) {
        continue
      }
      if (trigger.phase === 'gate' && !this.isNoPositionGateCondition(condition) && !this.isCompiledGateAtom(condition)) {
        continue
      }

      counters.gate += 1
      rules.push({
        id: `semantic-gate-${counters.gate}`,
        phase: 'gate',
        sideScope: trigger.sideScope ?? 'both',
        priority: this.resolveSemanticRulePriority('gate', counters.gate),
        condition,
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      })
    }

    const executableGroups = this.mergeImplicitMultiTimeframeGroups(
      this.triggerCombinationContracts.resolveExecutableGroups(semanticTriggers.filter(trigger =>
        trigger.status === 'locked'
        && (trigger.phase === 'entry' || trigger.phase === 'exit')
        && trigger.key !== ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key,
      ).filter(trigger =>
        !trigger._provenance?.ruleId || !directSemanticRuleIds.has(trigger._provenance.ruleId),
      )),
    )

    const dcaScheduleHasEvidenceTriggers = this.hasAnyDcaScheduleEvidenceTriggers(executableGroups)

    for (const group of executableGroups) {
      if (group.phase !== 'entry' && group.phase !== 'exit') {
        continue
      }

      const positionPresenceGateTriggers = group.members.filter(trigger => this.isPositionPresenceGateTrigger(trigger))
      const conditionMembers = positionPresenceGateTriggers.length > 0
        ? group.members.filter(trigger => !this.isPositionPresenceGateTrigger(trigger))
        : group.members

      for (const gateTrigger of group.phase === 'entry' ? positionPresenceGateTriggers : []) {
        const gateCondition = this.buildConditionFromSemanticTriggerGroup([gateTrigger], defaultTimeframe)
        if (!gateCondition || !this.isNoPositionGateCondition(gateCondition)) {
          continue
        }
        counters.gate += 1
        rules.push({
          id: `semantic-gate-${counters.gate}`,
          phase: 'gate',
          sideScope: gateTrigger.sideScope ?? group.sideScope,
          priority: this.resolveSemanticRulePriority('gate', counters.gate),
          condition: gateCondition,
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        })
      }

      const condition = this.buildConditionFromSemanticTriggerCombinationGroup(conditionMembers, group.join, defaultTimeframe)
      if (!condition) {
        continue
      }

      const lifecycleAction = this.resolveLifecycleActionForTriggerGroup(
        group,
        [...semanticActions],
        state.position,
        dcaScheduleHasEvidenceTriggers,
      )
      if (!lifecycleAction && !this.isSemanticTriggerGroupActionAllowed(group, actionKeys)) {
        continue
      }
      const actions = lifecycleAction
        ? this.buildActionsForSemanticLifecycleAction(lifecycleAction, sizing)
        : this.buildActionsForSemanticActionKey(group.actionKey, sizing)
      if (actions.length === 0) {
        continue
      }

      if (lifecycleAction) {
        counters[group.phase] += 1
        const metadata = this.buildPositionLifecycleMetadata(lifecycleAction, state.position)
        const sideScope = this.resolveLifecycleActionSideScope(lifecycleAction, group.sideScope)
        rules.push({
          id: `semantic-${group.phase}-${counters[group.phase]}`,
          phase: group.phase,
          sideScope,
          priority: this.resolveSemanticRulePriority(group.phase, counters[group.phase]),
          condition: group.phase === 'entry'
            ? this.normalizeLifecycleEntryCondition(
                this.attachSemanticGateConditions(condition, gateConditions, sideScope),
                lifecycleAction,
              )
            : condition,
          actions,
          ...(metadata ? { metadata } : {}),
        })
        continue
      }

      for (const ruleVariant of this.buildSemanticTriggerGroupActionVariants(group, actions, actionKeys, sizing)) {
        counters[group.phase] += 1
        // #1633 staging s29：non-lifecycle entry rule（OPEN_LONG/OPEN_SHORT）
        //   且仓位 pyramiding_limit 已锁定时，把 maxLayers / layerSizing / 来自
        //   condition.price.percent_change 的 valuePct 投射为 inert pyramidingHint，
        //   让编译脚本文本携带 3% / 50% / take_profit 等数值证据。
        const profitThresholdPct = group.phase === 'entry'
          ? this.extractProfitThresholdFromTriggerGroup(group)
          : null
        const hasOpenAction = ruleVariant.actions.some(a => a.type === 'OPEN_LONG' || a.type === 'OPEN_SHORT')
        const pyramidingHint = (group.phase === 'entry' && hasOpenAction)
          ? this.buildPyramidingHintMetadata(state.position, profitThresholdPct)
          : undefined
        rules.push({
          id: `semantic-${group.phase}-${counters[group.phase]}`,
          phase: group.phase,
          sideScope: ruleVariant.sideScope,
          priority: this.resolveSemanticRulePriority(group.phase, counters[group.phase]),
          condition: group.phase === 'entry'
            ? this.attachSemanticGateConditions(condition, gateConditions, ruleVariant.sideScope)
            : condition,
          actions: ruleVariant.actions,
          ...(pyramidingHint ? { metadata: { pyramidingHint } } : {}),
        })
      }
    }

    rules.push(...this.buildRiskRulesFromSemanticState([...semanticRisks], state.position, [...semanticActions], state.rules ?? []))

    return rules
  }

  private isPositionPresenceGateTrigger(trigger: SemanticTriggerState): boolean {
    return this.isPositionPresenceAtomKey(trigger.key)
  }

  private isPositionPresenceAtomKey(key: string): boolean {
    return key === ATOM_CONTRACT_REGISTRY['position.has_position'].key
      || key === ATOM_CONTRACT_REGISTRY['position.no_position'].key
  }

  private isSemanticTriggerGroupActionAllowed(
    group: SemanticTriggerCombinationGroup,
    actionKeys: Set<string>,
  ): boolean {
    if (actionKeys.has(group.actionKey)) {
      return true
    }

    return group.phase === 'entry'
      && (group.actionKey === 'open_long' || group.actionKey === 'open_short')
      && this.isPureExecutionOnStartGroup(group)
  }

  private isPureExecutionOnStartGroup(group: SemanticTriggerCombinationGroup): boolean {
    return group.members.length === 1
      && group.members[0]?.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key
  }

  private buildSemanticTriggerGroupActionVariants(
    group: SemanticTriggerCombinationGroup,
    actions: CanonicalRuleV2['actions'],
    actionKeys: Set<string>,
    sizing: CanonicalStrategySpecV2['sizing'],
  ): Array<{ sideScope: CanonicalRuleSideScope, actions: CanonicalRuleV2['actions'] }> {
    if (group.sideScope !== 'both' || this.hasExplicitSemanticTriggerGroupActionKey(group)) {
      return [{ sideScope: group.sideScope, actions }]
    }

    if (group.phase === 'entry') {
      const variants: Array<{ sideScope: CanonicalRuleSideScope, actions: CanonicalRuleV2['actions'] }> = []
      const allowDefaultOnStartAction = this.isPureExecutionOnStartGroup(group)
      if (actionKeys.has('open_long') || allowDefaultOnStartAction) {
        const atomKey = actionKeys.has('open_long') ? 'action.open_long' : undefined
        variants.push({ sideScope: 'long', actions: [this.buildOpenAction('OPEN_LONG', sizing, atomKey)] })
      }
      if (actionKeys.has('open_short') || allowDefaultOnStartAction) {
        const atomKey = actionKeys.has('open_short') ? 'action.open_short' : undefined
        variants.push({ sideScope: 'short', actions: [this.buildOpenAction('OPEN_SHORT', sizing, atomKey)] })
      }
      return variants
    }

    if (group.phase === 'exit') {
      const closeActions: CanonicalRuleV2['actions'] = []
      if (actionKeys.has('close_long')) {
        closeActions.push({ type: 'CLOSE_LONG', atomKey: 'action.close_long' })
      }
      if (actionKeys.has('close_short')) {
        closeActions.push({ type: 'CLOSE_SHORT', atomKey: 'action.close_short' })
      }
      return closeActions.length > 0
        ? [{ sideScope: 'both', actions: closeActions }]
        : []
    }

    return [{ sideScope: group.sideScope, actions }]
  }

  private hasExplicitSemanticTriggerGroupActionKey(group: SemanticTriggerCombinationGroup): boolean {
    return group.members.some(trigger =>
      trigger.contracts?.some(contract =>
        contract.params.groupId === group.groupId
        && Object.prototype.hasOwnProperty.call(contract.params, 'actionKey')
        && contract.params.actionKeySource !== 'default',
      ),
    )
  }

  private mergeImplicitMultiTimeframeGroups(
    groups: ReturnType<SemanticTriggerCombinationContractService['resolveExecutableGroups']>,
  ): ReturnType<SemanticTriggerCombinationContractService['resolveExecutableGroups']> {
    const mergedByKey = new Map<string, SemanticTriggerCombinationGroup>()
    const ordered: typeof groups = []

    for (const group of groups) {
      const member = group.members[0]
      const multiTimeframeKey = member && group.groupId.startsWith('implicit:')
        ? this.semanticMultiTimeframeGroupKey(member)
        : null
      const mergeKey = multiTimeframeKey
        ? JSON.stringify([group.phase, group.sideScope, group.actionKey, multiTimeframeKey])
        : null

      if (!mergeKey) {
        ordered.push(this.copySemanticTriggerCombinationGroup(group))
        continue
      }

      const existing = mergedByKey.get(mergeKey)
      if (existing) {
        const merged = {
          ...existing,
          members: [...existing.members, ...group.members],
          rolesByTriggerId: {
            ...existing.rolesByTriggerId,
            ...group.rolesByTriggerId,
          },
        }
        const index = ordered.indexOf(existing)
        if (index >= 0) {
          ordered[index] = merged
        }
        mergedByKey.set(mergeKey, merged)
        continue
      }

      const copy = this.copySemanticTriggerCombinationGroup(group)
      mergedByKey.set(mergeKey, copy)
      ordered.push(copy)
    }

    return ordered
  }

  private copySemanticTriggerCombinationGroup(
    group: SemanticTriggerCombinationGroup,
  ): SemanticTriggerCombinationGroup {
    return {
      ...group,
      members: [...group.members],
      rolesByTriggerId: group.rolesByTriggerId ? { ...group.rolesByTriggerId } : undefined,
    }
  }

  private buildConditionFromSemanticTriggerCombinationGroup(
    triggers: SemanticTriggerState[],
    join: 'AND' | 'OR',
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    const conditions = triggers
      .map(trigger => this.buildConditionFromSemanticTriggerGroup([trigger], defaultTimeframe))
      .filter((condition): condition is CanonicalConditionNode => condition !== null)

    if (conditions.length === 0) {
      return null
    }
    if (conditions.length === 1) {
      return conditions[0] ?? null
    }

    return {
      kind: join,
      predicateForm: 'generic',
      children: conditions,
    }
  }

  private buildActionsForSemanticActionKey(
    actionKey: string,
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2['actions'] {
    switch (this.normalizeSemanticActionKey(actionKey)) {
      case 'open_long':
        return [this.buildOpenAction('OPEN_LONG', sizing, 'action.open_long')]
      case 'open_short':
        return [this.buildOpenAction('OPEN_SHORT', sizing, 'action.open_short')]
      case 'close_long':
        return [{ type: 'CLOSE_LONG', atomKey: 'action.close_long' }]
      case 'close_short':
        return [{ type: 'CLOSE_SHORT', atomKey: 'action.close_short' }]
      default:
        return []
    }
  }

  private normalizeSemanticActionKey(actionKey: string): string {
    switch (actionKey) {
      case 'action.open_long':
        return 'open_long'
      case 'action.open_short':
        return 'open_short'
      case 'action.close_long':
        return 'close_long'
      case 'action.close_short':
        return 'close_short'
      default:
        return actionKey
    }
  }

  private resolveLifecycleActionForTriggerGroup(
    group: SemanticTriggerCombinationGroup,
    actions: SemanticActionState[],
    position: SemanticPositionState | null,
    dcaScheduleHasEvidenceTriggers = true,
  ): SemanticActionState | null {
    const lockedActions = actions.filter(action => action.status === 'locked')
    if (group.phase === 'entry') {
      const explicitAddPosition = lockedActions.find(action => action.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key)
      if (
        explicitAddPosition
        && this.shouldBindAddPositionAction(group, explicitAddPosition, position)
      ) {
        return explicitAddPosition
      }

      const dcaSchedule = this.findActivePositionConstraint(position, 'position.dca_schedule')
      if (dcaSchedule && (this.shouldBindDcaScheduleAction(group) || !dcaScheduleHasEvidenceTriggers)) {
        return {
          id: `${dcaSchedule.id}:action.add_position`,
          key: 'action.add_position',
          status: 'locked',
          source: dcaSchedule.source,
          evidence: dcaSchedule.evidence,
          params: {
            actionSide: 'long',
            lifecycleKind: 'dca_schedule',
            sizing: dcaSchedule.params.perOrderSizing,
          },
          openSlots: [],
          contracts: dcaSchedule.contracts,
          support: dcaSchedule.support,
        }
      }

      return null
    }

    if (group.phase === 'exit') {
      return lockedActions.find(action =>
        action.key === FIELD_KEY.ACTION_REDUCE_POSITION && this.shouldBindReducePositionAction(group, action),
      )
        ?? lockedActions.find(action =>
          action.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key && this.shouldBindReversePositionAction(group, action),
        )
        ?? null
    }

    return null
  }

  private shouldBindAddPositionAction(
    group: SemanticTriggerCombinationGroup,
    action: SemanticActionState,
    position: SemanticPositionState | null,
  ): boolean {
    if (group.actionKey === ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
      return true
    }

    if (this.groupSharesRuleProvenanceWithAction(group, action)) {
      return true
    }

    if (group.members.some(trigger => this.textContainsPositionLifecycleAction(trigger.evidence?.text, /加仓|补仓|scale\s*in/iu))) {
      return true
    }

    return false
  }

  private groupSharesRuleProvenanceWithAction(
    group: SemanticTriggerCombinationGroup,
    action: SemanticActionState,
  ): boolean {
    const actionRuleId = (action as { _provenance?: { ruleId?: unknown } })._provenance?.ruleId
    if (typeof actionRuleId !== 'string' || actionRuleId.length === 0) return false
    return group.members.some((trigger) => {
      const triggerRuleId = (trigger as { _provenance?: { ruleId?: unknown } })._provenance?.ruleId
      return triggerRuleId === actionRuleId
    })
  }

  private hasAnyDcaScheduleEvidenceTriggers(groups: readonly SemanticTriggerCombinationGroup[]): boolean {
    return groups.some(g => g.phase === 'entry' && this.shouldBindDcaScheduleAction(g))
  }

  private shouldBindDcaScheduleAction(group: SemanticTriggerCombinationGroup): boolean {
    if (group.actionKey === ATOM_CONTRACT_REGISTRY['action.add_position'].key || group.actionKey === ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key) {
      return true
    }

    return group.members.some(trigger =>
      this.textContainsPositionLifecycleAction(trigger.evidence?.text, /DCA|定投|补仓|每跌|每下跌|scale\s*in/iu),
    )
  }

  private shouldBindReducePositionAction(
    group: SemanticTriggerCombinationGroup,
    action: SemanticActionState,
  ): boolean {
    if (group.actionKey === FIELD_KEY.ACTION_REDUCE_POSITION) {
      return true
    }

    const actionSide = this.readActionSideScope(action.params) ?? 'long'
    if (group.sideScope !== 'both' && actionSide !== group.sideScope) {
      return false
    }

    return group.members.some(trigger =>
      this.textContainsPositionLifecycleAction(trigger.evidence?.text, /减仓|scale\s*out/iu),
    )
  }

  private shouldBindReversePositionAction(
    group: SemanticTriggerCombinationGroup,
    action: SemanticActionState,
  ): boolean {
    if (group.actionKey === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key) {
      return true
    }

    const fromSide = this.readSideParam(action.params?.fromSide)
    if (fromSide && group.sideScope !== 'both' && group.sideScope !== fromSide) {
      return false
    }

    return group.members.some(trigger =>
      this.textContainsPositionLifecycleAction(trigger.evidence?.text, /反手|reverse\s+position|flip\s+position/iu),
    )
  }

  private textContainsPositionLifecycleAction(text: string | undefined, pattern: RegExp): boolean {
    if (typeof text !== 'string') return false
    const semanticSlotEvidencePrefix = /^semantic\.[\w.]+:/u
    const naturalText = text
      .split('\n')
      .filter(line => !semanticSlotEvidencePrefix.test(line.trim()))
      .join('\n')
    return pattern.test(naturalText)
  }

  private buildActionsForSemanticLifecycleAction(
    action: SemanticActionState,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleV2['actions'] {
    if (action.key === FIELD_KEY.ACTION_REDUCE_POSITION) {
      const sideScope = this.readActionSideScope(action.params) ?? 'long'
      const type = sideScope === 'short' ? 'REDUCE_SHORT' : 'REDUCE_LONG'
      return [{
        type,
        sizing: this.resolveReducePositionSizing(action.params),
        params: { lifecycle: true },
      }]
    }

    if (action.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
      const sideScope = this.readActionSideScope(action.params) ?? 'long'
      return [{
        type: sideScope === 'short' ? 'ADD_SHORT' : 'ADD_LONG',
        sizing: this.resolveSemanticActionSizing(action.params?.sizing) ?? defaultSizing ?? undefined,
        atomKey: 'action.add_position',
      }]
    }

    if (action.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key) {
      const fromSide = this.readSideParam(action.params?.fromSide) ?? 'long'
      const toSide = this.readSideParam(action.params?.toSide) ?? (fromSide === 'long' ? 'short' : 'long')
      const sizingSource = this.readReverseSizingSource(action.params?.sizingSource)
      return [
        { type: fromSide === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT', atomKey: 'action.reverse_position' },
        {
          type: toSide === 'long' ? 'OPEN_LONG' : 'OPEN_SHORT',
          sizing: sizingSource === 'current_position'
            ? { mode: 'RATIO', value: 100 }
            : this.resolveSemanticActionSizing(action.params?.sizing) ?? defaultSizing ?? undefined,
          ...(sizingSource === 'current_position'
            ? { params: { quantityMode: 'position_pct' } }
            : {}),
          atomKey: 'action.reverse_position',
        },
      ]
    }

    return []
  }

  private resolveReducePositionSizing(params: SemanticActionState['params']): NonNullable<CanonicalRuleV2['actions'][number]['sizing']> {
    const basis = typeof params?.reduceBasis === 'string' ? params.reduceBasis : 'ratio'
    const value = typeof params?.reduceValue === 'number' && Number.isFinite(params.reduceValue)
      ? params.reduceValue
      : 0.5

    if (basis === 'quote') {
      return { mode: 'QUOTE', value }
    }
    if (basis === 'qty') {
      return { mode: 'QTY', value }
    }
    return { mode: 'RATIO', value }
  }

  private resolveSemanticActionSizing(value: unknown): CanonicalStrategySpecV2['sizing'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const sizing = value as { kind?: unknown, value?: unknown, asset?: unknown }
    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
      return null
    }
    if (sizing.kind === 'quote') {
      return {
        mode: 'QUOTE',
        value: sizing.value,
        ...(typeof sizing.asset === 'string' ? { asset: sizing.asset } : {}),
      }
    }
    if (sizing.kind === 'base') {
      return {
        mode: 'QTY',
        value: sizing.value,
        ...(typeof sizing.asset === 'string' ? { asset: sizing.asset } : {}),
      }
    }
    return { mode: 'RATIO', value: sizing.value }
  }

  private buildPositionLifecycleMetadata(
    action: SemanticActionState,
    position: SemanticPositionState | null,
  ): CanonicalRuleV2['metadata'] | undefined {
    const metadata: NonNullable<CanonicalRuleV2['metadata']> = {}

    if (action.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key && action.params?.lifecycleKind !== 'dca_schedule') {
      const pyramidingLimit = this.findPositionConstraint(position, 'position.pyramiding_limit')
      const maxExposure = this.findPositionConstraint(position, 'position.max_exposure_pct')
      // critic round 1 A-M2 修复：addMode / addRatio 必须透传至 IR action metadata，
      // 否则 runtime 拿到 ADD_LONG 但分不清 signal_confirm/profit_pct/drawdown_pct 三种 mode 的行为，
      // 导致 silent-equivalent (P2-1 atom 翻牌名义闭环但语义全等价)。
      const addMode = typeof action.params?.addMode === 'string' ? action.params.addMode : undefined
      // 通用回退：addRatio 缺失但 sizing 为 ratio kind 时从 sizing.value 推导，
      // 保持 (0,1] ratio 语义；同时透传 profitThreshold / drawdownThreshold。
      const addRatioRaw = action.params?.addRatio
      const sizingShape = action.params?.sizing as { kind?: unknown, value?: unknown, unit?: unknown } | undefined
      const sizingRatio = sizingShape
        && (sizingShape.kind === 'ratio' || sizingShape.kind === undefined)
        && typeof sizingShape.value === 'number'
        && Number.isFinite(sizingShape.value)
        && sizingShape.value > 0
        ? (sizingShape.unit === 'percent' ? sizingShape.value / 100 : sizingShape.value)
        : undefined
      const addRatio = typeof addRatioRaw === 'number' && Number.isFinite(addRatioRaw)
        ? addRatioRaw
        : sizingRatio
      metadata.addPosition = {
        stateKey: 'pyramiding_layer_count',
        ...this.optionalNumberField('maxLayers', pyramidingLimit?.params.maxLayers),
        ...this.optionalNumberField('maxExposurePct', maxExposure?.params.maxExposurePct ?? maxExposure?.params.valuePct),
        ...(addMode ? { addMode } : {}),
        ...this.optionalNumberField('addRatio', addRatio),
        ...this.optionalNumberField('profitThreshold', action.params?.profitThreshold),
        ...this.optionalNumberField('drawdownThreshold', action.params?.drawdownThreshold),
      }
    }

    if (action.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key) {
      const fromSide = this.readSideParam(action.params?.fromSide) ?? 'long'
      const toSide = this.readSideParam(action.params?.toSide) ?? (fromSide === 'long' ? 'short' : 'long')
      metadata.reversePosition = {
        fromSide,
        toSide,
        sameBarPolicy: this.readSameBarPolicy(action.params?.sameBarPolicy),
        sizingSource: this.readReverseSizingSource(action.params?.sizingSource),
      }
    }

    const dcaSchedule = action.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key && action.params?.lifecycleKind === 'dca_schedule'
      ? this.findActivePositionConstraint(position, 'position.dca_schedule')
      : null
    if (dcaSchedule) {
      const configuredMaxCount = this.readFiniteNumber(dcaSchedule.params.maxCount)
        ?? this.readFiniteNumber(dcaSchedule.params.maxOrders)
      const perOrderBudget = this.readFiniteNumber(dcaSchedule.params.perOrderBudget)
        ?? this.readFiniteNumber((dcaSchedule.params.perOrderSizing as { value?: unknown } | undefined)?.value)
      const maxCount = configuredMaxCount ?? (perOrderBudget !== null ? 1 : null)
      const capitalCap = this.readDcaCapitalCapValue(dcaSchedule.params.capitalCap)
        ?? this.readDcaCapitalCapValue(dcaSchedule.params.maxTotalQuote)
        ?? (maxCount !== null && perOrderBudget !== null ? maxCount * perOrderBudget : null)
      const maxExposure = this.findPositionConstraint(position, 'position.max_exposure_pct')
      const triggerMode = typeof dcaSchedule.params.triggerMode === 'string' ? dcaSchedule.params.triggerMode : undefined
      const priceIntervalPct = this.readFiniteNumber(dcaSchedule.params.priceIntervalPct)
      const priceIntervalQuote = this.readFiniteNumber(dcaSchedule.params.priceIntervalQuote)
      const timeIntervalBars = this.readFiniteNumber(dcaSchedule.params.timeIntervalBars)
      const timeIntervalMs = this.readFiniteNumber(dcaSchedule.params.timeIntervalMs)
      const exitRule = dcaSchedule.params.exitRule && typeof dcaSchedule.params.exitRule === 'object' && !Array.isArray(dcaSchedule.params.exitRule)
        ? dcaSchedule.params.exitRule as Record<string, string>
        : undefined
      if (maxCount !== null && capitalCap !== null) {
        // critic round 1 A-C2 修复：exitRule 缺失时显式塞入 cap_only 哨兵，
        // 避免 runtime `if (exitRule)` 漏判导致无限 DCA。
        // 与 spec "exitRule 必填" 描述对齐（cap_only 表示仅按 capitalCap 兜底退出）。
        const effectiveExitRule = exitRule ?? { type: 'cap_only' }
        metadata.dcaSchedule = {
          maxCount,
          capitalCap,
          ...this.optionalNumberField('maxExposurePct', maxExposure?.params.maxExposurePct ?? maxExposure?.params.valuePct),
          stateKey: 'dca_fired_count',
          ...(triggerMode !== undefined ? { triggerMode } : {}),
          ...this.optionalNumberField('priceIntervalPct', priceIntervalPct),
          ...this.optionalNumberField('priceIntervalQuote', priceIntervalQuote),
          ...this.optionalNumberField('timeIntervalBars', timeIntervalBars),
          ...this.optionalNumberField('timeIntervalMs', timeIntervalMs),
          exitRule: effectiveExitRule,
        }
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined
  }

  private readDcaCapitalCapValue(value: unknown): number | null {
    const direct = this.readFiniteNumber(value)
    if (direct !== null) {
      return direct
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return this.readFiniteNumber((value as { value?: unknown }).value)
  }

  private resolveLifecycleActionSideScope(
    action: SemanticActionState,
    fallback: CanonicalRuleSideScope,
  ): CanonicalRuleSideScope {
    if (action.key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key) {
      return this.readSideParam(action.params?.fromSide) ?? fallback
    }
    return this.readActionSideScope(action.params) ?? fallback
  }

  private findPositionConstraint(
    position: SemanticPositionState | null,
    key: SemanticPositionConstraintState['key'],
  ): SemanticPositionConstraintState | null {
    // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
    return (position as { constraints?: SemanticPositionConstraintState[] } | null)?.constraints?.find(constraint => constraint.status === 'locked' && constraint.key === key) ?? null
  }

  private findActivePositionConstraint(
    position: SemanticPositionState | null,
    key: SemanticPositionConstraintState['key'],
  ): SemanticPositionConstraintState | null {
    // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
    return (position as { constraints?: SemanticPositionConstraintState[] } | null)?.constraints?.find(constraint => constraint.status !== 'superseded' && constraint.key === key) ?? null
  }

  private optionalNumberField<K extends string>(key: K, value: unknown): Record<K, number> | {} {
    const numberValue = this.readFiniteNumber(value)
    return numberValue === null ? {} : { [key]: numberValue } as Record<K, number>
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  /**
   * #1633 staging s29 follow-up：把 `position.pyramiding_limit` 约束参数
   * （maxLayers / layerSizing）与 entry rule 上 `price.percent_change` 叶子的
   * `valuePct`（→ profitThreshold）合成为 inert pyramidingHint metadata。
   *
   * 调用方应仅在 entry 阶段且 rule 含 OPEN_LONG/OPEN_SHORT、且无 metadata.addPosition
   * （= 非 lifecycle add_position 路径）时合成，避免污染 runtime lifecycle 分支。
   *
   * Fail-open：任一字段缺失/非有限数 → 返回 undefined，不影响后续编译。
   */
  private buildPyramidingHintMetadata(
    position: SemanticPositionState | null,
    profitThresholdPct: number | null,
  ): NonNullable<PositionLifecycleActionMetadata['pyramidingHint']> | undefined {
    const constraint = this.findPositionConstraint(position, 'position.pyramiding_limit')
    if (!constraint) return undefined
    const params = constraint.params ?? {}
    const maxLayers = this.readFiniteNumber(params.maxLayers)
    const layerSizingRaw = (params as { layerSizing?: unknown }).layerSizing
    const layerSizingValue = typeof layerSizingRaw === 'number' && Number.isFinite(layerSizingRaw)
      ? layerSizingRaw
      : typeof layerSizingRaw === 'object' && layerSizingRaw !== null
        ? this.readFiniteNumber((layerSizingRaw as { value?: unknown }).value)
        : null
    const profitThreshold = profitThresholdPct !== null && Number.isFinite(profitThresholdPct) && profitThresholdPct > 0
      ? profitThresholdPct
      : null
    if (maxLayers === null && layerSizingValue === null && profitThreshold === null) {
      return undefined
    }
    return {
      ...(maxLayers !== null && maxLayers > 0 ? { maxLayers } : {}),
      ...(layerSizingValue !== null && layerSizingValue > 0 ? { layerSizing: layerSizingValue } : {}),
      ...(profitThreshold !== null ? { profitThreshold } : {}),
    }
  }

  /**
   * 从 SemanticRule.condition 抽取 price.percent_change 叶子 valuePct（仅
   * basis === 'entry_avg_price' 视为盈利触发；其他 basis 不参与 pyramiding 推导）。
   */
  private extractProfitThresholdFromTriggerGroup(
    group: { members: readonly SemanticTriggerState[] },
  ): number | null {
    for (const member of group.members) {
      if (member.key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key) continue
      const basis = (member.params as { basis?: unknown } | undefined)?.basis
      if (basis !== 'entry_avg_price') continue
      const value = this.readFiniteNumber((member.params as { valuePct?: unknown } | undefined)?.valuePct)
      if (value !== null && value > 0) return value
    }
    return null
  }

  private extractProfitThresholdFromSemanticCondition(expr: AtomExpr): number | null {
    if (expr.kind === 'atom') {
      if (expr.key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key) return null
      const params = expr.params as { basis?: unknown, valuePct?: unknown } | undefined
      if (!params || params.basis !== 'entry_avg_price') return null
      return this.readFiniteNumber(params.valuePct)
    }
    if (expr.kind === 'and' || expr.kind === 'or') {
      for (const child of expr.children) {
        const value = this.extractProfitThresholdFromSemanticCondition(child)
        if (value !== null) return value
      }
      return null
    }
    if (expr.kind === 'not') {
      return this.extractProfitThresholdFromSemanticCondition(expr.child)
    }
    if (expr.kind === 'sequence') {
      for (const step of expr.steps) {
        const value = this.extractProfitThresholdFromSemanticCondition(step)
        if (value !== null) return value
      }
      return null
    }
    return null
  }

  private readActionSideScope(params: SemanticActionState['params']): 'long' | 'short' | 'both' | null {
    const sideScope = typeof params?.sideScope === 'string' ? params.sideScope : null
    return sideScope === 'long' || sideScope === 'short' || sideScope === 'both' ? sideScope : null
  }

  private readSideParam(value: unknown): 'long' | 'short' | null {
    return value === 'long' || value === 'short' ? value : null
  }

  private readSameBarPolicy(value: unknown): NonNullable<PositionLifecycleActionMetadata['reversePosition']>['sameBarPolicy'] {
    return value === 'allow' ? 'allow' : 'next_bar_only'
  }

  private readReverseSizingSource(value: unknown): NonNullable<PositionLifecycleActionMetadata['reversePosition']>['sizingSource'] {
    if (value === 'current_position') return 'current_position'
    if (value === 'fixed') return 'fixed'
    return 'position_sizing'
  }

  private groupSemanticMultiTimeframeTriggers(
    triggers: SemanticTriggerState[],
  ): SemanticTriggerState[][] {
    return this.groupMultiTimeframeRuleTriggers(
      triggers,
      trigger => this.semanticMultiTimeframeGroupKey(trigger),
    )
  }

  private buildConditionFromSemanticTriggerGroup(
    triggers: SemanticTriggerState[],
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    const conditions = triggers
      .map(trigger => trigger.key === 'condition.expression'
        ? this.buildConditionFromSemanticExpressionTrigger(trigger)
        : this.buildConditionFromSemanticTriggerContract(trigger, defaultTimeframe))
      .filter((condition): condition is CanonicalConditionNode => condition !== null)

    if (conditions.length === 0) {
      return null
    }
    if (conditions.length === 1) {
      return conditions[0] ?? null
    }

    return {
      kind: 'AND',
      children: conditions,
    }
  }

  private buildDirectCanonicalRulesFromSemanticRule(
    rule: SemanticRule,
    sizing: CanonicalStrategySpecV2['sizing'],
    defaultTimeframe: string | null,
  ): CanonicalRuleV2[] {
    if (rule.phase !== 'entry' && rule.phase !== 'exit') return []
    if (rule.condition.kind === 'atom') return []
    const split = rule.phase === 'entry'
      ? this.splitPositionPresenceGatesFromSemanticRuleCondition(rule.condition)
      : { condition: rule.condition, gateAtoms: [] as AtomExprAtom[] }
    if (!split.condition) return []
    const phase = rule.phase
    const condition = this.buildConditionFromSemanticRuleExpr(split.condition, phase, rule.sideScope, defaultTimeframe)
    if (!condition) return []
    const actions = this.dedupeReversePositionImpliedOpenActions(listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .flatMap(leaf => this.buildCanonicalActionsFromRuleEffectLeaf(leaf, phase, sizing)))
    if (actions.length === 0) return []
    const gateRules = split.gateAtoms
      .map((atom, index): CanonicalRuleV2 | null => {
        const gateCondition = this.buildConditionFromSemanticRuleAtom(atom, 'gate', rule.sideScope, defaultTimeframe)
        if (!gateCondition || !this.isNoPositionGateCondition(gateCondition)) return null
        return {
          id: `semantic-gate-${rule.id}-${index + 1}`,
          phase: 'gate',
          sideScope: rule.sideScope,
          priority: this.resolveSemanticRulePriority('gate', index + 1),
          condition: gateCondition,
          actions: [{ type: 'BLOCK_NEW_ENTRY' }],
        }
      })
      .filter((gateRule): gateRule is CanonicalRuleV2 => gateRule !== null)

    // #1633 staging s29：direct rule path 同样需要把 pyramiding_limit
    //   params + profit leaf valuePct 投射成 inert pyramidingHint，让 OPEN_LONG/SHORT
    //   编译脚本带上 3% / 50% / take_profit 文本证据。
    const hasOpenAction = actions.some(a => a.type === 'OPEN_LONG' || a.type === 'OPEN_SHORT')
    const pyramidingPosition = phase === 'entry' && hasOpenAction
      ? this.buildPyramidingPositionFromSemanticRule(rule)
      : null
    const profitThreshold = phase === 'entry' && hasOpenAction
      ? this.extractProfitThresholdFromSemanticCondition(rule.condition)
      : null
    const pyramidingHint = pyramidingPosition
      ? this.buildPyramidingHintMetadata(pyramidingPosition, profitThreshold)
      : undefined

    return [...gateRules, {
      id: `semantic-${phase}-${rule.id}`,
      phase,
      sideScope: rule.sideScope,
      priority: this.resolveSemanticRulePriority(phase, 1),
      condition,
      actions,
      metadata: {
        normalized: {
          source: 'normalized-intent',
          triggerKeys: collectAtomLeaves(rule.condition).map(leaf => leaf.key),
          actionKeys: actions.map(action => action.type),
          family: 'single-leg',
        },
        ...(pyramidingHint ? { pyramidingHint } : {}),
      },
    }]
  }

  /**
   * 把 SemanticRule.effects.positions[] 中的 `position.pyramiding_limit` atom
   * 提取出来，伪装成 SemanticPositionState 让 buildPyramidingHintMetadata
   * 复用同一查找逻辑。effect leaf 的 status 默认按 'locked' 处理（rule 已合法即生效）。
   */
  private buildPyramidingPositionFromSemanticRule(rule: SemanticRule): SemanticPositionState | null {
    const positionLeaves = listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .filter(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key)
    if (positionLeaves.length === 0) return null
    const constraints = positionLeaves.map((leaf, index) => ({
      id: `${rule.id}-pyramiding-${index}`,
      key: 'position.pyramiding_limit' as const,
      status: 'locked',
      params: (leaf.params ?? {}) as Record<string, unknown>,
      source: 'planner',
      openSlots: [],
    } as unknown as SemanticPositionConstraintState))
    return { constraints } as unknown as SemanticPositionState
  }

  /**
   * #1633 staging30 s29 generic fix：
   * pyramiding semantic 不一定与 OPEN_LONG/OPEN_SHORT 同处于一条 SemanticRule。
   * 例如：rule[0] = 突破开多（无 pyramiding 副作用），rule[1] =
   * has_position → effects.positions[pyramiding_limit{profitThreshold=3,
   * layerSizing=50, maxLayers=3}]。Patch K 旧逻辑只在「同一 rule 同时具备
   * open_action + pyramiding effect + entry_avg_price percent_change」时合成
   * pyramidingHint，故漏掉本场景。
   *
   * 新逻辑：跨 rules 聚合 pyramiding_limit，并直接从其 params 读取
   * profitThreshold；若仍缺则回退到 condition / trigger group 的
   * price.percent_change 抽取。layerSizing / maxLayers 也优先用 params。
   */
  private extractPyramidingHintFromSemanticRules(
    rules: readonly SemanticRule[],
    profitThresholdFallback: number | null,
  ): NonNullable<PositionLifecycleActionMetadata['pyramidingHint']> | undefined {
    for (const rule of rules) {
      const position = this.buildPyramidingPositionFromSemanticRule(rule)
      if (!position) continue
      const constraint = this.findPositionConstraint(position, 'position.pyramiding_limit')
      if (!constraint) continue
      const params = (constraint.params ?? {}) as Record<string, unknown>
      const paramProfit = this.readFiniteNumber((params as { profitThreshold?: unknown }).profitThreshold)
      const profitThresholdPct = paramProfit !== null && paramProfit > 0
        ? paramProfit
        : profitThresholdFallback
      return this.buildPyramidingHintMetadata(position, profitThresholdPct)
    }
    return undefined
  }

  private splitPositionPresenceGatesFromSemanticRuleCondition(
    expr: AtomExpr,
  ): { condition: AtomExpr | null, gateAtoms: AtomExprAtom[] } {
    if (expr.kind === 'atom' && this.isPositionPresenceAtomKey(expr.key)) {
      return { condition: null, gateAtoms: [expr] }
    }
    if (expr.kind !== 'and') {
      return { condition: expr, gateAtoms: [] }
    }

    const gateAtoms: AtomExprAtom[] = []
    const children = expr.children.filter((child) => {
      const isPositionPresence = child.kind === 'atom' && this.isPositionPresenceAtomKey(child.key)
      if (isPositionPresence) gateAtoms.push(child)
      return !isPositionPresence
    })
    if (children.length === expr.children.length) {
      return { condition: expr, gateAtoms: [] }
    }
    if (children.length === 0) {
      return { condition: null, gateAtoms }
    }
    return {
      condition: children.length === 1 ? children[0]! : { kind: 'and', children },
      gateAtoms,
    }
  }

  private buildCanonicalActionsFromRuleEffectLeaf(
    leaf: AtomExprAtom,
    phase: 'entry' | 'exit',
    sizing: CanonicalStrategySpecV2['sizing'],
    sourcePath?: string,
  ): CanonicalRuleV2['actions'] {
    switch (leaf.key) {
      case ATOM_CONTRACT_REGISTRY['action.open_long'].key:
        return phase === 'entry' ? [this.buildOpenAction('OPEN_LONG', sizing, leaf.key)] : []
      case ATOM_CONTRACT_REGISTRY['action.open_short'].key:
        return phase === 'entry' ? [this.buildOpenAction('OPEN_SHORT', sizing, leaf.key)] : []
      case ATOM_CONTRACT_REGISTRY['action.close_long'].key:
        return phase === 'exit' ? [{ type: 'CLOSE_LONG', atomKey: leaf.key }] : []
      case ATOM_CONTRACT_REGISTRY['action.close_short'].key:
        return phase === 'exit' ? [{ type: 'CLOSE_SHORT', atomKey: leaf.key }] : []
      case 'action.reduce_position': {
        if (phase !== 'exit') return []
        const reducePct = this.readFiniteNumber(leaf.params.reducePct) ?? 50
        return [{
          type: leaf.sideScope === 'short' ? 'REDUCE_SHORT' : 'REDUCE_LONG',
          sizing: { mode: 'RATIO', value: reducePct },
          atomKey: leaf.key,
        }]
      }
      case 'action.conditional_order': {
        const fallbackType = phase === 'exit'
          ? (leaf.sideScope === 'short' ? 'CLOSE_SHORT' : 'CLOSE_LONG')
          : (leaf.sideScope === 'short' ? 'OPEN_SHORT' : 'OPEN_LONG')
        return [{ type: fallbackType, atomKey: leaf.key }]
      }
      case 'action.limit_order':
      case 'execution.post_only':
      case 'execution.reduce_only':
      case 'execution.limit_chase':
        return []
      case ATOM_CONTRACT_REGISTRY['action.add_position'].key:
        const addPositionSideScope = this.readActionSideScope(leaf.params) ?? leaf.sideScope ?? (sourcePath ? undefined : 'long')
        if (addPositionSideScope !== 'long' && addPositionSideScope !== 'short') {
          throw new Error(`InvalidSemanticRuleActionEffect: key=${leaf.key} sourcePath=${sourcePath ?? 'unknown'} sideScope=${leaf.sideScope ?? 'unknown'}`)
        }
        return phase === 'entry'
          ? [{
              type: addPositionSideScope === 'short' ? 'ADD_SHORT' : 'ADD_LONG',
              sizing: this.resolveSemanticActionSizing(leaf.params.sizing) ?? sizing ?? undefined,
              atomKey: leaf.key,
            }]
          : []
      case ATOM_CONTRACT_REGISTRY['action.reverse_position'].key:
        if (phase !== 'entry') return []
        const fromSide = this.readSideParam(leaf.params.fromSide) ?? 'long'
        const toSide = this.readSideParam(leaf.params.toSide) ?? (fromSide === 'long' ? 'short' : 'long')
        const sizingSource = this.readReverseSizingSource(leaf.params.sizingSource)
        return [
          { type: fromSide === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT', atomKey: leaf.key },
          {
            type: toSide === 'long' ? 'OPEN_LONG' : 'OPEN_SHORT',
            sizing: sizingSource === 'current_position'
              ? { mode: 'RATIO', value: 100 }
              : this.resolveSemanticActionSizing(leaf.params.sizing) ?? sizing ?? undefined,
            ...(sizingSource === 'current_position'
              ? { params: { quantityMode: 'position_pct' } }
              : {}),
            atomKey: leaf.key,
          },
        ]
      default:
        return []
    }
  }

  private dedupeReversePositionImpliedOpenActions(
    actions: CanonicalRuleV2['actions'],
  ): CanonicalRuleV2['actions'] {
    const reverseOpenTypes = new Set(actions
      .filter(action => action.atomKey === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key)
      .filter(action => action.type === 'OPEN_LONG' || action.type === 'OPEN_SHORT')
      .map(action => action.type))

    if (reverseOpenTypes.size === 0) return actions

    return actions.filter(action => !(
      (action.atomKey === ATOM_CONTRACT_REGISTRY['action.open_long'].key || action.atomKey === ATOM_CONTRACT_REGISTRY['action.open_short'].key)
      && reverseOpenTypes.has(action.type)
    ))
  }

  private isKnownCanonicalActionEffectLeaf(key: string): boolean {
    return key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
      || key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
      || key === ATOM_CONTRACT_REGISTRY['action.close_long'].key
      || key === ATOM_CONTRACT_REGISTRY['action.close_short'].key
      || key === ATOM_CONTRACT_REGISTRY['action.add_position'].key
      || key === ATOM_CONTRACT_REGISTRY['action.reverse_position'].key
      || key === 'action.limit_order'
      || key === 'action.reduce_position'
      || key === 'action.conditional_order'
      || key === 'execution.post_only'
      || key === 'execution.reduce_only'
      || key === 'execution.limit_chase'
  }

  private actionMatchesRuleSideScope(
    actionType: CanonicalRuleV2['actions'][number]['type'],
    sideScope: SemanticRule['sideScope'],
  ): boolean {
    if (sideScope === 'both') return true
    if (sideScope === 'long') {
      return actionType === 'OPEN_LONG' || actionType === 'CLOSE_LONG' || actionType === 'ADD_LONG' || actionType === 'BLOCK_NEW_ENTRY'
    }
    if (sideScope === 'short') {
      return actionType === 'OPEN_SHORT' || actionType === 'CLOSE_SHORT' || actionType === 'ADD_SHORT' || actionType === 'BLOCK_NEW_ENTRY'
    }
    return true
  }

  private buildConditionFromSemanticRuleExpr(
    expr: AtomExpr,
    phase: 'entry' | 'exit',
    sideScope: SemanticRule['sideScope'],
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    if (expr.kind === 'atom') {
      if (expr.key === FIELD_KEY.CONDITION_EXPRESSION && this.isValidSemanticExpression(expr.params.expression)) {
        return this.buildConditionFromSemanticExpression(expr.params.expression)
      }
      return this.buildConditionFromSemanticRuleAtom(expr, phase, sideScope, defaultTimeframe)
    }
    if (expr.kind === 'and' || expr.kind === 'or') {
      const children = expr.children
        .map(child => this.buildConditionFromSemanticRuleExpr(child, phase, sideScope, defaultTimeframe))
        .filter((condition): condition is CanonicalConditionNode => condition !== null)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]
      return { kind: expr.kind === 'and' ? 'AND' : 'OR', children }
    }
    if (expr.kind === 'not') {
      const child = this.buildConditionFromSemanticRuleExpr(expr.child, phase, sideScope, defaultTimeframe)
      return child ? { kind: 'NOT', children: [child] } : null
    }
    if (expr.kind === 'sequence') {
      const children = expr.steps
        .map(step => this.buildConditionFromSemanticRuleExpr(step, phase, sideScope, defaultTimeframe))
        .filter((condition): condition is CanonicalConditionNode => condition !== null)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]
      return { kind: 'AND', predicateForm: 'generic', children }
    }
    return null
  }

  private buildConditionFromSemanticRuleAtom(
    atom: AtomExprAtom,
    phase: 'entry' | 'exit' | 'gate',
    sideScope: SemanticRule['sideScope'],
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    // rules-only 主数据流：planner 常把「不限制开仓时间」误产出为 strategy.time_window
    //   { windows: "all" } 注入 entry/exit condition。该窗口语义恒真，且 strategy.time_window
    //   是 structural gate atom，IR condition 层无对应 emit，会落到 dispatcher default
    //   抛 codegen.canonical_spec_v2_condition_unsupported:strategy.time_window，整条策略被
    //   REJECTED、无法发布回测。no-op 窗口直接 drop，由上层 buildConditionFromSemanticRuleExpr
    //   的 null-filter 自动从 AND/OR/sequence 中剔除；有实义的时间窗仍按原路径处理（不静默降级）。
    if (this.isNoOpTimeWindowRuleAtom(atom)) {
      return null
    }
    return this.buildConditionFromSemanticTriggerContract({
      id: `rules-tree-${atom.key}`,
      key: atom.key,
      phase,
      sideScope,
      params: atom.params ?? {},
      status: 'locked',
      source: 'user_explicit',
      ...(atom.evidence?.text ? { evidence: { text: atom.evidence.text, source: 'user_explicit' as const } } : {}),
      openSlots: [],
    } as SemanticTriggerState, defaultTimeframe)
  }

  private attachSemanticGateConditions(
    condition: CanonicalConditionNode,
    gateConditions: ScopedSemanticGateCondition[],
    sideScope: CanonicalRuleSideScope,
  ): CanonicalConditionNode {
    const matchingGateConditions = gateConditions
      .filter(gate => gate.sideScope === 'both' || gate.sideScope === sideScope)
      .map(gate => gate.condition)

    if (matchingGateConditions.length === 0) {
      return condition
    }

    return {
      kind: 'AND',
      ...(this.hasGenericPredicateForm([condition, ...matchingGateConditions]) ? { predicateForm: 'generic' as const } : {}),
      children: [condition, ...matchingGateConditions],
    }
  }

  private normalizeLifecycleEntryCondition(
    condition: CanonicalConditionNode,
    action: SemanticActionState,
  ): CanonicalConditionNode {
    if (action.key !== ATOM_CONTRACT_REGISTRY['action.add_position'].key || action.params?.lifecycleKind !== 'dca_schedule') {
      return condition
    }
    if (condition.kind === 'atom' && condition.key === ATOM_CONTRACT_REGISTRY['strategy.time_window'].key) {
      return {
        kind: 'atom',
        key: 'execution.on_start',
        semanticScope: 'market',
      }
    }
    if (
      condition.kind === 'AND'
      && condition.children.every(child =>
        child.kind === 'atom'
        && (
          child.key === ATOM_CONTRACT_REGISTRY['strategy.time_window'].key
          || child.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key
        ),
      )
    ) {
      return {
        kind: 'atom',
        key: 'execution.on_start',
        semanticScope: 'market',
      }
    }
    return condition
  }

  private hasGenericPredicateForm(conditions: CanonicalConditionNode[]): boolean {
    return conditions.some(condition => this.isGenericPredicateCondition(condition))
  }

  private isGenericPredicateCondition(condition: CanonicalConditionNode): boolean {
    if (condition.kind === 'atom') {
      return condition.predicateForm === 'generic'
    }
    if (condition.kind === 'expression') {
      return false
    }

    return condition.predicateForm === 'generic'
      || condition.children.some(child => this.isGenericPredicateCondition(child))
  }

  private isNoPositionGateCondition(condition: CanonicalConditionNode): boolean {
    return condition.kind === 'atom'
      && (condition.key === ATOM_CONTRACT_REGISTRY['position.has_position'].key || condition.key === ATOM_CONTRACT_REGISTRY['position.no_position'].key)
      && condition.op === 'EQ'
      && condition.value === false
  }

  private isCompiledGateAtom(condition: CanonicalConditionNode): boolean {
    return condition.kind === 'atom'
      && (condition.key === ATOM_CONTRACT_REGISTRY['volume.threshold'].key
        || condition.key === ATOM_CONTRACT_REGISTRY['volatility.atr_threshold'].key
        || condition.key === ATOM_CONTRACT_REGISTRY['strategy.time_window'].key)
  }

  /**
   * no-op time_window：windows 全为「不限制」语义（或缺省）→ 恒真，无过滤作用。
   * 与 registry negativeExample「不限制开仓时间」对齐。仅判定 no-op；有实义窗口返回 false。
   */
  private isNoOpTimeWindowRuleAtom(atom: AtomExprAtom): boolean {
    if (atom.key !== ATOM_CONTRACT_REGISTRY['strategy.time_window'].key) return false
    const windowsParam = atom.params?.windows
    const windows = Array.isArray(windowsParam)
      ? windowsParam
      : (typeof windowsParam === 'string' && windowsParam.trim().length > 0 ? [windowsParam.trim()] : [])
    // every([]) === true：缺省 windows 等同「不限制」
    return windows.every(window => this.isUnrestrictedTimeWindowValue(window))
  }

  private isUnrestrictedTimeWindowValue(value: unknown): boolean {
    if (typeof value !== 'string') return false
    const normalized = value.trim().toLowerCase()
    return normalized === ''
      || normalized === 'all'
      || normalized === 'any'
      || normalized === 'always'
      || normalized === 'anytime'
      || normalized === '24/7'
      || normalized === '24x7'
      || normalized === '24h'
      || normalized === 'none'
      || normalized === 'unrestricted'
      || normalized === '不限'
      || normalized === '不限制'
      || normalized === '全天'
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
    if (trigger.key === 'price.previous_extrema_retest') {
      return this.buildPreviousExtremaRetestCondition(trigger, defaultTimeframe)
    }
    return this.buildConditionFromNormalizedTrigger({
      key: trigger.key as NormalizedTriggerAtom['key'],
      phase: trigger.phase,
      sideScope: trigger.sideScope,
      params: trigger.params as Record<string, string | number | boolean>,
      closureStatus: 'closed',
      unresolvedSlots: [],
    }, defaultTimeframe)
  }

  private buildPreviousExtremaRetestCondition(
    trigger: SemanticTriggerState,
    defaultTimeframe: string | null,
  ): CanonicalConditionNode {
    const retestKind = this.readStringParam(trigger.params.retestKind)
    const extremaType = this.readStringParam(trigger.params.extremaType) ?? 'high'
    return {
      kind: 'atom',
      key: 'price.previous_extrema_retest',
      semanticScope: 'market',
      predicateForm: 'generic',
      op: retestKind === 'break_through'
        ? (extremaType === 'low' ? 'LT' : 'GT')
        : (extremaType === 'low' ? 'GTE' : 'LTE'),
      params: {
        lookbackBars: typeof trigger.params.lookbackBars === 'number'
          ? trigger.params.lookbackBars
          : typeof trigger.params.period === 'number'
            ? trigger.params.period
            : 24,
        ...(typeof trigger.params.maxBars === 'number' ? { maxBars: trigger.params.maxBars } : {}),
        ...(typeof trigger.params.tolerancePct === 'number' ? { tolerancePct: trigger.params.tolerancePct } : {}),
        ...(typeof trigger.params.memoryKey === 'string' ? { memoryKey: trigger.params.memoryKey } : {}),
        ...(retestKind ? { retestKind } : {}),
        ...(extremaType ? { extremaType } : {}),
        ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
      },
    }
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
      if ((sideScope === 'long' || sideScope === 'both') && (actionKeys.has('open_long') || trigger.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key)) {
        const atomKey = actionKeys.has('open_long') ? 'action.open_long' : undefined
        actions.push(this.buildOpenAction('OPEN_LONG', sizing, atomKey))
      }
      if ((sideScope === 'short' || sideScope === 'both') && (actionKeys.has('open_short') || trigger.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key)) {
        const atomKey = actionKeys.has('open_short') ? 'action.open_short' : undefined
        actions.push(this.buildOpenAction('OPEN_SHORT', sizing, atomKey))
      }
    }

    if (trigger.phase === 'exit') {
      if ((sideScope === 'long' || sideScope === 'both') && actionKeys.has('close_long')) {
        actions.push({ type: 'CLOSE_LONG', atomKey: 'action.close_long' })
      }
      if ((sideScope === 'short' || sideScope === 'both') && actionKeys.has('close_short')) {
        actions.push({ type: 'CLOSE_SHORT', atomKey: 'action.close_short' })
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
    actions: SemanticActionState[] = [],
    semanticRules: readonly SemanticRule[] = [],
  ): CanonicalRuleV2[] {
    const normalizedRisks = normalizeRiskSemantics(risks)
    const defaultSideScope = this.resolveSemanticRiskSideScope(position)
    const reduceAction = actions.find(action => action.status === 'locked' && action.key === FIELD_KEY.ACTION_REDUCE_POSITION) ?? null
    const rules: CanonicalRuleV2[] = []
    let priority = 120

    for (const risk of normalizedRisks) {
      if (risk.status !== 'locked') {
        continue
      }
      const sideScope = this.resolveSemanticRiskRuleSideScope(risk, semanticRules, defaultSideScope)
      if (
        risk.key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP
        || risk.key === FIELD_KEY.RISK_ATR_MULTIPLE_TAKE_PROFIT
        || risk.key === FIELD_KEY.RISK_REMEMBERED_LEVEL_STOP
      ) {
        const riskRule = this.buildAtomicContractRiskRule(risk, sideScope, priority--)
        if (riskRule) {
          rules.push(riskRule)
        }
        continue
      }
      if (risk.key === FIELD_KEY.RISK_ATR_STOP) {
        // Issue #1383 Round 1 M3：参数提取抽 extractAtrStopParams，与
        //   canonical-spec-v2-ir-compiler.service.ts 复用相同规则避免双源漂移。
        const atrParams = extractAtrStopParams(risk.params)
        if (atrParams === null) continue
        rules.push({
          id: `semantic-${risk.id || 'risk-atr-stop'}`,
          phase: 'risk',
          sideScope,
          priority: priority--,
          condition: {
            kind: 'atom',
            key: 'risk.atr_stop',
            semanticScope: 'position',
            params: atrParams,
          },
          actions: [{ type: 'FORCE_EXIT' }],
          metadata: {
            semanticKey: risk.key,
          },
        })
        continue
      }
      if (risk.key === FIELD_KEY.RISK_ATR_TAKE_PROFIT) {
        const multiple = typeof risk.params.multiple === 'number' && Number.isFinite(risk.params.multiple)
          ? risk.params.multiple
          : typeof risk.params.multiplier === 'number' && Number.isFinite(risk.params.multiplier)
            ? risk.params.multiplier
            : null
        if (multiple === null || multiple <= 0) continue
        const period = typeof risk.params.period === 'number' && Number.isInteger(risk.params.period) && risk.params.period > 0
          ? risk.params.period
          : 14
        rules.push({
          id: `semantic-${risk.id || 'risk-atr-take-profit'}`,
          phase: 'risk',
          sideScope,
          priority: priority--,
          condition: {
            kind: 'atom',
            key: 'risk.atr_take_profit',
            semanticScope: 'position',
            params: { period, multiple },
          },
          actions: [{ type: 'FORCE_EXIT' }],
          metadata: {
            semanticKey: risk.key,
          },
        })
        continue
      }
      if (risk.key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key) {
        const ptpRules = this.buildPartialTakeProfitRules(risk, sideScope === 'flat' ? 'both' : sideScope, priority)
        if (ptpRules.length > 0) {
          rules.push(...ptpRules)
          priority -= ptpRules.length
        }
        continue
      }
      if (!validateSemanticRiskContract(risk).ok) {
        continue
      }
      if (risk.key === FIELD_KEY.RISK_CONDITION_EXPRESSION) {
        if (risk.params.capabilityStatus !== 'supported') {
          continue
        }
        const condition = this.isValidSemanticExpression(risk.params.condition)
          ? this.buildConditionFromSemanticExpression(risk.params.condition)
          : null
        const riskSideScope = this.resolveSemanticRiskExpressionSideScope(risk, position)
        const actions = this.buildActionsForSemanticRiskExpression(risk, riskSideScope)
        if (!condition || actions.length === 0) {
          continue
        }

        rules.push({
          id: `semantic-${risk.id || `risk-expression-${priority}`}`,
          phase: 'risk',
          sideScope: riskSideScope,
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
      if (risk.key !== FIELD_KEY.RISK_STOP_LOSS_PCT && risk.key !== FIELD_KEY.RISK_TAKE_PROFIT_PCT) {
        continue
      }

      const valuePct = typeof risk.params.valuePct === 'number' ? risk.params.valuePct : null
      if (valuePct === null || !Number.isFinite(valuePct)) {
        continue
      }
      const riskRule = this.buildPercentRiskCanonicalRule({
        id: risk.key === FIELD_KEY.RISK_STOP_LOSS_PCT ? 'semantic-risk-stop-loss' : 'semantic-risk-take-profit',
        sideScope,
        priority: priority--,
        riskKey: risk.key,
        valuePct,
        basis: risk.params.basis,
        actions: risk.key === FIELD_KEY.RISK_TAKE_PROFIT_PCT && reduceAction
          ? this.buildActionsForSemanticLifecycleAction(reduceAction, null)
          : [{ type: 'FORCE_EXIT' }],
      })
      if (riskRule) {
        rules.push(riskRule)
      }
    }

    return rules
  }

  private resolveSemanticRiskRuleSideScope(
    risk: SemanticRiskState,
    semanticRules: readonly SemanticRule[],
    fallback: CanonicalRuleV2['sideScope'],
  ): CanonicalRuleV2['sideScope'] {
    const ruleId = (risk as { _provenance?: { ruleId?: unknown } })._provenance?.ruleId
    if (typeof ruleId !== 'string') return fallback
    const sourceRule = semanticRules.find(rule => rule.id === ruleId)
    return sourceRule?.sideScope ?? fallback
  }

  private buildAtomicContractRiskRule(
    risk: SemanticRiskState,
    sideScope: CanonicalRuleV2['sideScope'],
    priority: number,
  ): CanonicalRuleV2 | null {
    if (risk.key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP || risk.key === FIELD_KEY.RISK_ATR_MULTIPLE_TAKE_PROFIT) {
      const multiple = this.readFiniteNumber(risk.params.multiple)
        ?? this.readFiniteNumber(risk.params.multiplier)
        ?? this.readFiniteNumber(risk.params.atrMultiple)
      if (multiple === null) {
        return null
      }
      return {
        id: `semantic-${risk.id}`,
        phase: 'risk',
        sideScope,
        priority,
        condition: {
          kind: 'atom',
          key: risk.key,
          semanticScope: 'position',
          params: { multiple },
        },
        actions: risk.key === FIELD_KEY.RISK_ATR_MULTIPLE_STOP
          ? [{ type: 'FORCE_EXIT' }]
          : this.buildAtrTakeProfitActions(sideScope),
        metadata: {
          semanticKey: risk.key,
        },
      }
    }

    const levelKey = this.readFirstStringParam(risk.params, ['levelKey', 'memoryKey', 'rememberedLevelKey', 'referenceLevelKey'])
    if (!levelKey) {
      return null
    }

    return {
      id: `semantic-${risk.id}`,
      phase: 'risk',
      sideScope,
      priority,
      condition: {
        kind: 'atom',
        key: 'risk.remembered_level_stop',
        semanticScope: 'position',
        params: { levelKey },
      },
      actions: [{ type: 'FORCE_EXIT' }],
      metadata: {
        semanticKey: risk.key,
      },
    }
  }

  private buildPartialTakeProfitRules(
    risk: SemanticRiskState,
    fallbackSideScope: 'long' | 'short' | 'both',
    startPriority: number,
  ): CanonicalRuleV2[] {
    const explicitMemoryKey = typeof risk.params.memoryKey === 'string' && risk.params.memoryKey.trim().length > 0
      ? risk.params.memoryKey.trim()
      : null
    const memoryKey = explicitMemoryKey ?? `ptp-${this.stableRulesPathId(risk.id)}`
    const rawTiers = Array.isArray(risk.params.tiers) ? risk.params.tiers : this.derivePartialTakeProfitTiersFromFlatParams(risk.params, risk.evidence?.text)
    if (!memoryKey || !rawTiers || rawTiers.length === 0) {
      // TODO(#984): when tiers/memoryKey are missing surface an open_slot
      // (risk.partial_take_profit.tiers / .memoryKey) instead of silently
      // dropping the rule. Builder context here only emits CanonicalRuleV2[];
      // openSlot routing must thread through the buildFromSemanticState pass.
      return []
    }

    const parsedTiers: Array<{ threshold: number; reduceRatio: number }> = []
    for (const raw of rawTiers) {
      if (!raw || typeof raw !== 'object') {
        // TODO(#984): see open_slot note above — silent drop on malformed tier.
        return []
      }
      const tier = raw as { trigger?: { kind?: unknown; threshold?: unknown }; reduceRatio?: unknown }
      const threshold = typeof tier.trigger?.threshold === 'number' && Number.isFinite(tier.trigger.threshold)
        ? tier.trigger.threshold
        : null
      const reduceRatio = typeof tier.reduceRatio === 'number' && Number.isFinite(tier.reduceRatio)
        ? tier.reduceRatio
        : null
      if (threshold === null || reduceRatio === null || reduceRatio <= 0 || reduceRatio > 1) {
        // TODO(#984): see open_slot note above.
        return []
      }
      parsedTiers.push({ threshold, reduceRatio })
    }

    const sideScope: 'long' | 'short' | 'both' = risk.params.sideScope === 'long'
      || risk.params.sideScope === 'short'
      || risk.params.sideScope === 'both'
      ? risk.params.sideScope
      : fallbackSideScope
    const totalTiers = parsedTiers.length
    const derived = this.deriveCumulativeReduceRatios(parsedTiers.map(tier => tier.reduceRatio))

    const rules: CanonicalRuleV2[] = []
    let cumulativeReduceRatio = 0
    for (let i = 0; i < parsedTiers.length; i += 1) {
      const ratio = derived[i]
      if (ratio <= 0) {
        continue
      }
      cumulativeReduceRatio = Number(Math.min(1, cumulativeReduceRatio + parsedTiers[i].reduceRatio).toFixed(6))
      const sizing = { mode: 'RATIO' as const, value: ratio }
      const actions: CanonicalRuleV2['actions'] = []
      if (sideScope === 'long' || sideScope === 'both') {
        actions.push({ type: 'REDUCE_LONG', sizing })
      }
      if (sideScope === 'short' || sideScope === 'both') {
        actions.push({ type: 'REDUCE_SHORT', sizing })
      }
      if (actions.length === 0) {
        continue
      }

      rules.push({
        id: `semantic-risk-ptp-${memoryKey}-tier-${i}`,
        phase: 'risk',
        sideScope,
        priority: startPriority - i,
        condition: {
          kind: 'atom',
          key: 'risk.partial_take_profit',
          semanticScope: 'position',
          op: 'GTE',
          value: parsedTiers[i].threshold,
          params: {
            tierIndex: i,
            totalTiers,
            memoryKey,
            basis: 'pnl_pct',
          },
        },
        actions,
        metadata: {
          partialTakeProfit: {
            memoryKey,
            tierIndex: i,
            totalTiers,
            cumulativeReduceRatio,
          },
        },
      })
    }
    return rules
  }

  private derivePartialTakeProfitTiersFromFlatParams(params: SemanticRiskState['params'], evidenceText?: string): Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> | null {
    const threshold = this.readFiniteNumber(params.profitPct)
      ?? this.readFiniteNumber(params.pct)
      ?? this.readFiniteNumber(params.valuePct)
    if (threshold === null || threshold <= 0) {
      return null
    }

    const evidenceRatio = this.extractPartialTakeProfitReduceRatioFromEvidence(evidenceText)
    const rawRatio = evidenceRatio
      ?? this.readFiniteNumber(params.reduceRatio)
      ?? this.readFiniteNumber(params.ratio)
      ?? this.readFiniteNumber(params.sizePct)
    const reduceRatio = rawRatio === null
      ? 0.5
      : rawRatio > 1
        ? rawRatio / 100
        : rawRatio

    if (!Number.isFinite(reduceRatio) || reduceRatio <= 0 || reduceRatio > 1) {
      return null
    }

    return [{ trigger: { kind: 'pnl_pct', threshold }, reduceRatio }]
  }

  private extractPartialTakeProfitReduceRatioFromEvidence(evidenceText?: string): number | null {
    if (!evidenceText) return null
    if (/(?:[平减卖]|reduce|close)[^，。,.；;]{0,8}(?:一半|半仓|half)/iu.test(evidenceText)
      || /(?:一半|半仓|half)[^，。,.；;]{0,8}(?:[平减卖]|reduce|close)/iu.test(evidenceText)) {
      return 0.5
    }
    return null
  }

  private ruleHasPartialTakeProfitAtThreshold(
    riskLeaves: readonly RulesMainflowLeaf[],
    ruleId: string,
    takeProfitLeaf: RulesMainflowLeaf,
  ): boolean {
    const takeProfitThreshold = this.readFiniteNumber(takeProfitLeaf.params.valuePct)
      ?? this.readFiniteNumber(takeProfitLeaf.params.pct)
    if (takeProfitThreshold === null) return false
    return riskLeaves.some(leaf => leaf.ruleId === ruleId
      && leaf.key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key
      && this.partialTakeProfitThresholds(leaf.params).includes(takeProfitThreshold))
  }

  private partialTakeProfitThresholds(params: Record<string, unknown>): number[] {
    if (Array.isArray(params.tiers)) {
      return params.tiers.flatMap((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
        const threshold = this.readFiniteNumber((raw as { trigger?: { threshold?: unknown } }).trigger?.threshold)
        return threshold === null ? [] : [threshold]
      })
    }
    const threshold = this.readFiniteNumber(params.profitPct)
      ?? this.readFiniteNumber(params.pct)
      ?? this.readFiniteNumber(params.valuePct)
    return threshold === null ? [] : [threshold]
  }

  private deriveCumulativeReduceRatios(originalRatios: number[]): number[] {
    const result: number[] = []
    let consumed = 0
    for (const ratio of originalRatios) {
      const remaining = 1 - consumed
      if (remaining <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
        result.push(0)
        continue
      }
      const derived = Math.min(1, ratio / remaining)
      result.push(Number(derived.toFixed(6)))
      // Accumulate based on derived expansion to keep `remaining` accurate
      // under floating-point inputs (e.g. [0.333, 0.333, 0.334]). When derived
      // is clamped to 1, the original ratio overshoots — consume only the
      // actual remaining instead.
      const consumedNow = derived >= 1 ? remaining : ratio
      consumed += consumedNow
    }
    return result
  }

  private buildAtrTakeProfitActions(
    sideScope: CanonicalRuleV2['sideScope'],
  ): CanonicalRuleV2['actions'] {
    if (sideScope === 'short') {
      return [{ type: 'CLOSE_SHORT' }]
    }
    if (sideScope === 'both') {
      return [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }]
    }
    return [{ type: 'CLOSE_LONG' }]
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

  private buildPercentRiskCanonicalRule(input: {
    id: string
    sideScope: CanonicalRuleV2['sideScope']
    priority: number
    riskKey: 'risk.stop_loss_pct' | 'risk.take_profit_pct'
    valuePct: number
    basis: unknown
    actions: CanonicalRuleV2['actions']
    metadata?: CanonicalRuleV2['metadata']
  }): CanonicalRuleV2 | null {
    const basis = typeof input.basis === 'string' ? input.basis : undefined
    if (this.isExecutablePercentRiskBasis(basis)) {
      return {
        id: input.id,
        phase: 'risk',
        sideScope: input.sideScope,
        priority: input.priority,
        condition: {
          kind: 'atom',
          key: input.riskKey === FIELD_KEY.RISK_STOP_LOSS_PCT ? CANONICAL_RULE_KEYS.positionLossPct : input.riskKey,
          semanticScope: 'position',
          op: 'GTE',
          value: Number((input.valuePct / 100).toFixed(4)),
          ...(basis ? { params: { basis } } : {}),
        },
        actions: input.actions,
        ...(basis || input.metadata ? { metadata: { ...input.metadata, ...(basis ? { basis } : {}) } } : {}),
      }
    }

    if (basis !== 'position_pnl') {
      return null
    }

    return {
      id: input.id,
      phase: 'risk',
      sideScope: input.sideScope,
      priority: input.priority,
      condition: {
        kind: 'expression',
        op: input.riskKey === FIELD_KEY.RISK_STOP_LOSS_PCT ? 'LTE' : 'GTE',
        left: { kind: 'position', field: 'pnl_pct' },
        right: {
          kind: 'constant',
          value: input.riskKey === FIELD_KEY.RISK_STOP_LOSS_PCT ? -input.valuePct : input.valuePct,
          unit: 'percent',
        },
      },
      actions: input.actions,
      metadata: {
        ...input.metadata,
        basis,
        semanticKey: input.riskKey,
      },
    }
  }

  private isExecutablePercentRiskBasis(rawBasis: unknown): boolean {
    return rawBasis === undefined || rawBasis === 'entry_avg_price'
  }

  private resolveSemanticRiskExpressionSideScope(
    risk: SemanticRiskState,
    position: SemanticPositionState | null,
  ): 'long' | 'short' | 'both' {
    if (risk.params.scope === 'long') {
      return 'long'
    }
    if (risk.params.scope === 'short') {
      return 'short'
    }

    return this.resolveSemanticRiskSideScope(position)
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
        params: { compatibilityFamilyHint: 'breakout' },
      })
    }

    if (allTexts.some(text => /网格/u.test(text))) {
      pushIndicator({
        kind: 'custom',
        params: { compatibilityFamilyHint: 'grid' },
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
    atomKey?: string,
  ): CanonicalRuleV2['actions'][number] {
    if (!sizing) {
      return atomKey ? { type, atomKey } : { type }
    }

    return atomKey ? { type, sizing, atomKey } : { type, sizing }
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
      const timeframe = this.readTriggerParamTimeframe(trigger.params)
      if (timeframe) {
        ordered.add(timeframe)
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
        case ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key:
        case ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key:
        case ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key:
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
        case ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key: {
          const indicator = this.readIndicatorBoundaryIndicator(trigger.params)
          if (indicator?.name === 'bollinger') {
            pushIndicator({
              kind: 'bollingerBands',
              params: {
                period: typeof indicator.period === 'number' && Number.isFinite(indicator.period)
                  ? indicator.period
                  : DEFAULT_INDICATOR_PARAMS.bollingerBands.period,
                stdDev: typeof indicator.stdDev === 'number' && Number.isFinite(indicator.stdDev)
                  ? indicator.stdDev
                  : DEFAULT_INDICATOR_PARAMS.bollingerBands.stdDev,
              },
            })
          }
          break
        }
        case ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key:
        case ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key:
          pushIndicator({
            kind: 'rsi',
            params: {
              period: typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
                ? trigger.params.period
                : DEFAULT_INDICATOR_PARAMS.rsi.period,
            },
          })
          break
        case ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key:
        case ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key:
        case ATOM_CONTRACT_REGISTRY['indicator.above'].key:
        case ATOM_CONTRACT_REGISTRY['indicator.below'].key: {
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
        case ATOM_CONTRACT_REGISTRY['volatility.state'].key:
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
        params: { compatibilityFamilyHint: 'grid' },
      })
    }

    if (normalizedIntent.triggers.some(trigger => trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key || trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_down'].key)) {
      pushIndicator({
        kind: 'custom',
        params: { compatibilityFamilyHint: 'breakout' },
      })
    }

    if (normalizedIntent.triggers.some(trigger => trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key || trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key)) {
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

    const phaseTriggers = input.normalizedIntent.triggers
      .filter((trigger): trigger is NormalizedTriggerAtom & { phase: 'entry' | 'exit' } =>
        trigger.phase === 'entry' || trigger.phase === 'exit')

    for (const triggerGroup of this.groupNormalizedMultiTimeframeTriggers(phaseTriggers)) {
      const phaseTrigger = triggerGroup[0]
      if (!phaseTrigger) {
        continue
      }
      const rule = this.buildRuleFromNormalizedTriggerGroup({
        triggers: triggerGroup,
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

  private groupNormalizedMultiTimeframeTriggers(
    triggers: Array<NormalizedTriggerAtom & { phase: 'entry' | 'exit' }>,
  ): Array<Array<NormalizedTriggerAtom & { phase: 'entry' | 'exit' }>> {
    return this.groupMultiTimeframeRuleTriggers(
      triggers,
      trigger => this.normalizedMultiTimeframeGroupKey(trigger),
    )
  }

  private groupMultiTimeframeRuleTriggers<T>(
    triggers: T[],
    readGroupKey: (trigger: T) => string | null,
  ): T[][] {
    const groups = new Map<string, T[]>()
    const ordered: T[][] = []

    for (const trigger of triggers) {
      const groupKey = readGroupKey(trigger)
      if (!groupKey) {
        ordered.push([trigger])
        continue
      }

      const group = groups.get(groupKey)
      if (group) {
        group.push(trigger)
      }
      else {
        const nextGroup = [trigger]
        groups.set(groupKey, nextGroup)
        ordered.push(nextGroup)
      }
    }

    return ordered
  }

  private normalizedMultiTimeframeGroupKey(
    trigger: NormalizedTriggerAtom & { phase: 'entry' | 'exit' },
  ): string | null {
    return this.multiTimeframeGroupKey({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      params: trigger.params,
    })
  }

  private semanticMultiTimeframeGroupKey(trigger: SemanticTriggerState): string | null {
    if (trigger.status !== 'locked' || (trigger.phase !== 'entry' && trigger.phase !== 'exit')) {
      return null
    }

    return this.multiTimeframeGroupKey({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      params: trigger.params,
    })
  }

  private multiTimeframeGroupKey(input: {
    key: string
    phase: string
    sideScope: string | null
    params: Record<string, unknown>
  }): string | null {
    if (!this.isMultiTimeframeConfirmableKey(input.key)) {
      return null
    }
    if (!this.readTriggerParamTimeframe(input.params)) {
      return null
    }

    const comparableParams = Object.keys(input.params)
      .filter(key => key !== 'timeframe')
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = input.params[key]
        return acc
      }, {})

    return JSON.stringify({
      key: input.key,
      phase: input.phase,
      sideScope: input.sideScope,
      params: comparableParams,
    })
  }

  private isMultiTimeframeConfirmableKey(key: string): boolean {
    return key !== 'condition.expression'
      && key !== ATOM_CONTRACT_REGISTRY['execution.on_start'].key
      && key !== ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key
      && key !== ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key
  }

  private buildRuleFromNormalizedTriggerGroup(input: {
    triggers: Array<NormalizedTriggerAtom & { phase: 'entry' | 'exit' }>
    gateTriggers: NormalizedTriggerAtom[]
    sizing: CanonicalStrategySpecV2['sizing']
    priority: number
    defaultTimeframe: string | null
  }): CanonicalRuleV2 | null {
    const trigger = input.triggers[0]
    if (!trigger) {
      return null
    }

    if (input.triggers.length === 1) {
      return this.buildRuleFromNormalizedTrigger({
        trigger,
        gateTriggers: input.gateTriggers,
        sizing: input.sizing,
        priority: input.priority,
        defaultTimeframe: input.defaultTimeframe,
      })
    }

    const triggerConditions = input.triggers
      .map(item => this.buildConditionFromNormalizedTrigger(item, input.defaultTimeframe))
      .filter((condition): condition is CanonicalConditionNode => condition !== null)
    if (triggerConditions.length === 0) {
      return null
    }

    const actions = this.buildActionsForNormalizedTrigger(trigger, input.sizing)
    if (actions.length === 0) {
      return null
    }

    const gateKeys = input.gateTriggers.map(item => item.key)
    return {
      id: `${trigger.phase}-${trigger.key.replace(/\./g, '-')}-${input.priority}`,
      phase: trigger.phase,
      sideScope: this.resolveNormalizedRuleSideScope(trigger, actions),
      priority: input.priority,
      condition: this.attachGateConditions({
        kind: 'AND',
        children: triggerConditions,
      }, input.gateTriggers),
      actions,
      metadata: {
        normalized: {
          source: 'normalized-intent',
          triggerKeys: [...new Set(input.triggers.map(item => item.key))],
          ...(gateKeys.length > 0 ? { gateKeys } : {}),
          actionKeys: actions.map(action => action.type),
          family: 'single-leg',
        },
      },
    }
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
    gateConditions?: ScopedSemanticGateCondition[]
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
          ? this.attachSemanticGateConditions(condition, input.gateConditions ?? [], sideScope)
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
    let lower = this.readSemanticGridNumber(trigger.params, 'rangeMin')
      ?? this.readSemanticGridNumber(trigger.params, 'rangeLower')
      ?? this.readSemanticGridRangeNumber(trigger.params, 'lower')
    let upper = this.readSemanticGridNumber(trigger.params, 'rangeMax')
      ?? this.readSemanticGridNumber(trigger.params, 'rangeUpper')
      ?? this.readSemanticGridRangeNumber(trigger.params, 'upper')
    let stepPct = this.readSemanticGridNumber(trigger.params, 'stepPct')
    const levels = this.readSemanticGridNumber(trigger.params, 'levels') ?? 20
    const centerOffsetPct = this.readSemanticGridNumber(trigger.params, 'centerOffsetPct')

    if (
      (lower === null || upper === null)
      && centerOffsetPct !== null
      && levels !== null
      && Number.isInteger(levels)
      && levels >= 2
    ) {
      const halfRangePct = centerOffsetPct > 0
        ? centerOffsetPct
        : (stepPct !== null && stepPct > 0 ? stepPct : null)
      if (halfRangePct !== null && halfRangePct > 0 && halfRangePct < 100) {
        lower = 1 - halfRangePct / 100
        upper = 1 + halfRangePct / 100
        const levelsPerWiderSide = Math.max(1, Math.ceil(levels / 2))
        stepPct = halfRangePct / levelsPerWiderSide
      }
    }

    // #1412: stepPct 缺席而 levels + range 都在场时，按几何间距反推 stepPct。
    //   公式：ratio = (upper / lower) ^ (1 / (levels - 1))；stepPct = (ratio - 1) * 100
    //   与 deriveGridLevelCount 公式同源（log(upper/lower) / log(1+stepPct/100) + 1 = levels）
    //   产品 UI 实测路径「20 格 + 区间 79200-80200」由此派生 stepPct ≈ 0.0664%。
    //   m2 守卫：levels 必须为正整数（避免 levels=2.5 之类非整数语义不合法的派生）
    if (stepPct === null) {
      if (
        levels !== null
        && Number.isInteger(levels)
        && levels >= 2
        && lower !== null
        && upper !== null
        && lower > 0
        && upper > lower
      ) {
        const ratio = Math.pow(upper / lower, 1 / (levels - 1))
        stepPct = (ratio - 1) * 100
      }
    }

    if (
      (lower === null || upper === null)
      && stepPct !== null
      && levels !== null
      && Number.isInteger(levels)
      && levels >= 2
      && stepPct > 0
    ) {
      lower = 1
      upper = Math.pow(1 + stepPct / 100, levels - 1)
    }

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

    // m1 守卫：toFixed(4) 截断可能让极端窄区间 + 高 levels 派生的 stepPct → 0.0000
    //   透过上面的 stepPct <= 0 守卫（守卫用的是 normalize 前的值）。normalize 后再 short-circuit。
    const normalizedStepPct = Number(stepPct.toFixed(4))
    if (normalizedStepPct <= 0) {
      return null
    }
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
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') return null
    const parsed = Number(value.trim().match(/-?\d+(?:\.\d+)?/u)?.[0])
    return Number.isFinite(parsed) ? parsed : null
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
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') return null
    const parsed = Number(value.trim().match(/-?\d+(?:\.\d+)?/u)?.[0])
    return Number.isFinite(parsed) ? parsed : null
  }

  private resolveGridSideModeFromSemanticTrigger(
    trigger: SemanticTriggerState,
  ): 'long_only' | 'short_only' | 'bidirectional' {
    const sideMode = trigger.params.sideMode
    if (sideMode === 'both') {
      return 'bidirectional'
    }
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

  private normalizeSingleBarCandlePattern(pattern: string): string {
    const normalized = pattern.trim().toLowerCase()
    if (
      normalized === 'bullish_candle'
      || normalized === 'bullish'
      || normalized === 'green_candle'
      || normalized === 'candle_up'
      || normalized === 'close_gt_open'
    ) {
      return 'single_bull_bar'
    }
    if (
      normalized === 'bearish_candle'
      || normalized === 'bearish'
      || normalized === 'red_candle'
      || normalized === 'candle_down'
      || normalized === 'close_lt_open'
    ) {
      return 'single_bear_bar'
    }
    return normalized
  }

  private resolveNormalizedRiskExpressionSideScope(
    scope: unknown,
    positionMode: StrategyNormalizedIntent['position']['positionMode'] | null,
  ): 'long' | 'short' | 'both' {
    if (scope === 'long') {
      return 'long'
    }
    if (scope === 'short') {
      return 'short'
    }
    if (positionMode === 'long_only') {
      return 'long'
    }
    if (positionMode === 'short_only') {
      return 'short'
    }
    return 'both'
  }

  private buildRiskRuleFromNormalizedAtom(
    riskAtom: NormalizedRiskAtom,
    priority: number,
    positionMode: StrategyNormalizedIntent['position']['positionMode'] | null,
  ): CanonicalRuleV2 | null {
    if (riskAtom.key === FIELD_KEY.RISK_CONDITION_EXPRESSION) {
      const risk: SemanticRiskState = {
        id: 'normalized-risk-expression',
        key: riskAtom.key,
        params: riskAtom.params,
        status: 'locked',
        source: 'derived',
        openSlots: [],
      }
      if (!validateSemanticRiskContract(risk).ok || risk.params.capabilityStatus !== 'supported') {
        return null
      }

      const condition = this.isValidSemanticExpression(risk.params.condition)
        ? this.buildConditionFromSemanticExpression(risk.params.condition)
        : null
      if (!condition) {
        return null
      }

      const sideScope = this.resolveNormalizedRiskExpressionSideScope(risk.params.scope, positionMode)
      const actions = this.buildActionsForSemanticRiskExpression(risk, sideScope)
      if (actions.length === 0) {
        return null
      }

      return {
        id: 'risk-condition-expression',
        phase: 'risk',
        sideScope,
        priority,
        condition,
        actions,
        metadata: {
          semanticKey: risk.key,
          scope: risk.params.scope,
          effect: risk.params.effect,
          capabilityStatus: risk.params.capabilityStatus,
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: actions.map(action => action.type),
          },
        },
      }
    }

    if (riskAtom.key === FIELD_KEY.RISK_STOP_LOSS_PCT) {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
      return this.buildPercentRiskCanonicalRule({
        id: 'risk-stop-loss',
        sideScope: 'both',
        priority,
        riskKey: 'risk.stop_loss_pct',
        valuePct,
        basis,
        actions: [{ type: 'FORCE_EXIT' }],
        metadata: {
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: ['FORCE_EXIT'],
          },
        },
      })
    }

    if (riskAtom.key === FIELD_KEY.RISK_TAKE_PROFIT_PCT) {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
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
      return this.buildPercentRiskCanonicalRule({
        id: 'risk-take-profit',
        sideScope,
        priority,
        riskKey: 'risk.take_profit_pct',
        valuePct,
        basis,
        actions,
        metadata: {
          normalized: {
            source: 'normalized-intent',
            triggerKeys: [riskAtom.key],
            actionKeys: actions.map(action => action.type),
          },
        },
      })
    }

    if (riskAtom.key === FIELD_KEY.RISK_ATR_STOP) {
      const multiplierRaw = typeof riskAtom.params.multiplier === 'number'
        ? riskAtom.params.multiplier
        : typeof riskAtom.params.multiple === 'number'
          ? riskAtom.params.multiple
          : null
      if (multiplierRaw === null || !Number.isFinite(multiplierRaw) || multiplierRaw <= 0) {
        return null
      }
      const periodRaw = typeof riskAtom.params.period === 'number' ? riskAtom.params.period : 14
      const period = Number.isInteger(periodRaw) && periodRaw > 0 ? periodRaw : 14
      return {
        id: 'risk-atr-stop',
        phase: 'risk',
        sideScope: 'both',
        priority,
        condition: {
          kind: 'atom',
          key: 'risk.atr_stop',
          semanticScope: 'position',
          params: { period, multiplier: multiplierRaw },
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

    if (riskAtom.key === FIELD_KEY.RISK_MAX_DRAWDOWN_PCT) {
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

    if (riskAtom.key === FIELD_KEY.RISK_MAX_SINGLE_LOSS_PCT) {
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
      case ATOM_CONTRACT_REGISTRY['execution.on_start'].key:
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.executionOnStart,
          semanticScope: 'market',
        }
      case ATOM_CONTRACT_REGISTRY['price.percent_change'].key: {
        const rawValuePct = typeof trigger.params.valuePct === 'number' ? trigger.params.valuePct : null
        const valuePct = this.normalizePercentChangeValuePct(rawValuePct, trigger.params.direction)
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
      case ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key:
      case ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key: {
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
          op: trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key ? 'LTE' : 'GTE',
          value: Number((thresholdPct / 100).toFixed(4)),
          params: {
            period: typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : 20,
            ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['pattern.range'].key:
        return {
          kind: 'atom',
          key: 'pattern.range',
          semanticScope: 'market',
          predicateForm: 'generic',
          op: 'EQ',
          value: true,
          params: {
            mode: typeof trigger.params.mode === 'string' ? trigger.params.mode : 'inside_range',
            lowerRole: typeof trigger.params.lowerRole === 'string' ? trigger.params.lowerRole : 'range_low',
            upperRole: typeof trigger.params.upperRole === 'string' ? trigger.params.upperRole : 'range_high',
            lookbackBars: typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : 48,
            ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
          },
        }
      case ATOM_CONTRACT_REGISTRY['price.breakout_up'].key:
        if (trigger.params.reference === 'price_level' && typeof trigger.params.priceLevel === 'number') {
          return {
            kind: 'atom',
            key: 'price.level_breakout_up',
            semanticScope: 'market',
            op: 'CROSS_OVER',
            params: { priceLevel: trigger.params.priceLevel },
          }
        }
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
      case ATOM_CONTRACT_REGISTRY['price.breakout_down'].key:
        if (trigger.params.reference === 'price_level' && typeof trigger.params.priceLevel === 'number') {
          return {
            kind: 'atom',
            key: 'price.level_breakout_down',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
            params: { priceLevel: trigger.params.priceLevel },
          }
        }
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
      case ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key:
        return this.buildConditionFromIndicatorBoundaryTrigger(trigger)
      case 'orderbook.spread_condition': {
        const valuePct = this.readNumberParam(trigger.params.valuePct) ?? 0.03
        const operator = this.readOrderbookComparator(trigger.params.operator, 'lt')
        return {
          kind: 'atom',
          key: 'orderbook.spread_condition',
          semanticScope: 'market',
          predicateForm: 'generic',
          op: operator,
          value: valuePct,
          params: {
            valuePct,
            operator,
          },
        }
      }
      case 'orderbook.depth_ratio': {
        const ratio = this.readNumberParam(trigger.params.ratio) ?? 2
        const operator = this.readOrderbookComparator(trigger.params.operator, 'gt')
        return {
          kind: 'atom',
          key: 'orderbook.depth_ratio',
          semanticScope: 'market',
          predicateForm: 'generic',
          op: operator,
          value: ratio,
          params: {
            ratio,
            side: this.readStringParam(trigger.params.side) ?? 'bid_over_ask',
            operator,
          },
        }
      }
      case FIELD_KEY.VOLUME_RELATIVE_AVERAGE: {
        const timeframe = this.readTriggerParamTimeframe(trigger.params)
        return {
          kind: 'atom',
          key: 'volume.relative_average',
          semanticScope: 'market',
          predicateForm: 'generic',
          op: this.resolveRelativeAverageComparator(trigger.params.comparator),
          params: {
            lookbackBars: typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : 20,
            multiplier: typeof trigger.params.multiplier === 'number' ? trigger.params.multiplier : 1,
            ...(timeframe ? { timeframe } : {}),
          },
        }
      }
      case FIELD_KEY.PRICE_ROLLING_EXTREMA_BREAKOUT: {
        const extrema = this.readStringParam(trigger.params.extrema) === 'low' ? 'low' : 'high'
        const event = this.readStringParam(trigger.params.event)
        const timeframe = this.readTriggerParamTimeframe(trigger.params)
        return {
          kind: 'atom',
          key: 'price.rolling_extrema_breakout',
          semanticScope: 'market',
          predicateForm: 'generic',
          op: event === 'breakout_down' || extrema === 'low' ? 'LT' : 'GT',
          params: {
            extrema,
            lookbackBars: typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : 20,
            ...(event ? { event } : {}),
            ...(timeframe ? { timeframe } : {}),
          },
        }
      }
      case 'condition.sequence': {
        const sequenceKind = this.readStringParam(trigger.params.sequenceKind)
        if (!sequenceKind) {
          return null
        }
        const reference = this.readRecordParam(trigger.params.reference)
        const referenceIndicator = this.readStringParam(reference?.indicator)
        const referencePeriod = this.readNumberParam(reference?.period)
        const threshold = this.readNumberParam(trigger.params.threshold)
        const count = this.readNumberParam(trigger.params.count)
        const direction = this.readStringParam(trigger.params.direction)
        const lookbackBars = this.readNumberParam(trigger.params.lookbackBars)
        return {
          kind: 'atom',
          key: 'condition.sequence',
          semanticScope: 'market',
          predicateForm: 'generic',
          params: {
            sequenceKind,
            ...(typeof trigger.params.lookbackWindow === 'string' ? { lookbackWindow: trigger.params.lookbackWindow } : {}),
            ...(typeof trigger.params.memoryKey === 'string' ? { memoryKey: trigger.params.memoryKey } : {}),
            ...(threshold !== null ? { threshold } : {}),
            ...(count !== null ? { count } : {}),
            ...(direction ? { direction } : {}),
            ...(lookbackBars !== null ? { lookbackBars } : {}),
            ...(referenceIndicator ? { 'reference.indicator': referenceIndicator } : {}),
            ...(referencePeriod !== null ? { 'reference.period': referencePeriod } : {}),
          },
        }
      }
      case 'logical.any_of': {
        const items = Array.isArray(trigger.params.items) ? trigger.params.items : []
        const children = items
          .map(item => this.buildConditionFromLogicalAnyOfItem(item, trigger, defaultTimeframe))
          .filter((condition): condition is CanonicalConditionNode => condition !== null)
        return children.length > 0 ? { kind: 'OR', predicateForm: 'generic', children } : null
      }
      case ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key:
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerUpperBreak,
          semanticScope: 'market',
          op: trigger.params.confirmationMode === 'touch' ? 'GTE' : 'CROSS_OVER',
          ...(typeof trigger.params.confirmationMode === 'string'
            ? { params: { confirmationMode: trigger.params.confirmationMode } }
            : {}),
        }
      case ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key:
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerLowerBreak,
          semanticScope: 'market',
          op: trigger.params.confirmationMode === 'touch' ? 'LTE' : 'CROSS_UNDER',
          ...(typeof trigger.params.confirmationMode === 'string'
            ? { params: { confirmationMode: trigger.params.confirmationMode } }
            : {}),
        }
      case ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key:
        return {
          kind: 'atom',
          key: CANONICAL_RULE_KEYS.bollingerMiddleRevert,
          semanticScope: 'market',
          ...(typeof trigger.params.confirmationMode === 'string'
            ? { params: { confirmationMode: trigger.params.confirmationMode } }
            : {}),
        }
      case ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key:
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
      case ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key:
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
      case ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key:
      case ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key: {
        const indicator = typeof trigger.params.indicator === 'string'
          ? trigger.params.indicator.trim().toLowerCase()
          : ''
        const operator = trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? 'CROSS_OVER' : 'CROSS_UNDER'
        if (indicator === 'macd') {
          return {
            kind: 'atom',
            key: trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? CANONICAL_RULE_KEYS.macdGoldenCross : CANONICAL_RULE_KEYS.macdDeathCross,
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
            key: trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? CANONICAL_RULE_KEYS.rsiCrossOver : CANONICAL_RULE_KEYS.rsiCrossUnder,
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
        const priceCrossReferencePeriod = this.readPriceCrossReferencePeriod(trigger)
        if (priceCrossReferencePeriod !== null) {
          return {
            kind: 'atom',
            key: trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? CANONICAL_RULE_KEYS.movingAverageGoldenCross : CANONICAL_RULE_KEYS.movingAverageDeathCross,
            semanticScope: 'market',
            op: operator,
            params: {
              indicator: movingAverageIndicator,
              period: priceCrossReferencePeriod,
            },
          }
        }
        return {
          kind: 'atom',
          key: trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? CANONICAL_RULE_KEYS.movingAverageGoldenCross : CANONICAL_RULE_KEYS.movingAverageDeathCross,
          semanticScope: 'market',
          op: operator,
          params: {
            indicator: movingAverageIndicator,
            ...(trigger.params.priceCross === true ? { priceCross: true } : {}),
            ...(typeof trigger.params.period === 'number' ? { period: trigger.params.period } : {}),
            ...(typeof trigger.params.fastPeriod === 'number' ? { fastPeriod: trigger.params.fastPeriod } : {}),
            ...(typeof trigger.params.slowPeriod === 'number' ? { slowPeriod: trigger.params.slowPeriod } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['indicator.above'].key: {
        const timeframe = this.readTriggerParamTimeframe(trigger.params)
        const referencePeriod = this.readSemanticReferencePeriod(trigger.params)
        const ownPeriod = typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
          ? trigger.params.period
          : (typeof trigger.params.fastPeriod === 'number' && Number.isFinite(trigger.params.fastPeriod)
            ? trigger.params.fastPeriod
            : undefined)
        return {
          kind: 'atom',
          key: 'indicator.above',
          semanticScope: 'market',
          op: 'GTE',
          params: {
            ...(typeof trigger.params.indicator === 'string' ? { indicator: trigger.params.indicator } : {}),
            ...(typeof trigger.params.referenceRole === 'string' ? { referenceRole: trigger.params.referenceRole } : {}),
            ...(typeof ownPeriod === 'number' ? { period: ownPeriod } : {}),
            ...(referencePeriod !== null ? { 'reference.period': referencePeriod } : {}),
            ...(timeframe ? { timeframe } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['indicator.below'].key: {
        const timeframe = this.readTriggerParamTimeframe(trigger.params)
        const referencePeriod = this.readSemanticReferencePeriod(trigger.params)
        const ownPeriod = typeof trigger.params.period === 'number' && Number.isFinite(trigger.params.period)
          ? trigger.params.period
          : (typeof trigger.params.fastPeriod === 'number' && Number.isFinite(trigger.params.fastPeriod)
            ? trigger.params.fastPeriod
            : undefined)
        return {
          kind: 'atom',
          key: 'indicator.below',
          semanticScope: 'market',
          op: 'LTE',
          params: {
            ...(typeof trigger.params.indicator === 'string' ? { indicator: trigger.params.indicator } : {}),
            ...(typeof trigger.params.referenceRole === 'string' ? { referenceRole: trigger.params.referenceRole } : {}),
            ...(typeof ownPeriod === 'number' ? { period: ownPeriod } : {}),
            ...(referencePeriod !== null ? { 'reference.period': referencePeriod } : {}),
            ...(timeframe ? { timeframe } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['trend.direction'].key:
      case ATOM_CONTRACT_REGISTRY['market.regime'].key:
      case ATOM_CONTRACT_REGISTRY['volatility.state'].key:
        return {
          kind: 'atom',
          key: trigger.key,
          semanticScope: 'market',
          op: 'EQ',
          value: typeof trigger.params.value === 'string' ? trigger.params.value : undefined,
      }
      case ATOM_CONTRACT_REGISTRY['volume.threshold'].key: {
        const operator = this.readGateThresholdOperator(trigger.params.operator)
        const metric = this.readStringParam(trigger.params.metric) ?? 'base_volume'
        const unit = this.readStringParam(trigger.params.unit)
        const period = this.readNumberParam(trigger.params.period)
        const mode = this.readStringParam(trigger.params.mode)
        const multiplier = this.readNumberParam(trigger.params.multiplier)
        const refWindow = this.readNumberParam(trigger.params.refWindow)
        const timeframe = this.readTriggerParamTimeframe(trigger.params) ?? defaultTimeframe
        if (mode === 'relative_to_sma' && multiplier !== null) {
          return {
            kind: 'atom',
            key: 'volume.threshold',
            semanticScope: 'market',
            predicateForm: 'generic',
            op: operator,
            params: {
              metric,
              mode,
              multiplier,
              refWindow: refWindow ?? 20,
              ...(unit ? { unit } : {}),
              ...(timeframe ? { timeframe } : {}),
            },
          }
        }

        const value = this.readNumberParam(trigger.params.value)
        if (value === null) {
          return null
        }
        return {
          kind: 'atom',
          key: 'volume.threshold',
          semanticScope: 'market',
          op: operator,
          value,
          params: {
            metric,
            ...(unit ? { unit } : {}),
            ...(period !== null ? { period } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['volatility.atr_threshold'].key: {
        const threshold = this.readNumberParam(trigger.params.threshold)
        if (threshold === null) {
          return null
        }
        const operator = this.readGateThresholdOperator(trigger.params.operator)
        const period = this.readNumberParam(trigger.params.period) ?? 14
        const thresholdUnit = this.readStringParam(trigger.params.thresholdUnit) ?? 'percent_of_close'
        return {
          kind: 'atom',
          key: 'volatility.atr_threshold',
          semanticScope: 'market',
          op: operator,
          value: threshold,
          params: {
            period,
            thresholdUnit,
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['strategy.time_window'].key: {
        const timezone = this.readStringParam(trigger.params.timezone)
        const windowsParam = trigger.params.windows
        const windows = Array.isArray(windowsParam)
          ? windowsParam
          : (typeof windowsParam === 'string' && windowsParam.trim().length > 0 ? [windowsParam.trim()] : [])
        if (!timezone || windows.length === 0) {
          return null
        }
        return {
          kind: 'atom',
          key: 'strategy.time_window',
          semanticScope: 'market',
          op: 'EQ',
          value: 1,
          params: {
            timezone,
            windows: JSON.stringify(windows),
          },
        }
      }
      // position.has_position: 已有仓位 → 阻止新开仓（gate guard）
      // 编译为 position.has_position EQ false（与 IR compiler MAX_POSITION_PCT 分支对齐）
      case ATOM_CONTRACT_REGISTRY['position.has_position'].key: {
        const side = typeof trigger.params.sideScope === 'string'
          ? trigger.params.sideScope as 'long' | 'short' | 'both'
          : (trigger.sideScope ?? 'both')
        return {
          kind: 'atom',
          key: 'position.has_position',
          semanticScope: 'position',
          op: 'EQ',
          value: false,
          params: { side },
        }
      }
      // position.no_position: 无仓位 → 阻止新开仓（当有仓位时 gate guard）
      // 语义与 has_position 对称：no_position = !has_position，同样编译为 has_position EQ false
      case ATOM_CONTRACT_REGISTRY['position.no_position'].key: {
        const side = typeof trigger.params.sideScope === 'string'
          ? trigger.params.sideScope as 'long' | 'short' | 'both'
          : (trigger.sideScope ?? 'both')
        return {
          kind: 'atom',
          key: 'position.no_position',
          semanticScope: 'position',
          op: 'EQ',
          value: false,
          params: { side },
        }
      }
      case ATOM_CONTRACT_REGISTRY['indicator.divergence'].key: {
        // 白名单：仅 rsi / macd；缺失 indicator 或 direction → fail-closed (null)
        const indicator = typeof trigger.params.indicator === 'string'
          ? trigger.params.indicator.trim().toLowerCase()
          : null
        if (indicator !== 'rsi' && indicator !== 'macd') return null
        const direction = typeof trigger.params.direction === 'string'
          ? trigger.params.direction.trim().toLowerCase()
          : null
        if (direction !== 'bullish' && direction !== 'bearish') return null
        const pivotWindow = typeof trigger.params.pivotWindow === 'number' && Number.isFinite(trigger.params.pivotWindow)
          ? trigger.params.pivotWindow
          : 14
        const confirmationBars = typeof trigger.params.confirmationBars === 'number' && Number.isFinite(trigger.params.confirmationBars)
          ? trigger.params.confirmationBars
          : 3
        return {
          kind: 'atom',
          key: 'indicator.divergence',
          semanticScope: 'market',
          op: direction === 'bullish' ? 'GTE' : 'LTE',
          params: {
            indicator,
            direction,
            pivotWindow,
            confirmationBars,
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key: {
        // P4-2: 白名单 patterns（Issue #1391 后续加 single_bull_bar / single_bear_bar）；
        //   缺失 pattern 或 direction → fail-closed (null)
        const cpPattern = typeof trigger.params.pattern === 'string'
          ? this.normalizeSingleBarCandlePattern(trigger.params.pattern)
          : null
        if (
          cpPattern !== 'engulfing'
          && cpPattern !== 'hammer'
          && cpPattern !== 'doji'
          && cpPattern !== 'consecutive_body'
          && cpPattern !== 'single_bull_bar'
          && cpPattern !== 'single_bear_bar'
        ) return null
        // single_bull_bar / single_bear_bar 自身已确定方向，direction 缺省时由 pattern 推导
        let cpDirection = typeof trigger.params.direction === 'string'
          ? trigger.params.direction.trim().toLowerCase()
          : null
        if (!cpDirection && cpPattern === 'single_bull_bar') cpDirection = 'bullish'
        if (!cpDirection && cpPattern === 'single_bear_bar') cpDirection = 'bearish'
        if (cpDirection !== 'bullish' && cpDirection !== 'bearish') return null
        const cpMinBars = typeof trigger.params.minBars === 'number' && Number.isInteger(trigger.params.minBars) && trigger.params.minBars > 0
          ? trigger.params.minBars
          : undefined
        if (cpPattern === 'consecutive_body' && cpMinBars === undefined) return null
        return {
          kind: 'atom',
          key: 'price.candle_pattern',
          semanticScope: 'market',
          op: cpDirection === 'bullish' ? 'GTE' : 'LTE',
          params: {
            pattern: cpPattern,
            direction: cpDirection,
            ...(cpMinBars !== undefined ? { minBars: cpMinBars } : {}),
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['price.chart_pattern'].key: {
        // P4-3: 白名单 4 patterns (head_and_shoulders / double_top / double_bottom / triangle)；
        // 缺失 pattern 或 direction → fail-closed (null)
        const chPattern = typeof trigger.params.pattern === 'string'
          ? trigger.params.pattern.trim().toLowerCase()
          : null
        if (
          chPattern !== 'head_and_shoulders'
          && chPattern !== 'double_top'
          && chPattern !== 'double_bottom'
          && chPattern !== 'triangle'
        ) return null
        const chDirection = typeof trigger.params.direction === 'string'
          ? trigger.params.direction.trim().toLowerCase()
          : null
        if (chDirection !== 'bullish' && chDirection !== 'bearish') return null
        return {
          kind: 'atom',
          key: 'price.chart_pattern',
          semanticScope: 'market',
          op: chDirection === 'bullish' ? 'GTE' : 'LTE',
          params: {
            pattern: chPattern,
            direction: chDirection,
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['external.signal'].key: {
        const provider = typeof trigger.params.provider === 'string'
          ? trigger.params.provider.trim().toLowerCase()
          : 'webhook'
        const signalId = typeof trigger.params.signalId === 'string'
          ? trigger.params.signalId.trim()
          : null
        const secret = typeof trigger.params.secret === 'string'
          ? trigger.params.secret.trim()
          : 'configured'
        if (provider !== 'webhook' || !signalId || signalId === 'REQUIRED_SIGNAL_ID' || secret !== 'configured') return null
        return {
          kind: 'atom',
          key: 'external.signal',
          semanticScope: 'market',
          op: 'EQ',
          params: {
            provider,
            signalId,
            secret,
          },
        }
      }
      case ATOM_CONTRACT_REGISTRY['orderbook.imbalance'].key:
      case ATOM_CONTRACT_REGISTRY['fundingRate.condition'].key:
      case ATOM_CONTRACT_REGISTRY['openInterest.condition'].key:
      case ATOM_CONTRACT_REGISTRY['liquidation.condition'].key:
        return {
          kind: 'atom',
          key: trigger.key,
          semanticScope: 'market',
          predicateForm: 'generic',
          op: this.readGateThresholdOperator(trigger.params.operator),
          params: {
            ...trigger.params,
            ...(defaultTimeframe ? { timeframe: defaultTimeframe } : {}),
          },
        }
      case ATOM_CONTRACT_REGISTRY['liquidity.sweep'].key: {
        // P4-4: 白名单方向 (bullish/bearish) + 4 reference (prev_low / prev_high / session_low / session_high)。
        // 缺失 direction 或 reference → fail-closed (null)；reclaimBars 默认值集中定义于
        // canonical-strategy-ir.ts (critic round 1 A3)。
        const lsDirection = typeof trigger.params.direction === 'string'
          ? trigger.params.direction.trim().toLowerCase()
          : null
        if (lsDirection !== 'bullish' && lsDirection !== 'bearish') return null
        const lsReference = typeof trigger.params.reference === 'string'
          ? trigger.params.reference.trim().toLowerCase()
          : null
        if (
          lsReference !== 'prev_low'
          && lsReference !== 'prev_high'
          && lsReference !== 'session_low'
          && lsReference !== 'session_high'
        ) return null
        // critic round 1 A2 修复：拒绝 SMC 语义不可能的 4 个矛盾组合（防御 in depth，
        // extractor 已在源头丢弃，但其他上游可能直接构造）：
        //   bullish + prev_high / session_high — 扫顶必为 bearish reversal
        //   bearish + prev_low / session_low   — 扫底必为 bullish reversal
        const isImpossibleCombo = (lsDirection === 'bullish' && (lsReference === 'prev_high' || lsReference === 'session_high'))
          || (lsDirection === 'bearish' && (lsReference === 'prev_low' || lsReference === 'session_low'))
        if (isImpossibleCombo) return null
        const lsReclaimBars = typeof trigger.params.reclaimBars === 'number'
          && Number.isInteger(trigger.params.reclaimBars)
          && trigger.params.reclaimBars > 0
          ? trigger.params.reclaimBars
          : LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS
        return {
          kind: 'atom',
          key: 'liquidity.sweep',
          semanticScope: 'market',
          op: lsDirection === 'bullish' ? 'GTE' : 'LTE',
          params: {
            direction: lsDirection,
            reference: lsReference,
            reclaimBars: lsReclaimBars,
          },
        }
      }
      default:
        return null
    }
  }

  private readGateThresholdOperator(value: unknown): 'GT' | 'GTE' | 'LT' | 'LTE' {
    if (value === 'GTE' || value === 'LT' || value === 'LTE') return value
    return 'GT'
  }

  private resolveRelativeAverageComparator(comparator: unknown): 'GT' | 'GTE' | 'LT' | 'LTE' {
    if (comparator === 'gte') return 'GTE'
    if (comparator === 'lt') return 'LT'
    if (comparator === 'lte') return 'LTE'
    return 'GT'
  }

  private buildConditionFromLogicalAnyOfItem(
    item: unknown,
    parentTrigger: NormalizedTriggerAtom,
    defaultTimeframe: string | null,
  ): CanonicalConditionNode | null {
    if (!item || typeof item !== 'object' || !('key' in item)) {
      return null
    }

    const key = (item as { key?: unknown }).key
    if (!this.isNormalizedTriggerAtomKey(key)) {
      return null
    }

    const params = (item as { params?: unknown }).params
    return this.buildConditionFromNormalizedTrigger({
      key,
      phase: parentTrigger.phase,
      sideScope: parentTrigger.sideScope,
      params: params && typeof params === 'object' && !Array.isArray(params)
        ? params as Record<string, unknown>
        : {},
      closureStatus: 'closed',
      unresolvedSlots: [],
    }, defaultTimeframe)
  }

  private isNormalizedTriggerAtomKey(value: unknown): value is NormalizedTriggerAtomKey {
    return typeof value === 'string' && NORMALIZED_TRIGGER_ATOM_KEYS.includes(value as NormalizedTriggerAtomKey)
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

  private normalizePercentChangeValuePct(rawValuePct: number | null, direction: unknown): number | null {
    if (rawValuePct === null || !Number.isFinite(rawValuePct)) {
      return null
    }

    if (direction === 'down') {
      return -Math.abs(rawValuePct)
    }

    if (direction === 'up') {
      return Math.abs(rawValuePct)
    }

    return rawValuePct
  }

  private buildConditionFromIndicatorBoundaryTrigger(
    trigger: NormalizedTriggerAtom,
  ): CanonicalConditionNode | null {
    const indicator = this.readIndicatorBoundaryIndicator(trigger.params)
    const boundaryRole = this.readStringParam(trigger.params.boundaryRole)
    const confirmationMode = this.readStringParam(trigger.params.confirmationMode)
    if (indicator?.name !== 'bollinger') {
      const op = boundaryRole === 'upper'
        ? (confirmationMode === 'touch' ? 'GTE' : 'CROSS_OVER')
        : (confirmationMode === 'touch' ? 'LTE' : 'CROSS_UNDER')
      return {
        kind: 'atom',
        key: ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key,
        semanticScope: 'market',
        predicateForm: 'generic',
        op,
        params: {
          indicator: indicator?.name ?? this.readStringParam(trigger.params.indicator) ?? 'channel',
          boundaryRole: boundaryRole ?? 'lower',
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      }
    }

    if (boundaryRole === 'upper') {
      return {
        kind: 'atom',
        key: CANONICAL_RULE_KEYS.bollingerUpperBreak,
        semanticScope: 'market',
        op: confirmationMode === 'touch' ? 'GTE' : 'CROSS_OVER',
        ...(confirmationMode ? { params: { confirmationMode } } : {}),
      }
    }

    if (boundaryRole === 'lower') {
      return {
        kind: 'atom',
        key: CANONICAL_RULE_KEYS.bollingerLowerBreak,
        semanticScope: 'market',
        op: confirmationMode === 'touch' ? 'LTE' : 'CROSS_UNDER',
        ...(confirmationMode ? { params: { confirmationMode } } : {}),
      }
    }

    if (boundaryRole === 'middle') {
      return {
        kind: 'atom',
        key: CANONICAL_RULE_KEYS.bollingerMiddleRevert,
        semanticScope: 'market',
        ...(confirmationMode ? { params: { confirmationMode } } : {}),
      }
    }

    return null
  }

  private readOrderbookComparator(value: unknown, fallback: 'lt' | 'gt'): 'LT' | 'LTE' | 'GT' | 'GTE' {
    switch (typeof value === 'string' ? value.trim().toLowerCase() : fallback) {
      case 'lte':
      case '<=':
        return 'LTE'
      case 'gt':
      case '>':
        return 'GT'
      case 'gte':
      case '>=':
        return 'GTE'
      case 'lt':
      case '<':
      default:
        return 'LT'
    }
  }

  private readIndicatorBoundaryIndicator(
    params: Record<string, unknown>,
  ): { name: string; period?: number; stdDev?: number } | null {
    const rawIndicator = params.indicator
    if (!rawIndicator || typeof rawIndicator !== 'object' || Array.isArray(rawIndicator)) {
      return null
    }

    const indicator = rawIndicator as Record<string, unknown>
    const rawName = indicator.name
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      return null
    }

    const period = indicator.period
    const stdDev = indicator.stdDev
    return {
      name: rawName.trim().toLowerCase(),
      ...(typeof period === 'number' && Number.isFinite(period) ? { period } : {}),
      ...(typeof stdDev === 'number' && Number.isFinite(stdDev) ? { stdDev } : {}),
    }
  }

  private readStringParam(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readFirstStringParam(params: Record<string, unknown>, keys: readonly string[]): string {
    for (const key of keys) {
      const value = this.readStringParam(params[key])
      if (value !== null) return value
    }
    return ''
  }

  private readNumberParam(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  private readRecordParam(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
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
    const levelMatch = text.match(/(?:共|总计)?\s*(\d+)\s*[格档]/u)
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
    const percentMatch = text.match(/(?:(?:步长|网格步长)\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:步长|网格步长))/u)
    if (percentMatch?.[1]) {
      return Number(percentMatch[1])
    }
    if (percentMatch?.[2]) {
      return Number(percentMatch[2])
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
