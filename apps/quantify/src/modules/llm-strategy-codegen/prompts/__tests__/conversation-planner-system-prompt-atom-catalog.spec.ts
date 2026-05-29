/**
 * Issue #1345 PR1.2 — conversation-planner-system.prompt.ts catalog 注入断言
 *
 * 防止 prompt 退化为 #1345 之前的 "让 LLM 自由造 schema" 形态。
 */

import { getAllRegisteredAtomKeys, getAtomKeysByBucket } from '../../atom-contracts/atom-contract-registry'
import { resetAtomCatalogCacheForTest } from '../atom-catalog-projection'
import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

describe('conversationPlannerSystemPrompt — atom catalog injection (issue #1345)', () => {
  beforeEach(() => resetAtomCatalogCacheForTest())

  describe('zh locale', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')

    it('包含所有注册表 atom key（动态派生，不写死数量）', () => {
      for (const key of getAllRegisteredAtomKeys()) {
        expect(prompt).toContain(key)
      }
    })

    it('显式说明 condition / effects 叶子 atom key 必须从枚举选（issue #1395 表达式树）', () => {
      expect(prompt).toMatch(/condition \/ effects.*?枚举/s)
      expect(prompt).toContain('禁止自由文本或自创 atom')
    })

    it('显式列出 phase enum 为 entry / exit / gate / program', () => {
      expect(prompt).toMatch(/phase\s*∈\s*\[entry,\s*exit,\s*gate,\s*program\]/)
    })

    it('要求 contextSlots 是 { value, source } 形态', () => {
      expect(prompt).toContain('{ value, source }')
    })

    it('包含 5 类组合形态 in-context examples（issue #1395 表达式树）', () => {
      // 单叶子 / AND / OR / SEQUENCE / 嵌套多周期 AND，覆盖 AtomExpr 全部 5 种 kind 形态
      expect(prompt).toContain('【单叶子】')
      expect(prompt).toContain('【AND】')
      expect(prompt).toContain('【OR 出场】')
      expect(prompt).toContain('【SEQUENCE】')
      expect(prompt).toContain('【嵌套 + 多周期 AND】')
      // 表达式树叶子形态
      expect(prompt).toMatch(/"kind":\s*"atom"/)
    })

    it('包含动态 atom 总数（绝不写死，断言数值与注册表长度一致）', () => {
      const total = getAllRegisteredAtomKeys().length
      expect(prompt).toContain(`${total} 个原子枚举`)
    })

    it('grid.range_rebalance 不在 catalog 中宣告 phase=entry', () => {
      expect(prompt).toContain('grid.range_rebalance phase=program')
      expect(prompt).not.toContain('grid.range_rebalance phase=entry')
    })

    it('catalog labels use typed rules paths, not legacy flat paths', () => {
      expect(prompt).toContain('rules[].condition')
      expect(prompt).toContain('rules[].effects.actions')
      expect(prompt).toContain('effects.risks')
      expect(prompt).toContain('effects.positions')
      expect(prompt).toContain('effects.orchestration')
      expect(prompt).toContain('effects.programs')
      expect(prompt).not.toContain('triggers[].key')
      expect(prompt).not.toContain('actions[].key')
      expect(prompt).not.toContain('risk[].key')
    })

    it('保留 v1 原 25 行约束语句（零回退）', () => {
      expect(prompt).toContain('你是交易策略对话编排器')
      expect(prompt).toContain('只输出 JSON，不要 markdown')
      expect(prompt).toContain('不得覆盖当前消息未涉及的已锁定语义')
      expect(prompt).toContain('JSON 结构：')
    })

    it('exposes PR2 predicate atom keys in the planner catalog', () => {
      for (const key of [
        'indicator.slope',
        'pattern.pullback',
        'pattern.range',
        'volume.confirmation',
        'time.cooldown_window',
        'orderbook.imbalance',
        'fundingRate.condition',
        'openInterest.condition',
        'liquidation.condition',
      ]) {
        expect(prompt).toContain(key)
      }
    })

    it('exposes PR3 risk and position atom keys in the planner catalog', () => {
      for (const key of [
        'risk.stop_loss_pct',
        'risk.trailing_stop_pct',
        'risk.partial_take_profit',
        'risk.max_drawdown_pct',
        'risk.cooldown',
        'risk.max_loss_per_trade',
        'position.sizing',
        'position.pyramiding_limit',
        'position.dca_schedule',
        'position.budget_cap',
        'position.leverage',
        'position.max_exposure_pct',
      ]) {
        expect(prompt).toContain(key)
      }
    })
  })

  describe('en locale', () => {
    const prompt = buildConversationPlannerSystemPrompt('en')

    it('包含所有注册表 atom key（en locale 同样覆盖）', () => {
      for (const key of getAllRegisteredAtomKeys()) {
        expect(prompt).toContain(key)
      }
    })

    it('包含 en 语言规则尾注', () => {
      expect(prompt).toContain('assistantPrompt must be written in natural English')
      expect(prompt).toContain('Keep semanticPatch keys and enum values unchanged')
    })

    it('en 与 zh 内容不完全相同（至少 catalog 部分有 en bucket 标签差异）', () => {
      const zh = buildConversationPlannerSystemPrompt('zh')
      expect(prompt).not.toBe(zh)
    })
  })

  it('5 桶 atom 各至少 1 条 example（key 出现在 catalog 部分）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    const buckets = ['trigger', 'action', 'risk', 'positionConstraint', 'orchestration'] as const
    for (const bucket of buckets) {
      const keysInBucket = getAtomKeysByBucket(bucket)
      // 至少有 1 个 key 出现在 prompt 中（被 catalog 段渲染）
      expect(keysInBucket.some(k => prompt.includes(k))).toBe(true)
    }
  })

})
