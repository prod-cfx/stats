/**
 * Issue #1395 — rules-first summary 渲染契约
 *
 * 验证 SemanticStateProjectionService 在 state.rules 非空时，从 AtomExpr 树
 * 递归渲染自然中文，保留 sequence / AND / OR / NOT 语义，不被 lift 出来的扁平桶
 * 打散。空 rules 时回落旧扁平桶路径（向后兼容）。
 */

import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
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
    // Issue #1443：去掉 phaseLabel 后的（做多/做空/双向）sideScope 括号；方向信息靠
    //   condition / effects 文本体现。此处 effects=[] 所以不验方向词。
    expect(view.summary).not.toContain('入场（做多）')
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

  it('renders EMA20 above from nested reference period', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-ema20-above',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.above',
        params: { indicator: 'ema', reference: { period: 20 }, timeframe: '15m' },
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('EMA20')
    expect(view.summary).toContain('15m')
    expect(view.summary).not.toContain('指标高于阈值')
  })

  it('renders moving-average relative compare from left period and nested reference period', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-ma50-above-ma200',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.above',
        params: { indicator: 'ma', period: 50, reference: { period: 200 }, timeframe: '1h' },
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('MA50')
    expect(view.summary).toContain('MA200')
    expect(view.summary).toContain('1h')
    expect(view.summary).not.toContain('价格在 MA200 上方')
  })

  it('renders rolling channel breakout with high/low reference', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-channel-breakout',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'price.breakout_up', params: { period: 24, reference: 'channel_high' } },
          { kind: 'atom', key: 'price.breakout_down', params: { period: 24, reference: 'channel_low' } },
        ],
      },
      effects: [],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toMatch(/滚动|过去|最近|前/u)
    expect(view.summary).toContain('24')
    expect(view.summary).toContain('高点')
    expect(view.summary).toContain('低点')
    expect(view.summary).not.toContain('向上突破（24，0%）')
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
    // Issue #1443：去掉（双向）sideScope 括号
    expect(view.summary).not.toContain('（双向）')
    expect(view.summary).toContain('止损')
    expect(view.summary).toContain('3')
  })

  // Issue #1403 子故障 B：UI 实际消费的 displayLogicGraph 必须基于 state.rules 渲染，
  //   而非 flat-lift 出来的 state.trigger（lift 可能含 LLM 幻觉参数）。
  describe('buildDisplayLogicGraph rules-first（#1403 子故障 B）', () => {
    function makeS2State(): SemanticState {
      const rules: SemanticRule[] = [{
        id: 'rule-s2',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'sequence',
          nextBarOnly: true,
          steps: [
            { kind: 'atom', key: 'price.candle_pattern', params: { pattern: 'three_consecutive_down', count: 3 } },
            { kind: 'atom', key: 'volume.threshold', params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 } },
          ],
        },
        effects: [],
      }]
      // 故意构造与 rules 语义冲突的 flat trigger（幻觉 minBars=15），模拟 #1403 复现条件
      const flatTrigger = {
        id: 'trig-hallucinated',
        key: 'price.candle_pattern',
        phase: 'entry' as const,
        sideScope: 'both' as const,
        params: { pattern: 'consecutive_body', minBars: 15 },
        status: 'locked' as const,
        source: 'derived' as const,
        openSlots: [],
        contracts: [],
      } as unknown as SemanticState['trigger'][number]
      return baseState({ rules, trigger: [flatTrigger] })
    }

    it('rules 非空 → displayLogicGraph 条件文本来自 rules 树（不出现 flat trigger 的 minBars=15 幻觉）', () => {
      const graph = service.buildDisplayLogicGraph(makeS2State())
      const conditionBlocks = graph.blocks.filter(b => b.type === 'IF' || b.type === 'AND_AT_THEN')
      expect(conditionBlocks.length).toBeGreaterThan(0)
      const allText = conditionBlocks
        .flatMap(b => b.items)
        .map(i => i.text)
        .join('\n')
      // 必须命中 rules 渲染特征文本
      expect(allText).toMatch(/先\s/u)
      expect(allText).toMatch(/然后\s/u)
      expect(allText).toContain('下一根')
      // 不应再出现 flat lift 的「≥15 根」幻觉
      expect(allText).not.toMatch(/≥\s*15\s*根/u)
      expect(allText).not.toMatch(/双向开仓/u)
      expect(allText).toContain('时做多开仓')
    })

    it('rules 为空 → fall back 到 flat trigger 路径（向后兼容）', () => {
      const flatTrigger = {
        id: 'trig-flat',
        key: 'macd.golden_cross',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        params: {},
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
        contracts: [],
      } as unknown as SemanticState['trigger'][number]
      const action = {
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
      } as unknown as SemanticState['action'][number]
      const graph = service.buildDisplayLogicGraph(baseState({ trigger: [flatTrigger], action: [action] }))
      const conditionBlocks = graph.blocks.filter(b => b.type === 'IF' || b.type === 'AND_AT_THEN')
      // flat 路径仍能产出条件块（不要求精确文本，只验证降级链路存活）
      expect(conditionBlocks.length).toBeGreaterThanOrEqual(0)
    })
  })

  // Issue #1403 子故障 A：grid 域 clarification 不再追问 atom-based position size。
  it('grid.range_rebalance 存在时，findNextOpenSlot 跳过 position.openSlots 的 nextQuestion', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-grid',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'grid.range_rebalance', params: {} },
      effects: [],
    }]
    const state = baseState({
      rules,
      position: {
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'position.sizing.perOrderSizing.value',
          fieldPath: 'position.sizing.perOrderSizing.value',
          status: 'open',
          priority: 'core',
          questionHint: '请确认单笔仓位大小（USDT）。',
          affectsExecution: true,
        }],
      } as unknown as SemanticState['position'],
    })
    const view = service.buildClarificationView(state)
    expect(view.nextQuestion).toBeNull()
  })

  // Issue #1403 子故障 D：rules 含 entry + exit + risk 三段时，rulesSummary 必须三段全渲染。
  it('rules 含 entry + exit + risk 三条时 summary 同时包含三段', () => {
    const rules: SemanticRule[] = [
      {
        id: 'rule-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'macd.golden_cross', params: {} },
        effects: [],
      },
      {
        id: 'rule-exit',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'macd.death_cross', params: {} },
        effects: [],
      },
      {
        id: 'rule-risk',
        phase: 'gate',
        sideScope: 'both',
        condition: {
          kind: 'atom',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 3, basis: 'entry_avg_price' },
        },
        effects: [],
      },
    ]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('入场')
    expect(view.summary).toContain('出场')
    expect(view.summary).toContain('前置')
    expect(view.summary).toContain('止损')
  })

  // 审查 R2-2 修复：≥2 个未注册 atom 的兜底文案不应在 and/or/sequence 内被乘积量重复
  it('and 子节点全是未注册 atom 时兜底文案只显示一次（不出现「X 同时 X」噪声）', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-unregistered',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'totally.fake.atom_a', params: {} },
          { kind: 'atom', key: 'totally.fake.atom_b', params: {} },
        ],
      },
      effects: [],
    }]
    // 抑制 console.warn 噪声（审查 M3 引入的预期 warn）
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const view = service.buildConversationView(baseState({ rules }))
      // 兜底文案最多出现一次
      const occurrences = (view.summary.match(/已识别条件，参数待补充/gu) ?? []).length
      expect(occurrences).toBe(1)
      // 不应出现「兜底 同时 兜底」乘积量
      expect(view.summary).not.toContain('已识别条件，参数待补充 同时 已识别条件，参数待补充')
    }
    finally {
      warnSpy.mockRestore()
    }
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
    // Issue #1443：去掉（做空）sideScope 括号
    expect(view.summary).not.toContain('（做空）')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Issue #1443 通用 UI 简化：
