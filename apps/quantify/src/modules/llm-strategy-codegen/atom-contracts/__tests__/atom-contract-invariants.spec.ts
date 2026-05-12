import type { AtomContractInvariantReport } from '../atom-contract-invariants'
import { ATOM_BUCKETS, ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../../constants/canonical-strategy-capabilities'

type AssertTrue<T extends true> = T
type _AllInvariantsHold = AssertTrue<
  AtomContractInvariantReport[keyof AtomContractInvariantReport] extends true ? true : false
>

void (0 as unknown as _AllInvariantsHold)

describe('ATOM_CONTRACT_REGISTRY type-level invariants', () => {
  it('keeps runtime registry shape aligned with PR1b invariant expectations', () => {
    expect(Object.keys(ATOM_CONTRACT_REGISTRY)).toHaveLength(Object.keys(ATOM_BUCKETS).length)

    for (const atomKey of FIRST_WAVE_TRIGGER_ATOMS) {
      expect(ATOM_CONTRACT_REGISTRY[atomKey].bucket).toBe('trigger')
    }
  })
})
