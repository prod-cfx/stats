import { resolveSemanticClarificationMetadata } from '../semantic-clarification-metadata'

describe('resolveSemanticClarificationMetadata', () => {
  it('maps position sizing to semantic position metadata instead of checklist riskRules', () => {
    expect(resolveSemanticClarificationMetadata('position.sizing')).toEqual({
      reason: 'missing_semantic_position_sizing',
      field: 'position.sizing',
    })
  })

  it('maps trigger slots to semantic trigger fields instead of entryRules or exitRules', () => {
    expect(resolveSemanticClarificationMetadata('trigger.entry')).toEqual({
      reason: 'missing_semantic_trigger',
      field: 'triggers',
    })
    expect(resolveSemanticClarificationMetadata('trigger.exit')).toEqual({
      reason: 'missing_semantic_trigger',
      field: 'triggers',
    })
  })

  it('maps risk slots to semantic risk fields instead of checklist riskRules', () => {
    expect(resolveSemanticClarificationMetadata('risk.protective_exit')).toEqual({
      reason: 'missing_semantic_risk',
      field: 'risk',
    })
  })
})
