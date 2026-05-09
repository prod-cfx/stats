import type {
  SemanticActionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import type { SupportedExecutableUtteranceAtom, UtteranceCorpusCase } from './utterance-corpus.types'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../../services/semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../../services/semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../../services/semantic-support-classifier.service'
import {
  SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS,
  utteranceCorpus,
} from './index'

type CorpusTarget =
  | SemanticTriggerState
  | SemanticActionState
  | SemanticRiskState
  | NonNullable<NonNullable<SemanticState['position']>['constraints']>[number]

describe('utterance corpus baseline', () => {
  const corpusCases: readonly UtteranceCorpusCase[] = utteranceCorpus
  const extractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const atomRegistry = new SemanticAtomRegistryService()
  const supportClassifier = new SemanticSupportClassifierService(atomRegistry)

  it('covers the current supported executable utterance atom set with at least 60 cases', () => {
    expect(utteranceCorpus.length).toBeGreaterThanOrEqual(60)

    const ids = new Set(utteranceCorpus.map(item => item.id))
    expect(ids.size).toBe(utteranceCorpus.length)

    for (const atomKey of SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS) {
      const cases = utteranceCorpus.filter(item => item.atomKey === atomKey)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(cases.some(item => item.locale === 'zh' || item.locale === 'mixed')).toBe(true)
      expect(cases.some(item => item.locale === 'en' || item.locale === 'mixed')).toBe(true)
      expect(cases.some(item => item.coverage === 'open-slot' || item.coverage === 'missing-default')).toBe(true)
    }
  })

  it.each(corpusCases)('$id parses into the expected atom target', (item) => {
    const state = seedStateBuilder.build(extractor.extract(item.utterance))
    expect(state).not.toBeNull()

    if (!state) {
      throw new Error(`Expected corpus case ${item.id} to build a semantic state`)
    }

    const target = findCorpusTarget(state, item)
    expect(target).toBeDefined()

    if (!target) {
      throw new Error(`Expected corpus case ${item.id} to contain ${item.expected.key}`)
    }

    if (item.expected.status) {
      expect(target.status).toBe(item.expected.status)
    }

    if (item.expected.params) {
      expect(target.params ?? {}).toMatchObject(item.expected.params)
    }

    assertOpenSlots(item, target, state, supportClassifier)
  })
})

function findCorpusTarget(state: SemanticState, item: UtteranceCorpusCase): CorpusTarget | undefined {
  if (item.expected.owner === 'trigger') {
    return state.triggers.find(target => target.key === item.expected.key)
  }
  if (item.expected.owner === 'action') {
    return state.actions.find(target => target.key === item.expected.key)
  }
  if (item.expected.owner === 'risk') {
    return state.risk.find(target => target.key === item.expected.key)
  }
  return state.position?.constraints?.find(target => target.key === item.expected.key)
}

function assertOpenSlots(
  item: UtteranceCorpusCase,
  target: CorpusTarget,
  state: SemanticState,
  supportClassifier: SemanticSupportClassifierService,
): void {
  const expectedOpenSlotKeys = item.expected.openSlotKeys ?? []
  const targetOpenSlotKeys = collectTargetOpenSlotKeys(target)
  const classifiedOpenSlotKeys = supportClassifier.classify(state).openSlots.map(slot => slot.slotKey)
  const allOpenSlotKeys = new Set([...targetOpenSlotKeys, ...classifiedOpenSlotKeys])

  for (const slotKey of expectedOpenSlotKeys) {
    expect(allOpenSlotKeys.has(slotKey)).toBe(true)
  }

  if (item.coverage === 'open-slot') {
    expect(expectedOpenSlotKeys.length).toBeGreaterThan(0)
    return
  }

  if (expectedOpenSlotKeys.length === 0) {
    expect(targetOpenSlotKeys.filter(slotKey => slotKey.startsWith(slotPrefix(item.atomKey)))).toEqual([])
  }
}

function collectTargetOpenSlotKeys(target: CorpusTarget): string[] {
  return ((target.openSlots ?? []) as readonly SemanticSlotState[]).map(slot => slot.slotKey)
}

function slotPrefix(atomKey: SupportedExecutableUtteranceAtom): string {
  if (atomKey === 'position.dca_schedule') return 'position.dca_schedule'
  return atomKey
}
