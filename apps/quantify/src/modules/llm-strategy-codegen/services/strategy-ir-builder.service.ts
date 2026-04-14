import type { AtomicIntentResolution, AtomicIntentRisk, AtomicIntentSizing, AtomicIntentTrigger } from '../types/strategy-ambiguity'
import type { StrategyExecutionContext } from '../types/strategy-execution-context'
import type { StrategyIR, StrategyIrGridTrigger, StrategyIrMarket } from '../types/strategy-ir'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StrategyIrBuilderService {
  build(input: {
    context: StrategyExecutionContext
    resolution: AtomicIntentResolution
  }): StrategyIR {
    if (input.resolution.ambiguities.length > 0) {
      throw new Error('strategy_ir_requires_resolved_atomic_intent')
    }

    return {
      version: 'strategy-ir.v1',
      market: this.requireResolvedMarket(input.context),
      intent: {
        kind: 'grid.range_rebalance',
        trigger: this.requireGridTrigger(input.resolution.atomicIntent.triggers),
        sizing: this.cloneSizing(input.resolution.atomicIntent.sizing),
        actions: input.resolution.atomicIntent.actions.map(action => action.kind),
        risk: input.resolution.atomicIntent.risk.map(risk => this.cloneRisk(risk)),
      },
    }
  }

  private requireResolvedMarket(context: StrategyExecutionContext): StrategyIrMarket {
    if (!context.exchange || !context.symbol || !context.marketType || !context.timeframe) {
      throw new Error('strategy_ir_requires_resolved_execution_context')
    }

    return {
      exchange: context.exchange,
      symbol: context.symbol,
      marketType: context.marketType,
      timeframe: context.timeframe,
    }
  }

  private requireGridTrigger(triggers: AtomicIntentTrigger[]): StrategyIrGridTrigger {
    const gridTrigger = triggers.find(trigger => trigger.kind === 'grid_touch')
    const params = gridTrigger?.params
    const range = params?.range
    const stepPct = params?.stepPct
    const sideMode = params?.sideMode

    if (
      !range
      || typeof range !== 'object'
      || typeof (range as { lower?: unknown }).lower !== 'number'
      || typeof (range as { upper?: unknown }).upper !== 'number'
      || typeof stepPct !== 'number'
      || (sideMode !== 'long_only' && sideMode !== 'short_only' && sideMode !== 'bidirectional')
    ) {
      throw new Error('strategy_ir_grid_trigger_required')
    }

    return {
      range: {
        lower: (range as { lower: number }).lower,
        upper: (range as { upper: number }).upper,
      },
      stepPct,
      sideMode,
      recycle: params?.recycle !== false,
    }
  }

  private cloneSizing(sizing: AtomicIntentSizing | null): StrategyIR['intent']['sizing'] {
    if (!sizing) {
      return null
    }

    return {
      mode: sizing.mode,
      value: sizing.value,
      positionMode: sizing.positionMode,
    }
  }

  private cloneRisk(risk: AtomicIntentRisk): AtomicIntentRisk {
    return {
      kind: risk.kind,
      params: { ...risk.params },
    }
  }
}
