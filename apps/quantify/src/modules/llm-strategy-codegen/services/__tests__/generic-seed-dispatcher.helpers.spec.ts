/**
 * Issue #1279 PR2 Run 1 (C3) — GenericSeedDispatcher helpers 单测
 *
 * 覆盖：
 *   - matchKeyword: 命中 / 不命中 / 大小写 / 空输入 / 多 keyword 优先级
 *   - matchVerbDirection: 多 direction / 顺序保留 / 不命中
 *   - resolvePhaseFromClause: 三种 spec 路径 / 出场词优先级
 *
 * Refs: #1279
 */
import {
  matchKeyword,
  matchVerbDirection,
  resolvePhaseFromClause,
} from '../generic-seed-dispatcher.helpers'

describe('matchKeyword', () => {
  it('命中 first keyword 时返回该 keyword', () => {
    expect(matchKeyword('RSI 大于 70 卖出', ['RSI'])).toBe('RSI')
  })

  it('大小写不敏感', () => {
    expect(matchKeyword('rsi 大于 70', ['RSI'])).toBe('RSI')
    expect(matchKeyword('ATR 波动率', ['atr'])).toBe('atr')
  })

  it('多 keyword 时按数组顺序返回首个命中的', () => {
    expect(matchKeyword('成交量放量', ['成交量', '量能', '放量'])).toBe('成交量')
    expect(matchKeyword('放量阶段', ['成交量', '量能', '放量'])).toBe('放量')
  })

  it('空 clause / 空 keywords 返回 null', () => {
    expect(matchKeyword('', ['RSI'])).toBeNull()
    expect(matchKeyword('RSI', [])).toBeNull()
  })

  it('keyword 为空字符串时被跳过', () => {
    expect(matchKeyword('RSI 大于 70', ['', 'RSI'])).toBe('RSI')
  })

  it('不命中时返回 null', () => {
    expect(matchKeyword('价格突破', ['RSI', 'ATR'])).toBeNull()
  })
})

describe('matchVerbDirection', () => {
  it('单 direction 命中返回该 direction', () => {
    expect(
      matchVerbDirection('RSI 大于 70', {
        gte: ['大于', '高于', '超过'] as const,
      }),
    ).toBe('gte')
  })

  it('多 direction 时按 Object.keys 顺序返回首个命中', () => {
    expect(
      matchVerbDirection('RSI 小于 30', {
        gte: ['大于', '高于'] as const,
        lte: ['小于', '低于'] as const,
      }),
    ).toBe('lte')
  })

  it('verb 大小写不敏感', () => {
    expect(
      matchVerbDirection('RSI greater than 70', {
        gte: ['Greater Than'] as const,
      }),
    ).toBe('gte')
  })

  it('空 verb 数组被跳过', () => {
    expect(
      matchVerbDirection('RSI 大于 70', {
        gte: [] as const,
        lte: ['大于'] as const,
      }),
    ).toBe('lte')
  })

  it('空 clause 返回 null', () => {
    expect(matchVerbDirection('', { gte: ['大于'] as const })).toBeNull()
  })

  it('不命中任何 verb 返回 null', () => {
    expect(
      matchVerbDirection('价格突破', {
        gte: ['大于'] as const,
        lte: ['小于'] as const,
      }),
    ).toBeNull()
  })
})

describe('resolvePhaseFromClause', () => {
  it('fixed-entry spec 恒返回 entry', () => {
    expect(resolvePhaseFromClause('随便什么子句', 'fixed-entry')).toBe('entry')
    expect(resolvePhaseFromClause('', 'fixed-entry')).toBe('entry')
  })

  it('fixed-exit spec 恒返回 exit', () => {
    expect(resolvePhaseFromClause('随便什么子句', 'fixed-exit')).toBe('exit')
  })

  it('fixed-program spec 恒返回 program', () => {
    expect(resolvePhaseFromClause('随便什么子句', 'fixed-program')).toBe('program')
    expect(resolvePhaseFromClause('', 'fixed-program')).toBe('program')
  })

  it('by-clause-verb 识别中文入场词', () => {
    expect(resolvePhaseFromClause('RSI 跌破 30 开多', 'by-clause-verb')).toBe('entry')
    expect(resolvePhaseFromClause('突破前高加仓', 'by-clause-verb')).toBe('entry')
  })

  it('by-clause-verb 识别中文出场词', () => {
    expect(resolvePhaseFromClause('RSI 70 卖出平仓', 'by-clause-verb')).toBe('exit')
    expect(resolvePhaseFromClause('止损 2%', 'by-clause-verb')).toBe('exit')
  })

  it('by-clause-verb 出场词优先级高于入场词', () => {
    // "卖出平仓" 含 exit 词，"开多" 含 entry 词 → 应判 exit
    expect(
      resolvePhaseFromClause('RSI 70 卖出平仓 再开多', 'by-clause-verb'),
    ).toBe('exit')
  })

  it('by-clause-verb 识别英文动词', () => {
    expect(resolvePhaseFromClause('open long position', 'by-clause-verb')).toBe('entry')
    expect(resolvePhaseFromClause('close at take-profit', 'by-clause-verb')).toBe('exit')
  })

  it('by-clause-verb 无 entry/exit 词返回 null', () => {
    expect(resolvePhaseFromClause('RSI 是 70', 'by-clause-verb')).toBeNull()
    expect(resolvePhaseFromClause('', 'by-clause-verb')).toBeNull()
  })

  it('fn spec 委托给自定义函数', () => {
    const customSpec = {
      kind: 'fn' as const,
      fn: (clause: string) => (clause.includes('特殊词') ? ('exit' as const) : null),
    }
    expect(resolvePhaseFromClause('包含特殊词', customSpec)).toBe('exit')
    expect(resolvePhaseFromClause('不含', customSpec)).toBeNull()
  })
})
