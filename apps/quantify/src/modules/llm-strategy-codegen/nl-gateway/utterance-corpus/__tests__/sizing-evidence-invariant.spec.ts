import { ATOM_CONTRACT_REGISTRY } from '../../../atom-contracts/atom-contract-registry'
import type { AtomContract } from '../../../atom-contracts/atom-contract-types'
import {
  SIZING_BEARING_ATOMS,
  assertSizingEvidenceRegistered,
} from '../sizing-evidence-invariant'

describe('INVARIANT-J: Sizing evidence registration', () => {
  // ── 基础不变式 ──────────────────────────────────────────────────────────────

  it('整个 registry 满足 INVARIANT-J：non-actionable atom 不携带 sizingEvidence', () => {
    expect(() => assertSizingEvidenceRegistered()).not.toThrow()
  })

  // ── SIZING_BEARING_ATOMS 派生正确 ───────────────────────────────────────────

  it('SIZING_BEARING_ATOMS 包含 position.dca_schedule', () => {
    expect(SIZING_BEARING_ATOMS.has('position.dca_schedule')).toBe(true)
  })

  it('SIZING_BEARING_ATOMS 包含 position.pyramiding_limit', () => {
    expect(SIZING_BEARING_ATOMS.has('position.pyramiding_limit')).toBe(true)
  })

  it('SIZING_BEARING_ATOMS 包含 grid.range_rebalance', () => {
    expect(SIZING_BEARING_ATOMS.has('grid.range_rebalance')).toBe(true)
  })

  it('SIZING_BEARING_ATOMS 与 registry sizingEvidence 非空集合完全一致', () => {
    const fromRegistry = new Set(
      Object.entries(ATOM_CONTRACT_REGISTRY)
        .filter(([, c]) => c.sizingEvidence !== null)
        .map(([k]) => k),
    )
    expect(new Set(SIZING_BEARING_ATOMS)).toEqual(fromRegistry)
  })

  // ── sizingEvidence 内容验证 ─────────────────────────────────────────────────

  it('position.dca_schedule sizingEvidence 指向 capital.allocate.per_order_budget + perOrderSizing', () => {
    const evidence = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].sizingEvidence
    expect(evidence).not.toBeNull()
    expect(evidence?.capability).toEqual({ domain: 'capital', verb: 'allocate', object: 'per_order_budget' })
    expect(evidence?.paramSource).toBe('perOrderSizing')
  })

  it('position.pyramiding_limit sizingEvidence 指向 capital.allocate.per_order_budget + layerSizing', () => {
    const evidence = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].sizingEvidence
    expect(evidence).not.toBeNull()
    expect(evidence?.capability).toEqual({ domain: 'capital', verb: 'allocate', object: 'per_order_budget' })
    expect(evidence?.paramSource).toBe('layerSizing')
  })

  it('grid.range_rebalance sizingEvidence 指向 capital.allocate.per_order_budget + perGridSizing', () => {
    const evidence = ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].sizingEvidence
    expect(evidence).not.toBeNull()
    expect(evidence?.capability).toEqual({ domain: 'capital', verb: 'allocate', object: 'per_order_budget' })
    expect(evidence?.paramSource).toBe('perGridSizing')
  })

  // ── isActionable 标记验证 ───────────────────────────────────────────────────

  it('actionable atom 携带 sizingEvidence 合法（position.dca_schedule）', () => {
    const contract = ATOM_CONTRACT_REGISTRY['position.dca_schedule']
    expect(contract.isActionable).toBe(true)
    expect(contract.sizingEvidence).not.toBeNull()
  })

  it('actionable atom 不携带 sizingEvidence 也合法（action.add_position）', () => {
    const contract = ATOM_CONTRACT_REGISTRY['action.add_position']
    expect(contract.isActionable).toBe(true)
    expect(contract.sizingEvidence).toBeNull()
    // 整体不变式仍通过（actionable 无 sizingEvidence 不违反）
    expect(() => assertSizingEvidenceRegistered()).not.toThrow()
  })

  it('non-actionable atom 携带 sizingEvidence 触发 INVARIANT-J throw', () => {
    // 临时把 non-actionable atom 的 sizingEvidence 改为非空，验证守门函数抛出
    const entry = ATOM_CONTRACT_REGISTRY['volume.threshold'] as AtomContract & {
      sizingEvidence: AtomContract['sizingEvidence']
    }
    const original = entry.sizingEvidence
    try {
      ;(entry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = {
        capability: { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
        paramSource: 'test',
      }
      expect(() => assertSizingEvidenceRegistered()).toThrow(/INVARIANT-J violated/)
    } finally {
      ;(entry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = original
    }
  })

  // ── 历史兼容：故意破坏 actionable atom 的 registry，守门函数不应因此 throw ──

  it('actionable atom sizingEvidence 置 null 不触发 INVARIANT-J throw', () => {
    const entry = ATOM_CONTRACT_REGISTRY['position.dca_schedule'] as AtomContract & {
      sizingEvidence: AtomContract['sizingEvidence']
    }
    const original = entry.sizingEvidence
    try {
      ;(entry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = null
      // isActionable=true + sizingEvidence=null 是合法状态，不应 throw
      expect(() => assertSizingEvidenceRegistered()).not.toThrow()
    } finally {
      ;(entry as { sizingEvidence: AtomContract['sizingEvidence'] }).sizingEvidence = original
    }
  })
})
