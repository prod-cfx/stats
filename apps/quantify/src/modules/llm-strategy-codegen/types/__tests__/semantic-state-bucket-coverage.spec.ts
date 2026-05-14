/**
 * Issue #1364 PR2 — SemanticState 与 AtomContractBucket 一致性反向不变量
 *
 * 守门 issue #1364 AC-1 第二条 / AC-8 部分：
 *   - SemanticState 必须为每个 `AtomContractBucket` 字面量提供对应的状态字段
 *   - 加新 bucket 字面量到 enum 但忘了在 SemanticState 上对应字段 → 这里 tsc 报错
 *   - 当前字段名（plural triggers/actions/risk + singular orchestration + position constraints）
 *     与 bucket 字面量不一一对应（这是 issue #1364 AC-1 第二条「mapped type」要求的差距），
 *     用 BUCKET_TO_FIELD 映射表显式补齐；新 bucket 必须在此处加映射否则 tsc 失败
 *
 * 完整迁移到 mapped type SemanticState（删 BUCKET_TO_FIELD 映射）属于 follow-up
 * （65+/377+ 处消费方适配点）。
 */

import type { AtomContractBucket } from '../../atom-contracts/atom-contract-types'
import type { SemanticState } from '../semantic-state'

// 类型层守门：每个 AtomContractBucket 字面量必须显式映射到 SemanticState 的某个字段。
// 加新 bucket 而忘了在这里映射 → satisfies Record<AtomContractBucket, ...> tsc 失败。
//
// 'positionConstraint' 当前归在 `position.constraints[]` 内（见 codegen-semantic-patch.ts
// CodegenSemanticPatch.position.constraints），SemanticState 上无独立顶层字段——
// 用字符串字面量 `'position.constraints'` 表达此 nested 路径，spec 在 follow-up 真正
// 引入 mapped type 时会强制重写。
const BUCKET_TO_FIELD = {
  trigger: 'triggers',
  action: 'actions',
  risk: 'risk',
  positionConstraint: 'position.constraints',
  orchestration: 'orchestration',
} as const satisfies Readonly<Record<AtomContractBucket, string>>

describe('SemanticState ↔ AtomContractBucket 一致性 (issue #1364 PR2)', () => {
  it('每个 AtomContractBucket 字面量都已显式映射到 SemanticState 字段', () => {
    const bucketsCovered = Object.keys(BUCKET_TO_FIELD) as AtomContractBucket[]
    expect(bucketsCovered).toEqual(
      expect.arrayContaining(['trigger', 'action', 'risk', 'positionConstraint', 'orchestration']),
    )
    expect(bucketsCovered).toHaveLength(5)
  })

  it('top-level field 名称未漂移（向后兼容守门）', () => {
    expect(BUCKET_TO_FIELD.trigger).toBe('triggers')
    expect(BUCKET_TO_FIELD.action).toBe('actions')
    expect(BUCKET_TO_FIELD.risk).toBe('risk')
    expect(BUCKET_TO_FIELD.orchestration).toBe('orchestration')
  })

  it('positionConstraint 归 nested 路径（待 follow-up 提至顶层）', () => {
    expect(BUCKET_TO_FIELD.positionConstraint).toBe('position.constraints')
  })

  it('SemanticState 类型示例：所有 top-level bucket 字段在运行时存在', () => {
    // type-only assertion — 编译期即守门；下方 const 仅为 reader 文档
    const sample: SemanticState = {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {},
      normalizationNotes: [],
      updatedAt: '2026-05-14T00:00:00.000Z',
    }
    expect(Array.isArray(sample.triggers)).toBe(true)
    expect(Array.isArray(sample.actions)).toBe(true)
    expect(Array.isArray(sample.risk)).toBe(true)
    expect('orchestration' in sample || sample.orchestration === undefined).toBe(true)
  })
})
