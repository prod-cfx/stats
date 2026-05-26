import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticEventFrame } from '../types/semantic-event-frame'

type ProjectedTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type ProjectedAction = NonNullable<CodegenSemanticPatch['actions']>[number]

@Injectable()
export class SemanticEventFrameProjectorService {
  project(frames: readonly SemanticEventFrame[]): CodegenSemanticPatch {
    const triggers: ProjectedTrigger[] = []
    const actions: ProjectedAction[] = []
    const seenActionKeys = new Set<string>()

    for (const frame of frames) {
      if (frame.trigger.kind !== 'indicator_cross') continue

      triggers.push({
        key: this.resolveTriggerKey(frame.trigger.direction),
        phase: frame.phase,
        sideScope: frame.sideScope,
        params: {
          indicator: frame.trigger.indicator,
          semantic: frame.trigger.semantic,
          ...(frame.trigger.fastPeriod !== undefined ? { fastPeriod: frame.trigger.fastPeriod } : {}),
          ...(frame.trigger.slowPeriod !== undefined ? { slowPeriod: frame.trigger.slowPeriod } : {}),
          ...(frame.trigger.signalPeriod !== undefined ? { signalPeriod: frame.trigger.signalPeriod } : {}),
        },
        evidence: {
          text: frame.evidenceText,
          source: 'user_explicit',
        },
      })

      if (!seenActionKeys.has(frame.action.kind)) {
        seenActionKeys.add(frame.action.kind)
        actions.push({
          key: frame.action.kind,
          evidence: {
            text: frame.evidenceText,
            source: 'user_explicit',
          },
        })
      }
    }

    const patch: CodegenSemanticPatch = {}
    if (triggers.length > 0) {
      patch.triggers = triggers
    }
    if (actions.length > 0) {
      patch.actions = actions
    }
    return patch
  }

  private resolveTriggerKey(direction: SemanticEventFrame['trigger']['direction']): string {
    return direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under'
  }
}
