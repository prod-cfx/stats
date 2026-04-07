import type { StrategyClarificationItem, StrategyClarificationState, StrategyClarificationStrategyType } from '../types/strategy-clarification'

export type { StrategyClarificationState } from '../types/strategy-clarification'

interface ClarificationChecklistPayload {
  strategyType?: StrategyClarificationStrategyType | null
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
}

const PRIORITY = {
  direction: 100,
  triggerSemantics: 80,
  riskAction: 60,
  numericParam: 40,
} as const

export class StrategyClarificationRulesService {
  evaluate(checklist: ClarificationChecklistPayload): StrategyClarificationState {
    const state = this.buildState(checklist)
    const nextItem = this.pickNextPendingItem(state)

    return {
      ...state,
      lastAskedItemId: nextItem?.id ?? null,
    }
  }

  buildState(checklist: ClarificationChecklistPayload): StrategyClarificationState {
    const strategyType = this.resolveStrategyType(checklist)
    const items = this.buildItems(strategyType, checklist)
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))

    return {
      strategyType,
      items,
      lastAskedItemId: null,
    }
  }

  pickNextPendingItem(state: StrategyClarificationState): StrategyClarificationItem | null {
    return state.items
      .filter(item => item.status === 'pending')
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0] ?? null
  }

  private buildItems(
    strategyType: StrategyClarificationStrategyType | null,
    checklist: ClarificationChecklistPayload,
  ): StrategyClarificationItem[] {
    const items: StrategyClarificationItem[] = []

    if (!strategyType) {
      return items
    }

    if (strategyType === 'price_change_pct') {
      const exitRules = checklist.exitRules ?? []
      const hasExplicitExitBasis = exitRules.some(rule => /开仓均价|持仓收益|浮盈|浮亏|上一根|上一条|前一根|前一条/u.test(rule))
      const hasPctExitRule = exitRules.some(rule => /(?:涨|上涨|跌|下跌).{0,12}\d+(?:\.\d+)?\s*%/u.test(rule))
      if (hasPctExitRule && !hasExplicitExitBasis) {
        items.push({
          id: 'price_change_pct:exitBasis',
          kind: 'semantic_ambiguity',
          strategyType,
          field: 'exitBasis',
          reason: '当前出场条件存在两种可编译解释',
          question: '这里的上涨1%，是相对上一根3分钟K线，还是相对开仓均价？',
          priority: PRIORITY.triggerSemantics,
          status: 'pending',
        })
      }
    }

    if (strategyType === 'grid') {
      const text = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
      const mentionsEqualGrid = /网格/u.test(text) && /1\s*%\s*等距|按\s*1\s*%\s*等距/u.test(text)
      const hasExplicitSpacingMode = /固定价差|固定步长|百分比递增|复利网格/u.test(text)
      if (mentionsEqualGrid && !hasExplicitSpacingMode) {
        items.push({
          id: 'grid:gridSpacingMode',
          kind: 'semantic_ambiguity',
          strategyType,
          field: 'gridSpacingMode',
          reason: '当前网格间距仍有两种可编译解释',
          question: '这里的1%等距网格，是固定价差，还是按百分比递增的复利网格？',
          priority: PRIORITY.triggerSemantics,
          status: 'pending',
        })
      }
    }

    if (strategyType === 'bollinger') {
      const text = [
        ...(checklist.entryRules ?? []),
        ...(checklist.exitRules ?? []),
        ...Object.values(checklist.riskRules ?? {}).filter((value): value is string => typeof value === 'string'),
      ].join(' ')
      if ((/布林|boll/i.test(text) || strategyType === 'bollinger') && /提前止损或减仓|止损或减仓/u.test(text)) {
        items.push({
          id: 'bollinger:outsideBandAction',
          kind: 'semantic_ambiguity',
          strategyType,
          field: 'outsideBandAction',
          reason: '当前轨外风控动作还不够明确',
          question: '价格连续3根K线在布林带外时，你希望提前全平，还是只减仓？',
          priority: PRIORITY.riskAction,
          status: 'pending',
        })
      }
    }

    return items
  }

  private resolveStrategyType(checklist: ClarificationChecklistPayload): StrategyClarificationStrategyType | null {
    if (checklist.strategyType) {
      return checklist.strategyType
    }

    const text = [
      ...(checklist.entryRules ?? []),
      ...(checklist.exitRules ?? []),
      ...Object.values(checklist.riskRules ?? {}).filter((value): value is string => typeof value === 'string'),
    ].join(' ')
    if (!text.trim()) {
      return null
    }

    if (/布林|boll/i.test(text)) {
      return 'bollinger'
    }
    if (/网格/u.test(text)) {
      return 'grid'
    }
    if (/(?:涨|上涨|跌|下跌).{0,12}\d+(?:\.\d+)?\s*%/u.test(text)) {
      return 'price_change_pct'
    }

    return 'custom'
  }
}
