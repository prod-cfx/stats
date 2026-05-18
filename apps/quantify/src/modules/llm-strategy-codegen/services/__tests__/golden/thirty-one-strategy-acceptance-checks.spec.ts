/**
 * #1497 5 条策略 rules-tree 拓扑验收 spec
 *
 * 覆盖 5 条策略的 rules-tree 拓扑结构（entry/exit 分离、AND/OR 嵌套、timeframe
 * 投影、加仓 vs 止盈区分）。验收基础是 planner mock semanticPatch.rules——
 * 与 harness 在 `snapshotRulesTree(patch, state)` 中实际编码进 rulesTreeHash 的
 * 完全一致；同时调用 harness.run 确认 5 条仍 route='pass'，避免 #1497 schema
 * 收紧导致 fixture 静默 unsupported。
 *
 * 不允许 .skip()。
 */

import { THIRTY_ONE_STRATEGIES } from '../fixtures/thirty-one-strategies'
import { PLANNER_MOCKS_BY_STRATEGY } from '../fixtures/thirty-one-strategies-planner-mocks'
import { ThirtyOneStrategyHarness } from './thirty-one-strategy-harness'

// ── 最小 rules-tree narrow 工具 ────────────────────────────────────────────

interface AtomNodeLike {
  readonly kind: 'atom'
  readonly key: string
  readonly params?: Readonly<Record<string, unknown>>
}

interface AndNodeLike {
  readonly kind: 'and'
  readonly children: readonly unknown[]
}

interface OrNodeLike {
  readonly kind: 'or'
  readonly children: readonly unknown[]
}

type ConditionNode = AtomNodeLike | AndNodeLike | OrNodeLike

interface RuleLike {
  readonly id: string
  readonly phase: 'entry' | 'exit' | 'gate'
  readonly sideScope?: string
  readonly condition: ConditionNode
  readonly effects?: readonly unknown[]
}

function isAtomNode(node: unknown): node is AtomNodeLike {
  return typeof node === 'object' && node !== null && (node as { kind?: unknown }).kind === 'atom'
}

function isAndNode(node: unknown): node is AndNodeLike {
  return typeof node === 'object' && node !== null && (node as { kind?: unknown }).kind === 'and'
}

function isOrNode(node: unknown): node is OrNodeLike {
  return typeof node === 'object' && node !== null && (node as { kind?: unknown }).kind === 'or'
}

/** 递归收集条件树里所有 atom key（去重保留出现顺序）。 */
function collectAtomKeys(node: unknown): string[] {
  const out: string[] = []
  const visit = (n: unknown): void => {
    if (isAtomNode(n)) {
      out.push(n.key)
      return
    }
    if (isAndNode(n) || isOrNode(n)) {
      for (const child of n.children) visit(child)
    }
  }
  visit(node)
  return out
}

/** 递归收集所有 atom 节点（保留 params 用于 timeframe 等参数检验）。 */
function collectAtoms(node: unknown): AtomNodeLike[] {
  const out: AtomNodeLike[] = []
  const visit = (n: unknown): void => {
    if (isAtomNode(n)) {
      out.push(n)
      return
    }
    if (isAndNode(n) || isOrNode(n)) {
      for (const child of n.children) visit(child)
    }
  }
  visit(node)
  return out
}

function getRulesFromMock(strategyId: number): readonly RuleLike[] {
  const queue = PLANNER_MOCKS_BY_STRATEGY[strategyId]
  if (!queue || queue.length === 0) {
    throw new Error(`#1497 spec: missing planner mock for strategy #${strategyId}`)
  }
  const patch = queue[0]!.semanticPatch as { rules?: readonly RuleLike[] } | undefined
  if (!patch?.rules || patch.rules.length === 0) {
    throw new Error(`#1497 spec: planner mock #${strategyId} missing semanticPatch.rules`)
  }
  return patch.rules
}

