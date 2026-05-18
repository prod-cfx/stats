/**
 * Issue #1493 块 F — pipeline 整体 invariant integration
 *
 * 锁定跨 service 闭环：rules 始终是真源，flat 五桶始终 ≡ projectToFlat(rules)。
 *
 * 涉及阶段：
 *   1) 初始 build —— state.rules 非空时，reprojectFromRules 必须把 flat 五桶填回成
 *      projectToFlat(rules) 的输出。
 *   2) reducer-style slot-fill —— 模拟「往 rule 条件的 atom.params 写入阈值」的不可
 *      变重建，再 reproject，flat 应同步更新。
 *   3) edit-style 替换 —— 模拟「替换 rule.condition 的常量阈值」的不可变重建，再
 *      reproject，flat 应反映新值。
 *   4) readiness —— evaluateRulesReadiness 必须只读 rules，与 flat 无关；即使
 *      flat 被故意置空，readiness 结论也应不变。
 *
 * 这条闭环是 #1493 的核心契约：任何下游误把 flat 当真源、或忘记 reproject 的
 * 路径都会在这里挂掉。
 */
import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

describe('SemanticState pipeline integration — flat ≡ projectToFlat(rules)（Issue #1493 块 F）', () => {
  // 直接实例化：两个 service 构造器都有默认参数，避开 Nest DI 链路（readiness 间接依赖
  // 较多 helper service，但都是 `new XxxService()` 默认 fallback，可零参实例化）。
  const projection = new SemanticRuleProjectionService()
  const readiness = new SemanticContractReadinessService()

  function makeBaseState(rules: SemanticRule[]): SemanticState {
    return {
      version: 1,
      families: [],
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      position: null,
      orchestrationContracts: [],
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00Z',
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
      rules,
    } as SemanticState
  }

  /** 校验 invariant：state.{trigger,action,risk,positionConstraint,orchestration} ≡ projectToFlat(state.rules) */
  function assertFlatMatchesRules(state: SemanticState): void {
    const expected = projection.projectToFlat(state.rules ?? [])
    expect(state.trigger).toEqual(expected.trigger)
    expect(state.action).toEqual(expected.action)
    expect(state.risk).toEqual(expected.risk)
    expect(state.positionConstraint).toEqual(expected.positionConstraint)
    expect(state.orchestration).toEqual(expected.orchestration)
  }

  /** 构造 entry：RSI < threshold → open_long；exit：RSI > 70 → close_long；risk：stop_loss_pct */
  function makeRsiRules(entryThreshold: number): SemanticRule[] {
    const entryRule: SemanticRule = {
      id: 'rule-entry-rsi',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'oscillator.rsi_lte',
        params: { period: 14, threshold: entryThreshold },
      } as AtomExpr,
      effects: [
        { kind: 'atom', key: 'action.open_long', params: {} } as AtomExpr,
      ],
    }
    const exitRule: SemanticRule = {
      id: 'rule-exit-rsi',
      phase: 'exit',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'oscillator.rsi_gte',
        params: { period: 14, threshold: 70 },
      } as AtomExpr,
      effects: [
        { kind: 'atom', key: 'action.close_long', params: {} } as AtomExpr,
        { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5 } } as AtomExpr,
      ],
    }
    return [entryRule, exitRule]
  }

  it('阶段 1：初始 build 后 reprojectFromRules 把 flat 五桶填成 projectToFlat(rules) 输出', () => {
    const rules = makeRsiRules(30)
    const initial = makeBaseState(rules)
    // initial 的 flat 是空的 —— 跑 reproject 后必须 ≡ projectToFlat(rules)
    const after = projection.reprojectFromRules(initial)

    assertFlatMatchesRules(after)
    expect(after.trigger.length).toBeGreaterThan(0)
    expect(after.action.length).toBeGreaterThan(0)
    expect(after.risk.length).toBeGreaterThan(0)
  })

  it('阶段 2：reducer-style slot-fill（不可变重建 rule.condition.params）后 reproject，flat 同步更新', () => {
    const baseRules = makeRsiRules(30)
    const baseState = projection.reprojectFromRules(makeBaseState(baseRules))
    const beforeTriggerThresholds = baseState.trigger.map(t => t.params?.threshold)
    expect(beforeTriggerThresholds).toContain(30)

    // 模拟 reducer 把 entry rule 的 threshold 从 30 变成 25（不可变重建）
    const mutatedRules: SemanticRule[] = baseState.rules!.map((rule) => {
      if (rule.id !== 'rule-entry-rsi') return rule
      const cond = rule.condition
      if (cond.kind !== 'atom') return rule
      return {
        ...rule,
        condition: { ...cond, params: { ...cond.params, threshold: 25 } } as AtomExpr,
      }
    })
    const mutated = projection.reprojectFromRules({ ...baseState, rules: mutatedRules })

    // 必须读取自 rules 的新值
    assertFlatMatchesRules(mutated)
    const entryTrigger = mutated.trigger.find(t => t.key === 'oscillator.rsi_lte')
    expect(entryTrigger?.params?.threshold).toBe(25)
    // 旧值不残留
    expect(mutated.trigger.find(t => t.params?.threshold === 30)).toBeUndefined()
  })

  it('阶段 3：edit-style 替换 rule（不可变重建整个 rule）后 reproject，flat 完全反映新树', () => {
    const baseRules = makeRsiRules(30)
    const baseState = projection.reprojectFromRules(makeBaseState(baseRules))

    // 模拟 edit 把 exit 规则的 close_long 替换为 close_short（极端形状变化）
    const editedRules: SemanticRule[] = baseState.rules!.map((rule) => {
      if (rule.id !== 'rule-exit-rsi') return rule
      return {
        ...rule,
        sideScope: 'short',
        effects: [
          { kind: 'atom', key: 'action.close_short', params: {} } as AtomExpr,
          ...rule.effects.slice(1),
        ],
      }
    })
    const edited = projection.reprojectFromRules({ ...baseState, rules: editedRules })

    assertFlatMatchesRules(edited)
    const closeAction = edited.action.find(a => a.key === 'action.close_short')
    expect(closeAction).toBeDefined()
    // 旧 atom 不残留
    expect(edited.action.find(a => a.key === 'action.close_long')).toBeUndefined()
  })

  it('阶段 4：readiness 以 rules 为唯一来源 —— flat 被人为清空也不影响判定', () => {
    const baseRules = makeRsiRules(30)
    const baseState = projection.reprojectFromRules(makeBaseState(baseRules))
    const truthSummary = readiness.evaluateRulesReadiness(baseState.rules)

    // 故意构造一个「flat 全空、rules 仍在」的脏 state
    const dirtyState: SemanticState = {
      ...baseState,
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }
    const dirtySummary = readiness.evaluateRulesReadiness(dirtyState.rules)

    expect(dirtySummary).toEqual(truthSummary)
    expect(dirtySummary.hasEntry).toBe(true)
    expect(dirtySummary.hasExit).toBe(true)
    expect(dirtySummary.hasRisk).toBe(true)
    expect(dirtySummary.missing).toEqual([])
  })

  it('阶段 4 端到端 normalize()：脏 state 经 readiness.normalize 修复 flat ≡ projectToFlat(rules)（Issue #1493 m1）', () => {
    // 构造一个 rules 非空 + flat 全空的脏 state（模拟下游忘记 reproject）
    const baseRules = makeRsiRules(30)
    const baseState = projection.reprojectFromRules(makeBaseState(baseRules))
    const dirtyState: SemanticState = {
      ...baseState,
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }

    // 端到端走 normalize() —— 入口的 reprojectFromRules 应把 flat 修回
    const { state: normalized } = readiness.normalize(dirtyState)

    // flat 被 reproject 修回非空
    expect(normalized.trigger.length).toBeGreaterThan(0)
    expect(normalized.action.length).toBeGreaterThan(0)
    expect(normalized.risk.length).toBeGreaterThan(0)

    // invariant：flat ≡ projectToFlat(rules)（normalize 内部还会叠加 readiness 派生
    // 的 openSlots / contracts，但派生字段对 atom 集合不应有增删，所以 key/id 集合
    // 与 projectToFlat 输出一致）
    const projected = projection.projectToFlat(normalized.rules ?? [])
    expect(new Set(normalized.trigger.map(t => t.id))).toEqual(new Set(projected.trigger.map(t => t.id)))
    expect(new Set(normalized.action.map(a => a.id))).toEqual(new Set(projected.action.map(a => a.id)))
    expect(new Set(normalized.risk.map(r => r.id))).toEqual(new Set(projected.risk.map(r => r.id)))
  })

  it('端到端链路：build → slot-fill → edit → readiness，每步后 flat ≡ projectToFlat(rules) 不变', () => {
    // build
    let state = projection.reprojectFromRules(makeBaseState(makeRsiRules(30)))
    assertFlatMatchesRules(state)

    // slot-fill：threshold 30 → 25
    state = projection.reprojectFromRules({
      ...state,
      rules: state.rules!.map((rule) => {
        if (rule.id !== 'rule-entry-rsi' || rule.condition.kind !== 'atom') return rule
        return {
          ...rule,
          condition: { ...rule.condition, params: { ...rule.condition.params, threshold: 25 } } as AtomExpr,
        }
      }),
    })
    assertFlatMatchesRules(state)

    // edit：换 risk 阈值
    state = projection.reprojectFromRules({
      ...state,
      rules: state.rules!.map((rule) => {
        if (rule.id !== 'rule-exit-rsi') return rule
        const [closeEff, ...rest] = rule.effects
        const newRest = rest.map((eff) => {
          if (eff.kind !== 'atom' || eff.key !== 'risk.stop_loss_pct') return eff
          return { ...eff, params: { ...eff.params, valuePct: 8 } } as AtomExpr
        })
        return { ...rule, effects: [closeEff, ...newRest] }
      }),
    })
    assertFlatMatchesRules(state)

    const stopLoss = state.risk.find(r => r.key === 'risk.stop_loss_pct')
    expect(stopLoss?.params?.valuePct).toBe(8)

    // readiness：rules-first
    const summary = readiness.evaluateRulesReadiness(state.rules)
    expect(summary.hasEntry).toBe(true)
    expect(summary.hasExit).toBe(true)
    expect(summary.hasRisk).toBe(true)
  })
})
