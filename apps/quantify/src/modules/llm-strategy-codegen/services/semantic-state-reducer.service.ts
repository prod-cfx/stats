import { Injectable } from '@nestjs/common'
import { buildSemanticSlotId } from '../types/semantic-state'
import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticCapabilityShape,
  SemanticEvidence,
  SemanticExpression,
  SemanticPositionConstraintState,
  SemanticPositionSizingContract,
  SemanticSlotState,
  SemanticState,
} from '../types/semantic-state'
import { PositionSizingContractService } from './position-sizing-contract.service'
import { normalizeRiskSemantics } from './semantic-state-normalization'

interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode' | 'rangeLower' | 'rangeUpper' | 'stepPct' | 'sideMode' | 'reference' | 'lookbackBars' | 'multiplier'
  paramValue: number | string
  slotValue: number | string
  extraParams?: Record<string, number | string>
}

interface SupportedContextReduction {
  slotValue: string
}

@Injectable()
export class SemanticStateReducerService {
  constructor(
    private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
  ) {}

  applyClarificationAnswer(input: {
    currentState: SemanticState
    targetSlotKey: string
    targetFieldPath?: string
    targetSlotId?: string
    answer: string
    messageIndex?: number
    applyEquivalentConfirmationSlots?: boolean
  }): SemanticState {
    const nextState: SemanticState = {
      ...input.currentState,
      triggers: input.currentState.triggers.map(trigger => ({
        ...trigger,
        params: { ...trigger.params },
        openSlots: trigger.openSlots.map(slot => ({ ...slot })),
      })),
      actions: input.currentState.actions.map(action => ({
        ...action,
        ...(action.params ? { params: { ...action.params } } : {}),
        openSlots: action.openSlots?.map(slot => ({ ...slot })),
      })),
      risk: input.currentState.risk.map(risk => ({
        ...risk,
        params: { ...risk.params },
        openSlots: risk.openSlots.map(slot => ({ ...slot })),
      })),
      position: input.currentState.position
        ? {
            ...input.currentState.position,
            openSlots: input.currentState.position.openSlots?.map(slot => ({ ...slot })),
            ...(input.currentState.position.constraints
              ? { constraints: structuredClone(input.currentState.position.constraints) }
              : {}),
          }
        : null,
      contextSlots: {
        exchange: input.currentState.contextSlots.exchange ? { ...input.currentState.contextSlots.exchange } : null,
        symbol: input.currentState.contextSlots.symbol ? { ...input.currentState.contextSlots.symbol } : null,
        marketType: input.currentState.contextSlots.marketType ? { ...input.currentState.contextSlots.marketType } : null,
        timeframe: input.currentState.contextSlots.timeframe ? { ...input.currentState.contextSlots.timeframe } : null,
      },
      updatedAt: new Date().toISOString(),
    }

    const answerText = input.answer.trim()
    for (const trigger of nextState.triggers) {
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

      slot.value = reduction.slotValue
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }

      trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      if (input.applyEquivalentConfirmationSlots && reduction.paramKey === 'confirmationMode') {
        this.applyEquivalentConfirmationSlotReduction(nextState, slot, reduction, answerText, input.messageIndex)
      }
      break
    }

    for (const action of nextState.actions) {
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
      action.params = {
        ...(action.params ?? {}),
        [paramKey]: answerText,
      }
      slot.value = answerText
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      action.status = (action.openSlots ?? []).every(item => item.status !== 'open') ? 'locked' : 'open'
      if (action.key === 'action.add_position' && paramKey === 'constraint') {
        this.applyAddPositionConstraintAnswer(nextState, answerText, input.messageIndex)
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

    for (const constraint of nextState.position?.constraints ?? []) {
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
      slot.value = answerText
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }
      constraint.status = constraint.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      break
    }

    let riskChanged = false
    for (const risk of nextState.risk) {
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

      if (risk.key !== 'risk.protective_exit' && slot?.status === 'open') {
        const paramKey = this.resolveRiskParamKey(slot)
        if (paramKey) {
          risk.params[paramKey] = answerText
          slot.value = answerText
          slot.status = 'locked'
          slot.evidence = {
            text: answerText,
            messageIndex: input.messageIndex,
            source: 'user_explicit',
          }
          risk.status = risk.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
          break
        }
      }

      if (risk.key !== 'risk.protective_exit') continue
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

      risk.key = riskKey === 'risk.max_drawdown_pct' || riskKey === 'risk.max_single_loss_pct'
        ? 'risk.condition_expression'
        : riskKey
      risk.params = this.buildProtectiveRiskParams(riskKey, percentValue)
      risk.status = 'locked'
      risk.source = 'user_explicit'
      risk.evidence = evidence
      slot.value = percentValue
      slot.status = 'locked'
      slot.evidence = evidence
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

      const reduction = this.reduceSupportedContextSlot(slot.slotKey, answerText)
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

    return {
      ...nextState,
      risk: riskChanged ? normalizeRiskSemantics(nextState.risk) : nextState.risk,
    }
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

  private applyAddPositionConstraintAnswer(
    state: SemanticState,
    answerText: string,
    messageIndex?: number,
  ): void {
    const parsed = this.parseAddPositionConstraintAnswer(answerText)
    if (!parsed) {
      return
    }

    if (!state.position) {
      state.position = {
        mode: 'constraint_only',
        value: 0,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        constraints: [],
      }
    }

    const constraints = state.position.constraints ?? []
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
    } else {
      constraints.push({
        id: parsed.key === 'position.pyramiding_limit'
          ? 'clarified-position-pyramiding-limit'
          : 'clarified-position-max-exposure',
        key: parsed.key,
        params: parsed.params,
        status: 'locked',
        source: 'user_explicit',
        evidence,
        openSlots: [],
      })
    }

    state.position.constraints = constraints
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

    if (normalizedGridSlotKey === 'grid.range.lower' || normalizedGridSlotKey === 'grid.range.upper' || normalizedGridSlotKey === 'grid.stepPct') {
      const value = this.parseGridNumericAnswer(normalizedGridSlotKey, answerText)
      if (value === null) {
        return null
      }

      const paramKey = normalizedGridSlotKey === 'grid.range.lower'
        ? 'rangeLower'
        : (normalizedGridSlotKey === 'grid.range.upper' ? 'rangeUpper' : 'stepPct')

      return {
        paramKey,
        paramValue: value,
        slotValue: value,
      }
    }

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

  private applyEquivalentConfirmationSlotReduction(
    state: SemanticState,
    targetSlot: SemanticSlotState,
    reduction: SupportedSlotReduction,
    answerText: string,
    messageIndex: number | undefined,
  ): void {
    for (const trigger of state.triggers) {
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
    if (slotKey === 'grid.range.lower' || slotKey === 'grid.lower') {
      return 'grid.range.lower'
    }

    if (slotKey === 'grid.range.upper' || slotKey === 'grid.upper') {
      return 'grid.range.upper'
    }

    if (slotKey === 'grid.stepPct') {
      return 'grid.stepPct'
    }

    if (slotKey === 'grid.sideMode') {
      return 'grid.sideMode'
    }

    return null
  }

  private parseGridNumericAnswer(slotKey: string, answerText: string): number | null {
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
