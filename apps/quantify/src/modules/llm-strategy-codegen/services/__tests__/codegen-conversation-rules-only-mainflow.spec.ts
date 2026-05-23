import type { SemanticSlotState } from '../../types/semantic-state'
import { CodegenConversationService } from '../codegen-conversation.service'

describe('CodegenConversationService rules-only mainflow helpers', () => {
  it('builds clarification items using rule paths', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => { items: Array<{ key: string, field: string }> }
    }

    const state = service.buildRulePathClarificationState([{
      slotKey: 'risk.stop_loss_pct.pct',
      fieldPath: 'rules[0].effects.risks[0].params.pct',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认止损百分比。',
      affectsExecution: true,
    }], ['missing_required_rule_params'])

    expect(state.items[0]).toMatchObject({
      key: 'rules[0].effects.risks[0].params.pct',
      field: 'rules[0].effects.risks[0].params.pct',
    })
  })
})
