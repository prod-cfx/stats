import type { StrategyClarificationState } from '../strategy-clarification-rules.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'

describe('StrategyClarificationRulesService', () => {
  const service = new StrategyClarificationRulesService()

  it('detects exitBasis ambiguity for price-change sell rule without explicit baseline', () => {
    const state = service.buildState({
      strategyType: 'price_change_pct',
      exitRules: ['上涨 2% 卖出平仓'],
    })

    expect(state.strategyType).toBe('price_change_pct')
    expect(state.lastAskedItemId).toBeNull()
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({
      id: 'price_change_pct:exitBasis',
      kind: 'semantic_ambiguity',
      strategyType: 'price_change_pct',
      field: 'exitBasis',
      status: 'pending',
    })
  })

  it('skips exitBasis ambiguity when baseline is explicit in sell rule', () => {
    const state = service.buildState({
      strategyType: 'price_change_pct',
      exitRules: ['当前K线收盘价相对于开仓均价上涨 2% 卖出平仓'],
    })

    expect(state.items).toEqual([])
  })

  it('detects gridSpacingMode ambiguity for percentage-spaced grid split', () => {
    const state = service.buildState({
      strategyType: 'grid',
      entryRules: ['按 1% 等距划分网格并执行买入'],
    })

    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({
      id: 'grid:gridSpacingMode',
      kind: 'semantic_ambiguity',
      strategyType: 'grid',
      field: 'gridSpacingMode',
      status: 'pending',
    })
  })

  it('detects outsideBandAction ambiguity for bollinger risk rule with stop-loss or reduce-position', () => {
    const state = service.buildState({
      strategyType: 'bollinger',
      riskRules: {
        note: '价格在布林带外连续运行时提前止损或减仓',
      },
    })

    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({
      id: 'bollinger:outsideBandAction',
      kind: 'semantic_ambiguity',
      strategyType: 'bollinger',
      field: 'outsideBandAction',
      status: 'pending',
    })
  })

  it('picks next pending item by priority and then id for stable ordering', () => {
    const state: StrategyClarificationState = {
      strategyType: 'grid',
      lastAskedItemId: null,
      items: [
        {
          id: 'grid:b',
          kind: 'semantic_ambiguity',
          strategyType: 'grid',
          field: 'b',
          reason: 'r2',
          question: 'q2',
          priority: 20,
          status: 'pending',
        },
        {
          id: 'grid:a',
          kind: 'semantic_ambiguity',
          strategyType: 'grid',
          field: 'a',
          reason: 'r1',
          question: 'q1',
          priority: 20,
          status: 'pending',
        },
      ],
    }

    const item = service.pickNextPendingItem(state)

    expect(item?.id).toBe('grid:a')
  })
})
