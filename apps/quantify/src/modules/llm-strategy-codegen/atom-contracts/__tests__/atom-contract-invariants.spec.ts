import type { AtomContractInvariantReport } from '../atom-contract-invariants'
import { ATOM_CONTRACT_REGISTRY, getAllRegisteredAtomKeys } from '../atom-contract-registry'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../../constants/canonical-strategy-capabilities'

type AssertTrue<T extends true> = T
type _AllInvariantsHold = AssertTrue<
  AtomContractInvariantReport[keyof AtomContractInvariantReport] extends true ? true : false
>

void (0 as unknown as _AllInvariantsHold)

describe('ATOM_CONTRACT_REGISTRY type-level invariants', () => {
  it('keeps runtime registry shape aligned with PR1b invariant expectations', () => {
    // #1364 PR1：删 ATOM_BUCKETS 二级表后，注册表自身长度即真相
    expect(Object.keys(ATOM_CONTRACT_REGISTRY).length).toBe(getAllRegisteredAtomKeys().length)

    for (const atomKey of FIRST_WAVE_TRIGGER_ATOMS) {
      expect(ATOM_CONTRACT_REGISTRY[atomKey].bucket).toBe('trigger')
    }
  })
})
