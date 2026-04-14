import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { Injectable } from '@nestjs/common'

type StrategyClarificationPromptState = StrategyClarificationState & {
  summary?: string | null
}

const REASON_PRIORITY: Record<StrategyClarificationItem['reason'], number> = {
  conflicting_market_scope: 1,
  invalid_spot_short_combo: 1,
  missing_entry_rules: 2,
  missing_exit_rules: 2,
  missing_stop_loss_rule: 2,
  missing_take_profit_rule: 2,
  missing_action_uniqueness: 2,
  missing_side_scope: 2,
  direction_ambiguous: 2,
  ambiguous_risk_effect: 3,
  missing_exchange: 4,
  missing_symbol: 4,
  missing_timeframe: 4,
  missing_market_type: 4,
  missing_position_pct: 4,
  missing_position_mode: 4,
  ambiguous_condition_basis: 5,
  grid_params_missing: 3,
  ambiguous_state_gate: 3,
}

@Injectable()
export class StrategyClarificationQuestionService {
  build(state: StrategyClarificationPromptState | null | undefined): string {
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

    return [
      `我当前理解的策略是：${state.summary?.trim() || '已识别部分条件，但仍未完整。'}`,
      `现在还缺一个会影响脚本生成一致性的条件：${this.renderGapLabel(target)}`,
      `请确认：${target.question}`,
    ].join('\n')
  }

  private renderGapLabel(item: StrategyClarificationItem): string {
    if (
      item.reason === 'missing_entry_rules'
      || item.reason === 'missing_exit_rules'
      || item.reason === 'missing_stop_loss_rule'
      || item.reason === 'missing_take_profit_rule'
    ) {
      return '核心交易语义。'
    }
    if (
      item.reason === 'missing_exchange'
      || item.reason === 'missing_symbol'
      || item.reason === 'missing_timeframe'
      || item.reason === 'missing_market_type'
      || item.reason === 'missing_position_pct'
      || item.reason === 'missing_position_mode'
    ) {
      return item.reason === 'missing_position_pct' ? '仓位配置。' : '关键市场约束信息。'
    }
    if (item.reason === 'conflicting_market_scope' || item.reason === 'invalid_spot_short_combo') {
      return '市场约束与方向条件冲突。'
    }
    if (item.reason === 'missing_side_scope' || item.reason === 'direction_ambiguous') {
      return '缺少方向约束。'
    }
    if (item.reason === 'missing_action_uniqueness') {
      return '动作唯一性约束。'
    }
    if (item.reason === 'ambiguous_risk_effect') {
      return '风控动作定义。'
    }
    if (item.reason === 'ambiguous_condition_basis') {
      return '条件比较基准。'
    }
    if (item.reason === 'grid_params_missing') {
      return '网格参数。'
    }
    if (item.reason === 'ambiguous_state_gate') {
      return '状态门控白名单。'
    }
    return '关键条件。'
  }
}
