import type { CanonicalConditionAtom, CanonicalRuleAction, CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { AtomicIntentRisk } from '../types/strategy-ambiguity'
import type { StrategyIR, StrategyIrGridTrigger } from '../types/strategy-ir'
import { Injectable } from '@nestjs/common'

import { CANONICAL_RULE_KEYS } from '../constants/canonical-strategy-capabilities'

@Injectable()
export class StrategyIrCanonicalAdapterService {
  adapt(strategyIr: StrategyIR): CanonicalStrategySpecV2 {
    if (strategyIr.intent.kind !== 'grid.range_rebalance') {
      throw new Error('strategy_ir_intent_not_supported')
    }

    return {
      version: 2,
      market: {
        exchange: strategyIr.market.exchange,
        symbol: strategyIr.market.symbol,
        marketType: strategyIr.market.marketType,
        defaultTimeframe: strategyIr.market.timeframe,
      },
      indicators: [
        {
          kind: 'custom',
          params: { family: 'grid' },
        },
      ],
      sizing: this.resolveSizing(strategyIr),
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: [strategyIr.market.timeframe],
      },
      rules: [
        ...this.buildGridRules(strategyIr.intent.trigger, this.resolveSizing(strategyIr), strategyIr.market.timeframe),
        ...this.buildRiskRules(strategyIr.intent.risk),
      ],
      metadata: {
        strategyIr: {
          version: strategyIr.version,
          intentKind: strategyIr.intent.kind,
        },
      } as CanonicalStrategySpecV2['metadata'],
    }
  }

  private buildGridRules(
    grid: StrategyIrGridTrigger,
    sizing: CanonicalStrategySpecV2['sizing'],
    timeframe: string,
  ): CanonicalRuleV2[] {
    const rules: CanonicalRuleV2[] = []
    let entryPriority = 210
    let exitPriority = 140
    const baseCondition = this.buildGridCondition(grid, timeframe)

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
      condition: {
        ...baseCondition,
        op,
      },
      actions: [phase === 'entry'
        ? this.buildOpenAction(actionType as 'OPEN_LONG' | 'OPEN_SHORT', sizing)
        : { type: actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
      metadata: {
        strategyIr: {
          intentKind: 'grid.range_rebalance',
        },
      },
    })

    if (grid.sideMode === 'long_only' || grid.sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'long', 'LTE', 'OPEN_LONG'))
      rules.push(buildRule('exit', 'long', 'GTE', 'CLOSE_LONG'))
    }

    if (grid.sideMode === 'short_only' || grid.sideMode === 'bidirectional') {
      rules.push(buildRule('entry', 'short', 'GTE', 'OPEN_SHORT'))
      rules.push(buildRule('exit', 'short', 'LTE', 'CLOSE_SHORT'))
    }

    return rules
  }

  private buildGridCondition(
    grid: StrategyIrGridTrigger,
    timeframe: string,
  ): CanonicalConditionAtom {
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
        timeframe,
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

  private resolveSizing(strategyIr: StrategyIR): CanonicalStrategySpecV2['sizing'] {
    const sizing = strategyIr.intent.sizing
    if (!sizing) {
      return null
    }

    switch (sizing.mode) {
      case 'fixed_ratio':
        return { mode: 'RATIO', value: Number(sizing.value.toFixed(4)) }
      case 'fixed_quote':
        return { mode: 'QUOTE', value: Number(sizing.value.toFixed(4)) }
      case 'fixed_qty':
        return { mode: 'QTY', value: Number(sizing.value.toFixed(4)) }
      default:
        return null
    }
  }

  private buildOpenAction(
    actionType: 'OPEN_LONG' | 'OPEN_SHORT',
    sizing: CanonicalStrategySpecV2['sizing'],
  ): CanonicalRuleAction {
    return {
      type: actionType,
      ...(sizing ? { sizing } : {}),
    }
  }

  private buildRiskRules(riskAtoms: AtomicIntentRisk[]): CanonicalRuleV2[] {
    const rules: CanonicalRuleV2[] = []
    let priority = 120

    for (const riskAtom of riskAtoms) {
      const rule = this.buildRiskRule(riskAtom, priority--)
      if (rule) {
        rules.push(rule)
      }
    }

    return rules
  }

  private buildRiskRule(
    riskAtom: AtomicIntentRisk,
    priority: number,
  ): CanonicalRuleV2 | null {
    if (riskAtom.kind === 'risk.stop_loss_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
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
          strategyIr: {
            intentKind: 'grid.range_rebalance',
          },
        },
      }
    }

    if (riskAtom.kind === 'risk.take_profit_pct') {
      const valuePct = typeof riskAtom.params.valuePct === 'number' ? riskAtom.params.valuePct : null
      if (!valuePct || !Number.isFinite(valuePct)) {
        return null
      }
      const basis = typeof riskAtom.params.basis === 'string' ? riskAtom.params.basis : 'entry_avg_price'
      return {
        id: 'risk-take-profit',
        phase: 'risk',
        sideScope: 'both',
        priority,
        condition: {
          kind: 'atom',
          key: 'risk.take_profit_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((valuePct / 100).toFixed(4)),
          params: { basis },
        },
        actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
        metadata: {
          basis,
          strategyIr: {
            intentKind: 'grid.range_rebalance',
          },
        },
      }
    }

    if (riskAtom.kind === 'risk.max_drawdown_pct') {
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
          strategyIr: {
            intentKind: 'grid.range_rebalance',
          },
        },
      }
    }

    if (riskAtom.kind === 'risk.max_single_loss_pct') {
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
          strategyIr: {
            intentKind: 'grid.range_rebalance',
          },
        },
      }
    }

    return null
  }
}
