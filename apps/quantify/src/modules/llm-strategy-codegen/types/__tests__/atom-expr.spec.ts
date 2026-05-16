/**
 * Issue #1395 — AtomExpr 类型与 zod schema 不变量
 */

import {
  type AtomExpr,
  ATOM_EXPR_MIN_CHILDREN,
  atomExprDepth,
  atomExprSchema,
  canonicalizeAtomExpr,
  collectAtomLeaves,
  semanticRuleSchema,
  walkAtomExpr,
} from '../atom-expr'

describe('AtomExpr — zod schema', () => {
  it('accepts single atom leaf', () => {
    const expr = { kind: 'atom', key: 'rsi.gte', params: { threshold: 65 } }
    expect(atomExprSchema.parse(expr)).toEqual(expr)
  })

  it('accepts nested AND of two atoms', () => {
    const expr = {
      kind: 'and',
      children: [
        { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
        { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
      ],
    }
    expect(atomExprSchema.parse(expr)).toEqual(expr)
  })

  it('rejects AND with < 2 children (use single atom instead)', () => {
    const expr = { kind: 'and', children: [{ kind: 'atom', key: 'rsi.gte', params: {} }] }
    expect(() => atomExprSchema.parse(expr)).toThrow()
  })

  it('rejects OR with < 2 children', () => {
    const expr = { kind: 'or', children: [{ kind: 'atom', key: 'rsi.gte', params: {} }] }
    expect(() => atomExprSchema.parse(expr)).toThrow()
  })

  it('accepts NOT with single child', () => {
    const expr = { kind: 'not', child: { kind: 'atom', key: 'rsi.gte', params: {} } }
    expect(atomExprSchema.parse(expr)).toEqual(expr)
  })

  it('accepts SEQUENCE with nextBarOnly + withinBars', () => {
    const expr = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'price.breakout_up', params: { lookback: 24 } },
        { kind: 'atom', key: 'price.retest_no_break', params: {} },
      ],
      withinBars: 6,
      nextBarOnly: false,
    }
    expect(atomExprSchema.parse(expr)).toEqual(expr)
  })

  it('rejects SEQUENCE with < 2 steps', () => {
    const expr = { kind: 'sequence', steps: [{ kind: 'atom', key: 'x', params: {} }] }
    expect(() => atomExprSchema.parse(expr)).toThrow()
  })

  it('accepts deeply nested mixed AND/OR/NOT/SEQUENCE', () => {
    const expr = {
      kind: 'or',
      children: [
        {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'a', params: {} },
            { kind: 'not', child: { kind: 'atom', key: 'b', params: {} } },
          ],
        },
        {
          kind: 'sequence',
          steps: [
            { kind: 'atom', key: 'c', params: {} },
            { kind: 'atom', key: 'd', params: {} },
          ],
        },
      ],
    }
    expect(atomExprSchema.parse(expr)).toEqual(expr)
  })

  it('exposes ATOM_EXPR_MIN_CHILDREN = 2', () => {
    expect(ATOM_EXPR_MIN_CHILDREN).toBe(2)
  })
})

describe('AtomExpr — walker / depth / leaves', () => {
  const expr: AtomExpr = {
    kind: 'or',
    children: [
      {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'a', params: {} },
          { kind: 'atom', key: 'b', params: {} },
        ],
      },
      { kind: 'atom', key: 'c', params: {} },
    ],
  }

  it('walkAtomExpr visits all nodes with depth', () => {
    const visits: Array<{ kind: string, depth: number }> = []
    walkAtomExpr(expr, (n, d) => visits.push({ kind: n.kind, depth: d }))
    expect(visits).toEqual([
      { kind: 'or', depth: 0 },
      { kind: 'and', depth: 1 },
      { kind: 'atom', depth: 2 },
      { kind: 'atom', depth: 2 },
      { kind: 'atom', depth: 1 },
    ])
  })

  it('collectAtomLeaves returns flat atom list in tree order', () => {
    expect(collectAtomLeaves(expr).map(a => a.key)).toEqual(['a', 'b', 'c'])
  })

  it('atomExprDepth returns max depth (root = 0)', () => {
    expect(atomExprDepth(expr)).toBe(2)
    expect(atomExprDepth({ kind: 'atom', key: 'x', params: {} })).toBe(0)
  })
})

describe('AtomExpr — canonicalize for dedup', () => {
  it('sorts AND children deterministically (commutative)', () => {
    const a: AtomExpr = {
      kind: 'and',
      children: [
        { kind: 'atom', key: 'z', params: {} },
        { kind: 'atom', key: 'a', params: {} },
      ],
    }
    const b: AtomExpr = {
      kind: 'and',
      children: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'z', params: {} },
      ],
    }
    expect(JSON.stringify(canonicalizeAtomExpr(a))).toEqual(JSON.stringify(canonicalizeAtomExpr(b)))
  })

  it('preserves SEQUENCE order (non-commutative)', () => {
    const ab: AtomExpr = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'b', params: {} },
      ],
    }
    const ba: AtomExpr = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'b', params: {} },
        { kind: 'atom', key: 'a', params: {} },
      ],
    }
    expect(JSON.stringify(canonicalizeAtomExpr(ab))).not.toEqual(JSON.stringify(canonicalizeAtomExpr(ba)))
  })
})

describe('SemanticRule — zod schema', () => {
  it('accepts single-atom rule (degenerate case)', () => {
    const rule = {
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'rsi.lt', params: { threshold: 35 } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }
    expect(semanticRuleSchema.parse(rule)).toEqual(rule)
  })

  it('accepts rule with AND condition + multi effects', () => {
    const rule = {
      id: 'r2',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
        ],
      },
      effects: [
        { kind: 'atom', key: 'action.open_long', params: {} },
        { kind: 'atom', key: 'risk.atr_stop', params: { multiple: 2 } },
      ],
    }
    expect(semanticRuleSchema.parse(rule)).toEqual(rule)
  })

  it('rejects rule with invalid phase', () => {
    const rule = {
      id: 'r3',
      phase: 'invalid',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'x', params: {} },
      effects: [],
    }
    expect(() => semanticRuleSchema.parse(rule)).toThrow()
  })
})
