/**
 * Issue #1395 — rules-first summary 渲染契约
 *
 * 验证 SemanticStateProjectionService 在 state.rules 非空时，从 AtomExpr 树
 * 递归渲染自然中文，保留 sequence / AND / OR / NOT 语义，不被 lift 出来的扁平桶
 * 打散。空 rules 时回落旧扁平桶路径（向后兼容）。
 */

import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function baseState(overrides: Partial<SemanticState>): SemanticState {
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
    updatedAt: '2026-05-16T00:00:00.000Z',
    ...overrides,
  }
}

describe('semanticStateProjectionService — rules-first summary 渲染（#1395）', () => {
  const service = new SemanticStateProjectionService()

  it('s2：sequence 步骤 + nextBarOnly=true 渲染 "先...然后...（下一根）"', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-s2',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'sequence',
        nextBarOnly: true,
        steps: [
          {
            kind: 'atom',
            key: 'price.candle_pattern',
            params: { pattern: 'three_consecutive_down', count: 3 },
          },
          {
            kind: 'atom',
            key: 'volume.threshold',
            params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 },
          },
        ],
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('入场')
    expect(view.summary).toContain('做多')
    expect(view.summary).toMatch(/先\s/u)
    expect(view.summary).toMatch(/然后\s/u)
    expect(view.summary).toContain('下一根')
    // 均量倍数文案出现 → 证明 sequence 第 2 步 atom contract summary 被消费
    expect(view.summary).toMatch(/1\.5\s*×/u)
  })

  it('s4：AND 子节点串 "同时" + 各 atom 中文模板被消费', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-s4',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          {
            kind: 'atom',
            key: 'bollinger.touch_lower',
            params: { period: 20, stdDev: 2, confirmationMode: 'touch' },
          },
          {
            kind: 'atom',
            key: 'volume.threshold',
            params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 },
          },
        ],
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('同时')
    // bollinger.touch_lower summaryTemplate 输出 "BOLL（20, 2）下轨触及"
    expect(view.summary).toContain('BOLL')
    expect(view.summary).toContain('1.5')
  })

  it('s6：sequence 突破→回踩 顺序保留 "先 X，然后 Y"', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-s6',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            key: 'price.breakout_up',
            params: { period: 24, reference: 'channel_high' },
          },
          {
            kind: 'atom',
            key: 'price.previous_extrema_retest',
            params: {},
          },
        ],
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toMatch(/先\s.*?，然后\s/u)
    // nextBarOnly 未启用 → 不应出现"下一根"
    expect(view.summary).not.toContain('下一根')
  })

  it('rules 为空 → fallback 走旧扁平桶路径，summary 仍可用', () => {
    // 仅 trigger 非空，rules 字段缺省（undefined）
    const trigger = {
      id: 'trig-1',
      key: 'volume.threshold',
      phase: 'entry' as const,
      sideScope: 'long' as const,
      params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 },
      status: 'locked' as const,
      source: 'user_explicit' as const,
      openSlots: [],
      contracts: [],
    } as unknown as SemanticState['trigger'][number]
    const state = baseState({ trigger: [trigger] })
    const view = service.buildConversationView(state)
    // 旧路径仍输出可用 summary，且不是默认空兜底
    expect(view.summary.length).toBeGreaterThan(0)
    expect(view.summary).not.toBe('已识别部分条件，但仍未完整。')
  })

  it('风控段：rule.phase=gate + risk.stop_loss_pct atom，前置段被渲染', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-risk',
      phase: 'gate',
      sideScope: 'both',
      condition: {
        kind: 'atom',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 3, basis: 'entry_avg_price' },
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('前置')
    expect(view.summary).toContain('双向')
    expect(view.summary).toContain('止损')
    expect(view.summary).toContain('3')
  })

  it('or / not 组合：渲染 "X 或 Y" 与 "非 X"', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-or-not',
      phase: 'entry',
      sideScope: 'short',
      condition: {
        kind: 'or',
        children: [
          {
            kind: 'atom',
            key: 'bollinger.touch_lower',
            params: { period: 20, stdDev: 2 },
          },
          {
            kind: 'not',
            child: {
              kind: 'atom',
              key: 'volume.threshold',
              params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 },
            },
          },
        ],
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('或')
    expect(view.summary).toContain('非')
    expect(view.summary).toContain('做空')
  })
})
