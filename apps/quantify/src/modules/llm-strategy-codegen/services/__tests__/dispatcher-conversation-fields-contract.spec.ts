/**
 * Issue #1279 PR2c4 — dispatcher 隐式字段契约 spec
 *
 * codegen-conversation.service.ts 的 `mergePlannerSemanticPatch` /
 * `detectPatchConflicts` 函数会读 patch 的 4 个隐式字段：
 *   - patch.symbols[0]
 *   - patch.timeframes[0]
 *   - patch.riskRules.exchange
 *   - patch.riskRules.marketType
 *
 * 这些字段不在 5 顶层 truthy 过滤里（contextSlots / triggers / actions /
 * risk / position），但 caller 一旦透传 dispatcher 的 patch 到合并逻辑，
 * 字段缺失会导致冲突探测漏报、合并退化。
 *
 * 注意（review M1）：本 spec 实质是"形态契约"——锁 dispatcher 输出在 caller
 * 类型守卫（`typeof === 'string'` + optional chain）下可被安全消费，含 undefined
 * 形态。语义层 oracle（"4 字段在 c5 caller 切换后真的非空且语义稳定"）由
 * `codegen-conversation.service.spec.ts` 的真实冲突探测断言负担。
 *
 * 为防止 dispatcher 整体退化为 `() => ({})` 也能过 9/9，下面追加一条最小正向覆盖：
 * AC-7 prompts 中至少 N 条产出非 undefined 的 symbols 或 riskRules.exchange——
 * 锁住 dispatcher 必须真实命中至少部分隐式字段。
 *
 * 注意（review M2 / #1492 更新）：#1492 收敛 codegen 入口为 planner rules tree
 * 后，dispatcher 已不在生产解释链路上（caller 端的 `extractSemanticPatchFromMessage`
 * 私有合并路径连同其调用方已一并下线）。本 spec 不再覆盖任何生产消费侧行为，
 * 但仍保留对 dispatcher 自身输出形态契约的锁定：AC-7 / AC-12 两组共 8 个 prompt
 * 的 dispatch 输出必须满足同一字段形态，避免未来若 dispatcher 被重新挂回任何
 * 链路时形态悄悄退化。
 *
 * Refs: #1279
 */

import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC12_WEBHOOK_PROMPTS, AC7_USER_PROMPTS } from './fixtures/ac-prompts'

type UnknownRecord = Record<string, unknown>

describe('PR2c4: dispatcher 隐式字段契约（codegen-conversation 消费侧）', () => {
  const dispatcher = new GenericSeedDispatcher()
  const ALL_PROMPTS = [...AC7_USER_PROMPTS, ...AC12_WEBHOOK_PROMPTS]

  it.each(ALL_PROMPTS.map(p => [p.id, p.utterance]))(
    '[%s] dispatch 输出必须可被 caller 安全访问 4 隐式字段',
    (_id, utterance) => {
      const patch = dispatcher.dispatch(utterance) as UnknownRecord

      expect(patch).toBeDefined()
      expect(typeof patch).toBe('object')

      // symbols / timeframes 必须是 undefined 或 array（caller 用 [0] 索引）
      const symbols = patch.symbols
      expect(symbols === undefined || Array.isArray(symbols)).toBe(true)

      const timeframes = patch.timeframes
      expect(timeframes === undefined || Array.isArray(timeframes)).toBe(true)

      // riskRules 必须是 undefined 或 object（caller 读 .exchange / .marketType）
      const riskRules = patch.riskRules
      expect(
        riskRules === undefined
          || (typeof riskRules === 'object' && riskRules !== null && !Array.isArray(riskRules)),
      ).toBe(true)

      if (riskRules && typeof riskRules === 'object') {
        const rr = riskRules as UnknownRecord
        // exchange / marketType 若存在必须是 string（caller 走 typeof === 'string' 守门）
        if (rr.exchange !== undefined) expect(typeof rr.exchange).toBe('string')
        if (rr.marketType !== undefined) expect(typeof rr.marketType).toBe('string')
      }
    },
  )

  it('AC-7 prompts 至少半数产出非空 contextSlots（caller truthy 闸口最小覆盖）', () => {
    const hits = AC7_USER_PROMPTS.filter((p) => {
      const patch = dispatcher.dispatch(p.utterance) as UnknownRecord
      return patch.contextSlots !== undefined
        || patch.triggers !== undefined
        || patch.actions !== undefined
        || patch.risk !== undefined
        || patch.position !== undefined
    })
    // review m2：从 `> 0` 收紧到 `>= N/2`，防止 dispatcher 退化到只剩 1 条命中也过
    expect(hits.length).toBeGreaterThanOrEqual(Math.ceil(AC7_USER_PROMPTS.length / 2))
  })

  it('AC-7 prompts 至少 1 条 contextSlots 命中真实非空 symbol 槽位（dispatcher 真实正向覆盖）', () => {
    // Issue #1342：原断言写在"top-level patch.symbols / patch.riskRules.exchange"
    // 维度，但 dispatcher 真实输出是 `contextSlots.symbol`（单数槽位）+
    // `contextSlots.exchange`——top-level symbols[] / riskRules{} 是下游
    // codegen-conversation.service `buildLogicSnapshotFromState` 路径基于 `state.contextSlots`
    // 投影出的 StrategyLogicSnapshot 字段，并非 dispatcher 的契约。
    //
    // 本断言对齐 dispatcher 真实契约：AC-7 prompts 中至少 1 条命中 contextSlots.symbol
    // （单数槽位，object 形态含非空 `value` 字段）。review M1 原意（防 dispatcher
    // 退化为 `() => ({})` 或 `() => ({ contextSlots: { symbol: null } })` 也能通过
    // 9/9 形态断言）继续生效：symbol 槽位是 dispatcher NL→ctx 的最强正向信号，
    // 校验到 `value` 非空字符串这一层避免空对象 / null 钻空。
    const realHits = AC7_USER_PROMPTS.filter((p) => {
      const patch = dispatcher.dispatch(p.utterance) as UnknownRecord
      const contextSlots = patch.contextSlots as UnknownRecord | undefined
      if (contextSlots === undefined) return false
      const symbolSlot = contextSlots.symbol
      if (symbolSlot === null || symbolSlot === undefined) return false
      if (typeof symbolSlot !== 'object') return false
      const value = (symbolSlot as UnknownRecord).value
      return typeof value === 'string' && value.length > 0
    })
    expect(realHits.length).toBeGreaterThanOrEqual(1)
  })
})
