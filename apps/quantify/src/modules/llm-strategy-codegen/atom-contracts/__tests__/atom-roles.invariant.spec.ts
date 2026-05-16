/**
 * Issue #1395 — atom roles 反向不变量
 *
 * 保证 ATOM_CONTRACT_REGISTRY 中每个 atom 的 roles 字段：
 *   1) 非空、每项为合法值（'predicate' | 'effect'）
 *   2) trigger bucket 含 predicate
 *   3) action / positionConstraint bucket = ['effect']
 *   4) risk bucket 至少含一个 role
 */
import { ATOM_CONTRACT_REGISTRY, getAllRegisteredAtomKeys } from '../atom-contract-registry'

describe('atom roles invariant (Issue #1395)', () => {
  const keys = getAllRegisteredAtomKeys()

  it.each(keys)('atom %s declares non-empty roles', (key) => {
    const c = ATOM_CONTRACT_REGISTRY[key]!
    expect(c.roles).toBeDefined()
    expect(c.roles.length).toBeGreaterThan(0)
    for (const r of c.roles) {
      expect(['predicate', 'effect']).toContain(r)
    }
  })

  it('trigger bucket atoms have predicate role', () => {
    const triggers = keys.filter(k => ATOM_CONTRACT_REGISTRY[k]!.bucket === 'trigger')
    expect(triggers.length).toBeGreaterThan(0)
    for (const k of triggers) {
      expect(ATOM_CONTRACT_REGISTRY[k]!.roles).toContain('predicate')
    }
  })

  it('action bucket atoms have effect role only', () => {
    const actions = keys.filter(k => ATOM_CONTRACT_REGISTRY[k]!.bucket === 'action')
    for (const k of actions) {
      expect(ATOM_CONTRACT_REGISTRY[k]!.roles).toEqual(['effect'])
    }
  })

  it('positionConstraint bucket atoms have effect role only', () => {
    const pcs = keys.filter(k => ATOM_CONTRACT_REGISTRY[k]!.bucket === 'positionConstraint')
    for (const k of pcs) {
      expect(ATOM_CONTRACT_REGISTRY[k]!.roles).toEqual(['effect'])
    }
  })

  it('risk bucket atoms have at least one role', () => {
    const risks = keys.filter(k => ATOM_CONTRACT_REGISTRY[k]!.bucket === 'risk')
    for (const k of risks) {
      const roles = ATOM_CONTRACT_REGISTRY[k]!.roles
      expect(roles.length).toBeGreaterThan(0)
      for (const r of roles) {
        expect(['predicate', 'effect']).toContain(r)
      }
    }
  })
})
