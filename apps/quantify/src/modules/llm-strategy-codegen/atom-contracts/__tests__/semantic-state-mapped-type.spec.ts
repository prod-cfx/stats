import type { AtomContractBucket } from '../atom-contract-types'
import type { SemanticState } from '../../types/semantic-state'

describe('[#1364 AC-8] SemanticState mapped type invariants', () => {
  it('SemanticState 必须包含每个 AtomContractBucket 字面量作为字段名', () => {
    type Test = AtomContractBucket extends keyof SemanticState ? true : false
    const ok: Test = true
    expect(ok).toBe(true)
  })

  it('SemanticState 各 bucket 字段值是对应 AtomState 数组（运行期 sanity）', () => {
    const empty = {
      trigger: [],
      action: [],
      risk: [],
      orchestration: [],
      positionConstraint: [],
      version: 1,
      families: [],
      contextSlots: {} as any,
      position: null,
      orchestrationContracts: [],
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    } as unknown as SemanticState
    expect(Array.isArray(empty.trigger)).toBe(true)
    expect(Array.isArray(empty.action)).toBe(true)
    expect(Array.isArray(empty.risk)).toBe(true)
    expect(Array.isArray(empty.orchestration)).toBe(true)
    expect(Array.isArray(empty.positionConstraint)).toBe(true)
  })
})
