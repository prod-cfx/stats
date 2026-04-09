import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { Injectable } from '@nestjs/common'

interface ClarificationChecklistInput {
  entryRules?: string[]
  riskRules?: Record<string, unknown>
}

const LONG_DIRECTION_PATTERN = /做多|多单|开多|long|买入/u
const SHORT_DIRECTION_PATTERN = /做空|空单|开空|short|卖出/u
const UPPER_BAND_PATTERN = /(?:布林|bollinger).{0,8}(?:上轨|upper)|(?:上轨|upper).{0,8}(?:布林|bollinger)|突破.{0,8}(?:上轨|upper)/iu
const LOWER_BAND_PATTERN = /(?:布林|bollinger).{0,8}(?:下轨|lower)|(?:下轨|lower).{0,8}(?:布林|bollinger)|跌破.{0,8}(?:下轨|lower)|突破.{0,8}(?:下轨|lower)/iu

@Injectable()
export class StrategyClarificationRulesService {
  detect(input: ClarificationChecklistInput): StrategyClarificationState {
    const items: StrategyClarificationItem[] = [
      ...this.detectEntryItems(input.entryRules ?? []),
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

  private detectEntryItems(entryRules: string[]): StrategyClarificationItem[] {
    const items: StrategyClarificationItem[] = []
    let sideQuestionAdded = false

    for (const [index, rawRule] of entryRules.entries()) {
      const rule = rawRule.trim()
      if (!rule) continue

      const hasLongDirection = LONG_DIRECTION_PATTERN.test(rule)
      const hasShortDirection = SHORT_DIRECTION_PATTERN.test(rule)

      if (hasLongDirection && hasShortDirection) {
        items.push({
          key: `entry.action_uniqueness.${index + 1}`,
          ruleId: `entry-${index + 1}`,
          reason: 'missing_action_uniqueness',
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
          question: '跌破下轨时是只做多，还是也允许做空？',
          status: 'pending',
        })
        sideQuestionAdded = true
      }
    }

    return items
  }

  private detectRiskItems(riskRules: Record<string, unknown>): StrategyClarificationItem[] {
    const riskTexts = Object.values(riskRules)
      .filter((value): value is string => typeof value === 'string' && !!value.trim())

    const hasAmbiguousEffect = riskTexts.some((text) => {
      const hasOutsideBand = /轨外|outside/iu.test(text)
      const hasThreeBars = /连续\s*3|3\s*根|三根/u.test(text)
      const hasForceExit = /全平|全部平仓|清仓|强平|force\s*exit|force\s*close/iu.test(text)
      const hasReduce = /减仓|reduce/iu.test(text)
      return hasOutsideBand && hasThreeBars && hasForceExit && hasReduce
    })

    if (!hasAmbiguousEffect) return []

    return [{
      key: 'risk.effect',
      reason: 'ambiguous_risk_effect',
      question: '轨外3根时是全平还是减仓？',
      status: 'pending',
    }]
  }
}
