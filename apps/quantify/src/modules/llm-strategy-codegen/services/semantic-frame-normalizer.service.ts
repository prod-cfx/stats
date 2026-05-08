import type {
  SemanticActionFrame,
  SemanticBoundaryTouchFrame,
  SemanticIndicatorCompareFrame,
  SemanticNaturalLanguageFrame,
  SemanticRiskFrame,
} from '../types/semantic-natural-language-frame'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticEvidence, SemanticExpression, SemanticExpressionOperand } from '../types/semantic-state'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SemanticFrameNormalizerService {
  normalize(frames: readonly SemanticNaturalLanguageFrame[]): CodegenSemanticPatch {
    const patch: CodegenSemanticPatch = {}
    const indicatorCompareGroups = new Map<string, SemanticIndicatorCompareFrame[]>()
    const actionsByKey = new Map<SemanticActionFrame['actionKey'], SemanticActionFrame>()

    for (const frame of frames) {
      switch (frame.kind) {
        case 'context':
          patch.contextSlots = {
            ...patch.contextSlots,
            [frame.field]: frame.value,
          }
          break
        case 'boundary_touch':
          patch.triggers = [...(patch.triggers ?? []), this.normalizeBoundaryTouch(frame)]
          break
        case 'indicator_compare':
          indicatorCompareGroups.set(frame.groupId, [...(indicatorCompareGroups.get(frame.groupId) ?? []), frame])
          break
        case 'action':
          if (!actionsByKey.has(frame.actionKey)) {
            actionsByKey.set(frame.actionKey, frame)
          }
          break
        case 'risk':
          patch.risk = [...(patch.risk ?? []), this.normalizeRisk(frame)]
          break
        case 'combination':
          break
      }
    }

    const gateTriggers = Array.from(indicatorCompareGroups.entries()).map(([groupId, groupFrames]) =>
      this.normalizeIndicatorCompareGroup(groupId, groupFrames),
    )
    if (gateTriggers.length > 0) {
      patch.triggers = [...gateTriggers, ...(patch.triggers ?? [])]
    }

    const actions = Array.from(actionsByKey.values()).map(frame => ({
      key: frame.actionKey,
      evidence: this.toEvidence(frame),
    }))
    if (actions.length > 0) {
      patch.actions = actions
    }

    return patch
  }

  private normalizeBoundaryTouch(frame: SemanticBoundaryTouchFrame): NonNullable<CodegenSemanticPatch['triggers']>[number] {
    return {
      key: 'price.detect.indicator_boundary',
      phase: frame.phase,
      sideScope: frame.sideScope,
      params: {
        indicator: { name: 'bollinger', period: 20, stdDev: 2 },
        boundaryRole: frame.boundaryRole,
        confirmationMode: 'touch',
      },
      evidence: this.toEvidence(frame),
    }
  }

  private normalizeIndicatorCompareGroup(
    groupId: string,
    frames: readonly SemanticIndicatorCompareFrame[],
  ): NonNullable<CodegenSemanticPatch['triggers']>[number] {
    const sortedFrames = [...frames].sort((left, right) => left.period - right.period)

    return {
      key: 'condition.expression',
      phase: 'gate',
      sideScope: sortedFrames[0]?.sideScope,
      params: {
        expression: this.toAndExpression(sortedFrames),
        displayGroupId: groupId,
        label: this.toGroupLabel(sortedFrames),
      },
      evidence: sortedFrames[0] ? this.toEvidence(sortedFrames[0]) : undefined,
    }
  }

  private toAndExpression(frames: readonly SemanticIndicatorCompareFrame[]): SemanticExpression {
    return {
      kind: 'AND',
      children: frames.map(frame => ({
        kind: 'predicate',
        op: frame.operator,
        left: this.barCloseOperand(),
        right: this.emaOperand(frame.period),
      })),
    }
  }

  private barCloseOperand(): SemanticExpressionOperand {
    return { kind: 'series', source: 'bar', field: 'close' }
  }

  private emaOperand(period: number): SemanticExpressionOperand {
    return { kind: 'indicator', name: 'ema', params: { period } }
  }

  private toGroupLabel(frames: readonly SemanticIndicatorCompareFrame[]): string {
    const periods = frames.map(frame => `EMA${frame.period}`).join('、')
    const directionText = frames[0]?.operator === 'LT' ? '下方' : '上方'

    return `价格同时位于 ${periods} ${directionText}`
  }

  private normalizeRisk(frame: SemanticRiskFrame): NonNullable<CodegenSemanticPatch['risk']>[number] {
    return {
      key: 'risk.stop_loss_pct',
      params: {
        valuePct: frame.valuePct,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'user_explicit',
        effect: 'close_position',
        scope: 'current_position',
      },
      evidence: this.toEvidence(frame),
    }
  }

  private toEvidence(frame: SemanticNaturalLanguageFrame): SemanticEvidence {
    return { text: frame.evidenceText, source: 'user_explicit' }
  }
}
