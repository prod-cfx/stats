/**
 * Issue #1493 块 A — updateRuleAtomParams helper 单测
 */
import type { AtomExpr, SemanticRule } from '../atom-expr'
import { updateRuleAtomParams } from '../atom-expr'

function makeAtom(key: string, params: Record<string, unknown> = {}): AtomExpr & { kind: 'atom' } {
  return { kind: 'atom', key, params }
}

describe('updateRuleAtomParams (Issue #1493)', () => {
  it('替换单叶 condition.atom 的 params', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('oscillator.rsi_gte', { period: 14, threshold: 65 }),
      effects: [],
    }
    const out = updateRuleAtomParams([rule], 'r1', 'condition.atom', atom => ({
      ...atom,
      params: { ...atom.params, threshold: 70 },
    }))
    expect(out).toHaveLength(1)
    expect(out[0].condition).toEqual({
      kind: 'atom',
      key: 'oscillator.rsi_gte',
      params: { period: 14, threshold: 70 },
    })
  })

  it('替换 and.children[1].atom 的 params，其它 child 引用复用', () => {
    const childA = makeAtom('a.key', { v: 1 })
    const childB = makeAtom('b.key', { v: 2 })
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'and', children: [childA, childB] },
      effects: [],
    }
    const out = updateRuleAtomParams([rule], 'r1', 'condition.and.children[1].atom', atom => ({
      ...atom,
      params: { v: 99 },
    }))
    const newCondition = out[0].condition
    if (newCondition.kind !== 'and') throw new Error('expected and')
    expect(newCondition.children[0]).toBe(childA) // 未触碰 child 保持原引用
    expect(newCondition.children[1]).toEqual({ kind: 'atom', key: 'b.key', params: { v: 99 } })
  })

  it('替换 effects[0] 的 atom params', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('cond.key', {}),
      effects: [makeAtom('action.open_long', { size: 1 })],
    }
    const out = updateRuleAtomParams([rule], 'r1', 'effects[0].atom', atom => ({
      ...atom,
      params: { size: 2 },
    }))
    expect(out[0].effects[0]).toEqual({ kind: 'atom', key: 'action.open_long', params: { size: 2 } })
  })

  it('替换 effects[0].sequence.steps[1].atom 的 params', () => {
    const stepA = makeAtom('step.a', { x: 1 })
    const stepB = makeAtom('step.b', { y: 2 })
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('cond', {}),
      effects: [{ kind: 'sequence', steps: [stepA, stepB] }],
    }
    const out = updateRuleAtomParams([rule], 'r1', 'effects[0].sequence.steps[1].atom', atom => ({
      ...atom,
      params: { y: 99 },
    }))
    const eff0 = out[0].effects[0]
    if (eff0.kind !== 'sequence') throw new Error('expected sequence')
    expect(eff0.steps[0]).toBe(stepA)
    expect(eff0.steps[1]).toEqual({ kind: 'atom', key: 'step.b', params: { y: 99 } })
  })

  it('其它 rule 保持原引用复用（结构共享）', () => {
    const ruleA: SemanticRule = {
      id: 'r-a',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('a', { v: 1 }),
      effects: [],
    }
    const ruleB: SemanticRule = {
      id: 'r-b',
      phase: 'exit',
      sideScope: 'short',
      condition: makeAtom('b', { v: 2 }),
      effects: [],
    }
    const out = updateRuleAtomParams([ruleA, ruleB], 'r-a', 'condition.atom', atom => ({
      ...atom,
      params: { v: 99 },
    }))
    expect(out[0]).not.toBe(ruleA)
    expect(out[1]).toBe(ruleB)
  })

  it('ruleId 不存在 → 抛 Error', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('a', {}),
      effects: [],
    }
    expect(() => updateRuleAtomParams([rule], 'nope', 'condition.atom', a => a)).toThrow(/rule "nope" not found/)
  })

  it('路径不命中 → 抛 Error', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('a', {}),
      effects: [],
    }
    expect(() => updateRuleAtomParams([rule], 'r1', 'condition.and.children[0].atom', a => a))
      .toThrow(/descends into atom leaf with extra segment/)
  })

  it('effects 索引越界 → 抛 Error', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: makeAtom('a', {}),
      effects: [makeAtom('e0', {})],
    }
    expect(() => updateRuleAtomParams([rule], 'r1', 'effects[5].atom', a => a))
      .toThrow(/effects index 5 out of range/)
  })

  it('children 索引越界 → 抛 Error', () => {
    const rule: SemanticRule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [makeAtom('a', {}), makeAtom('b', {})],
      },
      effects: [],
    }
    expect(() => updateRuleAtomParams([rule], 'r1', 'condition.and.children[9].atom', a => a))
      .toThrow(/children index 9 out of range/)
  })
})
