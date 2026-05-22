import { semanticRuleSchema } from '../../types/atom-expr'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
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
})
