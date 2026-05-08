import type {
  SemanticActionFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticIndicatorCompareFrame,
  SemanticNaturalLanguageFrame,
  SemanticRiskFrame,
} from '../types/semantic-natural-language-frame'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticEvidence, SemanticExpression, SemanticExpressionOperand } from '../types/semantic-state'
import { Injectable } from '@nestjs/common'

interface SemanticCombinationMetadata {
  join: SemanticCombinationFrame['join']
  evidence: SemanticEvidence
}

@Injectable()
export class SemanticFrameNormalizerService {
  normalize(frames: readonly SemanticNaturalLanguageFrame[]): CodegenSemanticPatch {
    const patch: CodegenSemanticPatch = {}
    const indicatorCompareGroups = new Map<string, {
      groupId: string
      frames: SemanticIndicatorCompareFrame[]
    }>()
    const combinationByKey = new Map<string, SemanticCombinationMetadata>()
    const actionsByKey = new Map<SemanticActionFrame['actionKey'], SemanticActionFrame>()
    const riskByKey = new Map<string, NonNullable<CodegenSemanticPatch['risk']>[number]>()

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
          this.appendIndicatorCompareGroup(indicatorCompareGroups, frame)
          break
        case 'action':
          if (!actionsByKey.has(frame.actionKey)) {
            actionsByKey.set(frame.actionKey, frame)
          }
          break
        case 'risk':
          this.setRisk(riskByKey, frame)
          break
        case 'combination':
          combinationByKey.set(this.toCombinationEvidenceKey(frame), {
            join: frame.join,
            evidence: this.toEvidence(frame),
          })
          break
      }
    }

    const gateTriggers = Array.from(indicatorCompareGroups.values()).map(group =>
      this.normalizeIndicatorCompareGroup(group.groupId, group.frames, combinationByKey),
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

    const risk = Array.from(riskByKey.values())
    if (risk.length > 0) {
      patch.risk = risk
    }

    return patch
  }

  private appendIndicatorCompareGroup(
    groups: Map<string, { groupId: string, frames: SemanticIndicatorCompareFrame[] }>,
    frame: SemanticIndicatorCompareFrame,
  ): void {
    const groupKey = this.toIndicatorCompareGroupKey(frame)
    const group = groups.get(groupKey) ?? { groupId: frame.groupId, frames: [] }

    group.frames.push(frame)
    groups.set(groupKey, group)
  }

  private toIndicatorCompareGroupKey(frame: SemanticIndicatorCompareFrame): string {
    return [frame.groupId, frame.sideScope, frame.operator, frame.indicator].join(':')
  }

  private toCombinationEvidenceKey(frame: SemanticCombinationFrame): string {
    return [frame.groupId, frame.sideScope].join(':')
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
    combinationByKey: ReadonlyMap<string, SemanticCombinationMetadata>,
  ): NonNullable<CodegenSemanticPatch['triggers']>[number] {
    const sortedFrames = [...frames].sort((left, right) => left.period - right.period)
    const firstFrame = sortedFrames[0]
    const combination = firstFrame ? combinationByKey.get(this.toCombinationEvidenceKey(firstFrame)) : undefined
    const join = combination?.join ?? 'AND'

    return {
      key: 'condition.expression',
      phase: 'gate',
      sideScope: firstFrame?.sideScope,
      params: {
        expression: this.toExpression(sortedFrames, join),
        displayGroupId: groupId,
        label: this.toGroupLabel(sortedFrames, join),
      },
      evidence: firstFrame
        ? this.toGroupEvidence(firstFrame, sortedFrames, combination)
        : undefined,
    }
  }

  private toExpression(
    frames: readonly SemanticIndicatorCompareFrame[],
    join: SemanticCombinationFrame['join'],
  ): SemanticExpression {
    return {
      kind: join,
      children: frames.map(frame => ({
        kind: 'predicate',
        op: frame.operator,
        left: this.barCloseOperand(),
        right: this.indicatorOperand(frame),
      })),
    }
  }

  private barCloseOperand(): SemanticExpressionOperand {
    return { kind: 'series', source: 'bar', field: 'close' }
  }

  private indicatorOperand(frame: SemanticIndicatorCompareFrame): SemanticExpressionOperand {
    const name = frame.indicator === 'ma' ? 'sma' : frame.indicator

    return { kind: 'indicator', name, params: { period: frame.period } }
  }

  private toGroupLabel(
    frames: readonly SemanticIndicatorCompareFrame[],
    join: SemanticCombinationFrame['join'],
  ): string {
    const indicatorName = frames[0]?.indicator === 'ma' ? 'MA' : (frames[0]?.indicator ?? 'ema').toUpperCase()
    const periods = frames.map(frame => `${indicatorName}${frame.period}`).join('、')
    const directionText = frames[0]?.operator === 'LT' ? '下方' : '上方'
    const joinText = join === 'OR' ? '任一' : '同时'

    return `价格${joinText}位于 ${periods} ${directionText}`
  }

  private toGroupEvidence(
    firstFrame: SemanticIndicatorCompareFrame,
    frames: readonly SemanticIndicatorCompareFrame[],
    combination: SemanticCombinationMetadata | undefined,
  ): SemanticEvidence {
    return combination?.evidence ?? {
      text: frames.map(frame => frame.evidenceText).join(' '),
      source: 'user_explicit',
    }
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

  private setRisk(
    risks: Map<string, NonNullable<CodegenSemanticPatch['risk']>[number]>,
    frame: SemanticRiskFrame,
  ): void {
    const risk = this.normalizeRisk(frame)
    const riskKey = JSON.stringify([risk.key, risk.params])

    if (!risks.has(riskKey)) {
      risks.set(riskKey, risk)
    }
  }

  private toEvidence(frame: SemanticNaturalLanguageFrame): SemanticEvidence {
    return { text: frame.evidenceText, source: 'user_explicit' }
  }
}