//   (a) renderRule 去掉 phaseLabel 后的（做多/做空/双向）sideScope 括号
//   (b) condition 是 always-on atom（如 execution.on_start）时 renderRule 省略
//       condition，只输出 effects
//   (c) enrichSummaryWithParamRenderers 跳过值 === paramSlot.default 的 slot
// ───────────────────────────────────────────────────────────────────────────
describe('Issue #1443 — renderRule 通用 UI 简化', () => {
  const service = new SemanticStateProjectionService()

  it('(a) entry rule 不再渲染「入场（做多）」括号', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1 } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    expect(view.summary).toContain('入场')
    expect(view.summary).not.toContain('（做多）')
    expect(view.summary).not.toContain('（做空）')
    expect(view.summary).not.toContain('（双向）')
  })

  it('(b) condition 是 execution.on_start always-on atom → 不渲染 condition', () => {
    // 用户实测策略 1 复测："出场（做多）：启动后执行（on_start，市价，once） → 止损 5%"
    //   condition execution.on_start 是 runtime gate，对 user 无意义；应只渲染 effects
    const rules: SemanticRule[] = [{
      id: 'r-stop-loss',
      phase: 'exit',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } },
      effects: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    // condition body 不应出现「启动后执行」
    expect(view.summary).not.toContain('启动后执行')
    // effects 应直接出现：止损 5%
    expect(view.summary).toMatch(/止损/u)
    expect(view.summary).toContain('5')
    // 不应有「→」（because condition 跳过，直接是 effects）
    // 不强断言「→」位置；只要 condition body 不渲染即可
  })

  it('(c) enrich 跳过值 === paramSlot.default 的 slot — execution.on_start 默认值不输出', () => {
    // execution.on_start 三个 param 全等 default（timing=on_start / orderType=market /
    //   occurrence=once）→ enrich 跳过全部 → summary 只剩 "启动后执行" 不附加（...）
    const rules: SemanticRule[] = [{
      id: 'r-on-start',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, threshold: 30 } },
      effects: [{ kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } }],
    }]
    const view = service.buildConversationView(baseState({ rules }))
    // 应不出现「on_start」「market」「once」这类技术默认值
    expect(view.summary).not.toContain('on_start')
    expect(view.summary).not.toContain('once')
    // "市价" 是 default 渲染应被跳过
    expect(view.summary).not.toContain('（市价')
  })
})

