import { Injectable, Logger } from '@nestjs/common'
import { buildSemanticSlotId } from '../types/semantic-state'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticCapabilityShape,
  SemanticEvidence,
  SemanticExpression,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticPositionSizingContract,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { updateRuleAtomParams, type SemanticRule } from '../types/atom-expr'
import { PositionSizingContractService } from './position-sizing-contract.service'
import { SemanticRuleProjectionService } from './semantic-rule-projection.service'
import { normalizeRiskSemantics } from './semantic-state-normalization'
import { readFlatActions, readFlatRisks, readFlatTriggers } from '../types/semantic-state-flat-readers'

/**
 * Issue #1493 块 B：reducer 内部用 mutable 工作态承载 in-place 中间结果。
 *
 * 与 `SemanticState`（block A 把五桶标 readonly）等价但解开 readonly 约束。
 * 函数末尾返回时通过 readonly 协变赋回 `SemanticState`，类型层无需 cast。
 *
 * 实际数组元素由 reducer 入口构造（readFlat* + .map 浅克隆），不会污染原 state。
 */
type ReducerWorkingState = Omit<
  SemanticState,
  'trigger' | 'action' | 'risk' | 'positionConstraint' | 'orchestration' | 'rules'
> & {
  trigger: SemanticTriggerState[]
  action: SemanticActionState[]
  risk: SemanticRiskState[]
  positionConstraint: SemanticPositionConstraintState[]
  orchestration: SemanticOrchestrationNode[]
  rules?: readonly SemanticRule[]
}

interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode' | 'rangeLower' | 'rangeUpper' | 'stepPct' | 'sideMode' | 'reference' | 'lookbackBars' | 'multiplier' | 'levels' | 'centerOffsetPct'
  paramValue: number | string
  slotValue: number | string
  extraParams?: Record<string, number | string>
}

interface SupportedContextReduction {
  slotValue: string
}

/**
 * Issue #1493 C1：reducer 在 flat slot 上写入的用户证据元数据，需要在 reproject 之后
 * 再次叠加回新的 flat 五桶（projectToFlat 通过 deriveOwnerMetadata 派生默认 evidence
 * 会丢掉用户的 user_explicit 证据链）。
 *
 * - `ruleId` + `conditionPath` 定位重投影后的 owner（_provenance 匹配）
 * - `slotKey` 定位 owner.openSlots 中的目标 slot；undefined 则覆盖 owner 自身 evidence
 *   （如 protective_exit 的 risk owner 整体）
 */
interface SlotEvidenceOverride {
  ruleId: string
  conditionPath: string
  slotKey?: string
  evidence: SemanticEvidence
  value?: string | number | boolean | null
  // 标记是否同步更新 owner 自身的 evidence/source（如 risk owner）
  applyToOwner?: boolean
}

@Injectable()
export class SemanticStateReducerService {
  /**
   * Issue #1493 块 B：mutation 完成后调用 reproject 把 rules → flat 同步回写。
   * 当 state.rules 为空时本服务 fail-open 直接返回原 state（reproject 实现已守门），
   * 因此对纯 flat 旧 fixture 路径行为不变。
   */
  private readonly logger = new Logger(SemanticStateReducerService.name)

  constructor(
    private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
    private readonly projection: SemanticRuleProjectionService = new SemanticRuleProjectionService(),
  ) {}

  /**
   * Issue #1493 C1：reproject 后把 reducer 在 flat slot 上写入的 user_explicit 证据
   * 重新覆盖回派生出的 owner.openSlots / owner.evidence。
   *
   * 仅在 ruleId + conditionPath 命中某个 owner 时生效；未命中则静默跳过（fixture/路径
   * 飘移场景，不影响 invariant）。
   */
  private applyEvidenceOverrides(
    state: SemanticState,
    overrides: readonly SlotEvidenceOverride[],
  ): SemanticState {
    if (overrides.length === 0) return state

    const matchOwner = <T extends { _provenance?: { ruleId: string, conditionPath: string }, openSlots?: SemanticSlotState[] | undefined, evidence?: SemanticEvidence, source?: SemanticState['position'] extends infer P ? P extends { source?: infer S } ? S : never : never }>(
      arr: ReadonlyArray<T>,
      override: SlotEvidenceOverride,
    ): { hit: boolean, next: T[] } => {
      let hit = false
      const next = arr.map((node) => {
        const prov = node._provenance
        if (!prov || prov.ruleId !== override.ruleId || prov.conditionPath !== override.conditionPath) {
          return node
        }
        hit = true
        const nextSlots = (node.openSlots ?? []).map((slot) => {
          if (override.slotKey && slot.slotKey !== override.slotKey) return slot
          return {
            ...slot,
            ...(override.value !== undefined ? { value: override.value } : {}),
            evidence: override.evidence,
          }
        })
        return {
          ...node,
          openSlots: nextSlots,
          ...(override.applyToOwner ? { evidence: override.evidence, source: override.evidence.source } : {}),
        }
      })
      return { hit, next }
    }

    let nextTrigger = state.trigger
    let nextAction = state.action
    let nextRisk = state.risk
    let nextPositionConstraint = state.positionConstraint

    for (const override of overrides) {
      const triggerMatch = matchOwner(nextTrigger, override)
      if (triggerMatch.hit) {
        nextTrigger = triggerMatch.next as typeof nextTrigger
        continue
      }
      const actionMatch = matchOwner(nextAction, override)
      if (actionMatch.hit) {
        nextAction = actionMatch.next as typeof nextAction
        continue
      }
      const riskMatch = matchOwner(nextRisk, override)
      if (riskMatch.hit) {
        nextRisk = riskMatch.next as typeof nextRisk
        continue
      }
      const constraintMatch = matchOwner(nextPositionConstraint ?? [], override)
      if (constraintMatch.hit) {
        nextPositionConstraint = constraintMatch.next as typeof nextPositionConstraint
        continue
      }
      // 未命中：reproject 后 owner 可能因 invariant drop，安全跳过
    }

    return {
      ...state,
      trigger: nextTrigger,
      action: nextAction,
      risk: nextRisk,
      positionConstraint: nextPositionConstraint,
    }
  }

