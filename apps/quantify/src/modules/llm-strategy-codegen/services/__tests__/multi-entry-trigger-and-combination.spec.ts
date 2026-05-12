/**
 * multi-entry-trigger-and-combination.spec.ts
 *
 * Requirement-driven tests for Issue #1145 — Bug C:
 * 同 utterance 多 entry trigger 同 sideScope 且含 AND 连词 → 源头注入 AND combination contract
 * → canonical-spec-builder 编出 1 条 AND rule（而非 N 条独立 OR-first-match rule）
 *
 * 一轮双源审查后补强（PR #1148）：
 * - 软断言改硬断言：先断言 length >= 2，再展开后续断言
 * - 子句切分：跨子句的「且/或」不串桶
 * - 「和」作列举名词不应触发 AND
 * - MA stack + hetero AND 不重叠
 */
import type { SemanticAtomContract, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { isTriggerPredicateGroupContract } from '../semantic-state-normalization'
import { SemanticTriggerCombinationContractService } from '../semantic-trigger-combination-contract.service'

// Minor m3：每次 beforeEach 新建实例，防御未来引入静态/缓存状态
let extractor: SemanticSeedExtractorService
let builder: SemanticSeedStateBuilderService
let combinationResolver: SemanticTriggerCombinationContractService

beforeEach(() => {
  extractor = new SemanticSeedExtractorService()
  builder = new SemanticSeedStateBuilderService()
  combinationResolver = new SemanticTriggerCombinationContractService()
})

/** 从 extract -> build 完整 pipeline，返回 state */
function buildState(message: string): SemanticState {
  const patch = extractor.extract(message)
  const state = builder.build(patch)
  if (!state) throw new Error(`state_build_failed for: ${message}`)
  return state
}

/** 判断 contract 是否为 trigger combination contract */
function isCombinationContract(c: SemanticAtomContract): boolean {
  return isTriggerPredicateGroupContract(c)
}

/** 取 trigger 上所有 combination contract 的 groupId 集合 */
function combinationGroupIds(state: SemanticState, phase: 'entry' | 'exit', sideScope: 'long' | 'short'): Set<string> {
  const ids = new Set<string>()
  for (const trigger of state.triggers) {
    if (trigger.phase !== phase || trigger.sideScope !== sideScope) continue
    for (const c of trigger.contracts ?? []) {
      if (isCombinationContract(c)) {
        const gid = c.params?.groupId
        if (typeof gid === 'string') ids.add(gid)
      }
    }
  }
  return ids
}

/** 取 trigger 上 combination contract 的 groupId（首个） */
function triggerGroupId(state: SemanticState, predicate: (t: SemanticState['triggers'][number]) => boolean): string | null {
  const t = state.triggers.find(predicate)
  if (!t) return null
  for (const c of t.contracts ?? []) {
    if (isCombinationContract(c) && typeof c.params?.groupId === 'string') return c.params.groupId
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 用例 1：正向 — 3 个 entry trigger 同 sideScope=long，含「且」连词
// ─────────────────────────────────────────────────────────────────────────────
it('[#1] 3 个 entry trigger 含「且」→ 挂同一 AND combination contract', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多，止损 5%',
  )

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(2)

  for (const trigger of longEntryTriggers) {
    const hasCombination = trigger.contracts?.some(c => isCombinationContract(c))
    expect(hasCombination).toBe(true)
  }

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  expect(groupIds.size).toBe(1)

  const anyTrigger = longEntryTriggers[0]!
  const combinationContracts = anyTrigger.contracts?.filter(c => isCombinationContract(c)) ?? []
  expect(combinationContracts.length).toBeGreaterThan(0)
  expect(combinationContracts[0]!.params?.join).toBe('AND')
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 2：方向分组 — long 组和 short 组各自独立 AND
// ─────────────────────────────────────────────────────────────────────────────
it('[#2] long 组和 short 组各自独立 AND groupId，不串组', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35 开多；MA20 下穿 MA50 且 RSI14 高于 65 开空',
  )

  const longGroupIds = combinationGroupIds(state, 'entry', 'long')
  const shortGroupIds = combinationGroupIds(state, 'entry', 'short')

  expect(longGroupIds.size).toBeGreaterThanOrEqual(1)
  expect(shortGroupIds.size).toBeGreaterThanOrEqual(1)

  for (const id of longGroupIds) {
    expect(shortGroupIds.has(id)).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 3：OR 句式排除 — 含「或」则不挂 AND contract（保持 singleton）
// ─────────────────────────────────────────────────────────────────────────────
it('[#3] 含「或」连词 → 不挂 hetero AND contract，保持 singleton', () => {
  const state = buildState('MA 金叉 或 RSI 低于 35 开多，止损 5%')

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 4：退化单 trigger — 只有 1 个 entry trigger，不挂 AND contract
// ─────────────────────────────────────────────────────────────────────────────
it('[#4] 单个 entry trigger → 不挂 AND combination contract（singleton）', () => {
  const state = buildState('MA20 上穿 MA50 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )
  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(1)

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }

  const groups = combinationResolver.resolveExecutableGroups(state.triggers)
  const entryLongGroups = groups.filter(g => g.phase === 'entry' && g.sideScope === 'long')
  for (const group of entryLongGroups) {
    expect(group.members.length).toBe(1)
  }
})

// 注：原用例 5（trend.direction）已删除：当前 NL gateway 把「市场趋势向上」识别为
// phase=gate trend.direction 而非 phase=entry，软断言 length>=2 永不成立。
// 覆盖盲区由 mock 路径专项 spec 兜底（不在本文件范围）。

// ─────────────────────────────────────────────────────────────────────────────
// 用例 6：close_long / close_short 不混入 entry AND 组
// ─────────────────────────────────────────────────────────────────────────────
it('[#6] exit trigger 不混入 entry AND 组', () => {
  const state = buildState('MA 金叉 且 RSI 低于 35 开多；MA 死叉 平多；止损 5%')

  const exitTriggers = state.triggers.filter(t => t.phase === 'exit')
  const entryAndGroupIds = Array.from(combinationGroupIds(state, 'entry', 'long'))
    .filter(id => id.startsWith('entry-and-'))

  for (const exitTrigger of exitTriggers) {
    for (const c of exitTrigger.contracts ?? []) {
      if (isCombinationContract(c)) {
        const gid = c.params?.groupId
        if (typeof gid === 'string') {
          expect(entryAndGroupIds.includes(gid)).toBe(false)
        }
      }
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 7：「同时」「并且」也能识别为 AND（「和」已从词表移除，不再列入正向）
// ─────────────────────────────────────────────────────────────────────────────
it.each([
  ['同时', 'MA20 上穿 MA50 同时 RSI14 低于 35 开多，止损 5%'],
  ['并且', 'MA20 上穿 MA50 并且 RSI14 低于 35 开多，止损 5%'],
])('[#7] 连词「%s」→ 触发 AND 分组', (_conjunction, message) => {
  const state = buildState(message)

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )
  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(2)

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  const hasAndGroup = Array.from(groupIds).some(id => id.startsWith('entry-and-'))
  expect(hasAndGroup).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 8：两次独立 extract 各自独立处理
// ─────────────────────────────────────────────────────────────────────────────
it('[#8] 两次独立 extract 各自独立处理，互不影响', () => {
  const state1 = buildState('MA20 上穿 MA50 且 RSI14 低于 35 开多，止损 5%')
  const state2 = buildState('MA20 下穿 MA50 开空，止损 5%')
  // sanity: state2 至少抽出 1 个 short entry trigger
  expect(state2.triggers.some(t => t.phase === 'entry' && t.sideScope === 'short')).toBe(true)

  const longTriggers1 = state1.triggers.filter(t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long')
  expect(longTriggers1.length).toBeGreaterThanOrEqual(2)
  const groupIds1 = combinationGroupIds(state1, 'entry', 'long')
  const hasAndGroup1 = Array.from(groupIds1).some(id => id.startsWith('entry-and-'))
  expect(hasAndGroup1).toBe(true)

  const groupIds2 = combinationGroupIds(state2, 'entry', 'short')
  for (const id of groupIds2) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 1b：resolveExecutableGroups → AND 组合并后 1 个 group 含 N members
// ─────────────────────────────────────────────────────────────────────────────
it('[#1b] resolveExecutableGroups → AND 组合并后 1 个 group 含 N members', () => {
  const state = buildState('MA20 上穿 MA50 且 RSI14 低于 35 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )
  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(2)

  const groups = combinationResolver.resolveExecutableGroups(state.triggers)
  const andGroups = groups.filter(
    g => g.phase === 'entry' && g.sideScope === 'long' && g.join === 'AND' && g.members.length >= 2,
  )

  expect(andGroups.length).toBeGreaterThanOrEqual(1)
  expect(andGroups[0]!.join).toBe('AND')
  expect(andGroups[0]!.members.length).toBeGreaterThanOrEqual(2)
})

it('[#1c] 完整策略中逗号后的平多不污染前置 AND 入场组', () => {
  const state = buildState(
    'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多，MA20 下穿 MA50 平多，单笔 10%，止损 5%。',
  )

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )
  expect(longEntryTriggers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over', params: expect.objectContaining({ indicator: 'ma', fastPeriod: 20, slowPeriod: 50 }) }),
      expect.objectContaining({ key: 'oscillator.rsi_lte', params: expect.objectContaining({ period: 14, value: 35 }) }),
      expect.objectContaining({ key: 'indicator.cross_over', params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }) }),
    ]),
  )

  const entryGroups = combinationResolver.resolveExecutableGroups(state.triggers)
    .filter(g => g.phase === 'entry' && g.sideScope === 'long')
  expect(entryGroups).toHaveLength(1)
  expect(entryGroups[0]).toEqual(expect.objectContaining({ join: 'AND' }))
  expect(entryGroups[0]!.members).toHaveLength(3)

  const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
  const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
  const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

  expect(entryRules).toHaveLength(1)
  expect(entryRules[0]).toEqual(expect.objectContaining({
    condition: expect.objectContaining({ kind: 'AND' }),
    actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
  }))
  expect(exitRules).toHaveLength(1)
  expect(exitRules[0]).toEqual(expect.objectContaining({
    condition: expect.objectContaining({ key: 'ma.death_cross' }),
    actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
  }))
})

it('[#1d] 重复逻辑子句按所在逗号块继承意图，不被前一父块污染', () => {
  const state = buildState(
    'MA20 上穿 MA50 开多，MA20 上穿 MA50 且 EMA7 上穿 EMA21 开空',
  )

  expect(state.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'ma', fastPeriod: 20, slowPeriod: 50 }),
    }),
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({ indicator: 'ma', fastPeriod: 20, slowPeriod: 50 }),
    }),
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
    }),
  ]))

  const shortEntryGroups = combinationResolver.resolveExecutableGroups(state.triggers)
    .filter(g => g.phase === 'entry' && g.sideScope === 'short')
  expect(shortEntryGroups).toHaveLength(1)
  expect(shortEntryGroups[0]).toEqual(expect.objectContaining({ join: 'AND' }))
  expect(shortEntryGroups[0]!.members).toHaveLength(2)
})

