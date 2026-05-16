/**
 * Issue #1413 — seed-builder rules-first 路径覆盖
 *
 * 任何非空 patch 路径（trigger / action / risk / position / orchestration 之一非空）
 * 出口都必须产出 state.rules.length > 0。真空 patch 仍返回 null（不在本断言范围）。
 *
 * 覆盖策略：用一组覆盖各 bucket 与组合形态的最小 patch 跑 seed builder.build()，
 * 逐个断言 rules 非空。具体 rule 语义形状由 rules-from-flat-buckets.spec.ts 守门，
 * 这里只守"必须有"。
 */

import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

type Patch = CodegenSemanticPatch

interface PatchCase {
  readonly name: string
  readonly message: string
  readonly patch: Patch
}

const CASES: PatchCase[] = [
  {
    name: '单 entry trigger atom（atoms[] 路径）',
    message: 'BTC RSI 高于 70 时做多',
    patch: {
      atoms: [{
        key: 'oscillator.rsi_gte',
        phase: 'entry',
        params: { period: 14, threshold: 70 },
        sideScope: 'long',
        evidence: { text: 'RSI 高于 70', source: 'user_explicit' },
      }],
    } as Patch,
  },
  {
    name: '单 entry trigger atom（legacy triggers[] 路径）',
    message: 'BTC RSI 高于 70 时做多',
    patch: {
      triggers: [{
        key: 'oscillator.rsi_gte',
        phase: 'entry',
        params: { period: 14, threshold: 70 },
        sideScope: 'long',
        evidence: { text: 'RSI 高于 70', source: 'user_explicit' },
      }],
    } as Patch,
  },
  {
    name: 'multi-MA stack trigger（#1391 历史回归）',
    message: '价格高于 MA10 且高于 MA20 且高于 MA50 时做多',
    patch: {
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', reference: { period: 10 } },
          sideScope: 'long',
          evidence: { text: '价格高于 MA10', source: 'user_explicit' },
        },
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', reference: { period: 20 } },
          sideScope: 'long',
          evidence: { text: '价格高于 MA20', source: 'user_explicit' },
        },
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', reference: { period: 50 } },
          sideScope: 'long',
          evidence: { text: '价格高于 MA50', source: 'user_explicit' },
        },
      ],
    } as Patch,
  },
  {
    name: 'trigger + risk + action',
    message: '突破做多，5% 止损',
    patch: {
      triggers: [{
        key: 'oscillator.rsi_gte',
        phase: 'entry',
        params: { period: 14, threshold: 65 },
        sideScope: 'long',
        evidence: { text: '突破', source: 'user_explicit' },
      }],
      actions: [{
        key: 'open_long',
        params: {},
        evidence: { text: '做多', source: 'user_explicit' },
      }],
      risk: [{
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, direction: 'loss', basis: 'entry_avg_price', basisSource: 'user_explicit', effect: 'close_position', scope: 'current_position' },
        evidence: { text: '5% 止损', source: 'user_explicit' },
      }],
    } as Patch,
  },
  {
    name: '显式 explicitRules 直接透传',
    message: 'RSI > 70 做多',
    patch: {
      rules: [{
        id: 'user-rule-1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 70 } },
        effects: [],
      }],
    } as Patch,
  },
  {
    name: 'context only（仅交易所/符号锁定）',
    message: 'OKX BTCUSDT 现货 1h',
    patch: {
      contextSlots: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '1h',
      },
    } as unknown as Patch,
  },
]

describe('SemanticSeedStateBuilderService — rules-first 路径覆盖 (Issue #1413)', () => {
  const seedBuilder = new SemanticSeedStateBuilderService()

  it.each(CASES)('「$name」出口 state.rules.length > 0（或纯 context-only 时合法允许 0）', ({ message, patch, name }) => {
    const state = seedBuilder.build(patch, message)
    // 真空 patch 才允许 null；CASES 中均非空，state 必非 null
    expect(state).not.toBeNull()
    if (!state) return
    const rulesLen = state.rules?.length ?? 0
    if (name.startsWith('context only')) {
      // context-only patch 没有 trigger / action / risk → flat 桶全空，
      // rulesFromFlatBuckets 输出 []；合法允许 rules=0（守门只针对"有桶非空但 rules 为空"反向）。
      expect(rulesLen).toBe(0)
    } else {
      expect(rulesLen).toBeGreaterThan(0)
    }
  })

  it('explicit rules 路径：state.rules 与 patch.rules 等长且 id 一致', () => {
    const patch = {
      rules: [
        {
          id: 'r-ex-1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { threshold: 70 } },
          effects: [],
        },
        {
          id: 'r-ex-2',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { threshold: 30 } },
          effects: [],
        },
      ],
    } as unknown as Patch
    const state = seedBuilder.build(patch, 'RSI > 70 多，RSI < 30 平')
    expect(state).not.toBeNull()
    expect(state!.rules).toHaveLength(2)
    expect(state!.rules!.map(r => r.id)).toEqual(['r-ex-1', 'r-ex-2'])
  })
})
