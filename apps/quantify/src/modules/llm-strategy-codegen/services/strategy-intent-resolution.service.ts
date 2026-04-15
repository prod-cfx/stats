import type {
  AtomicIntent,
  AtomicIntentResolution,
  AtomicIntentSemanticKind,
  StrategyAmbiguity,
  StrategyAmbiguityLane,
} from '../types/strategy-ambiguity'
import type { UnresolvedSlot } from '../types/strategy-normalized-intent'

const LANE_PRIORITY: Record<StrategyAmbiguityLane, number> = {
  signal: 1,
  behavior: 2,
  risk: 3,
  context: 4,
}

const SLOT_PRIORITY: Record<UnresolvedSlot['priority'], number> = {
  core: 1,
  behavior: 2,
  risk: 3,
  context: 4,
}

export class StrategyIntentResolutionService {
  resolve(input: AtomicIntent): AtomicIntentResolution {
    const ambiguities: StrategyAmbiguity[] = [
      ...input.normalizedIntent.triggers.flatMap((trigger) => this.toAmbiguities({
        lane: 'signal',
        semanticKind: 'trigger',
        semanticKey: trigger.key,
        phase: trigger.phase,
        unresolvedSlots: trigger.unresolvedSlots,
      })),
      ...input.normalizedIntent.actions.flatMap((action) => this.toAmbiguities({
        lane: 'signal',
        semanticKind: 'action',
        semanticKey: action.key,
        unresolvedSlots: action.unresolvedSlots,
      })),
      ...input.normalizedIntent.risk.flatMap((risk) => this.toAmbiguities({
        lane: 'risk',
        semanticKind: 'risk',
        semanticKey: risk.key,
        unresolvedSlots: risk.unresolvedSlots,
      })),
      ...this.toAmbiguities({
        lane: 'context',
        semanticKind: 'position',
        semanticKey: 'position',
        unresolvedSlots: input.normalizedIntent.position.unresolvedSlots,
      }),
      ...this.toAmbiguities({
        lane: 'signal',
        semanticKind: 'grid',
        semanticKey: input.normalizedIntent.grid?.family ?? 'grid',
        unresolvedSlots: input.normalizedIntent.grid?.unresolvedSlots,
      }),
      ...(input.normalizedIntent.stateHints ?? []).flatMap((hint) => this.toAmbiguities({
        lane: 'behavior',
        semanticKind: 'state_hint',
        semanticKey: hint.type,
        unresolvedSlots: hint.unresolvedSlots,
      })),
    ].sort((left, right) => this.compareAmbiguities(left, right))

    return {
      ambiguities,
      nextQuestion: ambiguities[0] ?? null,
    }
  }

  private toAmbiguities(input: {
    lane: StrategyAmbiguityLane
    semanticKind: AtomicIntentSemanticKind
    semanticKey: string
    phase?: StrategyAmbiguity['phase']
    unresolvedSlots?: UnresolvedSlot[]
  }): StrategyAmbiguity[] {
    return (input.unresolvedSlots ?? []).map(slot => ({
      ...slot,
      kind: slot.slotKey.endsWith('.conflict') ? 'semantic_conflict' : undefined,
      lane: input.lane,
      semanticKind: input.semanticKind,
      semanticKey: input.semanticKey,
      ...(input.phase ? { phase: input.phase } : {}),
    })).map(item => ({
      ...item,
      kind: item.kind ?? item.reason,
    }))
  }

  private compareAmbiguities(left: StrategyAmbiguity, right: StrategyAmbiguity): number {
    const laneDelta = LANE_PRIORITY[left.lane] - LANE_PRIORITY[right.lane]
    if (laneDelta !== 0) return laneDelta

    const priorityDelta = SLOT_PRIORITY[left.priority] - SLOT_PRIORITY[right.priority]
    if (priorityDelta !== 0) return priorityDelta

    const executionDelta = Number(right.affectsExecution) - Number(left.affectsExecution)
    if (executionDelta !== 0) return executionDelta

    return left.fieldPath.localeCompare(right.fieldPath)
  }
}
