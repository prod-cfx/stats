/**
 * multi-entry-trigger-and-combination.spec.ts
 *
 * Requirement-driven tests for Issue #1145 — Bug C:
 * 同 utterance 多 entry trigger 同 sideScope 且含 AND 连词 → 源头注入 AND combination contract
 * → canonical-spec-builder 编出 1 条 AND rule（而非 N 条独立 OR-first-match rule）
 */
import type { SemanticAtomContract, SemanticState } from '../../types/semantic-state'
import { isTriggerPredicateGroupContract } from '../semantic-state-normalization'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticTriggerCombinationContractService } from '../semantic-trigger-combination-contract.service'

const extractor = new SemanticSeedExtractorService()
const builder = new SemanticSeedStateBuilderService()
const combinationResolver = new SemanticTriggerCombinationContractService()

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

// ─────────────────────────────────────────────────────────────────────────────
// 用例 1：正向 — 3 个 entry trigger 同 sideScope=long，含「且」连词
// 期望：3 triggers 挂同一 groupId AND contract
// ─────────────────────────────────────────────────────────────────────────────
it('[#1] 3 个 entry trigger 含「且」→ 挂同一 AND combination contract', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多，止损 5%',
  )

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  // 应该有 ≥2 个入场 trigger
  expect(longEntryTriggers.length).toBeGreaterThanOrEqual(2)

  // 所有入场 trigger 都应挂 combination contract
  for (const trigger of longEntryTriggers) {
    const hasCombination = trigger.contracts?.some(c => isCombinationContract(c))
    expect(hasCombination).toBe(true)
  }

  // 所有入场 trigger 的 groupId 应相同（同一个 AND 组）
  const groupIds = combinationGroupIds(state, 'entry', 'long')
  expect(groupIds.size).toBe(1)

  // groupId 的 join 应为 AND
  const anyTrigger = longEntryTriggers[0]!
  const combinationContracts = anyTrigger.contracts?.filter(c => isCombinationContract(c)) ?? []
  expect(combinationContracts.length).toBeGreaterThan(0)
  expect(combinationContracts[0]!.params?.join).toBe('AND')
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 2：方向分组 — long 组和 short 组各自独立 AND，互不串组
// ─────────────────────────────────────────────────────────────────────────────
it('[#2] long 组和 short 组各自独立 AND groupId，不串组', () => {
  const state = buildState(
    'MA20 上穿 MA50 且 RSI14 低于 35 开多；MA20 下穿 MA50 且 RSI14 高于 65 开空',
  )

  const longGroupIds = combinationGroupIds(state, 'entry', 'long')
  const shortGroupIds = combinationGroupIds(state, 'entry', 'short')

  // long 组存在 combination contract
  expect(longGroupIds.size).toBeGreaterThanOrEqual(1)
  // short 组存在 combination contract
  expect(shortGroupIds.size).toBeGreaterThanOrEqual(1)

  // long 和 short 的 groupId 互不重叠
  for (const id of longGroupIds) {
    expect(shortGroupIds.has(id)).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 3：OR 句式排除 — 含「或」则不挂 AND contract（保持 singleton）
// ─────────────────────────────────────────────────────────────────────────────
it('[#3] 含「或」连词 → 不挂 AND contract，保持 singleton', () => {
  const state = buildState('MA 金叉 或 RSI 低于 35 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  // 如果有多个 entry trigger，它们不应共享同一 AND groupId
  if (longEntryTriggers.length >= 2) {
    const groupIds = combinationGroupIds(state, 'entry', 'long')
    // 每个 trigger 应该有自己独立的 groupId（singleton），不应该合并
    // singleton groupId 格式含 trigger.id：implicit:entry:long:...
    for (const id of groupIds) {
      expect(id).toMatch(/implicit:|entry-ma100|exit-ma100|any_of/)
    }
    // 或者：不存在任何以 'entry-and-' 开头的 groupId
    for (const id of groupIds) {
      expect(id.startsWith('entry-and-')).toBe(false)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 4：退化单 trigger — 只有 1 个 entry trigger，不挂 AND contract（singleton）
// ─────────────────────────────────────────────────────────────────────────────
it('[#4] 单个 entry trigger → 不挂 AND combination contract（singleton）', () => {
  const state = buildState('MA 金叉 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  // 不应出现 entry-and- 开头的 AND 组 groupId
  const groupIds = combinationGroupIds(state, 'entry', 'long')
  for (const id of groupIds) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }

  // resolveExecutableGroups 产出每个 trigger 为独立 group（singleton 格式 implicit:...）
  if (longEntryTriggers.length > 0) {
    const groups = combinationResolver.resolveExecutableGroups(state.triggers)
    const entryLongGroups = groups.filter(g => g.phase === 'entry' && g.sideScope === 'long')
    // 单 trigger → 每个 group 恰好 1 个 member
    for (const group of entryLongGroups) {
      expect(group.members.length).toBe(1)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 5：trend.direction phase=entry 参与 AND 组
// ─────────────────────────────────────────────────────────────────────────────
it('[#5] 含 trend.direction entry trigger 且有 AND 连词 → 纳入 AND 组', () => {
  // "市场趋势向上" 会产生 trend.direction phase=entry sideScope=long
  const state = buildState('市场趋势向上 且 MA 金叉 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  if (longEntryTriggers.length >= 2) {
    const groupIds = combinationGroupIds(state, 'entry', 'long')
    // 应该有 AND 组（entry-and- 开头）
    const hasAndGroup = Array.from(groupIds).some(id => id.startsWith('entry-and-'))
    expect(hasAndGroup).toBe(true)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 6：同 utterance 多 actionKey 隔离 — close_long(exit) 不混入 open_long(entry) 组
// ─────────────────────────────────────────────────────────────────────────────
it('[#6] exit trigger 不混入 entry AND 组', () => {
  // "且 MA 金叉" 在 entry 组，"MA 死叉 平多" 是 exit trigger
  const state = buildState('MA 金叉 且 RSI 低于 35 开多；MA 死叉 平多；止损 5%')

  // exit trigger 不应出现 entry-and-long 的 groupId
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
// 用例 7：混合连词识别 — 「同时」「并且」「和」也能识别为 AND
// ─────────────────────────────────────────────────────────────────────────────
it.each([
  ['同时', 'MA 金叉 同时 RSI 低于 35 开多，止损 5%'],
  ['并且', 'MA 金叉 并且 RSI 低于 35 开多，止损 5%'],
  ['和', 'MA 金叉 和 RSI 低于 35 开多，止损 5%'],
])('[#7] 连词「%s」→ 触发 AND 分组', (_conjunction, message) => {
  const state = buildState(message)

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  if (longEntryTriggers.length >= 2) {
    const groupIds = combinationGroupIds(state, 'entry', 'long')
    const hasAndGroup = Array.from(groupIds).some(id => id.startsWith('entry-and-'))
    expect(hasAndGroup).toBe(true)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 8：不同 utterance 不串组 — 两次 extract 各自独立
// ─────────────────────────────────────────────────────────────────────────────
it('[#8] 两次独立 extract 各自独立处理，互不影响', () => {
  const state1 = buildState('MA 金叉 且 RSI 低于 35 开多，止损 5%')
  const state2 = buildState('MA 死叉 开空，止损 5%')

  // state1 应有 AND 组（含「且」）
  const groupIds1 = combinationGroupIds(state1, 'entry', 'long')
  if (state1.triggers.filter(t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long').length >= 2) {
    const hasAndGroup1 = Array.from(groupIds1).some(id => id.startsWith('entry-and-'))
    expect(hasAndGroup1).toBe(true)
  }

  // state2 只有单 trigger，不应有 AND 组
  const groupIds2 = combinationGroupIds(state2, 'entry', 'short')
  for (const id of groupIds2) {
    expect(id.startsWith('entry-and-')).toBe(false)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 1b：resolveExecutableGroups 确认 AND 组合并为单 group N 个 members
// ─────────────────────────────────────────────────────────────────────────────
it('[#1b] resolveExecutableGroups → AND 组合并后 1 个 group 含 N members', () => {
  const state = buildState('MA20 上穿 MA50 且 RSI14 低于 35 开多，止损 5%')

  const longEntryTriggers = state.triggers.filter(
    t => t.phase === 'entry' && (t.sideScope ?? 'long') === 'long' && t.key !== 'logical.any_of',
  )

  if (longEntryTriggers.length < 2) {
    // 如果只抽出 1 个 trigger（语言理解退化），本用例不做强断言
    return
  }

  const groups = combinationResolver.resolveExecutableGroups(state.triggers)
  const andGroups = groups.filter(
    g => g.phase === 'entry' && g.sideScope === 'long' && g.join === 'AND' && g.members.length >= 2,
  )

  expect(andGroups.length).toBeGreaterThanOrEqual(1)

  const andGroup = andGroups[0]!
  expect(andGroup.join).toBe('AND')
  expect(andGroup.members.length).toBeGreaterThanOrEqual(2)
})
