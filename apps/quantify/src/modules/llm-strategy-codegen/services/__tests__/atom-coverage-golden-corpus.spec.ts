import type { SemanticState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { atomCoverageGoldenCases } from './fixtures/atom-coverage-golden-cases'

const extractor = new SemanticSeedExtractorService()
const builder = new SemanticSeedStateBuilderService()
const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

function collectCoverageKeys(
  state: SemanticState,
  classification: ReturnType<SemanticSupportClassifierService['classify']>,
): Set<string> {
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
    for (const constraint of state.position.constraints ?? []) {
      keys.add(constraint.key)
    }
  }
  for (const [field, slot] of Object.entries(state.contextSlots)) {
    if (slot?.status === 'locked') {
      keys.add(`context.${field}`)
    }
  }
  for (const node of state.orchestration?.nodes ?? []) {
    if (node.key) {
      keys.add(node.key)
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

  it('requires phase 0 metadata for every corpus case', () => {
    for (const goldenCase of atomCoverageGoldenCases) {
      expect(goldenCase.id).toEqual(expect.any(String))
      expect(goldenCase.id.length).toBeGreaterThan(0)
      expect(goldenCase.name).toEqual(expect.any(String))
      expect(goldenCase.name.length).toBeGreaterThan(0)
      expect(goldenCase.message).toEqual(expect.any(String))
      expect(goldenCase.message.length).toBeGreaterThan(0)
      expect(goldenCase.tags.length).toBeGreaterThan(0)
      expect(goldenCase.expectedRoute).toEqual(expect.any(String))
      expect(goldenCase.expectedAtoms.length).toBeGreaterThan(0)
      for (const expectedAtom of goldenCase.expectedAtoms) {
        expect(expectedAtom.key).not.toMatch(/^(?:open_slot|unsupported|unknown):/)
      }
    }
  })

  it('marks executable projection gate atoms with minimum contract substrate', () => {
    for (const goldenCase of atomCoverageGoldenCases) {
      if (goldenCase.expectedRoute !== 'projection_gate') continue

      for (const expectedAtom of goldenCase.expectedAtoms) {
        if (expectedAtom.category === 'context') continue
        // Phase 5 S1/S7: gate.regime + portfolioRisk.drawdown_block 是 supported_executable
        // orchestration atoms，路由在 trigger/action/risk/position substrate gate 之外。
        if (expectedAtom.category === 'orchestration') continue

        expect(expectedAtom.minContractSubstrate).toBe(true)
      }
    }
  })

  it('tracks orchestration cases outside the executable projection gate route (excluding gate.regime + portfolioRisk.drawdown_block supported executable)', () => {
    // Phase 5 S1: gate.regime 升级为 supported_executable orchestration atom。
    // Phase 5 S7: portfolioRisk.drawdown_block 升级为第二个 supported_executable orchestration atom。
    // 其他 orchestration 类（scope/program/其它 portfolioRisk 子键
    // /multi_timeframe/dca/grid/time_window/partial_take_profit 等）仍然不可执行。
    const SUPPORTED_EXECUTABLE_ORCHESTRATION_KEYS = new Set([
      'gate.regime',
      'portfolioRisk.drawdown_block',
      'program.fixed_grid_gated',
    ])
    const orchestrationCases = atomCoverageGoldenCases.filter(goldenCase =>
      goldenCase.tags.includes('orchestration'),
    )

    expect(orchestrationCases.length).toBeGreaterThan(0)
    for (const goldenCase of orchestrationCases) {
      const isSupportedExecutable = goldenCase.expectedAtoms.some(
        atom => atom.category === 'orchestration'
          && SUPPORTED_EXECUTABLE_ORCHESTRATION_KEYS.has(atom.key),
      )
      if (isSupportedExecutable) continue
      expect(goldenCase.expectedRoute).not.toBe('projection_gate')
    }
  })

  it.each(atomCoverageGoldenCases)('$name', goldenCase => {
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
