import type { AtomicIntent, AtomicIntentResolution, StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { NormalizedTriggerAtom, StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StrategyIntentResolutionService {
  resolve(input: { normalizedIntent: StrategyNormalizedIntent }): AtomicIntentResolution {
    const { normalizedIntent } = input
    if (normalizedIntent.grid) {
      return this.resolveGridIntent(normalizedIntent)
    }

    return this.resolveSingleLegIntent(normalizedIntent)
  }

  private resolveGridIntent(normalizedIntent: StrategyNormalizedIntent): AtomicIntentResolution {
    return {
      atomicIntent: {
        triggers: [
          {
            kind: 'grid_touch',
            params: {
              range: normalizedIntent.grid?.range,
              stepPct: normalizedIntent.grid?.stepPct,
              sideMode: normalizedIntent.grid?.sideMode,
              recycle: normalizedIntent.grid?.recycle,
            },
          },
        ],
        actions: normalizedIntent.actions.map(action => ({
          kind: action.key,
          ...(action.params ? { params: action.params as Record<string, unknown> } : {}),
        })),
        sizing: this.buildSizing(normalizedIntent),
        risk: normalizedIntent.risk.map(risk => ({ kind: risk.key, params: risk.params })),
        relations: [],
      },
      ambiguities: [],
    }
  }

  private resolveSingleLegIntent(normalizedIntent: StrategyNormalizedIntent): AtomicIntentResolution {
    const ambiguities: StrategyAmbiguity[] = []
    const triggers = normalizedIntent.triggers.flatMap((trigger) => {
      const resolution = this.resolveTrigger(trigger)
      ambiguities.push(...resolution.ambiguities)
      return resolution.triggers
    })

    return {
      atomicIntent: {
        triggers,
        actions: normalizedIntent.actions.map(action => ({
          kind: action.key,
          ...(action.params ? { params: action.params as Record<string, unknown> } : {}),
        })),
        sizing: this.buildSizing(normalizedIntent),
        risk: normalizedIntent.risk.map(risk => ({ kind: risk.key, params: risk.params })),
        relations: [],
      },
      ambiguities,
    }
  }

  private resolveTrigger(
    trigger: NormalizedTriggerAtom,
  ): Pick<AtomicIntentResolution, 'ambiguities'> & Pick<AtomicIntent, 'triggers'> {
    if (trigger.key.startsWith('bollinger.touch_')) {
      return this.resolveBollingerTrigger(trigger)
    }

    return {
      triggers: [
        {
          kind: 'normalized_trigger',
          phase: trigger.phase,
          triggerKey: trigger.key,
          params: {
            ...trigger.params,
            ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
          },
        },
      ],
      ambiguities: [],
    }
  }

  private resolveBollingerTrigger(
    trigger: NormalizedTriggerAtom,
  ): Pick<AtomicIntentResolution, 'ambiguities'> & Pick<AtomicIntent, 'triggers'> {
    const confirmation = trigger.resolutionHints?.confirmation ?? 'ambiguous_touch_or_close_confirm'
    if (confirmation === 'ambiguous_touch_or_close_confirm') {
      return {
        triggers: [],
        ambiguities: [
          {
            kind: 'atomic_semantic_fork',
            field: 'trigger.confirmation',
            message: '布林带触发尚不能确定是触及即生效还是收盘确认后生效。',
            choices: ['touch', 'close_confirm'],
          },
        ],
      }
    }

    return {
      triggers: [
        {
          kind: 'bollinger_band_trigger',
          phase: trigger.phase,
          triggerKey: trigger.key,
          params: {
            ...trigger.params,
            confirmation,
            ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
          },
        },
      ],
      ambiguities: [],
    }
  }

  private buildSizing(normalizedIntent: StrategyNormalizedIntent): AtomicIntent['sizing'] {
    return {
      kind: 'position_sizing',
      mode: normalizedIntent.position.mode,
      value: normalizedIntent.position.value,
      positionMode: normalizedIntent.position.positionMode,
    }
  }
}
