import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

describe('stage1 typed rules corpus fixture', () => {
  it('contains exactly 31 required current-capability cases', () => {
    expect(STAGE1_TYPED_RULES_CORPUS).toHaveLength(31)
    expect(new Set(STAGE1_TYPED_RULES_CORPUS.map(item => item.id)).size).toBe(31)
    expect(STAGE1_TYPED_RULES_CORPUS.every(item => item.text.trim().length > 0)).toBe(true)
  })

  it.each(STAGE1_TYPED_RULES_CORPUS)(
    '$id dispatches production typed rules without legacy flat fields',
    ({ text, expectedPhases, expectedEffectRoles }) => {
      const patch = new GenericSeedDispatcher().dispatch(text)
      const legacyTopLevelFields = ['triggers', 'actions', 'risk', 'position', 'orchestration', 'atoms'] as const

      expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
      for (const field of legacyTopLevelFields) {
        expect(patch).not.toHaveProperty(field)
      }
      for (const rule of patch.rules ?? []) {
        expect(Array.isArray(rule.effects)).toBe(false)
      }

      const phases = new Set((patch.rules ?? []).map(rule => rule.phase))
      for (const phase of expectedPhases) {
        expect(phases.has(phase)).toBe(true)
      }

      for (const role of expectedEffectRoles) {
        expect((patch.rules ?? []).some(rule => !Array.isArray(rule.effects) && rule.effects[role].length > 0)).toBe(true)
      }
    },
  )
})
