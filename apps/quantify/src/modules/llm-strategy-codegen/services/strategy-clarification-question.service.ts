import type { StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyDecision } from '../types/strategy-decision'
import { Injectable } from '@nestjs/common'

type StrategyClarificationPromptState = StrategyClarificationState & {
  summary?: string | null
}

interface PendingClarificationTargetCandidate {
  status?: unknown
  key?: unknown
  reason?: unknown
}

const REASON_PRIORITY: Record<StrategyClarificationItem['reason'], number> = {
  conflicting_market_scope: 1,
  invalid_spot_short_combo: 1,
  atomic_semantic_fork: 2,
  missing_action_uniqueness: 3,
  missing_side_scope: 3,
  direction_ambiguous: 3,
  missing_exchange: 4,
  missing_symbol: 4,
  missing_timeframe: 4,
  missing_market_type: 4,
  missing_position_pct: 4,
  missing_position_mode: 4,
  ambiguous_condition_basis: 7,
  ambiguous_risk_effect: 8,
  grid_params_missing: 5,
  ambiguous_state_gate: 5,
  missing_semantic_trigger: 5,
  missing_semantic_action: 5,
  missing_semantic_contract_requirement: 5,
  missing_semantic_position_sizing: 8,
  missing_semantic_position_mode: 8,
  missing_semantic_risk: 8,
  missing_risk_atom: 3,
  missing_entry_rules: 20,
  missing_exit_rules: 20,
  missing_stop_loss_rule: 20,
  missing_take_profit_rule: 20,
}

export function pickPendingClarificationTarget<T extends PendingClarificationTargetCandidate>(
  items: readonly T[],
): T | null {
  return items
    .filter(item => item.status === 'pending')
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priorityDelta = readClarificationItemPriority(a.item) - readClarificationItemPriority(b.item)
      if (priorityDelta !== 0) return priorityDelta
      return a.index - b.index
    })[0]?.item ?? null
}

@Injectable()
export class StrategyClarificationQuestionService {
  buildFromDecision(decision: StrategyDecision): string {
    if (decision.kind === 'CONFIRM_INFERRED') {
      return [
        `我当前理解的策略是：${decision.normalizedSummary}`,
        '以下内容是系统推断，不是你明确给出的：',
        ...decision.inferredAssumptions.map(item => `- ${item.key}: ${item.value}`),
        '请确认这些推断是否成立；确认后我再生成策略代码。',
      ].join('\n')
    }

    if (decision.kind === 'ASK_CLARIFY') {
      return [
        `我当前理解的策略是：${decision.normalizedSummary}`,
        `现在还缺一个会影响脚本生成一致性的条件：${this.renderDecisionGapLabel(decision.nextActionPayload.question.reason)}`,
        `请确认：${decision.nextActionPayload.question.question}`,
      ].join('\n')
    }

    return ''
  }

  buildFromAmbiguities(input: {
    summary?: string | null
    ambiguities?: StrategyAmbiguity[] | null
  }): string {
    const target = this.pickHighestPriorityAmbiguity(input.ambiguities ?? [])
    if (!target) return ''

    return [
      `我当前理解的策略是：${input.summary?.trim() || '已识别部分条件，但仍未完整。'}`,
      `现在还缺一个会影响脚本生成一致性的条件：${this.readAmbiguityMessage(target)}`,
      `请确认：${this.renderAmbiguityQuestion(target)}`,
    ].join('\n')
  }

  build(state: StrategyClarificationPromptState | null | undefined): string {
    if (!state || state.status !== 'NEEDS_CLARIFICATION') return ''

    const target = pickPendingClarificationTarget(state.items)

    if (!target) return ''

    return [
      `我当前理解的策略是：${state.summary?.trim() || '已识别部分条件，但仍未完整。'}`,
      `现在还缺一个会影响脚本生成一致性的条件：${this.renderGapLabel(target)}`,
      `请确认：${target.question}`,
    ].join('\n')
  }

