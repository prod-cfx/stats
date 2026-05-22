import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  }
}

describe('Stage 1 typed rule projection provenance', () => {
  it('projects typed RuleEffects roles into compatibility buckets with role-scoped provenance paths', () => {
    const rule: SemanticRule = {
      id: 'stage1-program-rule',
      phase: 'program',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'execution.on_start', params: {} },
      effects: {
        actions: [],
        risks: [
          { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
        ],
        positions: [
          { kind: 'atom', key: 'position.dca_schedule', params: { schedule: [{ delayBars: 1, sizePct: 20 }] } },
        ],
        orchestration: [
          { kind: 'atom', key: 'scope.symbol', params: { symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' } },
        ],
        programs: [
          {
            kind: 'atom',
            key: 'program.dynamic_grid',
            params: { programKind: 'dynamic_grid', anchorLookbackBars: 24, levelCount: 6 },
          },
        ],
      },
    }
    const service = new SemanticRuleProjectionService()

    const out = service.reprojectFromRules(createSemanticState({ rules: [rule] }))

    expect(out.trigger).toHaveLength(1)
    expect(out.trigger[0]).toMatchObject({
      key: 'execution.on_start',
      phase: 'gate',
      _provenance: {
        ruleId: 'stage1-program-rule',
        conditionPath: 'condition.atom',
      },
    })
    expect(out.risk.find(node => node.key === 'risk.stop_loss_pct')?._provenance).toEqual({
      ruleId: 'stage1-program-rule',
      conditionPath: 'effects.risks[0].atom',
    })
    expect(out.positionConstraint.find(node => node.key === 'position.dca_schedule')?._provenance).toEqual({
      ruleId: 'stage1-program-rule',
      conditionPath: 'effects.positions[0].atom',
    })
    expect(out.orchestration.find(node => node.key === 'scope.symbol')?._provenance).toEqual({
      ruleId: 'stage1-program-rule',
      conditionPath: 'effects.orchestration[0].atom',
    })
    expect(out.orchestration.find(node => node.key === 'program.dynamic_grid')?._provenance).toEqual({
      ruleId: 'stage1-program-rule',
      conditionPath: 'effects.programs[0].atom',
    })
  })
})
