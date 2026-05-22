import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
})

const emptyEffects = () => ({
  actions: [],
  risks: [],
  positions: [],
  orchestration: [],
  programs: [],
})

describe('PlannerDispatcherMergeService.validatePlannerSemanticPatch stage1 schema gate', () => {
  const svc = new PlannerDispatcherMergeService()
  const userMessage = 'BTCUSDT 网格策略，启动后运行，跌破 5% 止损'

  it('rejects legacy flat patch fields when typed rules are present', () => {
    const patch = {
      rules: [
        {
          id: 'program-grid-1',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            programs: [atom('program.grid', { symbol: 'BTCUSDT' })],
          },
          evidence: { text: 'BTCUSDT 网格策略' },
        },
      ],
      triggers: [atom('execution.on_start')],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('legacy_flat_field')
    }
  })

  it('rejects bare effects AtomExpr[]', () => {
    const patch = {
      rules: [
        {
          id: 'legacy-effects-1',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('execution.on_start'),
          effects: [atom('action.open_long')],
          evidence: { text: '启动后运行' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })
})
