import { z } from 'zod'
import { semanticRuleSchema } from '../../types/atom-expr'

describe('Issue #1395 — planner rules zod gate', () => {
  const plannerRulesSchema = z.array(semanticRuleSchema).optional()
  const emptyEffects = {
    actions: [],
    risks: [],
    positions: [],
    orchestration: [],
    programs: [],
  }

  it('accepts well-formed rules array', () => {
    const ok = plannerRulesSchema.safeParse([
      {
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'rsi.gte', params: { threshold: 65 } },
        effects: emptyEffects,
      },
    ])
    expect(ok.success).toBe(true)
  })

  it('rejects rules with invalid phase', () => {
    const bad = plannerRulesSchema.safeParse([
      {
        id: 'r1',
        phase: 'foo',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'x', params: {} },
        effects: emptyEffects,
      },
    ])
    expect(bad.success).toBe(false)
  })

  it('rejects AND with single child', () => {
    const bad = plannerRulesSchema.safeParse([
      {
        id: 'r2',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'and', children: [{ kind: 'atom', key: 'x', params: {} }] },
        effects: emptyEffects,
      },
    ])
    expect(bad.success).toBe(false)
  })

  it('accepts deep nesting (AND of OR of atoms)', () => {
    const ok = plannerRulesSchema.safeParse([
      {
        id: 'r3',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            {
              kind: 'or',
              children: [
                { kind: 'atom', key: 'a', params: {} },
                { kind: 'atom', key: 'b', params: {} },
              ],
            },
            { kind: 'atom', key: 'c', params: {} },
          ],
        },
        effects: emptyEffects,
      },
    ])
    expect(ok.success).toBe(true)
  })

  it('rejects unknown kind', () => {
    const bad = plannerRulesSchema.safeParse([
      {
        id: 'r4',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'xor', children: [] } as never,
        effects: emptyEffects,
      },
    ])
    expect(bad.success).toBe(false)
  })

  it('produces structured error path for invalid leaf params', () => {
    const bad = plannerRulesSchema.safeParse([
      {
        id: 'r5',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: '', params: {} },
        effects: emptyEffects,
      },
    ])
    expect(bad.success).toBe(false)
    if (!bad.success) {
      const summary = bad.error.issues.map(i => `path=${i.path.join('.')}`).join(';')
      expect(summary).toContain('path=0.condition')
    }
  })
})