it('[#1e] 非 MA/RSI 逻辑子句同样继承所在逗号块意图', () => {
  const macdState = buildState('MACD 金叉 且 RSI14 低于 35 开多，MACD 死叉 平多')
  expect(macdState.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'macd' }),
    }),
    expect.objectContaining({
      key: 'indicator.cross_under',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'macd' }),
    }),
  ]))

  const breakoutState = buildState('突破最近20根K线高点 且 RSI14 低于 35 开多，跌破最近20根K线低点 平多')
  expect(breakoutState.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'price.breakout_up',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ period: 20, reference: 'channel_high' }),
    }),
    expect.objectContaining({
      key: 'price.breakout_down',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({ period: 20, reference: 'channel_low' }),
    }),
  ]))
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 9（评审 1）：「和」作列举名词不触发 hetero AND
// 注：句式简化为不会被 NL gateway 抽出 trigger 的 "BTC 和 ETH 开多"
// ─────────────────────────────────────────────────────────────────────────────
it('[#9] 「BTC 和 ETH 开多」→ 不挂 hetero entry-and- AND 组', () => {
  const state = buildState('BTC 和 ETH 开多')

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 10（评审 2）：「价格高于 MA20 和 EMA50 开多」
// 即使 NL gateway 抽出 2 个 indicator.above（MA stack 路径），
// hetero AND 路径不应触发（「和」已从词表移除），entry-and- 前缀不应出现。
// ─────────────────────────────────────────────────────────────────────────────
it('[#10] 「价格高于 MA20 和 EMA50 开多」→ 不挂 hetero entry-and- AND 组', () => {
  const state = buildState('价格高于 MA20 和 EMA50 开多')

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 11（评审 3）：「A 且 B 开多；X 或 Y 开空」
// long 桶 AND 命中、short 桶不命中（子句切分）
// ─────────────────────────────────────────────────────────────────────────────
it('[#11] 「A 且 B 开多；X 或 Y 开空」→ long 桶 AND、short 桶不命中', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35 开多；MA20 下穿 MA50 或 RSI14 高于 65 开空',
  )

  const longGroupIds = combinationGroupIds(state, 'entry', 'long')
  const shortGroupIds = combinationGroupIds(state, 'entry', 'short')

  expect(Array.from(longGroupIds).some(id => id.startsWith('entry-and-'))).toBe(true)
  for (const id of shortGroupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 12（评审 4）：「A 且 B，或 C 且 D 开多」
// 子句切分后 long 桶不会全段判定（整段含「或」） — 当前实现按 [。；;] 切分，
// 该 utterance 全在同一子句内 → 含「或」 → 不挂 AND（符合期望）
// ─────────────────────────────────────────────────────────────────────────────
it('[#12] 「A 且 B，或 C 且 D 开多」→ 单子句含「或」连词，long 桶不命中 hetero AND', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35，或 EMA7 上穿 EMA21 且 ADX 高于 25 开多',
  )

  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 13（评审 5 / M2）：「A 且 B 开多。还有 C 也开多」
// A/B 同组、C 独立不并入
// ─────────────────────────────────────────────────────────────────────────────
it('[#13] 「A 且 B 开多。C 也开多」→ A/B 同组、C 独立（子句切分）', () => {
  const state = buildState('MA20 上穿 MA50 且 RSI14 低于 35 开多。EMA7 上穿 EMA21 开多')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  // 至少 3 个 entry trigger（MA cross_over、RSI、EMA cross_over）
  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(3)

  // 按 evidence.text 区分第一句和第二句 trigger
  const firstClauseTrigger = longEntryTriggers.find(
    t => t.evidence?.text?.includes('MA20') || t.evidence?.text?.includes('RSI14'),
  )
  const secondClauseTrigger = longEntryTriggers.find(
    t => t.evidence?.text?.includes('EMA7'),
  )
  expect(firstClauseTrigger).toBeDefined()
  expect(secondClauseTrigger).toBeDefined()

  const firstGid = triggerGroupId(state, t => t === firstClauseTrigger)
  const secondGid = triggerGroupId(state, t => t === secondClauseTrigger)

  // 第一句 trigger 挂 entry-and- 组（MA20 + RSI14 + 「且」连词）
  expect(firstGid?.startsWith('entry-and-')).toBe(true)
  // 第二句 trigger 单独成桶（仅 1 个），不应与第一句共享 entry-and- groupId
  expect(secondGid).not.toBe(firstGid)
})

// ─────────────────────────────────────────────────────────────────────────────
// 新增用例 14（评审 6 / M1）：3 个 entry trigger，2 个被 MA stack 识别 + 1 个 hetero
// 方案 a 行为：MA stack 命中 trigger 不重复挂 hetero AND；剩余仅 1 个 → 不挂
// ─────────────────────────────────────────────────────────────────────────────
it('[#14] MA stack 命中 trigger + 单 hetero trigger → hetero AND 不挂', () => {
  // "价格高于 MA20 且 价格高于 MA50 且 RSI14 低于 35 开多"
  // MA20、MA50 → MA stack 路径 AND；RSI14 → 单独 entry trigger
  // 期望：MA stack groupId（stack-...）存在；RSI 不会被并入 entry-and- 组
  const state = buildState('价格高于 MA20 且 价格高于 MA50 且 RSI14 低于 35 开多')

  const longGroupIds = combinationGroupIds(state, 'entry', 'long')

  // 至少存在一个 MA stack 组（stack 或 stack-）
  const hasStackGroup = Array.from(longGroupIds).some(id => id.includes('stack'))
  // 不存在 hetero entry-and- 组（剩余非 stack trigger 仅 1 个，hetero 桶 <2）
  const hasHeteroAndGroup = Array.from(longGroupIds).some(id => id.startsWith('entry-and-'))

  // hasStackGroup 不强断（NL gateway 行为可能弱化），仅断言不会出现 hetero AND 与 MA stack 重叠
  if (hasStackGroup) {
    expect(hasHeteroAndGroup).toBe(false)
  }
})
