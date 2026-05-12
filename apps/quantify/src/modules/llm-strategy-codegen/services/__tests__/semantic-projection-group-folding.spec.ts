/**
 * semantic-projection-group-folding.spec.ts
 *
 * 需求驱动测试 — Issue #1222 (#1218 子 C)
 *
 * `SemanticStateProjectionService.buildConversationView` 必须按
 * (phase, sideScope, contract.params.groupId) 分桶折叠 trigger 渲染：
 * - 桶大小 >= 2：单行 "条件1 {且|或} 条件2 ..."，连词由 contract.params.join 决定
 * - 桶大小 = 1 或 groupId 缺失/null：走原 singleton 渲染
 *
 * Pipeline 使用真实 SemanticSeedExtractor → SemanticSeedStateBuilder
 * → SemanticStateProjection 三段，不做 mock。
 */
import type { SemanticState } from '../../types/semantic-state'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

let extractor: SemanticSeedExtractorService
let builder: SemanticSeedStateBuilderService
let projection: SemanticStateProjectionService

beforeEach(() => {
  extractor = new SemanticSeedExtractorService()
  builder = new SemanticSeedStateBuilderService()
  projection = new SemanticStateProjectionService()
})

function buildState(message: string): SemanticState {
  const patch = extractor.extract(message)
  const state = builder.build(patch)
  if (!state) throw new Error(`state_build_failed for: ${message}`)
  return state
}

function summary(message: string): string {
  return projection.buildConversationView(buildState(message)).summary
}

// ─────────────────────────────────────────────────────────────────────────────
// 用例 1：3 个共享 groupId 的 indicator.above 入场 → 单行 AND 折叠
// ─────────────────────────────────────────────────────────────────────────────
it('[#1] 3 个共享 groupId 的 entry trigger → 渲染为单行「且」连接', () => {
  const s = summary(
    'Binance 合约 BTCUSDT 15m，价格在 EMA20、EMA60、EMA144 上方时做多开仓，价格低于 EMA20 时平多，仓位 10 USDT，止损 5%',
  )

  // 必须出现合并后的单行（含 EMA20 / EMA60 / EMA144 + 「且」连词 + 时做多开仓）
  expect(s).toMatch(/入场：价格在 EMA20 上方 且 价格在 EMA60 上方 且 价格在 EMA144 上方 时做多开仓/)

  // 不能再出现独立的 3 条「入场：价格在 EMAxx 上方时做多开仓」
  const standaloneCount = (s.match(/入场：价格在 EMA(20|60|144) 上方时做多开仓/g) ?? []).length
  expect(standaloneCount).toBe(0)

  // 平多出场仍为单独一行
  expect(s).toContain('出场：价格低于 EMA20 时平多')
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 2：同 utterance long 组（3 元 AND）+ short 组（3 元 AND） → 各 1 行
// ─────────────────────────────────────────────────────────────────────────────
it('[#2] long AND 组与 short AND 组各自独立折叠', () => {
  const s = summary(
    'Binance BTCUSDT 永续 15m，价格在 EMA20、EMA60、EMA144 上方只做多，价格都位于 EMA20、EMA60、EMA144 下方只做空，入场布林下轨开多上轨开空，仓位 20 USDT，止损 5%',
  )

  // long 组单行 AND
  expect(s).toMatch(/入场：价格在 EMA20 上方 且 价格在 EMA60 上方 且 价格在 EMA144 上方 时做多开仓/)
  // short 组单行 AND
  expect(s).toMatch(/入场：价格低于 EMA20 且 价格低于 EMA60 且 价格低于 EMA144 时做空开仓/)

  // 散开的独立行不应再出现
  expect(s).not.toMatch(/入场：价格在 EMA60 上方时做多开仓/)
  expect(s).not.toMatch(/入场：价格低于 EMA60 时做空开仓/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 3：contract.params.join === 'OR' → 「或」连词
// ─────────────────────────────────────────────────────────────────────────────
it('[#3] OR groupId → 「或」连接 singleton 行', () => {
  // 直接构造一个最小 state，因为 NL gateway 上的 hetero AND 路径只产 AND
  const baseState = buildState(
    'Binance 合约 BTCUSDT 15m，价格在 EMA20、EMA60、EMA144 上方时做多开仓，止损 5%',
  )
  // 改写 contracts 让 groupId 不变但 join 改成 OR
  for (const t of baseState.triggers) {
    if (t.phase !== 'entry' || t.sideScope !== 'long') continue
    for (const c of t.contracts ?? []) {
      if (c.params && typeof c.params === 'object' && 'groupId' in c.params && 'join' in c.params) {
        ;(c.params as Record<string, unknown>).join = 'OR'
      }
    }
  }

  const view = projection.buildConversationView(baseState)
  expect(view.summary).toMatch(/入场：价格在 EMA20 上方 或 价格在 EMA60 上方 或 价格在 EMA144 上方 时做多开仓/)
  expect(view.summary).not.toMatch(/ 且 /)
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 4：桶大小 = 1 → 走原 singleton 渲染
// ─────────────────────────────────────────────────────────────────────────────
it('[#4] 桶只有 1 个 trigger → 保持 singleton 渲染', () => {
  // 仅 1 个 entry trigger（无 AND 连词、无 stack）
  const s = summary('Binance 合约 BTCUSDT 15m，价格在 EMA20 上方时做多开仓，止损 5%')
  // 单行 singleton
  expect(s).toMatch(/入场：.*EMA20.*时做多开仓/)
  // 不应出现「且」连词（只有 1 个）
  expect(s).not.toMatch(/ 且 /)
})

// ─────────────────────────────────────────────────────────────────────────────
// 用例 5：groupId === undefined / null → 不与其他 trigger 串桶
// ─────────────────────────────────────────────────────────────────────────────
it('[#5] groupId 缺失 → 每条 trigger 独立 singleton', () => {
  // 取一个有 groupId 的 state，剥掉所有 contract.params.groupId
  const baseState = buildState(
    'Binance 合约 BTCUSDT 15m，价格在 EMA20、EMA60、EMA144 上方时做多开仓，止损 5%',
  )
  for (const t of baseState.triggers) {
    for (const c of t.contracts ?? []) {
      if (c.params && typeof c.params === 'object' && 'groupId' in c.params) {
        delete (c.params as Record<string, unknown>).groupId
      }
    }
  }

  const view = projection.buildConversationView(baseState)
  // 3 行独立 singleton（旧行为）
  const standaloneCount = (view.summary.match(/入场：价格在 EMA(20|60|144) 上方时做多开仓/g) ?? []).length
  expect(standaloneCount).toBe(3)
  // 无「且」/「或」折叠
  expect(view.summary).not.toMatch(/上方 且 价格在 EMA/)
  expect(view.summary).not.toMatch(/上方 或 价格在 EMA/)
})
