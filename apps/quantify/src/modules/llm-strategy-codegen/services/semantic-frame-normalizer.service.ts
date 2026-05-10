import type {
  SemanticActionFrame,
  SemanticAdaptiveVolatilityGridFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticDataSourceScopeFrame,
  SemanticDynamicGridFrame,
  SemanticEventListenerFrame,
  SemanticFixedGridGatedFrame,
  SemanticIndicatorCompareFrame,
  SemanticLegScopeFrame,
  SemanticNaturalLanguageFrame,
  SemanticPortfolioDrawdownFrame,
  SemanticRegimeGateFrame,
  SemanticRiskFrame,
  SemanticSubStrategyGateFrame,
  SemanticSubStrategyScopeFrame,
  SemanticSymbolScopeFrame,
  SemanticTimeframeScopeFrame,
} from '../types/semantic-natural-language-frame'
import type {
  CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch,
  CodegenSemanticOrchestrationDataSourceScopeNodePatch,
  CodegenSemanticOrchestrationDynamicGridProgramNodePatch,
  CodegenSemanticOrchestrationEventListenerProgramNodePatch,
  CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch,
  CodegenSemanticOrchestrationGateNodePatch,
  CodegenSemanticOrchestrationLegScopeNodePatch,
  CodegenSemanticOrchestrationPortfolioRiskNodePatch,
  CodegenSemanticOrchestrationSubStrategyGateNodePatch,
  CodegenSemanticOrchestrationSubStrategyScopeNodePatch,
  CodegenSemanticOrchestrationSymbolScopeNodePatch,
  CodegenSemanticOrchestrationTimeframeScopeNodePatch,
  CodegenSemanticPatch,
} from '../types/codegen-semantic-patch'
import type {
  SemanticEvidence,
  SemanticExpression,
  SemanticExpressionOperand,
  SemanticSupportedTimeframe,
} from '../types/semantic-state'
import { Injectable } from '@nestjs/common'
import { parseTimeframeMs } from '@ai/shared/script-engine/compiled-runtime'

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
    const fixedGridGatedByKey = new Map<string, CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch>()
    const fixedGridGatedFrames: SemanticFixedGridGatedFrame[] = []
    const dynamicGridByKey = new Map<string, CodegenSemanticOrchestrationDynamicGridProgramNodePatch>()
    const dynamicGridFrames: SemanticDynamicGridFrame[] = []
    const adaptiveByKey = new Map<string, CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch>()
    const adaptiveFrames: SemanticAdaptiveVolatilityGridFrame[] = []
    // Phase 5 S12 (#1118): event_listener
    const eventListenerByKey = new Map<string, CodegenSemanticOrchestrationEventListenerProgramNodePatch>()
    const eventListenerFrames: SemanticEventListenerFrame[] = []
    const symbolScopeByKey = new Map<string, CodegenSemanticOrchestrationSymbolScopeNodePatch>()
    const symbolScopeFrames: SemanticSymbolScopeFrame[] = []
    // Phase 5 S11 (#1112): leg_scope 同 utterance 命中时由 NL gateway 已 suppress symbol_scope
    //   normalizer 在 case 'leg_scope' 分支按 leg.instrumentSymbol 各自创建独立 scope.symbol node
    const legScopeFrames: SemanticLegScopeFrame[] = []
    const legScopeSymbolByKey = new Map<string, CodegenSemanticOrchestrationSymbolScopeNodePatch>()
    const legScopeLegByKey = new Map<string, CodegenSemanticOrchestrationLegScopeNodePatch>()
    const timeframeScopeByKey = new Map<string, CodegenSemanticOrchestrationTimeframeScopeNodePatch>()
    const timeframeScopeFrames: SemanticTimeframeScopeFrame[] = []
    const dataSourceScopeByKey = new Map<string, CodegenSemanticOrchestrationDataSourceScopeNodePatch>()
    const dataSourceScopeFrames: SemanticDataSourceScopeFrame[] = []
    // Phase 5 S10 (#1111)
    const subStrategyScopeByKey = new Map<string, CodegenSemanticOrchestrationSubStrategyScopeNodePatch>()
    const subStrategyScopeFrames: SemanticSubStrategyScopeFrame[] = []
    const subStrategyGateByKey = new Map<string, CodegenSemanticOrchestrationSubStrategyGateNodePatch>()
    const subStrategyGateFrames: SemanticSubStrategyGateFrame[] = []

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
        case 'adaptive_volatility_grid':
          adaptiveFrames.push(frame)
          break
        case 'event_listener':
          eventListenerFrames.push(frame)
          break
        case 'symbol_scope':
          symbolScopeFrames.push(frame)
          break
        case 'leg_scope':
          legScopeFrames.push(frame)
          break
        case 'timeframe_scope':
          timeframeScopeFrames.push(frame)
          break
        case 'data_source_scope':
          dataSourceScopeFrames.push(frame)
          break
        case 'sub_strategy_scope':
          subStrategyScopeFrames.push(frame)
          break
        case 'sub_strategy_gate':
          subStrategyGateFrames.push(frame)
          break
      }
    }

    regimeGateFrames.forEach((frame, index) => {
      const node = this.normalizeRegimeGate(frame, index)
      // Phase 5 S10 (#1117) follow-up：target 升级为 discriminated union 后 sideScope 仅存在于 phase='entry' 分支
      const targetSideScope = node.target.phase === 'entry' ? node.target.sideScope : undefined
      const dedupeKey = JSON.stringify([node.key, targetSideScope, node.activeWhen])

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

    adaptiveFrames.forEach((frame, index) => {
      const node = this.normalizeAdaptiveVolatilityGrid(frame, index)
      const dedupeKey = JSON.stringify([
        node.key,
        node.activeWhenRef,
        node.atrPeriod,
        node.atrMultiplier,
        node.rangeMultiplier,
        node.minStepPct,
        node.maxStepPct,
        node.levelCount,
        node.onDeactivate,
      ])

      if (!adaptiveByKey.has(dedupeKey)) {
        adaptiveByKey.set(dedupeKey, node)
      }
    })

    // Phase 5 S12 (#1118): event_listener
    eventListenerFrames.forEach((frame, index) => {
      const node = this.normalizeEventListener(frame, index)
      const dedupeKey = JSON.stringify([
        node.key,
        node.activeWhenRef,
        node.sourceRef,
        node.permissionScope,
        node.idempotencyKey.fieldPath,
        node.dedupWindowMs,
        node.expirationTtlMs,
        node.expirationPolicy,
        node.onDeactivate,
        node.rebuildPolicy,
      ])
      if (!eventListenerByKey.has(dedupeKey)) {
        eventListenerByKey.set(dedupeKey, node)
      }
    })

    symbolScopeFrames.forEach((frame, index) => {
      const node = this.normalizeSymbolScope(frame, index)
      const dedupeKey = JSON.stringify([node.key, [...node.symbols].sort(), node.primarySymbol ?? null])
      if (!symbolScopeByKey.has(dedupeKey)) {
        symbolScopeByKey.set(dedupeKey, node)
      }
    })

    // Phase 5 S11 (#1112): leg_scope frame → N 个 scope.symbol + N 个 scope.leg
    legScopeFrames.forEach((frame) => {
      for (const leg of frame.legs) {
        const symbolNodeId = `orchestration-scope-symbol-from-leg-${leg.legId}`
        const symbolNode: CodegenSemanticOrchestrationSymbolScopeNodePatch = {
          id: symbolNodeId,
          kind: 'scope',
          key: 'scope.symbol',
          params: { symbols: [leg.instrumentSymbol], primarySymbol: leg.instrumentSymbol },
          symbolScopeKind: 'symbol',
          symbols: [leg.instrumentSymbol],
          primarySymbol: leg.instrumentSymbol,
          evidence: this.toEvidence(frame),
        }
        const symbolDedupeKey = JSON.stringify(['scope.symbol', [leg.instrumentSymbol], leg.instrumentSymbol, leg.legId])
        if (!legScopeSymbolByKey.has(symbolDedupeKey)) {
          legScopeSymbolByKey.set(symbolDedupeKey, symbolNode)
        }

        const legNode: CodegenSemanticOrchestrationLegScopeNodePatch = {
          id: `orchestration-scope-leg-${leg.legId}`,
          kind: 'scope',
          key: 'scope.leg',
          params: {
            legId: leg.legId,
            direction: leg.direction,
            instrumentSymbol: leg.instrumentSymbol,
            ...(leg.sizing ? { legSizing: leg.sizing } : {}),
          },
          legScopeKind: 'leg',
          legId: leg.legId,
          direction: leg.direction,
          instrumentRef: symbolNodeId,
          ...(leg.sizing ? { legSizing: leg.sizing } : {}),
          ...(frame.syncTriggerRequired === true ? { syncTriggerRequired: true } : {}),
          evidence: this.toEvidence(frame),
        }
        const legDedupeKey = JSON.stringify(['scope.leg', leg.legId])
        if (!legScopeLegByKey.has(legDedupeKey)) {
          legScopeLegByKey.set(legDedupeKey, legNode)
        }
      }
    })

    timeframeScopeFrames.forEach((frame, index) => {
      const node = this.normalizeTimeframeScope(frame, index)
      if (node === null) return
      const dedupeKey = JSON.stringify([node.key, node.primaryTimeframe, [...node.requiredTimeframes].sort(), node.alignmentPolicy])
      if (!timeframeScopeByKey.has(dedupeKey)) {
        timeframeScopeByKey.set(dedupeKey, node)
      }
    })

    // Phase 5 S9 (#1110): data_source_scope frame → orchestration scope node patch
    dataSourceScopeFrames.forEach((frame, index) => {
      const node = this.normalizeDataSourceScope(frame, index)
      const dedupeKey = JSON.stringify([node.key, node.dataSourceRole, node.dataSourceFeedId, node.dataSourceSchemaRef])
      if (!dataSourceScopeByKey.has(dedupeKey)) {
        dataSourceScopeByKey.set(dedupeKey, node)
      }
    })

    // Phase 5 S10 (#1111): subStrategy scope/gate normalize + dedupe
    subStrategyScopeFrames.forEach((frame, index) => {
      const node = this.normalizeSubStrategyScope(frame, index)
      const dedupeKey = JSON.stringify([
        node.key,
        node.subStrategyId,
        node.positionHandlingOnDeactivate ?? null,
        node.orderHandlingOnDeactivate ?? null,
      ])
      if (!subStrategyScopeByKey.has(dedupeKey)) {
        subStrategyScopeByKey.set(dedupeKey, node)
      }
    })
    subStrategyGateFrames.forEach((frame, index) => {
      const node = this.normalizeSubStrategyGate(frame, index)
      const dedupeKey = JSON.stringify([
        node.key,
        node.target,
        node.effectWhenFalse,
      ])
      if (!subStrategyGateByKey.has(dedupeKey)) {
        subStrategyGateByKey.set(dedupeKey, node)
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
      ...Array.from(adaptiveByKey.values()),
      ...Array.from(eventListenerByKey.values()),
      ...Array.from(symbolScopeByKey.values()),
      // Phase 5 S11 (#1112): leg_scope frame 扩展出的 scope.symbol + scope.leg 节点
      //   注意 scope.symbol 节点必须排在 scope.leg 之前，便于 readiness Pass 1/2 顺序处理
      ...Array.from(legScopeSymbolByKey.values()),
      ...Array.from(legScopeLegByKey.values()),
      ...Array.from(timeframeScopeByKey.values()),
      ...Array.from(dataSourceScopeByKey.values()),
      // Phase 5 S10 (#1111)
      ...Array.from(subStrategyScopeByKey.values()),
      ...Array.from(subStrategyGateByKey.values()),
    ]
    if (orchestrationNodes.length > 0) {
      patch.orchestration = { nodes: orchestrationNodes }
    }

    return patch
  }

  // Phase 5 S3 (#1109): timeframe_scope frame → orchestration scope node patch
  // 默认 alignmentPolicy = 'strict'（critic Round 1 C4：与 fail-closed 主张一致）
  // 非法 timeframe vocab 返回 null（caller dedup loop 跳过）
  private normalizeTimeframeScope(
    frame: SemanticTimeframeScopeFrame,
    index: number,
  ): CodegenSemanticOrchestrationTimeframeScopeNodePatch | null {
    const primaryMs = parseTimeframeMs(frame.primaryTimeframe)
    if (primaryMs === null) return null
    const requiredMs: number[] = []
    for (const tf of frame.requiredTimeframes) {
      const ms = parseTimeframeMs(tf)
      if (ms === null) return null
      requiredMs.push(ms)
    }
    if (requiredMs.length === 0) return null
    const sortedRequired = [...frame.requiredTimeframes].sort(
      (a, b) => (parseTimeframeMs(a) ?? 0) - (parseTimeframeMs(b) ?? 0),
    )
    const alignmentPolicy = frame.alignmentPolicy === 'tolerant' ? 'tolerant' : 'strict'
    return {
      id: `orchestration-scope-timeframe-${index + 1}`,
      kind: 'scope',
      key: 'scope.timeframe',
      params: {
        primaryTimeframe: frame.primaryTimeframe,
        requiredTimeframes: [...sortedRequired],
        alignmentPolicy,
      },
      timeframeScopeKind: 'timeframe',
      primaryTimeframe: frame.primaryTimeframe as SemanticSupportedTimeframe,
      requiredTimeframes: sortedRequired as readonly SemanticSupportedTimeframe[],
      alignmentPolicy,
      evidence: this.toEvidence(frame),
    }
  }

  // Phase 5 S2 (#1104): symbol_scope frame → orchestration scope node patch
  private normalizeSymbolScope(
    frame: SemanticSymbolScopeFrame,
    index: number,
  ): CodegenSemanticOrchestrationSymbolScopeNodePatch {
    return {
      id: `orchestration-scope-symbol-${index + 1}`,
      kind: 'scope',
      key: 'scope.symbol',
      params: {
        symbols: [...frame.symbols],
        ...(frame.primarySymbol ? { primarySymbol: frame.primarySymbol } : {}),
      },
      symbolScopeKind: 'symbol',
      symbols: [...frame.symbols].sort(),
      ...(frame.primarySymbol ? { primarySymbol: frame.primarySymbol } : {}),
      evidence: this.toEvidence(frame),
    }
  }

  // Phase 5 S9 (#1110): data_source_scope frame → orchestration scope node patch
  private normalizeDataSourceScope(
    frame: SemanticDataSourceScopeFrame,
    index: number,
  ): CodegenSemanticOrchestrationDataSourceScopeNodePatch {
    return {
      id: `orchestration-scope-data-source-${index + 1}`,
      kind: 'scope',
      key: 'scope.dataSource',
      params: {
        role: frame.role,
        feedId: frame.feedId,
        schemaRef: frame.schemaRef,
      },
      dataSourceScopeKind: 'dataSource',
      dataSourceRole: frame.role,
      dataSourceFeedId: frame.feedId,
      dataSourceSchemaRef: frame.schemaRef,
      evidence: this.toEvidence(frame),
    }
  }

  // Phase 5 S10 (#1111): sub_strategy_scope frame → orchestration scope node patch
  private normalizeSubStrategyScope(
    frame: SemanticSubStrategyScopeFrame,
    index: number,
  ): CodegenSemanticOrchestrationSubStrategyScopeNodePatch {
    return {
      id: `orchestration-scope-substrategy-${index + 1}`,
      kind: 'scope',
      key: 'scope.subStrategy',
      params: {
        subStrategyId: frame.subStrategyId,
        ...(frame.subStrategyLabel ? { subStrategyLabel: frame.subStrategyLabel } : {}),
        ...(frame.positionHandlingOnDeactivate ? { positionHandlingOnDeactivate: frame.positionHandlingOnDeactivate } : {}),
        ...(frame.orderHandlingOnDeactivate ? { orderHandlingOnDeactivate: frame.orderHandlingOnDeactivate } : {}),
      },
      subStrategyScopeKind: 'subStrategy',
      subStrategyId: frame.subStrategyId,
      ...(frame.subStrategyLabel ? { subStrategyLabel: frame.subStrategyLabel } : {}),
      ...(frame.positionHandlingOnDeactivate ? { positionHandlingOnDeactivate: frame.positionHandlingOnDeactivate } : {}),
      ...(frame.orderHandlingOnDeactivate ? { orderHandlingOnDeactivate: frame.orderHandlingOnDeactivate } : {}),
      evidence: this.toEvidence(frame),
    }
  }

  // Phase 5 S10 (#1111): sub_strategy_gate frame → orchestration gate node patch
  private normalizeSubStrategyGate(
    frame: SemanticSubStrategyGateFrame,
    index: number,
  ): CodegenSemanticOrchestrationSubStrategyGateNodePatch {
    // 占位 activeWhen — utterance 未必显式给条件，由后续 readiness fail-closed 触发 missing slot
    const placeholderActiveWhen: SemanticExpression = {
      kind: 'predicate',
      op: 'EQ',
      left: { kind: 'constant', value: true } as SemanticExpressionOperand,
      right: { kind: 'constant', value: true } as SemanticExpressionOperand,
    }
    return {
      id: `orchestration-gate-substrategy-${index + 1}`,
      kind: 'gate',
      key: 'gate.subStrategy',
      params: {
        subStrategyScopeRef: frame.subStrategyScopeRef,
        ...(frame.toSubStrategyScopeRef ? { toSubStrategyScopeRef: frame.toSubStrategyScopeRef } : {}),
      },
      target: frame.effectWhenFalse === 'switch_substrategy'
        ? {
            phase: 'subStrategy',
            subStrategyScopeRef: frame.subStrategyScopeRef,
            ...(frame.toSubStrategyScopeRef ? { toSubStrategyScopeRef: frame.toSubStrategyScopeRef } : {}),
          }
        : {
            phase: 'subStrategy',
            subStrategyScopeRef: frame.subStrategyScopeRef,
          },
      activeWhen: placeholderActiveWhen,
      effectWhenFalse: frame.effectWhenFalse,
      evidence: this.toEvidence(frame),
    }
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
  ): CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch {
    const gridParams: CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch['gridParams'] = {
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

  // Phase 5 S5 (#984): dynamic_grid frame → patch
  private normalizeDynamicGrid(
    frame: SemanticDynamicGridFrame,
    index: number,
  ): CodegenSemanticOrchestrationDynamicGridProgramNodePatch {
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

  // Phase 5 S6 (#984): adaptive_volatility_grid frame → patch
  private normalizeAdaptiveVolatilityGrid(
    frame: SemanticAdaptiveVolatilityGridFrame,
    index: number,
  ): CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch {
    return {
      id: `orchestration-program-adaptive-volatility-grid-${index + 1}`,
      kind: 'program',
      key: 'program.adaptive_volatility_grid',
      params: {
        atrPeriod: frame.atrPeriod,
        atrMultiplier: frame.atrMultiplier,
        rangeMultiplier: frame.rangeMultiplier,
        minStepPct: frame.minStepPct,
        maxStepPct: frame.maxStepPct,
        levelCount: frame.levelCount,
        onDeactivate: frame.onDeactivate,
        sizing: frame.sizing,
        atrDriftPct: frame.atrDriftPct,
        rebuildCooldownSec: frame.rebuildCooldownSec,
      },
      programKind: 'adaptive_volatility_grid',
      activeWhenRef: frame.activeWhenRef,
      onDeactivate: frame.onDeactivate,
      rebuildPolicy: 'atr_window',
      atrPeriod: frame.atrPeriod,
      atrMultiplier: frame.atrMultiplier,
      rangeMultiplier: frame.rangeMultiplier,
      atrDriftPct: frame.atrDriftPct ?? 20,
      rebuildCooldownSec: frame.rebuildCooldownSec ?? 300,
      minStepPct: frame.minStepPct,
      maxStepPct: frame.maxStepPct,
      levelCount: frame.levelCount,
      sizing: frame.sizing,
      evidence: this.toEvidence(frame),
    }
  }

  // Phase 5 S12 (#1118): event_listener frame → patch
  //   sourceRef / activeWhenRef 由 frame 透传；cross-node ref 解引用在 readiness Pass
  //   permissionScope 即使空也透传（readiness fail-closed）
  private normalizeEventListener(
    frame: SemanticEventListenerFrame,
    index: number,
  ): CodegenSemanticOrchestrationEventListenerProgramNodePatch {
    return {
      id: `orchestration-program-event-listener-${index + 1}`,
      kind: 'program',
      key: 'program.event_listener',
      params: {
        eventSchemaRef: frame.eventSchemaRef,
        sourceRef: frame.sourceRef,
        permissionScope: frame.permissionScope,
        idempotencyKey: { fieldPath: frame.idempotencyKey.fieldPath },
        dedupWindowMs: frame.dedupWindowMs,
        expirationTtlMs: frame.expirationTtlMs,
        expirationPolicy: frame.expirationPolicy,
        onDeactivate: frame.onDeactivate,
        rebuildPolicy: frame.rebuildPolicy,
      },
      programKind: 'event_listener',
      activeWhenRef: frame.activeWhenRef,
      onDeactivate: frame.onDeactivate,
      rebuildPolicy: frame.rebuildPolicy,
      eventSchemaRef: frame.eventSchemaRef,
      sourceRef: frame.sourceRef,
      permissionScope: frame.permissionScope,
      idempotencyKey: { fieldPath: frame.idempotencyKey.fieldPath },
      dedupWindowMs: frame.dedupWindowMs,
      expirationTtlMs: frame.expirationTtlMs,
      expirationPolicy: frame.expirationPolicy,
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
