import type { AtomicIntent, AtomicIntentResolution, StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { NormalizedTriggerAtom, StrategyNormalizedIntent, UnresolvedSlot } from '../types/strategy-normalized-intent'
import { Injectable } from '@nestjs/common'
import { buildSemanticSlotId } from '../types/semantic-state'

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
    const triggers = normalizedIntent.triggers.flatMap((trigger, triggerIndex) => {
      const resolution = this.resolveTrigger(trigger, triggerIndex)
      ambiguities.push(...resolution.ambiguities)
      return resolution.triggers
    })

    for (const hint of normalizedIntent.stateHints ?? []) {
      ambiguities.push(...(hint.unresolvedSlots ?? []).map(slot => this.toOpenSemanticSlot({
        slot,
        field: slot.slotKey,
        message: slot.questionHint,
      })))
    }

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
    triggerIndex: number,
  ): Pick<AtomicIntentResolution, 'ambiguities'> & Pick<AtomicIntent, 'triggers'> {
    const openSlotAmbiguities = (trigger.unresolvedSlots ?? []).map(slot => this.toOpenSemanticSlot({
      slot,
      field: slot.slotKey,
      message: slot.questionHint,
    }))

    if (trigger.key.startsWith('bollinger.touch_')) {
      const resolution = this.resolveBollingerTrigger(trigger, triggerIndex)
      return {
        triggers: resolution.triggers,
        ambiguities: [...openSlotAmbiguities, ...resolution.ambiguities],
      }
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
      ambiguities: openSlotAmbiguities,
    }
  }

  private toOpenSemanticSlot(input: {
    slot: UnresolvedSlot
    field: string
    message: string
  }): StrategyAmbiguity {
    return {
      kind: input.slot.slotKey.endsWith('.conflict') ? 'semantic_conflict' : 'open_semantic_slot',
      field: input.field,
      message: input.message,
      question: input.slot.questionHint,
      priority: input.slot.priority === 'core' ? 10 : input.slot.priority === 'behavior' ? 20 : input.slot.priority === 'risk' ? 30 : 40,
      slotId: buildSemanticSlotId(input.slot),
      slotKey: input.slot.slotKey,
      fieldPath: input.slot.fieldPath,
    }
  }

  private resolveBollingerTrigger(
    trigger: NormalizedTriggerAtom,
    triggerIndex: number,
  ): Pick<AtomicIntentResolution, 'ambiguities'> & Pick<AtomicIntent, 'triggers'> {
    const confirmation = trigger.resolutionHints?.confirmation ?? 'ambiguous_touch_or_close_confirm'
    if (confirmation === 'ambiguous_touch_or_close_confirm') {
      const phase = trigger.phase === 'exit' ? 'exit' : 'entry'
      const slotKey = `confirmationMode.${phase}`
      const fieldPath = `triggers[${triggerIndex}].params.confirmationMode`
      return {
        triggers: [],
        ambiguities: [
          {
            kind: 'atomic_semantic_fork',
            field: 'trigger.confirmation',
            message: '存在触碰即触发与收盘确认触发两种合法解释',
            choices: ['touch', 'close_confirm'],
            question: '该触发条件是触碰即触发，还是收盘确认后触发？',
            priority: 10,
            slotKey,
            fieldPath,
            slotId: buildSemanticSlotId({ slotKey, fieldPath }),
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
