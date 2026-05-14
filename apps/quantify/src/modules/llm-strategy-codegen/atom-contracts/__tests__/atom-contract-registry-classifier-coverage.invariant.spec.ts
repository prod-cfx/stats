/**
 * INVARIANT: Every atom in ATOM_CONTRACT_REGISTRY must carry a `classifier` field
 * with a valid `supportStatus` value matching AtomClassifierSupportStatus.
 *
 * Issue #1334 PR1 — guards that classifier metadata coverage is complete.
 */

import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import type { AtomClassifierSupportStatus } from '../atom-contract-types'

// 与 AtomClassifierSupportStatus 联合类型同源；任何新增 supportStatus 字面量必须同步此处。
const FIXED_STATUSES = ['supported_executable', 'unsupported_unknown'] as const
const UNSUPPORTED_BETA_PATTERN = /^unsupported_.+_public_beta_unsupported$/

function isValidSupportStatus(status: string): status is AtomClassifierSupportStatus {
  return (
    (FIXED_STATUSES as readonly string[]).includes(status) ||
    UNSUPPORTED_BETA_PATTERN.test(status)
  )
}

describe('ATOM_CONTRACT_REGISTRY classifier coverage invariant', () => {
  const entries = Object.entries(ATOM_CONTRACT_REGISTRY)

  it('every atom has a classifier field', () => {
    const missing = entries
      .filter(([, contract]) => !('classifier' in contract))
      .map(([key]) => key)

    expect(missing).toEqual([])
  })

  it('every atom classifier supportStatus matches AtomClassifierSupportStatus', () => {
    const invalid = entries
      .filter(([, contract]) => !isValidSupportStatus(contract.classifier.supportStatus))
      .map(([key, contract]) => `${key}: ${contract.classifier.supportStatus}`)

    expect(invalid).toEqual([])
  })

  it('unsupported_* status entries carry unsupportedMeta; supported_executable entries do not', () => {
    const violations = entries.flatMap(([key, contract]) => {
      const { classifier } = contract
      if (classifier.supportStatus === 'supported_executable') {
        return 'unsupportedMeta' in classifier
          ? [`${key}: supported_executable must not carry unsupportedMeta`]
          : []
      }
      return 'unsupportedMeta' in classifier && classifier.unsupportedMeta?.reasonCode
        ? []
        : [`${key}: ${classifier.supportStatus} missing unsupportedMeta.reasonCode`]
    })

    expect(violations).toEqual([])
  })
})