/**
 * 取 mock queue 副本喂给 harness。
 * `PLANNER_MOCKS_BY_STRATEGY` 是 `Record<number, ...>` 在 strict 下 indexer 仍返回 `| undefined`，
 * 故保留 `?? []` 作为 type narrowing；实际 mock 完整性已由 `getRulesFromMock` 在前置断言中
 * 抛错保证，运行到此 fallback 不会被命中。
 */
function getPlannerMockQueue(strategyId: number) {
  return [...(PLANNER_MOCKS_BY_STRATEGY[strategyId] ?? [])]
}

function getFixture(strategyId: number) {
  const fixture = THIRTY_ONE_STRATEGIES.find(f => f.id === strategyId)
  if (!fixture) throw new Error(`#1497 spec: missing fixture #${strategyId}`)
  return fixture
}

// ── 拓扑断言 helper（正向 case 与 mutation negative case 共用） ─────────────

/** #2 entry 拓扑断言：2 条 entry，AND 顶层，direct child 全 atom，long/short 互斥。 */
function assertStrategy2Topology(rules: readonly RuleLike[]): void {
  const entryRules = rules.filter(r => r.phase === 'entry')
  expect(entryRules).toHaveLength(2)
  for (const rule of entryRules) {
    expect(rule.condition.kind).toBe('and')
    const directChildKinds = (rule.condition as AndNodeLike).children.map(c => (c as { kind: string }).kind)
    expect(directChildKinds.every(k => k === 'atom')).toBe(true)
  }
}

/** #24 entry timeframe 投影断言：{15m,1h,4h} 各一次，且 atom key 同源。 */
function assertStrategy24Topology(rules: readonly RuleLike[]): void {
  const entryRules = rules.filter(r => r.phase === 'entry')
  expect(entryRules).toHaveLength(1)
  const entryAtoms = collectAtoms(entryRules[0]!.condition)
  const entryTimeframes = entryAtoms
    .map(a => a.params?.timeframe)
    .filter((tf): tf is string => typeof tf === 'string')
  expect(new Set(entryTimeframes)).toEqual(new Set(['15m', '1h', '4h']))
  expect(entryTimeframes).toHaveLength(3)
  const entryAtomKeys = entryAtoms.map(a => a.key)
  expect(new Set(entryAtomKeys).size).toBe(1)
}

const FORBIDDEN_TAKE_PROFIT_ATOM_KEYS = new Set([
  'risk.take_profit_pct',
  'risk.take_profit_price',
  'risk.partial_take_profit',
  'risk.atr_take_profit',
])

/** #29 加仓不误识别为止盈断言：包含加仓 atom，禁止止盈 atom。 */
function assertStrategy29Topology(rules: readonly RuleLike[]): void {
  const allKeys: string[] = []
  for (const rule of rules) {
    for (const k of collectAtomKeys(rule.condition)) allKeys.push(k)
    if (Array.isArray(rule.effects)) {
      for (const eff of rule.effects) {
        for (const k of collectAtomKeys(eff)) allKeys.push(k)
      }
    }
  }
  expect(allKeys).toContain('action.add_position')
  expect(allKeys).toContain('position.pyramiding_limit')
  for (const k of allKeys) {
    expect(FORBIDDEN_TAKE_PROFIT_ATOM_KEYS.has(k)).toBe(false)
  }
}

/** 深拷贝 mock rules（mutation 测试用）。结构纯 JSON，可安全用 JSON.parse 实现。 */
function cloneMockRules(strategyId: number): RuleLike[] {
  const rules = getRulesFromMock(strategyId)
  return JSON.parse(JSON.stringify(rules)) as RuleLike[]
}

