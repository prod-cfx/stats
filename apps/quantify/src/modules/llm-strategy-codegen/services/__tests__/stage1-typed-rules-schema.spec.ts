import type { RuleEffects, SemanticRule } from '../../types/atom-expr'
import { gracefulParseSemanticRule, semanticRuleSchema, updateRuleAtomParams } from '../../types/atom-expr'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
})

const emptyEffects = (): RuleEffects => ({
  actions: [],
  risks: [],
  positions: [],
  orchestration: [],
  programs: [],
})

describe('stage1 typed SemanticRule schema', () => {
  it('accepts typed RuleEffects and program phase', () => {
    const parsed = semanticRuleSchema.safeParse({
      id: 'program-grid-1',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        actions: [],
        risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
        positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        orchestration: [atom('scope.symbol', { symbol: 'BTCUSDT' })],
        programs: [atom('program.grid', { levels: 10 })],
      },
      evidence: { text: '启动网格' },
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects legacy bare effects arrays', () => {
    const parsed = semanticRuleSchema.safeParse({
      id: 'legacy-effects-1',
      phase: 'entry',
      sideScope: 'long',
      condition: atom('price.ema_above', { period: 20 }),
      effects: [atom('action.open_long')],
    })

    expect(parsed.success).toBe(false)
  })

  it('gracefully parses program phase and prunes typed RuleEffects roles', () => {
    const parsed = gracefulParseSemanticRule({
      id: 'program-grid-2',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        actions: [atom('action.open_long')],
        risks: [{ kind: 'missing_key', params: {} }],
        positions: [atom('position.per_order_budget', { value: 10 })],
        orchestration: [],
        programs: [atom('program.grid', { levels: 10 })],
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.rule.effects).toEqual({
      actions: [atom('action.open_long')],
      risks: [],
      positions: [atom('position.per_order_budget', { value: 10 })],
      orchestration: [],
      programs: [atom('program.grid', { levels: 10 })],
    })
  })

  it('updates atoms in typed RuleEffects roles and keeps legacy flattened effects paths', () => {
    const rule: SemanticRule = {
      id: 'program-grid-3',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        ...emptyEffects(),
        risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
        programs: [atom('program.grid', { levels: 10 })],
      },
    }

    const rolePathOut = updateRuleAtomParams([rule], 'program-grid-3', 'effects.risks[0].atom', current => ({
      ...current,
      params: { valuePct: 7 },
    }))
    expect(rolePathOut[0].effects.risks[0]).toEqual(atom('risk.stop_loss_pct', { valuePct: 7 }))

    const legacyPathOut = updateRuleAtomParams(rolePathOut, 'program-grid-3', 'effects[1].atom', current => ({
      ...current,
      params: { levels: 12 },
    }))
    expect(legacyPathOut[0].effects.programs[0]).toEqual(atom('program.grid', { levels: 12 }))
  })
})
