/**
 * Issue #1494 — compileAtomExpr leaf delegate compileAtom 守门
 *
 * 锁住三件事：
 *   1. AtomExpr.leaf 与同 key/params 的 CanonicalConditionAtom 走 compileAtom 行为等价
 *      （predicateMap + seriesMap byte-equal）。
 *   2. AtomExpr 组合算子 and/or/not/sequence 调度 leaf 时各派生 baseId 不冲突、形态正确。
 *   3. 未注册 atom key 触发 `codegen.canonical_spec_v2_condition_unsupported:<key>` fail-closed；
 *      占位回归：IR dump 不含 `EQ(const_1, const_1)` 的 leaf 占位形态。
 *
 * compileAtomExpr / compileAtom 是 service private 方法，通过 `(service as any)` 桥接
 * 调用；CompileContext 也用纯字面量构造（避免拉起 NestJS DI）。
 */

import { Logger } from '@nestjs/common'
import type { CanonicalConditionAtom } from '../../types/canonical-strategy-spec-v2'
import type { AtomExpr } from '../../types/atom-expr'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

interface MutableCompileContextLike {
  timeframe: string
  seriesMap: Map<string, unknown>
  levelSetMap: Map<string, unknown>
  predicateMap: Map<string, { id: string; kind: string; args: string[]; params?: Record<string, unknown> }>
  orderProgramActivePredicateMap: Map<string, string>
  movingAverage: { kind: 'EMA' | 'SMA'; fast: number; slow: number }
  rsi: { period: number }
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number }
  bollinger: { period: number; stdDev: number }
  runtimeRequirements: { helpers: Set<string>; stateKeys: Set<string> }
}

function makeContext(): MutableCompileContextLike {
  return {
    timeframe: '1h',
    seriesMap: new Map(),
    levelSetMap: new Map(),
    predicateMap: new Map(),
    orderProgramActivePredicateMap: new Map(),
    movingAverage: { kind: 'EMA', fast: 7, slow: 30 },
    rsi: { period: 14 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    bollinger: { period: 20, stdDev: 2 },
    runtimeRequirements: { helpers: new Set(), stateKeys: new Set() },
  }
}

interface PrivateSurface {
  compileAtomExpr: (expr: AtomExpr, ctx: MutableCompileContextLike, seed: string) => string
  compileAtom: (atom: CanonicalConditionAtom, ctx: MutableCompileContextLike, seed: string) => string
}

function privates(service: CanonicalSpecV2IrCompilerService): PrivateSurface {
  return service as unknown as PrivateSurface
}

function snapshotContext(ctx: MutableCompileContextLike): {
  predicates: Array<{ id: string; kind: string; args: string[] }>
  seriesIds: string[]
} {
  return {
    predicates: [...ctx.predicateMap.values()].map(p => ({ id: p.id, kind: p.kind, args: [...p.args] })),
    seriesIds: [...ctx.seriesMap.keys()].sort(),
  }
}

describe('Issue #1494 — compileAtomExpr leaf 行为与 compileAtom 等价', () => {
  const service = new CanonicalSpecV2IrCompilerService()

  it.each<[string, AtomExpr, CanonicalConditionAtom]>([
    [
      'execution.on_start',
      { kind: 'atom', key: 'execution.on_start', params: {} },
      { kind: 'atom', key: 'execution.on_start' },
    ],
    [
      'oscillator.rsi_lte threshold=30',
      { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, op: 'LTE', value: 30 } },
      { kind: 'atom', key: 'oscillator.rsi_lte', op: 'LTE', value: 30, params: { period: 14 } },
    ],
    [
      'indicator.cross_over ma 7/30',
      { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fast: 7, slow: 30 } },
      { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fast: 7, slow: 30 } },
    ],
    [
      'price.breakout_up period=20',
      { kind: 'atom', key: 'price.breakout_up', params: { period: 20 } },
      { kind: 'atom', key: 'price.breakout_up', params: { period: 20 } },
    ],
  ])('%s leaf 与 compileAtom 输出 byte-equal', (_label, expr, atom) => {
    const leafCtx = makeContext()
    const atomCtx = makeContext()
    const leafId = privates(service).compileAtomExpr(expr, leafCtx, 'seed_0')
    const atomId = privates(service).compileAtom(atom, atomCtx, 'seed_0')
    expect(leafId).toBe(atomId)
    expect(snapshotContext(leafCtx)).toEqual(snapshotContext(atomCtx))
  })
})

describe('Issue #1494 — compileAtomExpr 组合算子调度 leaf', () => {
  const service = new CanonicalSpecV2IrCompilerService()

  function compile(expr: AtomExpr) {
    const ctx = makeContext()
    const id = privates(service).compileAtomExpr(expr, ctx, 'seed_0')
    return { id, ...snapshotContext(ctx) }
  }

  it('AND(rsi_lte, rsi_gte) → allOf 顶层 + 两叶子 predicate', () => {
    const expr: AtomExpr = {
      kind: 'and',
      children: [
        { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, op: 'LTE', value: 30 } },
        { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, op: 'GTE', value: 70 } },
      ],
    }
    expect(compile(expr)).toMatchSnapshot()
  })

  it('OR(cross_over, cross_under) → anyOf 顶层', () => {
    const expr: AtomExpr = {
      kind: 'or',
      children: [
        { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fast: 7, slow: 30 } },
        { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ma', fast: 7, slow: 30 } },
      ],
    }
    expect(compile(expr)).toMatchSnapshot()
  })

  it('NOT(execution.on_start) → NOT predicate 包裹 leaf', () => {
    const expr: AtomExpr = {
      kind: 'not',
      child: { kind: 'atom', key: 'execution.on_start', params: {} },
    }
    expect(compile(expr)).toMatchSnapshot()
  })

  it('SEQUENCE([cross_over, cross_under]) withinBars=5 → sequence predicate 带 params', () => {
    const expr: AtomExpr = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fast: 7, slow: 30 } },
        { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ma', fast: 7, slow: 30 } },
      ],
      withinBars: 5,
    }
    expect(compile(expr)).toMatchSnapshot()
  })
})

