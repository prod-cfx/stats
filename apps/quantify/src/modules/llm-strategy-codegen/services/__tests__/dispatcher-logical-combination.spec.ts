import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

function rulesFor(message: string): SemanticRule[] {
  return new GenericSeedDispatcher().dispatch(message).rules ?? []
}

function findRule(rules: readonly SemanticRule[], phase: SemanticRule['phase']): SemanticRule {
  const rule = rules.find(item => item.phase === phase)
  expect(rule).toBeDefined()
  return rule!
}

function atomLeaves(expr: AtomExpr): Array<Extract<AtomExpr, { kind: 'atom' }>> {
  if (expr.kind === 'atom') return [expr]
  if (expr.kind === 'and' || expr.kind === 'or') return expr.children.flatMap(atomLeaves)
  if (expr.kind === 'not') return atomLeaves(expr.child)
  return expr.steps.flatMap(atomLeaves)
}

describe('GenericSeedDispatcher logical condition combinations', () => {
  it('keeps exit OR semantics for MA break or MACD death cross', () => {
    const rules = rulesFor('SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。')

    const entry = findRule(rules, 'entry')
    expect(entry.condition.kind).toBe('and')

    const exit = findRule(rules, 'exit')
    expect(exit.condition.kind).toBe('or')

    const leaves = atomLeaves(exit.condition)
    expect(leaves.map(leaf => leaf.key).sort()).toEqual(['indicator.below', 'indicator.cross_under'])
    const macd = leaves.find(leaf => leaf.key === 'indicator.cross_under')
    expect(macd?.params).toMatchObject({ indicator: 'macd' })
    expect(macd?.params.fastPeriod).toBeUndefined()
    expect(macd?.params.period).toBeUndefined()
    expect(macd?.params['reference.period']).toBeUndefined()
  })

  it.each([
    '跌破 MA100 或者 MACD 死叉卖出',
    '跌破 MA100 任一 MACD 死叉卖出',
    '跌破 MA100 任意一个 MACD 死叉卖出',
    '跌破 MA100 任意条件 MACD 死叉卖出',
    '跌破 MA100 任一条件 MACD 死叉卖出',
    '跌破 MA100 其一 MACD 死叉卖出',
    '跌破 MA100 之一 MACD 死叉卖出',
    '跌破 MA100 / MACD 死叉 任一卖出',
    '跌破 MA100 OR MACD 死叉卖出',
    'either 跌破 MA100 or MACD 死叉卖出',
  ])('treats %s as OR', (exitText) => {
    const exit = findRule(rulesFor(`SOL 30分钟价格在 MA100 上方，MACD 金叉买入；${exitText}。`), 'exit')

    expect(exit.condition.kind).toBe('or')
    expect(atomLeaves(exit.condition).map(leaf => leaf.key).sort()).toEqual(['indicator.below', 'indicator.cross_under'])
  })

  it.each([
    '价格在 MA100 上方 且 MACD 金叉买入',
    '价格在 MA100 上方 并且 MACD 金叉买入',
    '价格在 MA100 上方 同时 MACD 金叉买入',
    '价格在 MA100 上方 以及 MACD 金叉买入',
    '价格在 MA100 上方 并 MACD 金叉买入',
    '价格在 MA100 上方 都 MACD 金叉买入',
    '价格在 MA100 上方 全部 MACD 金叉买入',
    '满足 价格在 MA100 上方 和 MACD 金叉买入',
    '价格在 MA100 上方 AND MACD 金叉买入',
    '价格在 MA100 上方 + MACD 金叉买入',
    '价格在 MA100 上方 & MACD 金叉买入',
  ])('treats %s as AND', (entryText) => {
    const entry = findRule(rulesFor(`SOL 30分钟${entryText}；跌破 MA100 卖出。`), 'entry')

    expect(entry.condition.kind).toBe('and')
    expect(atomLeaves(entry.condition).map(leaf => leaf.key).sort()).toEqual(['indicator.above', 'indicator.cross_over'])
  })

  it.each([
    '不满足 价格在 MA100 上方 时 MACD 金叉买入',
    '不是 价格在 MA100 上方 时 MACD 金叉买入',
    '未 价格在 MA100 上方 时 MACD 金叉买入',
    '没有 价格在 MA100 上方 时 MACD 金叉买入',
    '避免 价格在 MA100 上方 时 MACD 金叉买入',
    '排除 价格在 MA100 上方 时 MACD 金叉买入',
    '除非 价格在 MA100 上方 否则 MACD 金叉买入',
  ])('wraps clear negation in NOT for %s', (entryText) => {
    const entry = findRule(rulesFor(`SOL 30分钟${entryText}；跌破 MA100 卖出。`), 'entry')

    expect(entry.condition.kind).toBe('and')
    if (entry.condition.kind !== 'and') return
    expect(entry.condition.children.some(child => child.kind === 'not')).toBe(true)
    expect(atomLeaves(entry.condition).map(leaf => leaf.key)).toEqual(expect.arrayContaining([
      'indicator.above',
      'indicator.cross_over',
    ]))
  })

  it.each([
    '先 价格在 MA100 上方 再 MACD 金叉买入',
    '价格在 MA100 上方 之后 MACD 金叉买入',
    '价格在 MA100 上方 然后 MACD 金叉买入',
    '价格在 MA100 上方 随后 MACD 金叉买入',
    '价格在 MA100 上方 下一根 MACD 金叉买入',
    '价格在 MA100 上方 3 根内 MACD 金叉买入',
    '价格在 MA100 上方 回踩后 MACD 金叉买入',
    '价格在 MA100 上方 突破后等待 MACD 金叉买入',
  ])('maps %s to SEQUENCE', (entryText) => {
    const entry = findRule(rulesFor(`SOL 30分钟${entryText}；跌破 MA100 卖出。`), 'entry')

    expect(entry.condition.kind).toBe('sequence')
    if (entry.condition.kind !== 'sequence') return
    expect(entry.condition.steps.length).toBeGreaterThanOrEqual(2)
    expect(atomLeaves(entry.condition).map(leaf => leaf.key)).toEqual(expect.arrayContaining([
      'indicator.above',
      'indicator.cross_over',
    ]))
  })

  it('uses AND precedence over OR for mixed condition text', () => {
    const exit = findRule(
      rulesFor('SOL 30分钟 MACD 金叉买入；跌破 MA100 且 MACD 死叉卖出 或 RSI14 下穿 50 卖出。'),
      'exit',
    )

    expect(exit.condition.kind).toBe('or')
    if (exit.condition.kind !== 'or') return
    expect(exit.condition.children[0]?.kind).toBe('and')
    expect(atomLeaves(exit.condition).map(leaf => leaf.key)).toEqual(expect.arrayContaining([
      'indicator.below',
      'indicator.cross_under',
    ]))
  })
})
