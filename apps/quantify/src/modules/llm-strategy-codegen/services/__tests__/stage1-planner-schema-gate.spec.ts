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
            programs: [atom('program.dynamic_grid', { symbol: 'BTCUSDT' })],
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

  it('rejects top-level risk and position legacy fields when typed rules are present', () => {
    const patch = {
      rules: [
        {
          id: 'program-grid-1',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            programs: [atom('program.dynamic_grid', { symbol: 'BTCUSDT' })],
          },
          evidence: { text: 'BTCUSDT 网格策略' },
        },
      ],
      risk: { stopLossPct: 5 },
      position: { sizing: 'fixed' },
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('legacy_flat_field')
    }
  })

  it('rejects action atoms inside effects.programs', () => {
    const patch = {
      rules: [
        {
          id: 'program-role-invalid',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            programs: [atom('action.open_long')],
          },
          evidence: { text: 'BTCUSDT 网格策略' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('effects_leaf_bucket_invalid')
    }
  })

  it('rejects risk atoms inside effects.actions', () => {
    const patch = {
      rules: [
        {
          id: 'action-role-invalid',
          phase: 'entry',
          sideScope: 'long',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            actions: [atom('risk.stop_loss_pct')],
          },
          evidence: { text: '启动后运行' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('effects_leaf_bucket_invalid')
    }
  })

  it('rejects program atoms inside effects.orchestration', () => {
    const patch = {
      rules: [
        {
          id: 'orchestration-role-invalid',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            orchestration: [atom('program.dynamic_grid', { symbol: 'BTCUSDT' })],
          },
          evidence: { text: 'BTCUSDT 网格策略' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('effects_leaf_bucket_invalid')
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

  it('retry reminder keeps DCA in typed position effects, not program rule wording', () => {
    const patch = {
      rules: [
        {
          id: 'dca-role-invalid',
          phase: 'program',
          sideScope: 'both',
          condition: atom('execution.on_start'),
          effects: {
            ...emptyEffects(),
            programs: [atom('position.dca_schedule')],
          },
          evidence: { text: 'DCA 定投' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, 'BTC DCA 定投')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reminder).toContain('position.dca_schedule')
      expect(result.reminder).toContain('effects.positions')
      expect(result.reminder).toContain('effects.programs')
      expect(result.reminder).not.toContain('DCA 等非 program.* atom')
      expect(result.reminder).not.toContain('DCA 由 program rule 承载')
      expect(result.reminder).not.toContain('program rule')
      expect(result.reminder).not.toMatch(/DCA[^。\n]*effects\.programs/)
      expect(result.reminder).not.toMatch(/position\.dca_schedule[^。\n]*effects\.programs/)
    }
  })
})