describe('Issue #1494 — compileAtomExpr fail-closed 守门', () => {
  const service = new CanonicalSpecV2IrCompilerService()

  it('未注册 atom key → 抛 canonical_spec_v2_condition_unsupported:<key>', () => {
    const expr: AtomExpr = {
      kind: 'atom',
      key: '__test.unsupported_atom',
      params: {},
    }
    const ctx = makeContext()
    expect(() => privates(service).compileAtomExpr(expr, ctx, 'seed_0'))
      .toThrow(/canonical_spec_v2_condition_unsupported.*__test\.unsupported_atom/)
  })

  it('占位回归：leaf IR dump 不含 EQ(const_1, const_1) 形态', () => {
    const expr: AtomExpr = {
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      params: { period: 14, op: 'LTE', value: 30 },
    }
    const ctx = makeContext()
    privates(service).compileAtomExpr(expr, ctx, 'seed_0')
    // 旧占位形态：EQ predicate args 指向同一个 CONST series 且 value === 1
    // 结构判定（不依赖 const_ 命名前缀，避免 series id 命名调整造成假阳/假阴）
    for (const p of ctx.predicateMap.values()) {
      if (p.kind !== 'EQ' || p.args.length !== 2 || p.args[0] !== p.args[1]) continue
      const series = ctx.seriesMap.get(p.args[0]) as { kind?: string; value?: unknown } | undefined
      const isTautology = series?.kind === 'CONST' && series.value === 1
      expect(isTautology).toBe(false)
    }
  })
})

describe('Issue #1494 — atomExprAtomToConditionAtom op 字段白名单', () => {
  const service = new CanonicalSpecV2IrCompilerService()

  it('非法 op 字符串保持 op=undefined，走 resolveComparisonKind 默认分支（GTE）兜底', () => {
    // 非法 op = 'FOO'，正常 params.value=30，rsi_lte atom emit 内部使用
    // helpers.resolveComparisonKind(atom.op) 应回退 'GTE' 而非任性接受 'FOO'。
    const exprBad: AtomExpr = {
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      params: { period: 14, op: 'FOO', value: 30 },
    }
    const exprGood: AtomExpr = {
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      params: { period: 14, value: 30 },
    }
    const ctxBad = makeContext()
    const ctxGood = makeContext()
    // 非法 op 既不能让 compileAtomExpr 抛异常，也不能产出 kind='FOO' 的 predicate
    expect(() => privates(service).compileAtomExpr(exprBad, ctxBad, 'seed_0')).not.toThrow()
    privates(service).compileAtomExpr(exprGood, ctxGood, 'seed_0')
    // 与不带 op 的版本输出 byte-equal —— 证明非法值被丢弃后走默认分支
    expect(snapshotContext(ctxBad)).toEqual(snapshotContext(ctxGood))
    for (const p of ctxBad.predicateMap.values()) {
      // predicate.kind 取自 resolveComparisonKind，永远不会出现 'FOO'
      expect(p.kind).not.toBe('FOO')
    }
  })

  it.each(['EQ', 'LTE', 'GTE', 'GT', 'LT', 'CROSS_OVER', 'CROSS_UNDER'] as const)(
    '合法 op=%s 透传到 op 字段',
    (validOp) => {
      const exprWithValid: AtomExpr = {
        kind: 'atom',
        key: 'oscillator.rsi_lte',
        params: { period: 14, op: validOp, value: 30 },
      }
      const ctx = makeContext()
      expect(() => privates(service).compileAtomExpr(exprWithValid, ctx, 'seed_0')).not.toThrow()
    },
  )
})

describe('Issue #1494 — atomExprAtomToConditionAtom non-primitive param 结构化告警', () => {
  it('遇到嵌套 object / array param 时调用 logger.warn，primitive param 仍正常透传', () => {
    const service = new CanonicalSpecV2IrCompilerService()
    // 通过 prototype spy 截获实例 logger（@nestjs/common Logger 全局共享 prototype）
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    // 直接调 adapter（private），用纯字面量构造 AtomExprAtom
    const expr = {
      kind: 'atom' as const,
      key: 'oscillator.rsi_lte',
      params: {
        x: { nested: 1 },
        y: [1, 2, 3],
        period: 14,
        op: 'LTE',
        value: 30,
      },
    }
    const adapter = (service as unknown as {
      atomExprAtomToConditionAtom: (e: typeof expr) => CanonicalConditionAtom
    }).atomExprAtomToConditionAtom.bind(service)
    const atom = adapter(expr)

    // x / y 两条 non-primitive 各触发一次 warn
    const dropWarns = warnSpy.mock.calls
      .map(c => String(c[0] ?? ''))
      .filter(msg => msg.includes('[#1494]') && msg.includes('dropping non-primitive param'))
    expect(dropWarns).toHaveLength(2)
    expect(dropWarns.some(m => m.includes('paramKey=x') && m.includes('valueType=object'))).toBe(true)
    expect(dropWarns.some(m => m.includes('paramKey=y') && m.includes('valueType=array'))).toBe(true)
    expect(dropWarns.every(m => m.includes('atomKey=oscillator.rsi_lte'))).toBe(true)

    // primitive params 仍正常透传
    expect(atom.params).toEqual({ period: 14 })
    expect(atom.op).toBe('LTE')
    expect(atom.value).toBe(30)

    warnSpy.mockRestore()
  })
})