  applyClarificationAnswer(input: {
    currentState: SemanticState
    targetSlotKey: string
    targetFieldPath?: string
    targetSlotId?: string
    answer: string
    messageIndex?: number
    applyEquivalentConfirmationSlots?: boolean
  }): SemanticState {
    // Issue #1493 块 B：rules 是 single source of truth；mutation 期间同时维护
    //   flat（兼容旧 fixture 与下游 49 reader）与 rules（权威）。
    //   函数末尾若 rules 非空走 reprojectFromRules 重新派生 flat；空则 fail-open
    //   保留 flat 修改（reproject 实现已守门 rules.length===0 直接 return state）。
    let nextRules: readonly SemanticRule[] | undefined = input.currentState.rules
    // Issue #1493 C1：跟踪 reducer 在 flat slot 上写入的 user_explicit 证据，
    //   reproject 之后通过 applyEvidenceOverrides 重新覆盖回派生出的 owner.openSlots。
    const evidenceOverrides: SlotEvidenceOverride[] = []
    const recordSlotEvidence = (
      owner: { _provenance?: { ruleId: string, conditionPath: string } },
      slot: SemanticSlotState,
      applyToOwner?: boolean,
    ): void => {
      const prov = owner._provenance
      if (!prov || !slot.evidence) return
      evidenceOverrides.push({
        ruleId: prov.ruleId,
        conditionPath: prov.conditionPath,
        slotKey: slot.slotKey,
        evidence: slot.evidence,
        value: slot.value,
        applyToOwner,
      })
    }
    /**
     * #1447 闸 3 起，flat 五桶 owner（trigger/action/risk/positionConstraint）携带
     * `_provenance: { ruleId, conditionPath }` 反查 rules 树中的 atom 叶子。reducer 写入
     * 时同步重建 rules 子树，保证 `flat ≡ projectToFlat(rules)` invariant。
     *
     * 对没有 `_provenance` 的旧 fixture / 没有 `state.rules` 的纯 flat 路径，fail-open
     * 跳过 rules 更新（reproject 末端也会守门 rules 为空时直接返回）。
     */
    const updateRuleFromOwner = (
      owner: { _provenance?: { ruleId: string, conditionPath: string } },
      mutator: (params: Record<string, unknown>) => Record<string, unknown>,
      keyOverride?: string,
    ): void => {
      const prov = owner._provenance
      if (!prov || !nextRules || nextRules.length === 0) return
      try {
        nextRules = updateRuleAtomParams(nextRules, prov.ruleId, prov.conditionPath, atom => ({
          ...atom,
          ...(keyOverride ? { key: keyOverride } : {}),
          params: mutator({ ...atom.params }),
        }))
      } catch (err) {
        // Issue #1493 M1：路径不命中或越界时 fail-open，rules 保持旧值；flat 已被同步修改。
        //   原本静默 swallow 让 reducer / rules 漂移无法被线上观测，
        //   改为结构化 warn 暴露 ruleId / path / op 标识便于排查。
        this.logger.warn(
          `[#1493] mutateRulesAtom path miss: ruleId=${prov.ruleId} path=${prov.conditionPath} op=reducer.updateRuleFromOwner`,
          err,
        )
      }
    }

    const nextState: ReducerWorkingState = {
      ...input.currentState,
      trigger: readFlatTriggers(input.currentState).map(trigger => ({
        ...trigger,
        params: { ...trigger.params },
        openSlots: trigger.openSlots.map(slot => ({ ...slot })),
      })),
      action: readFlatActions(input.currentState).map(action => ({
        ...action,
        ...(action.params ? { params: { ...action.params } } : {}),
        openSlots: action.openSlots?.map(slot => ({ ...slot })),
      })),
      risk: readFlatRisks(input.currentState).map(risk => ({
        ...risk,
        params: { ...risk.params },
        openSlots: risk.openSlots.map(slot => ({ ...slot })),
      })),
      orchestration: [...input.currentState.orchestration],
      position: input.currentState.position
        ? {
            ...input.currentState.position,
            openSlots: input.currentState.position.openSlots?.map(slot => ({ ...slot })),
            constraints: input.currentState.position.constraints?.map(constraint => ({
              ...constraint,
              params: { ...constraint.params },
              openSlots: constraint.openSlots.map(slot => ({ ...slot })),
            })),
          }
        : null,
      positionConstraint: structuredClone(input.currentState.positionConstraint ?? []) as SemanticPositionConstraintState[],
      contextSlots: {
        exchange: input.currentState.contextSlots.exchange ? { ...input.currentState.contextSlots.exchange } : null,
        symbol: input.currentState.contextSlots.symbol ? { ...input.currentState.contextSlots.symbol } : null,
        marketType: input.currentState.contextSlots.marketType ? { ...input.currentState.contextSlots.marketType } : null,
        timeframe: input.currentState.contextSlots.timeframe ? { ...input.currentState.contextSlots.timeframe } : null,
      },
      updatedAt: new Date().toISOString(),
    }

    const answerText = input.answer.trim()
    for (const trigger of readFlatTriggers(nextState)) {
      const slot = trigger.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
      if (!slot) continue

      if (slot.status === 'open' && this.isContractRequirementSlot(slot)) {
        if (this.applyContractRequirementAnswer(trigger, slot, answerText, input.messageIndex)) {
          trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
        }
        break
      }

      const reduction = this.reduceSupportedSlot(slot, answerText)
      if (!reduction) {
        break
      }

      if (reduction.paramKey === 'reference.period') {
        trigger.params['reference.period'] = reduction.paramValue
      } else if (reduction.paramKey === 'confirmationMode') {
        trigger.params.confirmationMode = reduction.paramValue
      } else {
        trigger.params[reduction.paramKey] = reduction.paramValue
      }
      if (reduction.extraParams) {
        Object.assign(trigger.params, reduction.extraParams)
      }

      // #1493 块 B：rules-first 同步——把 reducer 写入的 params 透传到 rules 树
      updateRuleFromOwner(trigger, () => ({ ...trigger.params }))

      slot.value = reduction.slotValue
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      recordSlotEvidence(trigger, slot)

      if (slot.paramSlotKey) {
        trigger.openSlots = trigger.openSlots.filter(item => item.status === 'open')
      }
      trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      if (input.applyEquivalentConfirmationSlots && reduction.paramKey === 'confirmationMode') {
        this.applyEquivalentConfirmationSlotReduction(
          nextState,
          slot,
          reduction,
          answerText,
          input.messageIndex,
          (owner, brotherSlot) => recordSlotEvidence(owner, brotherSlot),
        )
      }
      break
    }

    for (const action of readFlatActions(nextState)) {
      const slot = action.openSlots?.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
      if (!slot || slot.status !== 'open') continue

      if (this.isContractRequirementSlot(slot)) {
        if (this.applyContractRequirementAnswer(action, slot, answerText, input.messageIndex)) {
          action.status = (action.openSlots ?? []).every(item => item.status !== 'open') ? 'locked' : 'open'
        }
        break
      }

      const paramKey = this.resolveActionParamKey(slot)
      const slotReduction = this.reduceKnownActionSlot(slot, answerText)
      const paramValue = slotReduction?.paramValue ?? answerText
      const slotValue = slotReduction?.slotValue ?? answerText
      action.params = {
        ...(action.params ?? {}),
        [paramKey]: paramValue,
      }
      updateRuleFromOwner(action, () => ({ ...(action.params ?? {}) }))
      slot.value = slotValue
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      recordSlotEvidence(action, slot)
      if (slot.paramSlotKey) {
        action.openSlots = (action.openSlots ?? []).filter(item => item.status === 'open')
      }
      action.status = (action.openSlots ?? []).every(item => item.status !== 'open') ? 'locked' : 'open'
      if (action.key === ATOM_CONTRACT_REGISTRY['action.add_position'].key && paramKey === 'constraint') {
        const result = this.applyAddPositionConstraintAnswer(nextState, answerText, input.messageIndex)
        if (result?.newRule && nextRules) {
          // #1493 块 B：append single-leaf gate rule，保持 flat ≡ projectToFlat(rules)
          nextRules = [...nextRules, result.newRule]
        }
        if (result?.updatedExisting && nextRules) {
          // #1493 C3：既有 positionConstraint 二次更新同步 rules（通过 _provenance
          //   反查 atom 叶子，更新 params 与 flat 同步）。
          const { provenance, params } = result.updatedExisting
          try {
            nextRules = updateRuleAtomParams(nextRules, provenance.ruleId, provenance.conditionPath, atom => ({
              ...atom,
              params: { ...atom.params, ...params },
            }))
          }
          catch (err) {
            this.logger.warn(
              `[#1493] mutateRulesAtom path miss: ruleId=${provenance.ruleId} path=${provenance.conditionPath} op=positionConstraint.existing`,
              err,
            )
          }
        }
      }
      break
    }

    const positionSlot = nextState.position?.openSlots?.find((item) => {
      if (input.targetSlotId) {
        return buildSemanticSlotId(item) === input.targetSlotId
      }

      return item.slotKey === input.targetSlotKey
        && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.sizing is a slot key label, not an atom key routing comparison
    if (nextState.position && positionSlot?.slotKey === 'position.sizing' && positionSlot.status === 'open') {
      const parsed = this.parsePositionSizingContractAnswer(answerText, input.messageIndex)
      if (parsed) {
        const evidence = parsed.evidence

        nextState.position.sizing = parsed.sizing
        nextState.position.mode = this.resolveLegacySizingMode(parsed.sizing)
        nextState.position.value = parsed.sizing.value
        nextState.position.status = 'locked'
        nextState.position.source = 'user_explicit'
        nextState.position.evidence = evidence
        positionSlot.value = this.formatPositionSizingValue(parsed.sizing)
        positionSlot.status = 'locked'
        positionSlot.evidence = evidence
      }
    }
    if (
      nextState.position
      && positionSlot?.status === 'open'
      && this.isContractRequirementSlot(positionSlot)
    ) {
      if (this.applyContractRequirementAnswer(nextState.position, positionSlot, answerText, input.messageIndex)) {
        nextState.position.status = nextState.position.openSlots?.every(item => item.status !== 'open') ? 'locked' : 'open'
      }
    }

    for (const constraint of nextState.positionConstraint ?? []) {
      const slot = constraint.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
      if (!slot || slot.status !== 'open') continue

      if (this.isContractRequirementSlot(slot)) {
        if (this.applyContractRequirementAnswer(constraint, slot, answerText, input.messageIndex)) {
          constraint.status = constraint.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
        }
        break
      }

      const paramKey = this.resolvePositionConstraintParamKey(slot)
      if (!paramKey) {
        break
      }

      constraint.params[paramKey] = this.parsePositionConstraintParamAnswer(paramKey, answerText, input.messageIndex)
      updateRuleFromOwner(constraint, () => ({ ...constraint.params }))
      slot.value = answerText
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      recordSlotEvidence(constraint, slot)
      if (slot.paramSlotKey) {
        constraint.openSlots = constraint.openSlots.filter(item => item.status === 'open')
      }
      constraint.status = constraint.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      break
    }

    for (const constraint of nextState.position?.constraints ?? []) {
      const slot = constraint.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
      if (!slot || slot.status !== 'open') continue

      const paramKey = this.resolvePositionConstraintParamKey(slot)
      if (!paramKey) {
        break
      }

      constraint.params[paramKey] = this.parsePositionConstraintParamAnswer(paramKey, answerText, input.messageIndex)
      updateRuleFromOwner(constraint, () => ({ ...constraint.params }))
      slot.value = answerText
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      recordSlotEvidence(constraint, slot)
      if (slot.paramSlotKey) {
        constraint.openSlots = constraint.openSlots.filter(item => item.status === 'open')
      }
      constraint.status = constraint.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      break
    }

    let riskChanged = false
    for (const risk of readFlatRisks(nextState)) {
      const slot = risk.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })

      if (slot?.status === 'open' && this.isContractRequirementSlot(slot)) {
        if (this.applyContractRequirementAnswer(risk, slot, answerText, input.messageIndex)) {
          risk.status = risk.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
        }
        break
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.protective_exit not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key !== 'risk.protective_exit' && slot?.status === 'open') {
        const paramKey = this.resolveRiskParamKey(slot)
        if (paramKey) {
          risk.params[paramKey] = answerText
          updateRuleFromOwner(risk, () => ({ ...risk.params }))
          slot.value = answerText
          slot.status = 'locked'
          slot.evidence = {
            text: answerText,
            messageIndex: input.messageIndex,
            source: 'user_explicit',
          }
          recordSlotEvidence(risk, slot)
          if (slot.paramSlotKey) {
            risk.openSlots = risk.openSlots.filter(item => item.status === 'open')
          }
          risk.status = risk.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
          break
        }
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.protective_exit not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key !== 'risk.protective_exit') continue
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.protective_exit slot key routing (follow-up #1329)
      if (slot?.slotKey !== 'risk.protective_exit' || slot.status !== 'open') continue

      const percentValue = this.parsePercentAnswer(answerText)
      if (percentValue === null) {
        break
      }

      const evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit' as const,
      }

      const riskKey = this.resolveProtectiveRiskAnswerKey(answerText)
      if (!riskKey) {
        break
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.max_drawdown_pct / risk.max_single_loss_pct / risk.condition_expression not yet in REGISTRY (follow-up #1329)
      const swappedKey = riskKey === 'risk.max_drawdown_pct' || riskKey === 'risk.max_single_loss_pct'
        ? 'risk.condition_expression'
        : riskKey
      risk.key = swappedKey
      risk.params = this.buildProtectiveRiskParams(riskKey, percentValue)
      // #1493 块 B：protective_exit 「换 key」——同步重写 rules 树中的 atom.key + params
      updateRuleFromOwner(risk, () => ({ ...risk.params }), swappedKey)
      risk.status = 'locked'
      risk.source = 'user_explicit'
      risk.evidence = evidence
      slot.value = percentValue
      slot.status = 'locked'
      slot.evidence = evidence
      recordSlotEvidence(risk, slot, true)
      risk.openSlots = []
      riskChanged = true
      break
    }

    for (const contextKey of ['exchange', 'symbol', 'marketType', 'timeframe'] as const) {
      const slot = nextState.contextSlots[contextKey]
      if (!slot || slot.status !== 'open') continue

      const matchesTarget = input.targetSlotId
        ? buildSemanticSlotId(slot) === input.targetSlotId
        : slot.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? slot.fieldPath === input.targetFieldPath : true)
      if (!matchesTarget) continue

      const reduction = this.reduceSupportedContextSlot(contextKey, answerText)
      if (!reduction) {
        break
      }

      slot.value = reduction.slotValue
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      break
    }

    const flatResult: SemanticState = {
      ...nextState,
      risk: riskChanged ? normalizeRiskSemantics([...readFlatRisks(nextState)]) : [...readFlatRisks(nextState)],
      ...(nextRules !== undefined ? { rules: nextRules } : {}),
    }

    // #1493 块 B：rules 非空时统一走 reprojectFromRules 重新派生 flat 五桶。
    //   - rules 为空：fail-open 直接返回 flatResult（reproject 实现守门 length===0
    //     时不改 flat），保持旧 fixture 路径行为完全等价。
    //   - rules 非空：rules-first invariant 生效，flat ≡ projectToFlat(rules)。
    //
    // #1493 C1：reproject 后通过 applyEvidenceOverrides 把 reducer 在 flat slot 上
    //   写入的 user_explicit 证据链（slot.evidence / value 以及 owner 自身 evidence）
    //   覆盖回派生出的 owner.openSlots；rules 空时 reprojectFromRules 透传，
    //   applyEvidenceOverrides 仍可对原 flat 应用，行为等价。
    const reprojected = this.projection.reprojectFromRules(flatResult)
    return this.applyEvidenceOverrides(reprojected, evidenceOverrides)
  }

  private resolveActionParamKey(slot: SemanticSlotState): string {
    const paramsPath = slot.fieldPath.match(/\.params\.([A-Za-z0-9_]+)$/u)
    if (paramsPath?.[1]) {
      return paramsPath[1]
    }

    const slotKeyPath = slot.slotKey.match(/^action\.([A-Za-z0-9_]+)$/u)
    if (slotKeyPath?.[1]) {
      return slotKeyPath[1]
    }

    return slot.slotKey
  }

  private reduceKnownActionSlot(
    slot: SemanticSlotState,
    answerText: string,
  ): { paramValue: string | boolean, slotValue: string | boolean } | null {
    const normalized = answerText.trim()
    const slotLabel = `${slot.slotKey} ${slot.fieldPath}`.toLowerCase()
    if (!normalized) {
      return null
    }

    if (slotLabel.includes('reverse') && /不需要|不用|否|no/iu.test(normalized)) {
      return { paramValue: false, slotValue: false }
    }

    if (slotLabel.includes('add_position') && /不加仓|不需要|不用|否|no/iu.test(normalized)) {
      return { paramValue: 'none', slotValue: 'none' }
    }

    return null
  }

  private resolveRiskParamKey(slot: SemanticSlotState): string | null {
    const paramsPath = slot.fieldPath.match(/(?:^|\.)params\.([A-Za-z0-9_]+)$/u)
    if (paramsPath?.[1]) {
      return paramsPath[1]
    }

    const slotKeyPath = slot.slotKey.match(/\.([A-Za-z0-9_]+)$/u)
    return slotKeyPath?.[1] ?? null
  }

  private resolvePositionConstraintParamKey(slot: SemanticSlotState): keyof SemanticPositionConstraintState['params'] | null {
    const paramsPath = slot.fieldPath.match(/(?:^|\.)params\.([A-Za-z0-9_]+)$/u)
    if (paramsPath?.[1]) {
      return paramsPath[1]
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.dca_schedule.exit_rule is a slot key label (sub-field path), not atom key routing
    if (slot.slotKey === 'position.dca_schedule.exit_rule') {
      return 'exitRule'
    }

    const slotKeyPath = slot.slotKey.match(/\.([A-Za-z0-9_]+)$/u)
    if (!slotKeyPath?.[1]) {
      return null
    }

    return this.toCamelCaseParamKey(slotKeyPath[1])
  }

  private toCamelCaseParamKey(value: string): string {
    return value.replace(/_([a-z0-9])/giu, (_, item: string) => item.toUpperCase())
  }

  private parsePositionConstraintParamAnswer(
    paramKey: string,
    answerText: string,
    messageIndex?: number,
  ): unknown {
    if (paramKey === 'maxCount') {
      const value = this.parsePositiveIntegerAnswer(answerText)
      return value ?? answerText
    }

    if (paramKey === 'levels') {
      const value = this.parsePositiveIntegerAnswer(answerText)
      return value ?? answerText
    }

    if (paramKey === 'rangeLower' || paramKey === 'rangeUpper' || paramKey === 'stepPct' || paramKey === 'centerOffsetPct') {
      const value = this.parseGridNumericAnswer(paramKey === 'stepPct' ? 'grid.stepPct' : paramKey, answerText)
      return value ?? answerText
    }

    if (paramKey === 'sideMode') {
      return this.parseGridSideModeAnswer(answerText) ?? answerText
    }

    if (paramKey === 'capitalCap' || paramKey === 'perOrderSizing') {
      return this.parsePositionSizingContractAnswer(answerText, messageIndex)?.sizing ?? answerText
    }

    if (paramKey === 'triggerMode') {
      if (/价格|跌|涨|price/iu.test(answerText)) return 'price_interval'
      if (/时间|每隔|周期|time/iu.test(answerText)) return 'time_interval'
      if (/信号|确认|signal/iu.test(answerText)) return 'signal'
      return answerText
    }

    return answerText
  }

  /**
   * Issue #1493 块 B：返回 append 到 rules 的新 SemanticRule（首次添加场景）；
   * 既有约束就地更新参数时返回 null。
   *
   * 历史行为（in-place mutation `state.positionConstraint.push`）保留以兼容旧 fixture；
   * `ReducerWorkingState.positionConstraint` 显式声明为 mutable 数组，类型层不再误报 readonly。
   */
  private applyAddPositionConstraintAnswer(
    state: ReducerWorkingState,
    answerText: string,
    messageIndex?: number,
  ): {
    newRule?: SemanticRule
    updatedExisting?: {
      provenance: { ruleId: string, conditionPath: string }
      params: Record<string, unknown>
    }
  } | null {
    const parsed = this.parseAddPositionConstraintAnswer(answerText)
    if (!parsed) {
      return null
    }

    if (!state.position) {
      state.position = {
        mode: 'constraint_only',
        value: 0,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    const constraints = state.positionConstraint ?? []
    const existing = constraints.find(constraint => constraint.key === parsed.key)
    const evidence: SemanticEvidence = {
      text: answerText,
      messageIndex,
      source: 'user_explicit',
    }

    if (existing) {
      existing.params = { ...existing.params, ...parsed.params }
      existing.status = existing.openSlots.every(slot => slot.status !== 'open') ? 'locked' : existing.status
      existing.evidence = evidence
      state.positionConstraint = constraints
      // #1493 C3：既有 constraint 通过 _provenance 关联回 rules；返回 provenance 让 caller
      //   调 updateRuleAtomParams 同步 rules 树参数，保持 flat ≡ projectToFlat(rules)。
      if (existing._provenance) {
        return {
          updatedExisting: {
            provenance: existing._provenance,
            params: parsed.params,
          },
        }
      }
      return null
    }

    const newConstraintId = parsed.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
      ? 'clarified-position-pyramiding-limit'
      : 'clarified-position-max-exposure'
    // single-leaf gate rule：构造对应 SemanticRule，flat 与 rules 共享同一 _provenance
    const ruleId = `clarified-rule-${newConstraintId}`
    const newRule: SemanticRule = {
      id: ruleId,
      phase: 'gate',
      sideScope: 'both',
      condition: {
        kind: 'atom',
        key: parsed.key,
        params: { ...parsed.params },
      },
      effects: [],
    }
    constraints.push({
      id: newConstraintId,
      key: parsed.key,
      params: parsed.params,
      status: 'locked',
      source: 'user_explicit',
      evidence,
      openSlots: [],
      _provenance: { ruleId, conditionPath: 'condition.atom' },
    })

    state.positionConstraint = constraints
    return { newRule }
  }

  private parseAddPositionConstraintAnswer(
    answerText: string,
  ): { key: 'position.pyramiding_limit', params: { maxLayers: number } } | { key: 'position.max_exposure_pct', params: { maxExposurePct: number } } | null {
    const layerMatch = answerText.match(/(?:最多|不超过|上限|限制)?\s*(\d+)\s*(?:次|层|笔)/u)
    if (layerMatch?.[1]) {
      const maxLayers = Number(layerMatch[1])
      if (Number.isInteger(maxLayers) && maxLayers > 0) {
        return { key: 'position.pyramiding_limit', params: { maxLayers } }
      }
    }

    const exposureMatch = answerText.match(/(?:敞口|仓位|总仓位|总敞口|exposure)[^\d]*(\d+(?:\.\d+)?)\s*%/iu)
      ?? answerText.match(/(\d+(?:\.\d+)?)\s*%[^\n]*(?:敞口|仓位|总仓位|总敞口|exposure)/iu)
    if (exposureMatch?.[1]) {
      const maxExposurePct = Number(exposureMatch[1])
      if (Number.isFinite(maxExposurePct) && maxExposurePct > 0) {
        return { key: 'position.max_exposure_pct', params: { maxExposurePct } }
      }
    }

    return null
  }

  private parsePositiveIntegerAnswer(answerText: string): number | null {
    const match = answerText.match(/\d+/u)
    if (!match) {
      return null
    }

    const value = Number(match[0])
    return Number.isInteger(value) && value > 0 ? value : null
  }

  private parsePositiveNumberAnswer(answerText: string): number | null {
    const match = answerText.match(/\d+(?:\.\d+)?/u)
    if (!match) {
      return null
    }

    const value = Number(match[0])
    return Number.isFinite(value) && value > 0 ? value : null
  }

  private applyContractRequirementAnswer(
    owner: { contracts?: SemanticAtomContract[] },
    slot: SemanticSlotState,
    answerText: string,
    messageIndex?: number,
  ): boolean {
    const capability = this.buildCapabilityFromContractRequirementSlot(slot, answerText)
    if (!capability) {
      return false
    }

    const contractId = this.resolveContractIdFromFieldPath(slot.fieldPath)
    const contracts = owner.contracts ?? []
    let changed = false
    owner.contracts = contracts.map((contract) => {
      if (contractId && contract.id !== contractId) {
        return contract
      }
      if (this.contractHasCapability(contract, capability)) {
        changed = true
        return contract
      }

      changed = true
      return {
        ...contract,
        capabilities: [...contract.capabilities, capability],
      }
    })

    if (!changed) {
      return false
    }

    slot.value = answerText
    slot.status = 'locked'
    slot.evidence = {
      text: answerText,
      messageIndex,
      source: 'user_explicit',
    }
    return true
  }

  private isContractRequirementSlot(slot: SemanticSlotState): boolean {
    return slot.slotKey.startsWith('contract.requirement.')
  }

  private buildCapabilityFromContractRequirementSlot(
    slot: SemanticSlotState,
    answerText: string,
  ): SemanticCapability | null {
    if (!slot.slotKey.startsWith('contract.requirement.')) {
      return null
    }

    const parts = slot.slotKey.slice('contract.requirement.'.length).split('.')
    if (parts.length < 3 || !this.isSemanticCapabilityDomain(parts[0])) {
      return null
    }

    const shape = this.buildContractRequirementCapabilityShape(
      parts[0],
      parts[1],
      parts.slice(2).join('.'),
      answerText,
      slot,
    )
    if (!shape) {
      return null
    }

    return {
      domain: parts[0],
      verb: parts[1],
      object: parts.slice(2).join('.'),
      shape,
    }
  }

  private buildContractRequirementCapabilityShape(
    domain: SemanticCapabilityDomain,
    verb: string,
    object: string,
    answerText: string,
    slot: SemanticSlotState,
  ): SemanticCapabilityShape | null {
    if (domain === 'capital' && verb === 'allocate' && object === 'per_order_budget') {
      return this.parsePerOrderBudgetCapabilityShape(answerText)
    }

    if (domain === 'price' && verb === 'define' && object === 'level_set') {
      return this.parseLevelSetCapabilityShape(answerText, slot)
    }

    if (domain === 'guard' && verb === 'enforce') {
      return this.parseGuardEnforcementCapabilityShape(answerText, slot)
    }

    if (domain === 'guard' && verb === 'define' && object === 'dca_exit_rule') {
      return { rule: answerText }
    }

    return null
  }

  private parsePerOrderBudgetCapabilityShape(answerText: string): SemanticCapabilityShape | null {
    if (/(?:每(?:单|格|笔)[^，。；;,.]{0,12})?\d+(?:\.\d+)?\s*%/u.test(answerText)) {
      return null
    }

    const amountMatch = answerText.match(/(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|刀|U)\b/iu)
    const value = amountMatch?.[1] ? Number(amountMatch[1]) : null
    if (value === null || !Number.isFinite(value) || value <= 0) {
      return null
    }

    const assetText = amountMatch?.[2]?.toUpperCase()
    const asset = assetText === 'USDC'
      ? 'USDC'
      : assetText === 'USD'
        ? 'USD'
        : 'USDT'
    return { value, asset }
  }

  private parseLevelSetCapabilityShape(
    answerText: string,
    slot: SemanticSlotState,
  ): SemanticCapabilityShape | null {
    const contextText = [
      answerText,
      slot.questionHint,
      slot.evidence?.text,
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('。')

    const lower = this.parseLabeledNumber(contextText, ['下限', '下界', '最低', 'lower', 'min'])
    const upper = this.parseLabeledNumber(contextText, ['上限', '上界', '最高', 'upper', 'max'])
    const rangeMatch = contextText.match(/(\d+(?:\.\d+)?)\s*(?:-|~|到|至)\s*(\d+(?:\.\d+)?)/iu)
    const rangeLower = lower ?? (rangeMatch?.[1] ? Number(rangeMatch[1]) : null)
    const rangeUpper = upper ?? (rangeMatch?.[2] ? Number(rangeMatch[2]) : null)
    if (
      rangeLower !== null
      && rangeUpper !== null
      && Number.isFinite(rangeLower)
      && Number.isFinite(rangeUpper)
      && rangeUpper > rangeLower
    ) {
      const gridCountMatch = contextText.match(/(\d{1,4})\s*(?:格|网格)/u)
      const spacingPctMatch = contextText.match(/(?:间距|每格|spacing)[^\d]{0,12}(\d+(?:\.\d+)?)\s*%/iu)
      return {
        lower: rangeLower,
        upper: rangeUpper,
        ...(gridCountMatch?.[1] ? { gridCount: Number(gridCountMatch[1]) } : {}),
        ...(spacingPctMatch?.[1] ? { spacingPct: Number(spacingPctMatch[1]) } : {}),
        spacingMode: /等比|geometric/iu.test(contextText) ? 'geometric' : 'arithmetic',
      }
    }

    return this.parseCenteredLevelSetCapabilityShape(contextText)
  }

  private parseCenteredLevelSetCapabilityShape(text: string): SemanticCapabilityShape | null {
    const centerSource = this.parseLevelSetCenterSource(text)
    if (!centerSource) {
      return null
    }

    const windowMatch = text.match(/(?:部署时刻?往前|部署时往前|最近|近|过去)?\s*(\d{1,4})\s*(m|min|分钟|h|小时|d|天)/iu)
    const halfRangePctMatch = text.match(/上下各\s*(\d+(?:\.\d+)?)\s*%/u)
    const totalRangePctMatch = text.match(/(?:上下一共|总区间|全区间)\s*(\d+(?:\.\d+)?)\s*%/u)
    const gridCountMatch = text.match(/(\d{1,4})\s*(?:格|网格)/u)
    const halfRangePct = halfRangePctMatch?.[1] ? Number(halfRangePctMatch[1]) : null
    const totalRangePct = !halfRangePctMatch?.[1] && totalRangePctMatch?.[1]
      ? Number(totalRangePctMatch[1])
      : null

    return {
      mode: 'centered_percent_range',
      centerTiming: /部署|启动|上线|创建网格|运行时|deploy|start/iu.test(text) ? 'deployment' : 'runtime',
      centerSource,
      ...(windowMatch?.[1] && windowMatch[2] ? { aggregationWindow: this.normalizeDurationWindow(windowMatch[1], windowMatch[2]) } : {}),
      ...(halfRangePct !== null && Number.isFinite(halfRangePct) && halfRangePct > 0 ? { halfRangePct } : {}),
      ...(totalRangePct !== null && Number.isFinite(totalRangePct) && totalRangePct > 0 ? { halfRangePct: totalRangePct / 2 } : {}),
      ...(gridCountMatch?.[1] ? { gridCount: Number(gridCountMatch[1]) } : {}),
      spacingMode: /等比|geometric/iu.test(text) ? 'geometric' : 'arithmetic',
    }
  }

  private parseLevelSetCenterSource(text: string): string | null {
    if (/成交均价|平均成交价|成交平均价|vwap|volume[-_\s]?weighted/iu.test(text)) {
      return 'trade_vwap'
    }

    if (/最新成交价|最近一次成交价|last\s*trade|成交价/iu.test(text)) {
      return 'last_trade'
    }

    if (/标记价|mark\s*price/iu.test(text)) {
      return 'mark_price'
    }

    if (/最新价|现价|当前价格|ticker\s*last|last\s*price|current\s*price/iu.test(text)) {
      return 'last_price'
    }

    return null
  }

  private parseGuardEnforcementCapabilityShape(
    answerText: string,
    slot: SemanticSlotState,
  ): SemanticCapabilityShape | null {
    const contextText = [
      answerText,
      slot.questionHint,
      slot.evidence?.text,
      slot.slotKey,
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('。')

    const hasBoundaryContext = /边界|上下界|上下边界|区间|突破|触及|越界|boundary|breach|breakout|outside/iu.test(contextText)
    const hasCancelIntent = /撤销|取消|撤单|cancel/iu.test(contextText)
    const hasHaltIntent = /停止|暂停|终止|不再|halt|stop|pause/iu.test(contextText)

    if (!hasBoundaryContext && !hasCancelIntent && !hasHaltIntent) {
      return null
    }

    const cancelScope = this.parseGuardCancelScope(contextText)
    const cancelOrders = hasCancelIntent || cancelScope !== null
    const onBreach = hasHaltIntent
      ? 'HALT_STRATEGY'
      : cancelOrders
        ? 'CANCEL_ORDER_PROGRAMS'
        : null

    if (!onBreach) {
      return null
    }

    return {
      trigger: hasBoundaryContext ? 'boundary_breach' : 'guard_breach',
      onBreach,
      cancelOrders,
      ...(cancelScope ? { cancelScope } : {}),
      ...(/网格|grid/iu.test(contextText) ? { programScope: 'grid' } : {}),
      ...(/限价|limit/iu.test(contextText) ? { orderTypeScope: 'limit' } : {}),
      ...(/未成交|未完成|挂单|open\s+orders?|pending|unfilled/iu.test(contextText) ? { orderStatusScope: 'unfilled' } : {}),
      ...(/不包含[^。；;]*已成交|不.*已成交|不含[^。；;]*已成交|仅[^。；;]*未成交/iu.test(contextText)
        ? { includeFilledOrders: false }
        : {}),
      ...(/不包含[^。；;]*其他类型|不含[^。；;]*其他类型|仅[^。；;]*(?:网格|限价)/iu.test(contextText)
        ? { includeOtherOrderTypes: false }
        : {}),
      ...(/不再(?:重新)?(?:下发|挂|创建)|不重新(?:计算|下发|挂)|不再重新计算|no\s+regrid|do\s+not\s+regrid/iu.test(contextText)
        ? { regrid: false }
        : {}),
    }
  }

  private parseGuardCancelScope(text: string): string | null {
    const grid = /网格|grid/iu.test(text)
    const limit = /限价|limit/iu.test(text)
    const unfilled = /未成交|未完成|挂单|open\s+orders?|pending|unfilled/iu.test(text)

    if (grid && limit && unfilled) {
      return 'unfilled_grid_limit_orders'
    }

    if (grid && unfilled) {
      return 'unfilled_grid_orders'
    }

    if (grid) {
      return 'grid_orders'
    }

    if (limit && unfilled) {
      return 'unfilled_limit_orders'
    }

    if (unfilled) {
      return 'unfilled_orders'
    }

    if (/订单程序|order\s+program|program/iu.test(text)) {
      return 'program_orders'
    }

    return null
  }

  private normalizeDurationWindow(valueText: string, unitText: string): string {
    const value = Number(valueText)
    const unit = unitText.toLowerCase()
    if (unit === '分钟' || unit === 'min') {
      return `${value}m`
    }
    if (unit === '小时') {
      return `${value}h`
    }
    if (unit === '天') {
      return `${value}d`
    }
    return `${value}${unit}`
  }

  private parseLabeledNumber(answerText: string, labels: readonly string[]): number | null {
    for (const label of labels) {
      const match = answerText.match(new RegExp(`${label}[^\\d]{0,12}(\\d+(?:\\.\\d+)?)`, 'iu'))
      if (match?.[1]) {
        const value = Number(match[1])
        return Number.isFinite(value) ? value : null
      }
    }

    return null
  }

  private resolveContractIdFromFieldPath(fieldPath: string): string | null {
    return fieldPath.match(/\.?contracts\[([^\]]+)\]/u)?.[1] ?? null
  }

  private contractHasCapability(contract: SemanticAtomContract, capability: SemanticCapability): boolean {
    return contract.capabilities.some(item =>
      item.domain === capability.domain
      && item.verb === capability.verb
      && item.object === capability.object,
    )
  }

  private isSemanticCapabilityDomain(value: string): value is SemanticCapabilityDomain {
    return [
      'market',
      'price',
      'order_program',
      'capital',
      'exposure',
      'margin',
      'guard',
      'runtime',
      'state',
      'order',
      'portfolio',
      'orchestration',
    ].includes(value)
  }

  private reduceSupportedSlot(slot: SemanticSlotState, answerText: string): SupportedSlotReduction | null {
    const normalizedGridSlotKey = this.normalizeGridSlotKey(slot.slotKey)

    if (slot.slotKey === 'trigger.reference_definition') {
      const periodMatch = answerText.match(/最近\s*(\d{1,4})\s*根\s*K?\s*线/u)
      const period = periodMatch?.[1] ? Number(periodMatch[1]) : null
      const reference = /低点|最低|支撑/u.test(answerText)
        ? 'channel_low'
        : /高点|最高|压力|阻力/u.test(answerText)
          ? 'channel_high'
          : null
      if (!reference || !period || !Number.isFinite(period)) {
        return null
      }

      return {
        paramKey: 'reference',
        paramValue: reference,
        slotValue: answerText,
        extraParams: { period },
      }
    }

    if (slot.slotKey.includes('reference.period')) {
      const periodMatch = answerText.match(/(?:ma|ema|sma)?\s*(\d{1,4})/iu)
      if (!periodMatch?.[1]) {
        return null
      }

      const period = Number(periodMatch[1])
      return {
        paramKey: 'reference.period',
        paramValue: period,
        slotValue: period,
      }
    }

    if (slot.slotKey.includes('confirmationMode')) {
      const confirmationIsClose = /收盘|闭合|确认后|close|bar\s*close|candle\s*close/iu.test(answerText)
      const confirmationIsTouch = /触碰|触及|碰到|盘中|即时|实时|touch|intrabar|immediate/iu.test(answerText)
      if (confirmationIsClose === confirmationIsTouch) {
        return null
      }

      const confirmationMode = confirmationIsClose ? 'close_confirm' : 'touch'
      return {
        paramKey: 'confirmationMode',
        paramValue: confirmationMode,
        slotValue: confirmationMode,
      }
    }

    if (slot.slotKey === 'trigger.volume.relative_average.lookback_bars') {
      const lookbackBars = this.parsePositiveIntegerAnswer(answerText)
      if (lookbackBars === null) {
        return null
      }

      return {
        paramKey: 'lookbackBars',
        paramValue: lookbackBars,
        slotValue: lookbackBars,
      }
    }

    if (slot.slotKey === 'trigger.volume.relative_average.multiplier') {
      const multiplier = this.parsePositiveNumberAnswer(answerText)
      if (multiplier === null) {
        return null
      }

      return {
        paramKey: 'multiplier',
        paramValue: multiplier,
        slotValue: multiplier,
      }
    }

    if (slot.paramSlotKey) {
      const reduction = this.reduceAtomParamSlot(slot.paramSlotKey, answerText)
      if (reduction) {
        return reduction
      }
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.range.lower / grid.range.upper / grid.stepPct are slot key labels, not atom key routing
    if (normalizedGridSlotKey === 'grid.range.lower' || normalizedGridSlotKey === 'grid.range.upper' || normalizedGridSlotKey === 'grid.stepPct') {
      const value = this.parseGridNumericAnswer(normalizedGridSlotKey, answerText)
      if (value === null) {
        return null
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- slot key labels (follow-up #1329)
      const paramKey = normalizedGridSlotKey === 'grid.range.lower'
        ? 'rangeLower'
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- slot key labels (follow-up #1329)
        : (normalizedGridSlotKey === 'grid.range.upper' ? 'rangeUpper' : 'stepPct')

      return {
        paramKey,
        paramValue: value,
        slotValue: value,
      }
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.sideMode is a slot key label, not atom key routing
    if (normalizedGridSlotKey === 'grid.sideMode') {
      const sideMode = this.parseGridSideModeAnswer(answerText)
      if (!sideMode) {
        return null
      }

      return {
        paramKey: 'sideMode',
        paramValue: sideMode,
        slotValue: sideMode,
      }
    }

    return null
  }

  private reduceAtomParamSlot(
    paramSlotKey: string,
    answerText: string,
  ): SupportedSlotReduction | null {
    if (paramSlotKey === 'levels') {
      const levels = this.parsePositiveIntegerAnswer(answerText)
      return levels === null ? null : { paramKey: 'levels', paramValue: levels, slotValue: levels }
    }

    if (paramSlotKey === 'rangeLower' || paramSlotKey === 'rangeUpper' || paramSlotKey === 'stepPct' || paramSlotKey === 'centerOffsetPct') {
      const value = this.parseGridNumericAnswer(paramSlotKey === 'stepPct' ? 'grid.stepPct' : paramSlotKey, answerText)
      return value === null ? null : { paramKey: paramSlotKey, paramValue: value, slotValue: value }
    }

    if (paramSlotKey === 'sideMode') {
      const sideMode = this.parseGridSideModeAnswer(answerText)
      return sideMode ? { paramKey: 'sideMode', paramValue: sideMode, slotValue: sideMode } : null
    }

    return null
  }

  private applyEquivalentConfirmationSlotReduction(
    state: SemanticState,
    targetSlot: SemanticSlotState,
    reduction: SupportedSlotReduction,
    answerText: string,
    messageIndex: number | undefined,
    // #1493 R2 M-new-1：caller 注入 evidence 收集回调，让 confirmationMode 同义兄弟
    //   slot 的 user_explicit evidence 也进入 evidenceOverrides，在 reproject 后保留。
    //   未传时为 no-op，保持旧调用方兼容。
    evidenceCollector?: (
      owner: { _provenance?: { ruleId: string, conditionPath: string } },
      slot: SemanticSlotState,
    ) => void,
  ): void {
    for (const trigger of readFlatTriggers(state)) {
      for (const slot of trigger.openSlots) {
        if (
          slot.status !== 'open'
          || !slot.slotKey.includes('confirmationMode')
          || buildSemanticSlotId(slot) === buildSemanticSlotId(targetSlot)
        ) {
          continue
        }

        trigger.params.confirmationMode = reduction.paramValue
        slot.value = reduction.slotValue
        slot.status = 'locked'
        slot.evidence = {
          text: answerText,
          messageIndex,
          source: 'user_explicit',
        }
        evidenceCollector?.(trigger, slot)
      }
      trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
    }
  }

  private reduceSupportedContextSlot(
    slotKey: SemanticSlotState['slotKey'],
    answerText: string,
  ): SupportedContextReduction | null {
    const normalized = answerText.trim()
    if (!normalized) {
      return null
    }

    if (slotKey === 'marketType') {
      if (/现货|spot/iu.test(normalized)) {
        return { slotValue: 'spot' }
      }
      if (/合约|perp|永续|\bcontract\b/iu.test(normalized)) {
        return { slotValue: 'perp' }
      }
      return null
    }

    if (slotKey === 'exchange') {
      return { slotValue: normalized.toLowerCase() }
    }

    return { slotValue: normalized }
  }

  private normalizeGridSlotKey(slotKey: string): 'grid.range.lower' | 'grid.range.upper' | 'grid.stepPct' | 'grid.sideMode' | null {
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.* slot key labels, not atom key routing
    if (slotKey === 'grid.range.lower' || slotKey === 'grid.lower') {
      return 'grid.range.lower'
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.* slot key labels, not atom key routing
    if (slotKey === 'grid.range.upper' || slotKey === 'grid.upper') {
      return 'grid.range.upper'
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.* slot key labels, not atom key routing
    if (slotKey === 'grid.stepPct') {
      return 'grid.stepPct'
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.* slot key labels, not atom key routing
    if (slotKey === 'grid.sideMode') {
      return 'grid.sideMode'
    }

    return null
  }

  private parseGridNumericAnswer(slotKey: string, answerText: string): number | null {
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- grid.stepPct is a slot key label, not atom key routing
    if (slotKey === 'grid.stepPct') {
      const percentMatch = answerText.match(/(\d+(?:\.\d+)?)\s*%/u)
      if (percentMatch?.[1]) {
        return Number(percentMatch[1])
      }

      const perMilleMatch = answerText.match(/千分之\s*(\d+(?:\.\d+)?)/u)
      if (perMilleMatch?.[1]) {
        return Number(perMilleMatch[1]) / 10
      }
    }

    const numericMatch = answerText.match(/-?\d+(?:\.\d+)?/u)
    if (!numericMatch) {
      return null
    }

    const value = Number(numericMatch[0])
    return Number.isFinite(value) ? value : null
  }

  private parsePercentAnswer(answerText: string): number | null {
    const normalized = answerText.trim()
    if (!normalized || /(?:不是|并非|不要|别|not)/iu.test(normalized) || /-\s*\d/u.test(normalized)) {
      return null
    }

    const percentText = normalized.replace(/％/gu, '%')
    const percentCandidates = [...percentText.matchAll(/(?:百分之?\s*(\d+(?:\.\d+)?|[一二三四五六七八九十]+)|(\d+(?:\.\d+)?)\s*%)/gu)]
    if (percentCandidates.length > 1) {
      return null
    }
    if (percentCandidates.length === 1) {
      const value = this.parsePercentNumberText(percentCandidates[0]?.[1] ?? percentCandidates[0]?.[2])
      return this.isValidPercentValue(value) ? value : null
    }

    if (!/^\d+(?:\.\d+)?$/u.test(normalized)) {
      return null
    }

    const value = Number(normalized)
    return this.isValidPercentValue(value) ? value : null
  }

  private parsePositionSizingContractAnswer(
    answerText: string,
    messageIndex?: number,
  ): { sizing: SemanticPositionSizingContract, evidence: SemanticEvidence } | null {
    if (/(?:不是|并非|不要|别|not)/iu.test(answerText)) {
      return null
    }

    if (this.hasAmbiguousPositionSizingPercentChoice(answerText)) {
      return null
    }

    const parsed = this.positionSizingContracts.parse(answerText, messageIndex)
    if (parsed) {
      return {
        sizing: parsed.sizing,
        evidence: { text: answerText, messageIndex, source: 'user_explicit' },
      }
    }

    if (this.hasMultiplePercentCandidates(answerText)) {
      return null
    }

    const contextualParsed = this.positionSizingContracts.parse(`仓位 ${answerText}`, messageIndex)
    if (contextualParsed) {
      return {
        sizing: contextualParsed.sizing,
        evidence: { text: answerText, messageIndex, source: 'user_explicit' },
      }
    }

    if (this.looksLikeNonSizingPercentAnswer(answerText)) {
      return null
    }

    const percentValue = this.parsePercentAnswer(answerText)
    if (percentValue === null) {
      return null
    }

    return {
      sizing: { kind: 'ratio', value: percentValue / 100, unit: 'ratio' },
      evidence: { text: answerText, messageIndex, source: 'user_explicit' },
    }
  }

  private resolveLegacySizingMode(sizing: SemanticPositionSizingContract): 'fixed_ratio' | 'fixed_quote' | 'fixed_qty' {
    if (sizing.kind === 'quote') return 'fixed_quote'
    if (sizing.kind === 'base') return 'fixed_qty'
    return 'fixed_ratio'
  }

  private formatPositionSizingValue(sizing: SemanticPositionSizingContract): string {
    if (sizing.kind === 'ratio') {
      return `${this.formatFiniteNumber(sizing.value * 100)}%`
    }

    return `${this.formatFiniteNumber(sizing.value)} ${sizing.asset}`
  }

  private formatFiniteNumber(value: number): string {
    return Number(value.toFixed(8)).toString()
  }

  private hasMultiplePercentCandidates(answerText: string): boolean {
    const percentText = answerText.replace(/％/gu, '%')
    const percentCandidates = percentText.match(/(?:百分之?\s*(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+)|\d+(?:\.\d+)?\s*%)/gu) ?? []
    return percentCandidates.length > 1
  }

  private hasAmbiguousPositionSizingPercentChoice(answerText: string): boolean {
    const percentText = answerText.replace(/％/gu, '%')
    const percentPattern = /(?:百分之?\s*(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+)|\d+(?:\.\d+)?\s*%)/gu
    const candidates = [...percentText.matchAll(percentPattern)]
      .map(match => ({
        index: match.index ?? -1,
        text: match[0],
        hasSizingContext: match.index === undefined
          ? false
          : this.hasLocalPositionSizingContextAt(percentText, match.index, match[0].length),
      }))
      .filter(candidate => candidate.index >= 0)

    for (let index = 0; index < candidates.length - 1; index += 1) {
      const current = candidates[index]
      const next = candidates[index + 1]
      if (!current || !next) continue

      const between = percentText.slice(current.index + current.text.length, next.index)
      if (!/(?:或|或者|还是|\/|／)/u.test(between)) continue
      if (current.hasSizingContext || next.hasSizingContext) return true
    }

    return false
  }

  private looksLikeNonSizingPercentAnswer(answerText: string): boolean {
    if (!/(?:百分之?\s*(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+)|\d+(?:\.\d+)?\s*[%％])/u.test(answerText)) {
      return false
    }

    if (this.hasLocalPositionSizingPercentContext(answerText)) {
      return false
    }

    return /(?:止盈|止损|盈利|亏损|收益|损失|风险|回撤|资金费率|funding|价格|收盘价|开盘价|最高价|最低价|上涨|下跌|涨|跌|突破|跌破|高于|低于|站上)/iu.test(answerText)
  }

  private hasLocalPositionSizingPercentContext(answerText: string): boolean {
    const percentText = answerText.replace(/％/gu, '%')
    const percentPattern = /(?:百分之?\s*(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+)|\d+(?:\.\d+)?\s*%)/gu
    for (const match of percentText.matchAll(percentPattern)) {
      if (match.index === undefined) continue

      if (this.hasLocalPositionSizingContextAt(percentText, match.index, match[0].length)) {
        return true
      }
    }

    return false
  }

  private hasLocalPositionSizingContextAt(text: string, index: number, length: number): boolean {
    const prefix = text.slice(Math.max(0, index - 8), index)
    if (/(?:仓位|资金(?!费率)|比例|使用|投入|固定|单笔|每次|每笔|每单|用)\s*$/u.test(prefix)) {
      return true
    }

    const suffix = text.slice(index + length, index + length + 8)
    return /^\s*(?:仓位|资金(?!费率)|比例)/u.test(suffix)
  }

  private parsePercentNumberText(valueText: string | undefined): number {
    if (!valueText) {
      return Number.NaN
    }

    const numericValue = Number(valueText)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }

    return this.parseChinesePercentNumberText(valueText)
  }

  private parseChinesePercentNumberText(valueText: string): number {
    const digitMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    }

    if (valueText === '十') {
      return 10
    }

    const tenIndex = valueText.indexOf('十')
    if (tenIndex >= 0) {
      const leadingText = valueText.slice(0, tenIndex)
      const trailingText = valueText.slice(tenIndex + 1)
      const leading = leadingText === '' ? 1 : digitMap[leadingText]
      const trailing = trailingText === '' ? 0 : digitMap[trailingText]
      return leading !== undefined && trailing !== undefined ? leading * 10 + trailing : Number.NaN
    }

    return digitMap[valueText] ?? Number.NaN
  }

  private isValidPercentValue(value: number): boolean {
    return Number.isFinite(value) && value > 0 && value <= 100
  }

  /* eslint-disable atom-keys/no-atom-key-literal -- risk.max_drawdown_pct / risk.max_single_loss_pct / risk.stop_loss_pct not yet in REGISTRY (follow-up #1329) */
  private buildProtectiveRiskParams(
    riskKey: 'risk.stop_loss_pct' | 'risk.max_drawdown_pct' | 'risk.max_single_loss_pct' | 'risk.trailing_stop_pct',
    valuePct: number,
  ): Record<string, unknown> {
    if (riskKey === 'risk.max_drawdown_pct' || riskKey === 'risk.max_single_loss_pct') {
      const condition: SemanticExpression = {
        kind: 'predicate',
        op: riskKey === 'risk.max_drawdown_pct' ? 'GTE' : 'LTE',
        left: riskKey === 'risk.max_drawdown_pct'
          ? { kind: 'account', field: 'drawdown_pct' }
          : { kind: 'position', field: 'pnl_pct' },
        right: { kind: 'constant', value: riskKey === 'risk.max_drawdown_pct' ? valuePct : -valuePct, unit: 'percent' },
      }

      return {
        condition,
        effect: riskKey === 'risk.max_drawdown_pct'
          ? { type: 'pause_strategy' }
          : { type: 'close_position' },
        scope: riskKey === 'risk.max_drawdown_pct' ? 'account' : 'current_position',
        capabilityStatus: riskKey === 'risk.max_drawdown_pct' ? 'recognized_unsupported' : 'supported',
        ...(riskKey === 'risk.max_drawdown_pct' ? { unsupportedReason: 'risk_expression_compiler_not_available' } : {}),
      }
    }

    return {
      valuePct,
      basis: 'entry_avg_price',
    }
  }
  /* eslint-enable atom-keys/no-atom-key-literal */

  private resolveProtectiveRiskAnswerKey(answerText: string): 'risk.stop_loss_pct' | 'risk.max_drawdown_pct' | 'risk.max_single_loss_pct' | 'risk.trailing_stop_pct' | null {
    if (/最大回撤|max\s*drawdown/iu.test(answerText)) {
      return 'risk.max_drawdown_pct'
    }

    if (/单笔|单次|每笔|max\s*single/iu.test(answerText) && /亏损|损失|loss/iu.test(answerText)) {
      return 'risk.max_single_loss_pct'
    }

    if (/移动止损|trailing/iu.test(answerText)) {
      return null
    }

    if (/止损|亏损|损失|stop[\s_-]?loss|loss/iu.test(answerText)) {
      return 'risk.stop_loss_pct'
    }

    return null
  }

  private parseGridSideModeAnswer(answerText: string): 'long_only' | 'short_only' | 'bidirectional' | null {
    const normalized = answerText.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    if (normalized === 'bidirectional' || /双向|低买高卖|来回|往返|自动买卖|自动交易/u.test(answerText)) {
      return 'bidirectional'
    }

    if (normalized === 'long_only' || /只做多|仅做多|做多网格|多头网格|做多|多头/u.test(answerText)) {
      return 'long_only'
    }

    if (normalized === 'short_only' || /只做空|仅做空|做空网格|空头网格|做空|空头/u.test(answerText)) {
      return 'short_only'
    }

    return null
  }
}
