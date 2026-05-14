// #1162 critic Major #2 修订：直接守 mergeActions/mergeRisk 的 fallback push 真重复 dedup
//   INVARIANT-H 在 corpus spec 用同 utterance reduce 3 次会走 strict identity match 路径，
//   不抓 fallback push 分支；本 spec 用合成 state 直接覆盖 fallback push 的真重复 dedup 逻辑。

import type { SemanticActionState, SemanticRiskState, SemanticState } from '../../types/semantic-state'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

function makeState(overrides: Partial<SemanticState>): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

function makeAction(id: string, params: Record<string, unknown>): SemanticActionState {
  return {
    id,
    key: 'action.add_position',
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    params,
  }
}

function makeRisk(id: string, params: Record<string, unknown>): SemanticRiskState {
  return {
    id,
    key: 'risk.stop_loss_pct',
    params,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

describe('SemanticStateMergeService — fallback push 真重复 dedup (#1162 Task 7)', () => {
  const merge = new SemanticStateMergeService()

  it('完全相同 action（params 全等）fallback push 时丢弃 → 不出现 2 份', () => {
    // 构造 identity-incompatible 但 stableParamsHash 等价的两个 action（强制走 fallback push）
    const persistedAction = makeAction('a1', { addMode: 'profit_pct', addRatio: 0.2, profitThreshold: 2 })
    const derivedAction = makeAction('a2', { addMode: 'profit_pct', addRatio: 0.2, profitThreshold: 2 })
    // 关键：让 derived 已含 persisted 同 key 的 action（但 id 不同 → identity miss）
    // 触发 fallback push 路径
    const persisted = makeState({ action: [persistedAction] })
    const derived = makeState({ action: [derivedAction] })
    const merged = merge.merge({ persisted, derived })
    // 真重复（stableParamsHash 完全相等）应被丢弃 → 仅 1 份保留
    const addPositionActions = merged.action.filter(a => a.key === 'action.add_position')
    expect(addPositionActions.length).toBeLessThanOrEqual(1)
  })

  it('同 key 多档（params 不同）fallback push 时保留 → 出现 N 份（合法多档）', () => {
    // 模拟 add-position.example.ts 三档 0.5/0.3/0.2 场景
    // derived 已含 0.5 档；persisted 含 0.3 档（同 key 但 stableParamsHash 不同）
    const persisted = makeState({ action: [makeAction('a-tier-2', { addRatio: 0.3 })] })
    const derived = makeState({ action: [makeAction('a-tier-1', { addRatio: 0.5 })] })
    const merged = merge.merge({ persisted, derived })
    const addPositionActions = merged.action.filter(a => a.key === 'action.add_position')
    const ratios = new Set(addPositionActions.map(a => a.params?.addRatio))
    // 两档不同 ratio 应都保留
    expect(ratios.has(0.5)).toBe(true)
    expect(ratios.has(0.3)).toBe(true)
    expect(addPositionActions.length).toBeGreaterThanOrEqual(2)
  })

  it('risk 真重复 fallback push 同样守门', () => {
    const persistedRisk = makeRisk('r1', { valuePct: 2 })
    const derivedRisk = makeRisk('r2', { valuePct: 2 })
    const persisted = makeState({ risk: [persistedRisk] })
    const derived = makeState({ risk: [derivedRisk] })
    const merged = merge.merge({ persisted, derived })
    const stopLossRisks = merged.risk.filter(r => r.key === 'risk.stop_loss_pct')
    expect(stopLossRisks.length).toBeLessThanOrEqual(1)
  })

  it('stableParamsHash 递归稳定：嵌套对象 key 顺序不影响判定（critic Major #1）', () => {
    // persisted 嵌套对象 key 顺序与 derived 不同（{a, b} vs {b, a}），应判等价 → 真重复 → 丢弃一份
    const persisted = makeState({
      action: [makeAction('a1', { addMode: 'profit_pct', sizing: { kind: 'ratio', value: 0.2, unit: 'ratio' } })],
    })
    const derived = makeState({
      action: [makeAction('a2', { sizing: { unit: 'ratio', value: 0.2, kind: 'ratio' }, addMode: 'profit_pct' })],
    })
    const merged = merge.merge({ persisted, derived })
    const addPositionActions = merged.action.filter(a => a.key === 'action.add_position')
    expect(addPositionActions.length).toBeLessThanOrEqual(1)
  })
})