  private renderGapLabel(item: StrategyClarificationItem): string {
    if (item.key.startsWith('semantic.')) {
      if (item.key.includes('confirmationMode')) return '待确认的触发语义槽位。'
      if (item.key.includes('reference.period')) return '待确认的指标参数槽位。'
      if (item.key.includes('risk.')) return '待确认的风控语义槽位。'
      return '待确认的策略语义槽位。'
    }
    if (item.key.startsWith('grid.')) {
      return '网格参数。'
    }
    if (item.key.startsWith('executionContext.')) {
      return '待确认的执行上下文槽位。'
    }
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
    if (item.reason === 'missing_risk_atom') {
      return '待确认的风控语义槽位。'
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
    if (item.reason === 'atomic_semantic_fork') {
      return '执行语义分叉。'
    }
    return '关键条件。'
  }

  private renderDecisionGapLabel(reason: string): string {
    if (reason === 'trigger_semantics_fork') return '执行语义分叉。'
    if (reason === 'basis_ambiguity') return '待确认的语义槽位。'
    if (reason === 'direction_ambiguity') return '待确认的语义槽位。'
    if (reason === 'runtime_context_missing') return '待确认的执行上下文槽位。'
    if (reason === 'exit_semantics_missing') return '待确认的策略语义槽位。'
    return '关键条件。'
  }

  private pickHighestPriorityAmbiguity(ambiguities: StrategyAmbiguity[]): StrategyAmbiguity | null {
    return ambiguities
      .map((ambiguity, index) => ({ ambiguity, index }))
      .sort((a, b) => {
        const priorityDelta = this.readAmbiguityPriority(a.ambiguity) - this.readAmbiguityPriority(b.ambiguity)
        if (priorityDelta !== 0) return priorityDelta
        return a.index - b.index
      })[0]?.ambiguity ?? null
  }

  private readAmbiguityPriority(ambiguity: StrategyAmbiguity): number {
    if (ambiguity.kind === 'semantic_conflict') return 1
    if (ambiguity.kind === 'open_semantic_slot') {
      if (ambiguity.priority === 10) return 2
      if (ambiguity.priority === 20) return 3
      if (ambiguity.priority === 30) return 4
      if (ambiguity.priority === 40) return 5
      return 2
    }
    if (ambiguity.kind === 'execution_context_conflict') return 1
    if (ambiguity.kind === 'execution_context_missing') {
      if (ambiguity.field === 'exchange') return 20
      if (ambiguity.field === 'symbol') return 21
      if (ambiguity.field === 'marketType') return 22
      if (ambiguity.field === 'timeframe') return 23
      return 24
    }
    if (ambiguity.kind === 'atomic_semantic_fork') return 10
    return 99
  }

  private renderAmbiguityQuestion(ambiguity: StrategyAmbiguity): string {
    if (ambiguity.kind === 'open_semantic_slot' || ambiguity.kind === 'semantic_conflict') {
      return ambiguity.question ?? ambiguity.message
    }

    if (ambiguity.kind === 'execution_context_missing') {
      if (ambiguity.field === 'exchange') {
        return '请确认交易所（binance / okx / hyperliquid）。'
      }
      if (ambiguity.field === 'symbol') {
        return '请确认策略交易标的（例如 BTCUSDT）。'
      }
      if (ambiguity.field === 'marketType') {
        return '请确认市场类型（现货或合约/perp）。'
      }
      if (ambiguity.field === 'timeframe') {
        return '请确认策略主周期（例如 15m 或 1h）。'
      }
    }

    if (ambiguity.field === 'trigger.confirmation') {
      const labels = ambiguity.choices?.map((choice) => {
        if (choice === 'touch') return '触碰即触发'
        if (choice === 'close_confirm') return '收盘确认后触发'
        return choice
      }) ?? []

      return labels.length > 0
        ? `请确认采用哪种触发方式：${labels.join('，还是')}？`
        : '该布林带条件是触碰即触发，还是收盘确认后触发？'
    }

    return ambiguity.message
  }

  private readAmbiguityMessage(ambiguity: StrategyAmbiguity): string {
    if (ambiguity.kind === 'open_semantic_slot') {
      return '核心信号未闭合'
    }
    if (ambiguity.kind === 'semantic_conflict') {
      return '核心语义存在冲突'
    }
    if (ambiguity.kind === 'execution_context_missing') {
      if (ambiguity.field === 'exchange') return '缺少唯一交易所'
      if (ambiguity.field === 'symbol') return '缺少唯一交易标的'
      if (ambiguity.field === 'marketType') return '缺少唯一市场类型'
      if (ambiguity.field === 'timeframe') return '缺少唯一主周期'
    }

    return ambiguity.message
  }
}

function readClarificationItemPriority(item: PendingClarificationTargetCandidate): number {
  const key = typeof item.key === 'string' ? item.key : ''
  if (key.startsWith('semantic.')) {
    if (key.includes('confirmationMode')) return 2
    if (key.includes('reference.period')) return 2
    if (key.includes('risk.')) return 4
    return 3
  }
  if (key.startsWith('executionContext.')) {
    return 6
  }
  if (key.startsWith('grid.')) {
    return 5
  }

  return typeof item.reason === 'string' ? REASON_PRIORITY[item.reason] ?? 99 : 99
}
