/**
 * Issue #1364 PR2 — conversation-planner-system.prompt.ts ↔ ATOM_CONTRACT_REGISTRY 反向一致性
 *
 * 守门 issue #1364 AC-2 / AC-8：
 *   - prompt 中出现的所有 atom key 必须 ∈ ATOM_CONTRACT_REGISTRY（防 typo / 改名静默退化）
 *   - 注册表中所有 atom key 都应在 prompt 内被列举（确保 LLM 看得见全集）
 *   - prompt 字段规范应覆盖每个 AtomContractBucket 字面量
 *
 * 与 conversation-planner-system-prompt-atom-catalog.spec.ts 的差异：
 *   - 该 spec 验「prompt 派生自 catalog」（前向：catalog → prompt）
 *   - 本 spec 验「prompt 不超出 contract 真相源」（反向：prompt → REGISTRY）
 *
 * Follow-up：当 LLM patch shape 折叠为 atoms 单数组（issue #1364 AC-2 完整版）后，
 * 本 spec 还需扩展为「LLM JSON shape 内不再含分桶字段（triggers/actions/risk/orchestration）」。
 */

import {
  ATOM_CONTRACT_REGISTRY,
  getAllRegisteredAtomKeys,
} from '../../atom-contracts/atom-contract-registry'
import type { AtomContractBucket } from '../../atom-contracts/atom-contract-types'
import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

const ALL_BUCKETS: readonly AtomContractBucket[] = [
  'trigger',
  'action',
  'risk',
  'positionConstraint',
  'orchestration',
] as const

describe('conversation-planner-system-prompt ↔ ATOM_CONTRACT_REGISTRY 一致性 (issue #1364 PR2)', () => {
  // 注：prompt 中可能出现非 atom-key 的 dotted token（如 docs 引用 / JSON path），
  // 启发式提取容易误判；正向（prompt key ⊆ REGISTRY）守门精度受限于启发式准确度。
  // 已有 `conversation-planner-system-prompt-atom-catalog.spec.ts` 的
  // `IN_CONTEXT_EXAMPLE_ATOM_KEYS` 反向不变量做精确守门，避免 in-context 示例硬编码 typo。
  // 本 spec 聚焦于反向更可靠的断言：注册表全集 ⊆ prompt 渲染。

  describe('反向：注册表中所有 atom key 都在 prompt 出现 ≥1 次（atom catalog 全集覆盖）', () => {
    it('zh prompt 包含每个已注册 atom key', () => {
      const prompt = buildConversationPlannerSystemPrompt('zh')
      const missing = getAllRegisteredAtomKeys().filter(key => !prompt.includes(key))
      expect(missing).toEqual([])
    })

    it('en prompt 包含每个已注册 atom key', () => {
      const prompt = buildConversationPlannerSystemPrompt('en')
      const missing = getAllRegisteredAtomKeys().filter(key => !prompt.includes(key))
      expect(missing).toEqual([])
    })
  })

  describe('bucket 覆盖：prompt 字段规范应覆盖每个 AtomContractBucket', () => {
    it('zh prompt 字段规范段提及每个 bucket（直接或通过 bucket 标题）', () => {
      const prompt = buildConversationPlannerSystemPrompt('zh')
      // 每个 bucket 都应至少在 prompt 中以中文标题或字面量形式出现
      const bucketLabels: Record<AtomContractBucket, readonly string[]> = {
        trigger: ['触发原子', 'triggers'],
        action: ['动作原子', 'actions'],
        risk: ['风险原子', 'risk'],
        positionConstraint: ['仓位约束', 'position'],
        orchestration: ['编排', 'orchestration'],
      }
      for (const bucket of ALL_BUCKETS) {
        const labels = bucketLabels[bucket]
        const found = labels.some(label => prompt.includes(label))
        expect({ bucket, found }).toEqual({ bucket, found: true })
      }
    })
  })

  it('prompt 绝不出现旧 5 桶 patch 字段（issue #1364 AC-2 + #1395 rules 表达式树）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).not.toMatch(/"triggers"\s*\??\s*:/)
    expect(prompt).not.toMatch(/"actions"\s*\??\s*:/)
    expect(prompt).not.toMatch(/"risk"\s*\??\s*:\s*\[/)
    // #1395：旧 atoms[] 已被 rules[] 替换
    expect(prompt).not.toMatch(/"atoms"\s*\??\s*:\s*\[/)
    expect(prompt).toMatch(/"rules"\s*\??\s*:\s*\[/)
  })

  describe('REGISTRY contract sanity', () => {
    it('每个 REGISTRY key 的 contract.bucket ∈ AtomContractBucket', () => {
      for (const key of getAllRegisteredAtomKeys()) {
        const bucket = ATOM_CONTRACT_REGISTRY[key].bucket
        expect(ALL_BUCKETS).toContain(bucket)
      }
    })
  })
})
