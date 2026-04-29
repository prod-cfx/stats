import { Injectable } from '@nestjs/common'
import { buildSemanticSlotId } from '../types/semantic-state'
import type { SemanticEvidence, SemanticPositionSizingContract, SemanticSlotState, SemanticState } from '../types/semantic-state'
import { PositionSizingContractService } from './position-sizing-contract.service'

interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode' | 'rangeLower' | 'rangeUpper' | 'stepPct' | 'sideMode' | 'reference'
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

    for (const risk of nextState.risk) {
      if (risk.key !== 'risk.protective_exit') continue

      const slot = risk.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey
          && (input.targetFieldPath ? item.fieldPath === input.targetFieldPath : true)
      })
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

      risk.key = riskKey
      risk.params = {
        valuePct: percentValue,
        basis: 'entry_avg_price',
      }
      risk.status = 'locked'
      risk.source = 'user_explicit'
      risk.evidence = evidence
      slot.value = percentValue
      slot.status = 'locked'
      slot.evidence = evidence
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

    return nextState
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
      const confirmationIsClose = /收盘|确认|close/u.test(answerText)
      const confirmationIsTouch = /盘中|即时|touch/u.test(answerText)
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
      if (/合约|perp|永续|contract/iu.test(normalized)) {
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
