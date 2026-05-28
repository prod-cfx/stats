/**
 * Issue #1700：LLM codegen 多 ema 不同 period 解析压成单一 period。
 *
 * Staging 实证：prompt「价格在 ema20 ema60 ema144 上方做多」，published_strategy_snapshots
 * spec_snapshot.rules[0].condition 三个 AND children 的 `reference.period` 全部退化为 20，
 * compiled_ir.EXPR_POOL 只生成 `ema_20_15m` 一条 → 回测 7 天 trades=0。
 *
 * 本测试覆盖两条不变量：
 *
 * 1. **Codegen seed**（SemanticSeedExtractorService）：给到三 EMA 不同周期的 prompt 必须
 *    emit 三条独立 `indicator.above` rule，且每条 rule condition atom 的
 *    `params['reference.period']` 分别为 20 / 60 / 144。这是 dispatcher 侧的兜底真源——
 *    无论 planner LLM 是否把 period 压成单一值，dispatcher 必须保持三个不同周期。
 *
 * 2. **IR 编译**（CanonicalSpecBuilderService + CanonicalSpecV2IrCompilerService）：三条
 *    `indicator.above` rule（reference.period 各 20/60/144、timeframe=15m）→ 编译后
 *    `signalCatalog.series` 必须含三条不同 EMA series（period 20/60/144、timeframe 15m），
 *    `signalCatalog.predicates` 至少含三条对应的 GTE 比较；保证下游策略真能拿到三个周期的
 *    EMA 数据。
 */

import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

const compileFallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1m',
  positionPct: 10,
}

function baseState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-28T00:00:00.000Z',
    ...overrides,
  }
}

function lockedContextSlot(slotKey: string, value: string) {
  return {
    slotKey,
    value,
    status: 'locked' as const,
    fieldPath: `contextSlots.${slotKey}`,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}

describe('issue #1700 multi-ema period preservation', () => {
  it('semantic seed extractor emits three indicator.above rules with reference.period 20/60/144', () => {
    const patch = new SemanticSeedExtractorService().extract(
      '价格在 ema20 ema60 ema144 上方做多',
    )

    const collectAtoms = (expr: unknown): Array<{ key: string, params?: Record<string, unknown> }> => {
      if (!expr || typeof expr !== 'object') return []
      const node = expr as { kind?: string, key?: string, params?: Record<string, unknown>, children?: unknown[], child?: unknown, steps?: unknown[] }
      if (node.kind === 'atom') {
        return [{ key: node.key ?? '', params: node.params }]
      }
      if (node.kind === 'and' || node.kind === 'or') {
        return (node.children ?? []).flatMap(collectAtoms)
      }
      if (node.kind === 'not' && node.child) return collectAtoms(node.child)
      if (node.kind === 'sequence') return (node.steps ?? []).flatMap(collectAtoms)
      return []
    }

    const aboveAtoms = (patch.rules ?? []).flatMap(rule =>
      collectAtoms(rule.condition).filter(atom => atom.key === 'indicator.above'),
    )

    expect(aboveAtoms).toHaveLength(3)
    const periods = aboveAtoms.map(atom => atom.params?.['reference.period']).sort((a, b) => Number(a) - Number(b))
    expect(periods).toEqual([20, 60, 144])

    for (const atom of aboveAtoms) {
      expect(atom.params?.indicator).toBe('ema')
    }
  })

  it('ir compiler emits three distinct EMA series and predicates for three indicator.above rules on 15m', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'binance'),
        symbol: lockedContextSlot('symbol', 'BTCUSDT'),
        marketType: lockedContextSlot('marketType', 'perp'),
        timeframe: lockedContextSlot('timeframe', '15m'),
      },
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [{
        id: 'rule-ema-stack-above-long',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        condition: {
          kind: 'and' as const,
          children: [20, 60, 144].map(period => ({
            kind: 'atom' as const,
            key: 'indicator.above',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': period,
              timeframe: '15m',
              timeframeOverride: true,
            },
          })),
        },
        effects: {
          actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: compileFallback,
    })

    const emaSeries = ir.signalCatalog.series.filter(series =>
      series.kind === 'EMA' && series.timeframe === '15m',
    )
    const emaPeriods = emaSeries
      .map(series => (series.params as { period?: number } | undefined)?.period)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b)
    expect(emaPeriods).toEqual([20, 60, 144])

    // 对每个 period 校验有对应 EMA series id 命名（ema_<period>_15m 风格 predicate seed）
    // EXPR_POOL（compiled-ir）真实承载：ir.signalCatalog.predicates 引用 series id。
    // 每个 indicator.above 必须 emit 独立 predicate，且其 inputs 覆盖三个 EMA series id。
    const emaSeriesIds = new Set(emaSeries.map(series => series.id))
    expect(emaSeriesIds).toEqual(new Set(['ema_20_15m', 'ema_60_15m', 'ema_144_15m']))

    const predicateJson = JSON.stringify(ir.signalCatalog.predicates)
    for (const seriesId of emaSeriesIds) {
      expect(predicateJson).toContain(seriesId)
    }
  })
})
