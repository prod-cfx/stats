/**
 * Issue #1395 — rules-first summary 渲染契约
 *
 * 验证 SemanticStateProjectionService 在 state.rules 非空时，从 AtomExpr 树
 * 递归渲染自然中文，保留 sequence / AND / OR / NOT 语义，不被 lift 出来的扁平桶
 * 打散。空 rules 不回落旧扁平桶主流程。
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

  it('detects recommendation intent from namespaced action atom keys', () => {
    const signals = (service as unknown as {
      buildRecommendationSignals(input: {
        actions: SemanticState['action']
        triggers: SemanticState['trigger']
        families: SemanticState['families']
      }): {
        hasLongIntent: boolean
        hasShortIntent: boolean
        hasBidirectionalIntent: boolean
        hasGridIntent: boolean
      }
    }).buildRecommendationSignals({
      actions: [
        {
          id: 'action-open-long',
          key: 'action.open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        } as SemanticState['action'][number],
      ],
      triggers: [],
      families: [],
    })

    expect(signals.hasLongIntent).toBe(true)
    expect(signals.hasShortIntent).toBe(false)
  })

  it('keeps recommendation intent compatibility for legacy bare and reduce action keys', () => {
    const signals = (service as unknown as {
      buildRecommendationSignals(input: {
        actions: SemanticState['action']
        triggers: SemanticState['trigger']
        families: SemanticState['families']
      }): {
        hasLongIntent: boolean
        hasShortIntent: boolean
        hasBidirectionalIntent: boolean
        hasGridIntent: boolean
      }
    }).buildRecommendationSignals({
      actions: [
        {
          id: 'action-open-long',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        } as SemanticState['action'][number],
        {
          id: 'action-reduce-short',
          key: 'reduce_short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        } as SemanticState['action'][number],
      ],
      triggers: [],
      families: [],
    })

    expect(signals.hasLongIntent).toBe(true)
    expect(signals.hasShortIntent).toBe(true)
    expect(signals.hasBidirectionalIntent).toBe(true)
  })

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

  it('rules 为空 → 不走旧扁平桶主流程 fallback', () => {
    // 仅 trigger 非空，rules 显式为空
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
    const state = baseState({ rules: [], trigger: [trigger] })
    const view = service.buildConversationView(state)
    expect(view.summary).toBe('已识别部分条件，但仍未完整。')
    expect(view.summary).not.toContain('1.5')
    expect(view.summary).not.toContain('均量')
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

  it('renders condition.expression and position.per_order_budget without internal-key fallback', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-expression-budget',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'condition.expression',
        params: {
          expression: {
            kind: 'predicate',
            left: { kind: 'series', source: 'bar', field: 'close' },
            op: 'GT',
            right: { kind: 'indicator', name: 'ema', params: { period: 20 }, output: 'value' },
          },
        },
      },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [],
        positions: [{ kind: 'atom', key: 'position.per_order_budget', params: { value: 10, asset: 'USDT' } }],
        orchestration: [],
        programs: [],
      },
    }]
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const view = service.buildConversationView(baseState({ rules }))
      expect(view.summary).toContain('收盘价高于EMA20')
      expect(view.summary).toContain('单笔仓位 10 USDT')
      expect(view.summary).not.toContain('condition.expression')
      expect(view.summary).not.toContain('position.per_order_budget')
      expect(view.summary).not.toContain('已识别条件，参数待补充')
      expect(warnSpy).not.toHaveBeenCalled()
    }
    finally {
      warnSpy.mockRestore()
    }
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

    it('rules 为空 → displayLogicGraph 不走 flat trigger 主流程 fallback', () => {
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
      expect(conditionBlocks).toHaveLength(0)
      expect(JSON.stringify(graph)).not.toContain('macd.golden_cross')
      expect(JSON.stringify(graph)).not.toContain('open_long')
    })

    // staging 30 策略复测发现：两条 phase=exit 的 rule 在 dedupeRulesBySignature
    //   签名上有微差（id 不同 + leaf 局部差异）但语义等价（同一退场条件 + 同一动作），
    //   被透传到 projection 后 UI 渲染出两个重复 IF 出场块（见 issue 截图 1）。
    //   buildDisplayLogicGraph 应基于「phase + 渲染后的 conditionText + 排序后的
    //   actionText 集合」做兜底去重，保证 UI 不出现重复的出场提示。
    it('两条语义等价的 exit rule（leaf 微差）→ displayLogicGraph 仅渲染一个出场块', () => {
      const exitRuleA: SemanticRule = {
        id: 'exit-ema20-a',
        phase: 'exit',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'price.below_ma',
          params: { maType: 'ema', period: 20 },
        },
        effects: [
          { kind: 'atom', key: 'action.close_long', params: {} },
        ],
      }
      const exitRuleB: SemanticRule = {
        ...exitRuleA,
        id: 'exit-ema20-b',
        // 故意保留 evidence 微差 —— 之前的 dedupeRulesBySignature 会因此放过
        evidence: { text: '价格低于 EMA20 时平多', source: 'dispatcher' },
      } as SemanticRule
      const graph = service.buildDisplayLogicGraph(baseState({ rules: [exitRuleA, exitRuleB] }))
      const exitBlocks = graph.blocks.filter(b => b.type === 'IF')
      expect(exitBlocks).toHaveLength(1)
      // 契约：保留 eligible 中首次出现的 A（顺序契约）
      expect(exitBlocks[0].id).toBe('exit-ema20-a')
      // 内容契约：渲染出的 condition 与 action 必须含 EMA20 / 平多 语义，
      //   而不是 dedupe 把内容也吞掉留个空壳块
      const blockText = exitBlocks[0].items.map(item => item.text).join(' ')
      expect(blockText).toMatch(/EMA/)
      expect(blockText).toContain('平多')
    })

    // 反向用例：phase 同为 exit、condition 真不同 → 必须保留两个 block
    it('两条 exit rule 条件不同 → 保留两个 IF block', () => {
      const exitClose: SemanticRule = {
        id: 'exit-below-ema20',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.below_ma', params: { maType: 'ema', period: 20 } },
        effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
      }
      const exitStop: SemanticRule = {
        id: 'exit-above-ema60',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.above_ma', params: { maType: 'ema', period: 60 } },
        effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
      }
      const graph = service.buildDisplayLogicGraph(baseState({ rules: [exitClose, exitStop] }))
      const exitBlocks = graph.blocks.filter(b => b.type === 'IF')
      expect(exitBlocks).toHaveLength(2)
      expect(exitBlocks.map(b => b.id).sort()).toEqual(['exit-above-ema60', 'exit-below-ema20'])
    })

    // 反向用例：phase 不同且 effects 不同 → 必须保留两个 block
    //   （注：纯净隔离 phase 维度的最小反例难构造——entry/exit 的 actionSuffix
    //   `buildRuleActionSuffix` 与 effects 都会引入差异；此 spec 实际同时测
    //   conditionText 副作用 + effects + phase 三维度，命名已更新避免误导）
    it('phase 不同且 effects 不同 → 保留两个 IF block', () => {
      const entryRule: SemanticRule = {
        id: 'entry-cross-ema',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.above_ma', params: { maType: 'ema', period: 20 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }
      const exitRule: SemanticRule = {
        id: 'exit-cross-ema',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.above_ma', params: { maType: 'ema', period: 20 } },
        effects: [{ kind: 'atom', key: 'action.close_short', params: {} }],
      }
      const graph = service.buildDisplayLogicGraph(baseState({ rules: [entryRule, exitRule] }))
      const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
      expect(ifBlocks).toHaveLength(2)
    })

    // 配套 n1（PR #1694 第 2 轮）：condition-only（无 effects）的两条等价 rule
    //   仍应被显示层去重；防止「actionItems 为空时跳过 dedupe」回归。
    it('两条 condition-only rule 完全等价 → 仅渲染一个 IF block', () => {
      const ruleA: SemanticRule = {
        id: 'condition-only-a',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.above_ma', params: { maType: 'ema', period: 20 } },
        effects: [],
      }
      const ruleB: SemanticRule = {
        ...ruleA,
        id: 'condition-only-b',
      }
      const graph = service.buildDisplayLogicGraph(baseState({ rules: [ruleA, ruleB] }))
      const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
      expect(ifBlocks).toHaveLength(1)
      expect(ifBlocks[0].id).toBe('condition-only-a')
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

  it('filters always-on action noise rules from display graph fallback path', () => {
    const rules: SemanticRule[] = [{
      id: 'r-on-start-open',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const state = baseState({
      rules,
      trigger: [{
        id: 'trigger-on-start',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
      } as SemanticState['trigger'][number]],
      action: [{
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      } as SemanticState['action'][number],
      ],
    })
    const graph = service.buildDisplayLogicGraph(state)
    const view = service.buildConversationView(state)
    const serialized = JSON.stringify(graph)

    expect(serialized).not.toContain('启动后执行')
    expect(serialized).not.toContain('开多')
    expect(view.summary).not.toContain('启动后执行')
    expect(view.summary).not.toContain('开多')
  })

  it('keeps non-action effects when sanitizing always-on action noise rules', () => {
    const rules: SemanticRule[] = [{
      id: 'r-on-start-open-with-risk',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
        positions: [],
        orchestration: [],
        programs: [],
      },
    }]
    const view = service.buildConversationView(baseState({ rules }))

    expect(view.summary).not.toContain('开多')
    expect(view.summary).toMatch(/止损/u)
    expect(view.summary).toContain('5')
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

// PR #1691 hard-deleted `SemanticRuleProjectionService`，原本依赖该 service
// 的 `rules projection — pyramiding lifecycle guard noise` describe 整段失效，
// 连带阻塞同文件 spec 加载（编译期 `Cannot find module ../semantic-rule-projection.service`）。
// 这里删除已死的 describe，让本文件其余 spec 与本 PR 新增 dedupe case 真正可执行。
// 配套 follow-up Issue #1696：补全 #1691 后置清理，迁移这两条断言到新的
// rules-only 主流程 spec（同时收 9 个同根因 spec 的清理）。
