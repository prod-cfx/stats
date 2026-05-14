/**
 * Issue #1345 PR1.2 — conversation-planner-system.prompt.ts catalog 注入断言
 *
 * 防止 prompt 退化为 #1345 之前的 "让 LLM 自由造 schema" 形态。
 */

import { ATOM_BUCKETS } from '../../atom-contracts/atom-contract-registry'
import { resetAtomCatalogCacheForTest } from '../atom-catalog-projection'
import { buildConversationPlannerSystemPrompt, IN_CONTEXT_EXAMPLE_ATOM_KEYS } from '../conversation-planner-system.prompt'

describe('conversationPlannerSystemPrompt — atom catalog injection (issue #1345)', () => {
  beforeEach(() => resetAtomCatalogCacheForTest())

  describe('zh locale', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')

    it('包含所有 ATOM_BUCKETS 注册的 atom key（动态派生，不写死数量）', () => {
      for (const key of Object.keys(ATOM_BUCKETS)) {
        expect(prompt).toContain(key)
      }
    })

    it('显式说明 triggers[].key / actions[].key / risk[].key 必须从枚举选', () => {
      expect(prompt).toMatch(/triggers\[\]\.key.*?actions\[\]\.key.*?risk\[\]\.key.*?枚举/s)
      expect(prompt).toContain('禁止自由文本或自创 atom')
    })

    it('显式列出 phase enum 为 entry / exit / gate（不含 risk）', () => {
      expect(prompt).toMatch(/phase\s*∈\s*\[entry,\s*exit,\s*gate\]/)
      expect(prompt).toContain("不含 'risk'")
    })

    it('要求 contextSlots 是结构化 { value, source } 而非裸字符串', () => {
      expect(prompt).toContain('结构化对象 { value, source }')
    })

    it('包含 5 桶各 1 条 in-context example（trigger/action/risk/orchestration/positionConstraint）', () => {
      expect(prompt).toContain('示例 1（trigger）')
      expect(prompt).toContain('indicator.cross_over')
      expect(prompt).toContain('示例 2（action）')
      expect(prompt).toContain('action.open_long')
      expect(prompt).toContain('示例 3（risk）')
      expect(prompt).toContain('risk.partial_take_profit')
      expect(prompt).toContain('示例 4（orchestration / portfolioRisk）')
      expect(prompt).toContain('portfolioRisk.drawdown_block')
      expect(prompt).toContain('示例 5（positionConstraint）')
      expect(prompt).toContain('position.pyramiding_limit')
    })

    it('包含动态 atom 总数（绝不写死，断言数值与 ATOM_BUCKETS 长度一致）', () => {
      const total = Object.keys(ATOM_BUCKETS).length
      expect(prompt).toContain(`${total} 个原子枚举`)
    })

    it('保留 v1 原 25 行约束语句（零回退）', () => {
      expect(prompt).toContain('你是交易策略对话编排器')
      expect(prompt).toContain('只输出 JSON，不要 markdown')
      expect(prompt).toContain('不得覆盖当前消息未涉及的已锁定语义')
      expect(prompt).toContain('JSON 结构：')
    })
  })

  describe('en locale', () => {
    const prompt = buildConversationPlannerSystemPrompt('en')

    it('包含所有 ATOM_BUCKETS 注册的 atom key（en locale 同样覆盖）', () => {
      for (const key of Object.keys(ATOM_BUCKETS)) {
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
      const keysInBucket = Object.entries(ATOM_BUCKETS)
        .filter(([, b]) => b === bucket)
        .map(([k]) => k)
      // 至少有 1 个 key 出现在 prompt 中（被 catalog 段渲染）
      expect(keysInBucket.some(k => prompt.includes(k))).toBe(true)
    }
  })

  it('In-context 示例段使用的 atom key 全部 ∈ ATOM_BUCKETS（防 atom 重命名静默退化）', () => {
    // review m3 follow-up：5 条 in-context 示例硬编码 atom key，必须由反向不变量守门
    for (const key of IN_CONTEXT_EXAMPLE_ATOM_KEYS) {
      expect(Object.keys(ATOM_BUCKETS)).toContain(key)
    }
  })
})
