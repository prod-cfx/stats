/**
 * Issue #1495 — buildDisplayLogicGraph 必须从 rules tree 派生
 *
 * 锁定：含 AND / OR / SEQUENCE 组合的单条 rule 必须产出 **单个 IF block**，
 * 条件文本里完整呈现 AND / OR / SEQUENCE 语义。绝不允许把 N 叶子 rule 拆成
 * N 个独立 IF block（旧 flat-lift 路径的退化形态，会让用户误以为是多条 OR 规则）。
 *
 * 对应 PR body 验收锚定 #19 / #21 / #24（rules tree 不被 flat 拆散）。
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
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  }
}

describe('#1495 buildDisplayLogicGraph — rules tree 不被 flat 拆散', () => {
  const service = new SemanticStateProjectionService()

  it('AND 2 个 atom 叶子 → 单个 IF block + 单条 condition item（保留 AND 语义）', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-and',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2, confirmationMode: 'touch' } },
          { kind: 'atom', key: 'volume.threshold', params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
    expect(ifBlocks).toHaveLength(1)
    const conditionItems = ifBlocks[0]!.items.filter(item => item.kind === 'condition')
    // AND 不能被拆成 2 条独立 condition item；单条 condition 文本里携带「同时」等连接词
    expect(conditionItems).toHaveLength(1)
    expect(conditionItems[0]!.text).toMatch(/同时|且|与/u)
  })

  it('OR 2 个 atom 叶子 → 单个 IF block + 单条 condition item（保留 OR 语义）', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-or',
      phase: 'entry',
      sideScope: 'short',
      condition: {
        kind: 'or',
        children: [
          { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, value: 70 } },
          { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2, confirmationMode: 'touch' } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_short', params: {} }],
    }]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
    expect(ifBlocks).toHaveLength(1)
    const conditionItems = ifBlocks[0]!.items.filter(item => item.kind === 'condition')
    expect(conditionItems).toHaveLength(1)
    // OR 渲染含「或」连接词
    expect(conditionItems[0]!.text).toMatch(/或/u)
  })

  it('SEQUENCE 2 步骤 → 单个 IF block + 单条 condition item（保留 "先...然后..." 语义）', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-seq',
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
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
    expect(ifBlocks).toHaveLength(1)
    const conditionItems = ifBlocks[0]!.items.filter(item => item.kind === 'condition')
    expect(conditionItems).toHaveLength(1)
    expect(conditionItems[0]!.text).toMatch(/先\s/u)
    expect(conditionItems[0]!.text).toMatch(/然后\s/u)
  })

  it('renders EMA20 above from nested reference period in rules tree graph', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-ema20-graph',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.above',
        params: { indicator: 'ema', reference: { period: 20 }, timeframe: '15m' },
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const allText = graph.blocks.flatMap(block => block.items).map(item => item.text).join('\n')
    expect(allText).toContain('EMA20')
    expect(allText).toContain('15m')
    expect(allText).not.toContain('指标高于阈值')
  })

  it('renders rolling channel breakout high/low references in rules tree graph', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-channel-breakout-graph',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'price.breakout_up', params: { period: 24, reference: 'channel_high' } },
          { kind: 'atom', key: 'price.breakout_down', params: { period: 24, reference: 'channel_low' } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const allText = graph.blocks.flatMap(block => block.items).map(item => item.text).join('\n')
    expect(allText).toMatch(/滚动|过去|最近|前/u)
    expect(allText).toContain('24')
    expect(allText).toContain('高点')
    expect(allText).toContain('低点')
    expect(allText).not.toContain('向上突破（24，0%）')
  })

  // Issue #1495-M3: 嵌套组合 AND(OR(a, b), c) 边界覆盖
  it('嵌套 AND(OR(a, b), c) → 单个 IF block + 单条 condition item，文本含 OR + AND 双连接词', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-nested',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          {
            kind: 'or',
            children: [
              { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, value: 30 } },
              { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2, confirmationMode: 'touch' } },
            ],
          },
          { kind: 'atom', key: 'volume.threshold', params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20 } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
    expect(ifBlocks).toHaveLength(1)
    const conditionItems = ifBlocks[0]!.items.filter(item => item.kind === 'condition')
    // 不能被拆成多条独立 condition
    expect(conditionItems).toHaveLength(1)
    // 嵌套语义须同时携带 OR 连接词与 AND 连接词
    expect(conditionItems[0]!.text).toMatch(/或/u)
    expect(conditionItems[0]!.text).toMatch(/同时|且|与/u)
  })

  // Issue #1495-M3: atom 缺 publicName fallback 渲染（走「该条件」兜底，不漏 atom key）
  it('atom 缺 publicName 时 displayLogicGraph 渲染走「该条件」兜底，不漏 atom key', () => {
    // mutate registry：临时把某 atom 的 publicName 清空，触发 fallback 链
    const { ATOM_CONTRACT_REGISTRY } = require('../../atom-contracts/atom-contract-registry') as { ATOM_CONTRACT_REGISTRY: Record<string, { display: { publicName: { zh?: string, en?: string } } }> }
    const targetAtomKey = 'oscillator.rsi_lte'
    const original = { ...ATOM_CONTRACT_REGISTRY[targetAtomKey]!.display.publicName }
    ATOM_CONTRACT_REGISTRY[targetAtomKey]!.display.publicName = { zh: '', en: '' }
    try {
      const rules: SemanticRule[] = [{
        id: 'rule-missing-publicname',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: targetAtomKey, params: { period: 14, value: 30 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }]
      const graph = service.buildDisplayLogicGraph(baseState({ rules }))
      const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
      expect(ifBlocks).toHaveLength(1)
      const conditionItems = ifBlocks[0]!.items.filter(item => item.kind === 'condition')
      expect(conditionItems).toHaveLength(1)
      // 关键不变量：不能把 internal atom key（dotted lowercase identifier）漏到 user-visible 文案
      expect(conditionItems[0]!.text).not.toContain(targetAtomKey)
    }
    finally {
      ATOM_CONTRACT_REGISTRY[targetAtomKey]!.display.publicName = original
    }
  })

  it('多条独立 rule 各自 1 个 IF block（rules 之间不是 AND/OR，互不合并）', () => {
    const rules: SemanticRule[] = [
      {
        id: 'rule-1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, value: 30 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      },
      {
        id: 'rule-2',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, value: 70 } },
        effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
      },
    ]
    const graph = service.buildDisplayLogicGraph(baseState({ rules }))
    const ifBlocks = graph.blocks.filter(b => b.type === 'IF')
    expect(ifBlocks).toHaveLength(2)
  })

  it('does not render flat-only action when rules omit it', () => {
    const state: SemanticState = {
      version: 1,
      families: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      trigger: [],
      action: [{
        id: 'flat-action',
        key: 'action.open_long',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
      }],
      risk: [],
      positionConstraint: [],
      orchestration: [],
      position: null,
      orchestrationContracts: [],
      normalizationNotes: [],
      updatedAt: new Date(0).toISOString(),
      rules: [{
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.breakout_up', params: {} },
        effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
      }],
    }

    const graph = service.buildDisplayLogicGraphFromSemanticState(state)

    expect(JSON.stringify(graph)).toContain('rules[0].condition')
    expect(JSON.stringify(graph)).not.toContain('flat-action')
    expect(JSON.stringify(graph)).not.toContain('action.open_long')
  })
})
