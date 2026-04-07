import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { Injectable } from '@nestjs/common'

const REASON_PRIORITY: Record<StrategyClarificationItem['reason'], number> = {
  missing_action_uniqueness: 1,
  missing_side_scope: 2,
  direction_ambiguous: 2,
  ambiguous_risk_effect: 3,
  ambiguous_condition_basis: 4,
}

@Injectable()
export class StrategyClarificationQuestionService {
  build(state: StrategyClarificationState | null | undefined): string {
    if (!state || state.status !== 'NEEDS_CLARIFICATION') return ''

    const pendingItems = state.items.filter(item => item.status === 'pending')
    if (pendingItems.length === 0) return ''

    const target = pendingItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const priorityDelta = REASON_PRIORITY[a.item.reason] - REASON_PRIORITY[b.item.reason]
        if (priorityDelta !== 0) return priorityDelta
        return a.index - b.index
      })[0]?.item

    if (!target) return ''

    return `${this.renderLead(target)}\n${target.question}`
  }

  private renderLead(item: StrategyClarificationItem): string {
    if (item.reason === 'missing_side_scope' || item.reason === 'direction_ambiguous') {
      return '当前这条规则还缺少方向约束。'
    }
    if (item.reason === 'missing_action_uniqueness') {
      return '当前这条规则还缺少动作唯一性约束。'
    }
    if (item.reason === 'ambiguous_risk_effect') {
      return '当前这条规则的风控动作还不明确。'
    }
    return '当前这条规则还有一个关键条件需要澄清。'
  }
}
