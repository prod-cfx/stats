import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticRule } from '../types/atom-expr'
import type { SemanticEventFrame } from '../types/semantic-event-frame'

@Injectable()
export class SemanticEventFrameProjectorService {
  project(frames: readonly SemanticEventFrame[]): CodegenSemanticPatch {
    const rules: SemanticRule[] = []

    for (const frame of frames) {
      if (frame.trigger.kind !== 'indicator_cross') continue

      rules.push({
        id: frame.id,
        phase: frame.phase,
        sideScope: frame.sideScope,
        condition: {
          kind: 'atom',
          key: this.resolveTriggerKey(frame.trigger.direction),
          params: {
            indicator: frame.trigger.indicator,
            semantic: frame.trigger.semantic,
            ...(frame.trigger.fastPeriod !== undefined ? { fastPeriod: frame.trigger.fastPeriod } : {}),
            ...(frame.trigger.slowPeriod !== undefined ? { slowPeriod: frame.trigger.slowPeriod } : {}),
            ...(frame.trigger.signalPeriod !== undefined ? { signalPeriod: frame.trigger.signalPeriod } : {}),
          },
          evidence: { text: frame.evidenceText },
        },
        effects: {
          actions: [{
            kind: 'atom',
            key: this.resolveActionKey(frame.action.kind),
            params: {},
            evidence: { text: frame.evidenceText },
          }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
        evidence: { text: frame.evidenceText },
      })
    }

    return rules.length > 0 ? { rules } : {}
  }

  private resolveTriggerKey(direction: SemanticEventFrame['trigger']['direction']): string {
    return direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under'
  }

  private resolveActionKey(action: SemanticEventFrame['action']['kind']): string {
    return `action.${action}`
  }
}
