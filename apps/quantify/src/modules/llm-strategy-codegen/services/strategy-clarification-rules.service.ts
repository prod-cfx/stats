import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { Injectable } from '@nestjs/common'

interface MarketChecklistInput {
  exchange?: unknown
  symbol?: unknown
  timeframe?: unknown
  marketType?: unknown
  positionMode?: unknown
}

interface ClarificationChecklistInput {
  entryRules?: string[]
  riskRules?: Record<string, unknown>
  market?: MarketChecklistInput
}

const LONG_DIRECTION_PATTERN = /做多|多单|开多|long|买入/u
const SHORT_DIRECTION_PATTERN = /做空|空单|开空|short|卖出/u
const UPPER_BAND_PATTERN = /(布林|bollinger).{0,8}(上轨|upper)|(上轨|upper).{0,8}(布林|bollinger)|突破.{0,8}(上轨|upper)/iu
const LOWER_BAND_PATTERN = /(布林|bollinger).{0,8}(下轨|lower)|(下轨|lower).{0,8}(布林|bollinger)|跌破.{0,8}(下轨|lower)|突破.{0,8}(下轨|lower)/iu

@Injectable()
export class StrategyClarificationRulesService {
  detect(input: ClarificationChecklistInput): StrategyClarificationState {
    const entryDetection = this.detectEntryItems(input.entryRules ?? [])
    const items: StrategyClarificationItem[] = [
      ...entryDetection.items,
      ...this.detectMarketItems(input, entryDetection.hasShortEntry),
      ...this.detectRiskItems(input.riskRules ?? {}),
    ]

    if (items.length === 0) {
      return {
        status: 'CLEAR',
        items: [],
      }
    }

    return {
      status: 'NEEDS_CLARIFICATION',
      items,
    }
  }

  private detectEntryItems(entryRules: string[]): { items: StrategyClarificationItem[] } & { hasShortEntry: boolean } {
    const items: StrategyClarificationItem[] = []
    let sideQuestionAdded = false
    let hasShortEntry = false

    for (const [index, rawRule] of entryRules.entries()) {
      const rule = rawRule.trim()
      if (!rule) continue

      const hasLongDirection = LONG_DIRECTION_PATTERN.test(rule)
      const hasShortDirection = SHORT_DIRECTION_PATTERN.test(rule)
      if (hasShortDirection) {
        hasShortEntry = true
      }

      if (hasLongDirection && hasShortDirection) {
        items.push({
          key: `entry.action_uniqueness.${index + 1}`,
          ruleId: `entry-${index + 1}`,
          reason: 'missing_action_uniqueness',
          field: 'positionMode',
          blocking: true,
          question: '这条入场规则同时包含做多和做空，请确认最终只保留哪个方向？',
          status: 'pending',
        })
        continue
      }

      if (sideQuestionAdded || hasLongDirection || hasShortDirection) continue

      if (UPPER_BAND_PATTERN.test(rule)) {
        items.push({
          key: 'entry.side',
          ruleId: `entry-${index + 1}`,
          reason: 'missing_side_scope',
          field: 'positionMode',
          blocking: true,
          question: '突破上轨时是只做空，还是也允许做多？',
          status: 'pending',
        })
        sideQuestionAdded = true
        continue
      }

      if (LOWER_BAND_PATTERN.test(rule)) {
        items.push({
          key: 'entry.side',
          ruleId: `entry-${index + 1}`,
          reason: 'missing_side_scope',
          field: 'positionMode',
          blocking: true,
          question: '跌破下轨时是只做多，还是也允许做空？',
          status: 'pending',
        })
        sideQuestionAdded = true
      }
    }

    return {
      items,
      hasShortEntry,
    }
  }

  private detectMarketItems(
    input: ClarificationChecklistInput,
    hasShortEntry: boolean,
  ): StrategyClarificationItem[] {
    if (!hasShortEntry) return []

    const marketType = this.readMarketType(input)
    if (!marketType) {
      return [{
        key: 'market.marketType',
        reason: 'missing_market_type',
        field: 'marketType',
        blocking: true,
        question: '该策略运行在现货还是合约市场？',
        status: 'pending',
      }]
    }

    if (marketType === 'spot') {
      return [{
        key: 'market.marketType',
        reason: 'invalid_spot_short_combo',
        field: 'marketType',
        blocking: true,
        question: '现货市场不支持做空，请改为合约市场(perp)或移除做空规则。',
        status: 'pending',
      }]
    }

    return []
  }

  private readMarketType(input: ClarificationChecklistInput): 'spot' | 'perp' | null {
    const candidates = [input.market?.marketType, input.riskRules?.marketType]
    for (const raw of candidates) {
      if (typeof raw !== 'string') continue
      const normalized = raw.trim().toLowerCase()
      if (normalized === 'spot' || normalized === 'perp') {
        return normalized
      }
    }
    return null
  }

  private detectRiskItems(riskRules: Record<string, unknown>): StrategyClarificationItem[] {
    const riskTexts = Object.values(riskRules)
      .filter((value): value is string => typeof value === 'string' && !!value.trim())

    const hasAmbiguousEffect = riskTexts.some((text) => {
      const hasOutsideBand = /轨外|outside/iu.test(text)
      const hasThreeBars = /连续\s*3|3\s*根|三根/iu.test(text)
      const hasCloseAction = /提前止损|止损|全平|全部平仓|清仓|强平|平仓|close|exit/iu.test(text)
      const hasReduce = /减仓|reduce/iu.test(text)
      return hasOutsideBand && hasThreeBars && hasCloseAction && hasReduce
    })

    if (!hasAmbiguousEffect) return []

    return [{
      key: 'riskRules.earlyStop.action',
      reason: 'ambiguous_risk_effect',
      field: 'riskRules.earlyStop.action',
      allowedAnswers: ['reduce', 'close'],
      blocking: true,
      question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
      status: 'pending',
    }]
  }
}