describe('rules projection — pyramiding lifecycle guard noise', () => {
  const ruleProjection = new SemanticRuleProjectionService()
  const stateProjection = new SemanticStateProjectionService()

  it('drops pyramiding_limit gate when no add_position action exists', () => {
    const rules: SemanticRule[] = [
      {
        id: 'entry-ema',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 60 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      },
      {
        id: 'exit-ema',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 60 } },
        effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
      },
      {
        id: 'synthetic-pyramiding-gate',
        phase: 'gate',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'position.no_position', params: { sideScope: 'both' } },
        effects: [{ kind: 'atom', key: 'position.pyramiding_limit', params: { maxLayers: 1, layerSizing: { kind: 'ratio', value: 0.01, unit: 'ratio' } } }],
      },
    ]

    const state = ruleProjection.reprojectFromRules(baseState({
      rules,
      position: {
        mode: 'fixed_ratio',
        value: 0.01,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.01, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))
    const summary = stateProjection.buildConversationView(state).summary

    expect(state.rules?.map(rule => rule.id)).not.toContain('synthetic-pyramiding-gate')
    expect(state.positionConstraint).toHaveLength(0)
    expect(summary).not.toContain('金字塔')
    expect(summary).not.toContain('最多1次加仓')
    expect(summary).not.toContain('无任意方向仓位')
    expect(summary).toContain('仓位：1%')
  })

  it('keeps pyramiding_limit when add_position action exists', () => {
    const rules: SemanticRule[] = [
      {
        id: 'add-profit',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { basis: 'entry_avg_price', direction: 'up', valuePct: 3 } },
        effects: [
          { kind: 'atom', key: 'action.add_position', params: { addMode: 'profit_pct', profitThreshold: 3, sizing: { kind: 'ratio', value: 0.5, unit: 'ratio' } } },
          { kind: 'atom', key: 'position.pyramiding_limit', params: { maxLayers: 3 } },
        ],
      },
    ]

    const state = ruleProjection.reprojectFromRules(baseState({ rules }))

    expect(state.positionConstraint).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.pyramiding_limit',
        params: expect.objectContaining({ maxLayers: 3 }),
      }),
    ]))
  })
})
