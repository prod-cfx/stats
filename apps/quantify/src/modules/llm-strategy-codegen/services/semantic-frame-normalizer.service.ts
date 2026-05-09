import type {
  SemanticActionFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticDynamicGridFrame,
  SemanticFixedGridGatedFrame,
  SemanticIndicatorCompareFrame,
  SemanticNaturalLanguageFrame,
  SemanticPortfolioDrawdownFrame,
  SemanticRegimeGateFrame,
  SemanticRiskFrame,
} from '../types/semantic-natural-language-frame'
import type {
  CodegenSemanticOrchestrationDynamicGridNodePatch,
  CodegenSemanticOrchestrationFixedGridGatedNodePatch,
  CodegenSemanticOrchestrationGateNodePatch,
  CodegenSemanticOrchestrationPortfolioRiskNodePatch,
  CodegenSemanticPatch,
} from '../types/codegen-semantic-patch'
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
    const regimeGateByKey = new Map<string, CodegenSemanticOrchestrationGateNodePatch>()
    const regimeGateFrames: SemanticRegimeGateFrame[] = []
    const portfolioDrawdownByKey = new Map<string, CodegenSemanticOrchestrationPortfolioRiskNodePatch>()
    const portfolioDrawdownFrames: SemanticPortfolioDrawdownFrame[] = []
    const fixedGridGatedByKey = new Map<string, CodegenSemanticOrchestrationFixedGridGatedNodePatch>()
    const fixedGridGatedFrames: SemanticFixedGridGatedFrame[] = []
    const dynamicGridByKey = new Map<string, CodegenSemanticOrchestrationDynamicGridNodePatch>()
    const dynamicGridFrames: SemanticDynamicGridFrame[] = []

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
        case 'regime_gate':
          regimeGateFrames.push(frame)
          break
        case 'portfolio_drawdown':
          portfolioDrawdownFrames.push(frame)
          break
        case 'fixed_grid_gated':
          fixedGridGatedFrames.push(frame)
          break
        case 'dynamic_grid':
          dynamicGridFrames.push(frame)
          break
      }
    }

    regimeGateFrames.forEach((frame, index) => {
      const node = this.normalizeRegimeGate(frame, index)
      const dedupeKey = JSON.stringify([node.key, node.target.sideScope, node.activeWhen])

      if (!regimeGateByKey.has(dedupeKey)) {
        regimeGateByKey.set(dedupeKey, node)
      }
    })

    portfolioDrawdownFrames.forEach((frame, index) => {
      const node = this.normalizePortfolioDrawdown(frame, index)
      const dedupeKey = JSON.stringify([node.key, node.scope, node.mode, node.thresholdPct])

      if (!portfolioDrawdownByKey.has(dedupeKey)) {
        portfolioDrawdownByKey.set(dedupeKey, node)
      }
    })

    fixedGridGatedFrames.forEach((frame, index) => {
      const node = this.normalizeFixedGridGated(frame, index)
      const dedupeKey = JSON.stringify([node.key, node.activeWhenRef, node.gridParams, node.onDeactivate])

      if (!fixedGridGatedByKey.has(dedupeKey)) {
        fixedGridGatedByKey.set(dedupeKey, node)
      }
    })

    dynamicGridFrames.forEach((frame, index) => {
      const node = this.normalizeDynamicGrid(frame, index)
      const dedupeKey = JSON.stringify([
        node.key,
        node.activeWhenRef,
        node.anchorLookbackBars,
        node.anchorSide,
        node.dynamicGridStep,
        node.levelCount,
        node.onDeactivate,
      ])

      if (!dynamicGridByKey.has(dedupeKey)) {
        dynamicGridByKey.set(dedupeKey, node)
      }
    })

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

    const orchestrationNodes = [
      ...Array.from(regimeGateByKey.values()),
      ...Array.from(portfolioDrawdownByKey.values()),
      ...Array.from(fixedGridGatedByKey.values()),
      ...Array.from(dynamicGridByKey.values()),
    ]
    if (orchestrationNodes.length > 0) {
      patch.orchestration = { nodes: orchestrationNodes }
    }

    return patch
  }

  private normalizeRegimeGate(frame: SemanticRegimeGateFrame, index: number): CodegenSemanticOrchestrationGateNodePatch {
    const indicatorName = frame.indicator === 'ma' ? 'sma' : frame.indicator
    const activeWhen: SemanticExpression = {
      kind: 'predicate',
      op: frame.operator,
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'indicator', name: indicatorName, params: { period: frame.period } },
    }

    return {
      id: `orchestration-gate-regime-${index + 1}`,
      kind: 'gate',
      key: 'gate.regime',
      params: {
        sideScope: frame.sideScope,
        indicator: frame.indicator,
        period: frame.period,
        operator: frame.operator,
      },
      target: { phase: 'entry', sideScope: frame.sideScope },
      activeWhen,
      effectWhenFalse: 'block_new_entries',
      evidence: this.toEvidence(frame),
    }
  }

  private normalizePortfolioDrawdown(
    frame: SemanticPortfolioDrawdownFrame,
    index: number,
  ): CodegenSemanticOrchestrationPortfolioRiskNodePatch {
    return {
      id: `orchestration-portfolio-risk-drawdown-${index + 1}`,
      kind: 'portfolioRisk',
      key: 'portfolioRisk.drawdown_block',
      params: {
        thresholdPct: frame.thresholdPct,
        mode: frame.mode,
      },
      scope: 'portfolio',
      mode: frame.mode,
      thresholdPct: frame.thresholdPct,
      evidence: this.toEvidence(frame),
    }
  }

  private normalizeFixedGridGated(
    frame: SemanticFixedGridGatedFrame,
    index: number,
  ): CodegenSemanticOrchestrationFixedGridGatedNodePatch {
    const gridParams: CodegenSemanticOrchestrationFixedGridGatedNodePatch['gridParams'] = {
      anchorPrice: frame.anchorPrice,
      levelCount: frame.levelCount,
      stepPct: frame.stepPct,
    }

    if (frame.lowerBound !== undefined) {
      gridParams.lowerBound = frame.lowerBound
    }
    if (frame.upperBound !== undefined) {
      gridParams.upperBound = frame.upperBound
    }

    return {
      id: `orchestration-program-fixed-grid-gated-${index + 1}`,
      kind: 'program',
      key: 'program.fixed_grid_gated',
      params: {
        anchorPrice: frame.anchorPrice,
        levelCount: frame.levelCount,
        stepPct: frame.stepPct,
        lowerBound: frame.lowerBound,
        upperBound: frame.upperBound,
        onDeactivate: frame.onDeactivate,
        sizing: frame.sizing,
      },
      programKind: 'fixed_grid_gated',
      activeWhenRef: frame.activeWhenRef,
      onDeactivate: frame.onDeactivate,
      rebuildPolicy: 'static',
      gridParams,
      sizing: frame.sizing,
      evidence: this.toEvidence(frame),
    }
  }

  private normalizeDynamicGrid(
    frame: SemanticDynamicGridFrame,
    index: number,
  ): CodegenSemanticOrchestrationDynamicGridNodePatch {
    return {
      id: `orchestration-program-dynamic-grid-${index + 1}`,
      kind: 'program',
      key: 'program.dynamic_grid',
      params: {
        anchorLookbackBars: frame.anchorLookbackBars,
        anchorSide: frame.anchorSide,
        levelCount: frame.levelCount,
        step: frame.step,
        anchorDriftPct: frame.anchorDriftPct,
        rebuildMinIntervalSec: frame.rebuildMinIntervalSec,
        onDeactivate: frame.onDeactivate,
        sizing: frame.sizing,
      },
      programKind: 'dynamic_grid',
      activeWhenRef: frame.activeWhenRef,
      onDeactivate: frame.onDeactivate,
      rebuildPolicy: 'anchor_on_state_change',
      anchorLookbackBars: frame.anchorLookbackBars,
      anchorSide: frame.anchorSide,
      anchorDriftPct: frame.anchorDriftPct,
      rebuildMinIntervalSec: frame.rebuildMinIntervalSec,
      levelCount: frame.levelCount,
      dynamicGridStep: frame.step,
      sizing: frame.sizing,
      evidence: this.toEvidence(frame),
    }
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

  private toCombinationEvidenceKey(frame: Pick<SemanticCombinationFrame, 'groupId' | 'sideScope'>): string {
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
