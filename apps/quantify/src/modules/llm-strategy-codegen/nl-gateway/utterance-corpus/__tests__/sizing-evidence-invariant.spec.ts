import { ATOM_CONTRACT_REGISTRY } from '../../../atom-contracts/atom-contract-registry'
import type { AtomContract } from '../../../atom-contracts/atom-contract-types'
import {
  SIZING_BEARING_ATOMS,
  assertSizingEvidenceRegistered,
} from '../sizing-evidence-invariant'

describe('INVARIANT-J: Sizing evidence registration', () => {
  it('SIZING_BEARING_ATOMS 内 atom 均在 ATOM_CONTRACT_REGISTRY 声明非空 sizingEvidence', () => {
    expect(() => assertSizingEvidenceRegistered()).not.toThrow()
  })

  it('position.dca_schedule sizingEvidence 指向 capital.allocate.per_order_budget + perOrderSizing 参数源', () => {
    const evidence = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].sizingEvidence
    expect(evidence).not.toBeNull()
    expect(evidence?.capability).toEqual({
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
    })
    expect(evidence?.paramSource).toBe('perOrderSizing')
  })

  it('故意破坏 ATOM_CONTRACT_REGISTRY 触发 assertSizingEvidenceRegistered 真函数 throw', () => {
    // 临时把生产 registry 的 DCA sizingEvidence 改 null，调真守门函数，验证 throw
    const dcaEntry = ATOM_CONTRACT_REGISTRY['position.dca_schedule'] as AtomContract & {
      sizingEvidence: AtomContract['sizingEvidence']
    }
    const original = dcaEntry.sizingEvidence
    try {
      // 直接 mutate 验证运行期守门生产函数（非本地副本）
      ;(dcaEntry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = null
      expect(() => assertSizingEvidenceRegistered()).toThrow(/INVARIANT-J violated/)
    }
    finally {
      // 恢复，避免污染其它 spec
      ;(dcaEntry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = original
    }
  })

  it('SIZING_BEARING_ATOMS 当前包含 position.dca_schedule', () => {
    expect(SIZING_BEARING_ATOMS.has('position.dca_schedule')).toBe(true)
  })

  // Issue #1191：pyramiding sizing-evidence emit 已上线，加入白名单
  it('position.pyramiding_limit sizingEvidence 指向 capital.allocate.per_order_budget + layerSizing 参数源', () => {
    const evidence = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].sizingEvidence
    expect(evidence).not.toBeNull()
    expect(evidence?.capability).toEqual({
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
    })
    expect(evidence?.paramSource).toBe('layerSizing')
  })

  it('SIZING_BEARING_ATOMS 包含 position.pyramiding_limit', () => {
    expect(SIZING_BEARING_ATOMS.has('position.pyramiding_limit')).toBe(true)
  })
})
