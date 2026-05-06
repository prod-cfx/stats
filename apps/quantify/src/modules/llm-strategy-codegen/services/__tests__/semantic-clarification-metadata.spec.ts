import { STRATEGY_CLARIFICATION_REASONS } from '../../types/strategy-clarification'
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

  it.each([
    'trigger.percent_change.magnitude',
    'trigger.confirmation.rebound_definition',
    'trigger.confirmation.pullback_hold',
    'trigger.volume.relative_average.lookback_bars',
    'trigger.volume.relative_average.multiplier',
  ])('maps %s to semantic trigger metadata', (slotKey) => {
    expect(resolveSemanticClarificationMetadata(slotKey)).toEqual({
      reason: 'missing_semantic_trigger',
      field: 'triggers',
    })
  })

  it('maps falling knife guard definition to risk atom metadata', () => {
    const metadata = resolveSemanticClarificationMetadata('risk.falling_knife_guard.definition')

    expect(metadata).toEqual({
      reason: 'missing_risk_atom',
      field: 'risk',
    })
    expect(STRATEGY_CLARIFICATION_REASONS).toContain(metadata.reason)
  })

  it.each([
    [
      'position.mode',
      {
        reason: 'missing_semantic_position_mode',
        field: 'position.positionMode',
      },
    ],
    [
      'exposure.position_mode',
      {
        reason: 'missing_semantic_position_mode',
        field: 'position.positionMode',
      },
    ],
    [
      'action.entry',
      {
        reason: 'missing_semantic_action',
        field: 'actions',
      },
    ],
    [
      'entry.order.intent',
      {
        reason: 'missing_semantic_action',
        field: 'actions',
      },
    ],
    [
      'grid.stepPct',
      {
        reason: 'missing_semantic_contract_requirement',
        field: 'grid.stepPct',
      },
    ],
    [
      'contract.requirement.price.define.level_set',
      {
        reason: 'missing_semantic_contract_requirement',
        field: 'contract.requirement.price.define.level_set',
      },
    ],
  ])('maps %s to semantic metadata', (slotKey, expected) => {
    expect(resolveSemanticClarificationMetadata(slotKey)).toEqual(expected)
  })
})
