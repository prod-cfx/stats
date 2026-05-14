/**
 * INVARIANT: Every atom in ATOM_CONTRACT_REGISTRY must carry a `classifier` field
 * with a valid `supportStatus` value.
 *
 * Issue #1334 PR1 — guards that classifier metadata coverage is complete.
 */

import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'

describe('ATOM_CONTRACT_REGISTRY classifier coverage invariant', () => {
  const entries = Object.entries(ATOM_CONTRACT_REGISTRY) as [string, (typeof ATOM_CONTRACT_REGISTRY)[keyof typeof ATOM_CONTRACT_REGISTRY]][]

  it('every atom has a classifier field', () => {
    const missing = entries
      .filter(([, contract]) => !('classifier' in contract))
      .map(([key]) => key)

    expect(missing).toEqual([])
  })

  it('every atom classifier has a valid supportStatus', () => {
    const invalid = entries
      .filter(([, contract]) => {
        const { supportStatus } = contract.classifier
        return (
          supportStatus !== 'supported_executable' &&
          supportStatus !== 'unsupported_unknown' &&
          !supportStatus.startsWith('unsupported_')
        )
      })
      .map(([key, contract]) => `${key}: ${contract.classifier.supportStatus}`)

    expect(invalid).toEqual([])
  })

  it('all atoms default to supported_executable in PR1', () => {
    const nonDefault = entries
      .filter(([, contract]) => contract.classifier.supportStatus !== 'supported_executable')
      .map(([key, contract]) => `${key}: ${contract.classifier.supportStatus}`)

    // In PR1 all atoms must default to supported_executable.
    // PR2 will override specific atoms with their legacy unsupported values.
    expect(nonDefault).toEqual([])
  })
})
