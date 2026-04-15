import type { StrategySummary } from '../types/strategy-summary'
import { Injectable } from '@nestjs/common'

export interface StrategySummaryObservationReport {
  status: 'aligned' | 'drifted' | 'unprovable'
  warnings: string[]
  details: {
    userIntentSummary?: StrategySummary | null
    strategySummary?: StrategySummary | null
    scriptSummary?: StrategySummary | null
  }
}

@Injectable()
export class StrategySummaryObservationService {
  build(input: {
    userIntentSummary?: StrategySummary
    strategySummary?: StrategySummary
    scriptSummary?: StrategySummary
  }): StrategySummaryObservationReport {
    const userIntentSummary = input.userIntentSummary
    const strategySummary = input.strategySummary
    const scriptSummary = input.scriptSummary

    if (!userIntentSummary || !strategySummary || !scriptSummary) {
      return {
        status: 'unprovable',
        warnings: [],
        details: {
          userIntentSummary: userIntentSummary ?? null,
          strategySummary: strategySummary ?? null,
          scriptSummary: scriptSummary ?? null,
        },
      }
    }

    const warnings = [
      ...this.compareSummaries('用户意图', userIntentSummary, '策略描述', strategySummary),
      ...this.compareSummaries('策略描述', strategySummary, '脚本语义', scriptSummary),
    ]

    return {
      status: warnings.length > 0 ? 'drifted' : 'aligned',
      warnings,
      details: {
        userIntentSummary,
        strategySummary,
        scriptSummary,
      },
    }
  }

  private compareSummaries(
    leftLabel: string,
    left: StrategySummary,
    rightLabel: string,
    right: StrategySummary,
  ): string[] {
    const issues: string[] = []
    if (left.strategyType !== right.strategyType) {
      issues.push(`${leftLabel}.strategyType=${left.strategyType} != ${rightLabel}.strategyType=${right.strategyType}`)
    }

    const leftIndicators = [...left.indicators].sort()
    const rightIndicators = [...right.indicators].sort()
    if (leftIndicators.join('|') !== rightIndicators.join('|')) {
      issues.push(`${leftLabel}.indicators 与 ${rightLabel}.indicators 不一致`)
    }

    if (left.entryRule !== right.entryRule) {
      issues.push(`${leftLabel}.entryRule=${left.entryRule} != ${rightLabel}.entryRule=${right.entryRule}`)
    }

    if (left.exitRule !== right.exitRule) {
      issues.push(`${leftLabel}.exitRule=${left.exitRule} != ${rightLabel}.exitRule=${right.exitRule}`)
    }

    if (left.sizing && right.sizing) {
      const leftSizing = `${left.sizing.mode}:${left.sizing.evidence}`
      const rightSizing = `${right.sizing.mode}:${right.sizing.evidence}`
      if (leftSizing !== rightSizing) {
        issues.push(`${leftLabel}.sizing=${leftSizing} != ${rightLabel}.sizing=${rightSizing}`)
      }
    }

    return issues
  }
}
