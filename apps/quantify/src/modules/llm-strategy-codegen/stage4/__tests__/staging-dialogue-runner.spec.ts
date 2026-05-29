import {
  STAGE4_BLOCKER_TAXONOMY,
  isStage4AttemptOnePass,
} from '../staging-dialogue-runner'

describe('Stage 4 staging dialogue runner gates', () => {
  it('accepts only attempt-1 pass with stable semantics', () => {
    expect(isStage4AttemptOnePass({ attemptCount: 1, passed: true, semanticHashesStable: true })).toBe(true)
    expect(isStage4AttemptOnePass({ attemptCount: 2, passed: true, semanticHashesStable: true })).toBe(false)
    expect(isStage4AttemptOnePass({ attemptCount: 1, passed: true, semanticHashesStable: false })).toBe(false)
    expect(isStage4AttemptOnePass({ attemptCount: 1, passed: false, semanticHashesStable: true })).toBe(false)
  })

  it('defines PR1 blocker taxonomy', () => {
    expect(STAGE4_BLOCKER_TAXONOMY).toEqual(expect.arrayContaining([
      'missing_semantics',
      'semantic_drift',
      'duplicated_entry',
      'duplicated_exit',
      'slot_answer_created_duplicate_rule',
      'deploy_payload_drift',
    ]))
  })
})