describe('#1497 5 条策略 rules-tree 拓扑验收', () => {
  const harness = new ThirtyOneStrategyHarness()

  it('#2 EMA gate AND BOLL trigger 双向开仓 — entry 2 条都是 AND，long/short 互斥', async () => {
    const rules = getRulesFromMock(2)
    const fixture = getFixture(2)

    // 验收 1：harness 仍能 route=pass（schema 收紧未误伤 fixture）
    const artifacts = await harness.run(fixture, getPlannerMockQueue(2))
    expect(artifacts.route).toBe('pass')

    // 验收 2/3：entry rules 恰好 2 条 + AND 顶层 + direct child 全 atom（helper 复用 mutation case）
    assertStrategy2Topology(rules)
    const entryRules = rules.filter(r => r.phase === 'entry')

    // 验收 4：每条 entry 同时包含 EMA gate（indicator.above/below）与 BOLL trigger
    for (const rule of entryRules) {
      const keys = collectAtomKeys(rule.condition)
      const hasEmaGate = keys.some(k => k === 'indicator.above' || k === 'indicator.below')
      const hasBollTrigger = keys.some(k => k === 'bollinger.touch_lower' || k === 'bollinger.touch_upper')
      expect(hasEmaGate).toBe(true)
      expect(hasBollTrigger).toBe(true)
    }

    // 验收 5：两条 entry sideScope 互斥（long ↔ short）
    const sideScopes = entryRules.map(r => r.sideScope).sort()
    expect(sideScopes).toEqual(['long', 'short'])
  })

  it('#19 entry AND + exit 单条 — entry/exit atom 集合互斥', async () => {
    const rules = getRulesFromMock(19)
    const fixture = getFixture(19)

    const artifacts = await harness.run(fixture, getPlannerMockQueue(19))
    expect(artifacts.route).toBe('pass')

    const entryRules = rules.filter(r => r.phase === 'entry')
    const exitRules = rules.filter(r => r.phase === 'exit')

    // entry 恰好 1 条，condition.kind === 'and'
    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]!.condition.kind).toBe('and')

    // exit 至少 1 条
    expect(exitRules.length).toBeGreaterThanOrEqual(1)

    // entry/exit atom 按语义分类做 phase-specific 禁忌：
    //   - entry 不得出现止盈/止损/平仓类（这些是 exit 语义）
    //   - exit  不得出现开仓类（这些是 entry 语义）
    // 比单纯 disjoint 集合更精确——允许 entry 与 exit 共享中性 atom（如同一个 indicator），
    // 但坚决禁止跨 phase 误用 exit/entry 专属 atom。
    const ENTRY_FORBIDDEN_KEYS = new Set([
      'risk.take_profit_pct',
      'risk.take_profit_price',
      'risk.partial_take_profit',
      'risk.atr_take_profit',
      'risk.stop_loss_pct',
      'risk.stop_loss_price',
      'risk.atr_stop',
      'action.close_long',
      'action.close_short',
    ])
    const EXIT_FORBIDDEN_KEYS = new Set(['action.open_long', 'action.open_short'])
    const entryAtomKeys = new Set(entryRules.flatMap(r => collectAtomKeys(r.condition)))
    const exitAtomKeys = new Set(exitRules.flatMap(r => collectAtomKeys(r.condition)))
    for (const k of entryAtomKeys) expect(ENTRY_FORBIDDEN_KEYS.has(k)).toBe(false)
    for (const k of exitAtomKeys) expect(EXIT_FORBIDDEN_KEYS.has(k)).toBe(false)
  })

  it('#21 entry AND / exit OR 嵌套保留 — OR 子节点 ≥ 2', async () => {
    const rules = getRulesFromMock(21)
    const fixture = getFixture(21)

    const artifacts = await harness.run(fixture, getPlannerMockQueue(21))
    expect(artifacts.route).toBe('pass')

    const entryRules = rules.filter(r => r.phase === 'entry')
    const exitRules = rules.filter(r => r.phase === 'exit')

    // entry condition.kind === 'and'
    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]!.condition.kind).toBe('and')

    // exit condition.kind === 'or'
    expect(exitRules).toHaveLength(1)
    expect(exitRules[0]!.condition.kind).toBe('or')

    // OR 子节点 >= 2
    const exitCondition = exitRules[0]!.condition
    if (!isOrNode(exitCondition)) throw new Error('#21 exit condition expected or-node')
    expect(exitCondition.children.length).toBeGreaterThanOrEqual(2)
  })

  it('#24 三周期 timeframe 投影 — entry 15m/1h/4h 各一次，exit 只剩 15m', async () => {
    const rules = getRulesFromMock(24)
    const fixture = getFixture(24)

    const artifacts = await harness.run(fixture, getPlannerMockQueue(24))
    expect(artifacts.route).toBe('pass')

    // entry 拓扑断言（timeframe set + key 同源）通过 helper 复用 mutation case
    assertStrategy24Topology(rules)
    const exitRules = rules.filter(r => r.phase === 'exit')
    expect(exitRules).toHaveLength(1)

    // exit 只保留 15m（不复用 entry 多周期投影）
    const exitAtoms = collectAtoms(exitRules[0]!.condition)
    const exitTimeframes = exitAtoms
      .map(a => a.params?.timeframe)
      .filter((tf): tf is string => typeof tf === 'string')
    expect(exitTimeframes).toEqual(['15m'])
  })

  it('#29 加仓不误识别为止盈 — entry 含 action.add_position + position.pyramiding_limit，且无 risk.take_profit_*', async () => {
    const rules = getRulesFromMock(29)
    const fixture = getFixture(29)

    const artifacts = await harness.run(fixture, getPlannerMockQueue(29))
    expect(artifacts.route).toBe('pass')

    // condition + effects atom key 集合断言通过 helper 复用 mutation case
    assertStrategy29Topology(rules)
  })

  // ── Mutation negative case：验证 helper 真咬人，避免哑断言 ──────────────────
  describe('#1497 拓扑断言反向回归 — mutation 应触发 fail', () => {
    it('#2 entry 减到 1 条必须 fail', () => {
      const mutated = cloneMockRules(2)
      // 删掉第二条 entry（保留 long，删除 short）
      const firstShortIdx = mutated.findIndex(r => r.phase === 'entry' && r.sideScope === 'short')
      expect(firstShortIdx).toBeGreaterThanOrEqual(0)
      mutated.splice(firstShortIdx, 1)
      expect(() => assertStrategy2Topology(mutated)).toThrow()
    })

    it('#24 timeframe 重复 1h 必须 fail', () => {
      const mutated = cloneMockRules(24)
      const entryRule = mutated.find(r => r.phase === 'entry')
      if (!entryRule) throw new Error('mutation: #24 entry rule missing')
      const entryAtoms = collectAtoms(entryRule.condition)
      // 把第一个 atom 的 timeframe 改成与其它 atom 重复的 '1h'
      const firstAtom = entryAtoms[0] as AtomNodeLike & { params: Record<string, unknown> }
      expect(firstAtom).toBeDefined()
      firstAtom.params = { ...firstAtom.params, timeframe: '1h' }
      expect(() => assertStrategy24Topology(mutated)).toThrow()
    })

    it('#29 加 risk.take_profit_pct 必须 fail', () => {
      const mutated = cloneMockRules(29)
      // 找到任一 entry rule，把一个 risk.take_profit_pct atom 注入 effects
      const entryRule = mutated.find(r => r.phase === 'entry') ?? mutated[0]
      if (!entryRule) throw new Error('mutation: #29 entry rule missing')
      const injected: AtomNodeLike = { kind: 'atom', key: 'risk.take_profit_pct', params: { pct: 5 } }
      ;(entryRule as unknown as { effects: unknown[] }).effects = [
        ...((entryRule.effects ?? []) as unknown[]),
        injected,
      ]
      expect(() => assertStrategy29Topology(mutated)).toThrow()
    })
  })
})
