import type { SemanticState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { atomCoverageGoldenCases } from './fixtures/atom-coverage-golden-cases'

const extractor = new SemanticSeedExtractorService()
const builder = new SemanticSeedStateBuilderService()
const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

function collectCoverageKeys(state: SemanticState, classification: ReturnType<SemanticSupportClassifierService['classify']>): Set<string> {
  const keys = new Set<string>()

  for (const trigger of state.triggers) {
    keys.add(trigger.key)
  }
  for (const action of state.actions) {
    keys.add(action.key)
  }
  for (const risk of state.risk) {
    keys.add(risk.key)
  }
  if (state.position) {
    keys.add(state.position.mode)
    keys.add(toPositionAtomKey(state.position.mode))
  }
  for (const [field, slot] of Object.entries(state.contextSlots)) {
    if (slot?.status === 'locked') {
      keys.add(`context.${field}`)
    }
  }
  for (const slot of classification.openSlots) {
    keys.add(`open_slot:${slot.slotKey}`)
  }
  for (const atom of classification.unsupportedAtoms) {
    keys.add(`unsupported:${atom.key}`)
  }
  for (const key of classification.unknownAtoms) {
    keys.add(`unknown:${key}`)
  }

  return keys
}

function toPositionAtomKey(mode: string): string {
  if (mode === 'fixed_ratio') return 'position.fixed_pct'
  if (mode === 'fixed_quote') return 'position.fixed_notional'
  if (mode === 'fixed_qty') return 'position.fixed_quantity'
  return mode
}

describe('atom coverage golden corpus', () => {
  it('keeps the pre-launch corpus at the intended size', () => {
    expect(atomCoverageGoldenCases.length).toBeGreaterThanOrEqual(50)
    expect(atomCoverageGoldenCases.length).toBeLessThanOrEqual(100)
  })

  it.each(atomCoverageGoldenCases)('$name', (goldenCase) => {
    const patch = extractor.extract(goldenCase.message)
    const state = builder.build(patch)
    expect(state).not.toBeNull()

    const classification = classifier.classify(state!)
    const coverageKeys = collectCoverageKeys(classification.state, classification)

    expect(classification.route).toBe(goldenCase.expectedRoute)
    for (const expectedKey of goldenCase.expectedKeys) {
      expect(coverageKeys).toContain(expectedKey)
    }
    for (const forbiddenKey of goldenCase.forbiddenKeys ?? []) {
      expect(coverageKeys).not.toContain(forbiddenKey)
    }
  })
})
