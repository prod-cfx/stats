/**
 * Issue #1494 — condition predicate atom emit dispatch decision snapshot
 *
 * 锁住 PR3a Phase 2 兑现的 23 个 condition atom：
 *   1. `ATOM_CONTRACT_REGISTRY[key].emit.irShape === CONDITION_ATOM_EMITS[key].irShape`
 *      引用相等（守门 completePr1bRegistry 合并链路；与 action-emit-dispatch.spec 同形）。
 *   2. `capabilityStatus === 'pr3a-condition'`，确保 dispatcher 走 REGISTRY 调度而非
 *      legacy switch / Pr1bStub。
 *   3. 核心 8 个 atom（execution.on_start / indicator.above / indicator.below /
 *      ma.golden_cross[indicator.cross_over] / ma.death_cross[indicator.cross_under] /
 *      oscillator.rsi_lte / oscillator.rsi_gte / bollinger.touch_upper） 通过
 *      `CanonicalSpecV2IrCompilerService.compile()` 端到端走一遍 emit.irShape →
 *      snapshot predicateMap / seriesMap 投影，锁定 byte-equal 行为。
 *
 * 受影响 atom：CONDITION_ATOM_EMITS 全量（23 个）。其余 15 个 atom 的端到端 snapshot
 * 由 atom-coverage-ir-end-to-end.contract.spec.ts 与 canonical-spec-v2-ir-compiler
 * 历史 spec 兜底，本 spec 仅做契约状态守门。
 */

import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { CONDITION_ATOM_EMITS } from '../atom-contract-condition-emits'
import { CanonicalSpecV2IrCompilerService } from '../../services/canonical-spec-v2-ir-compiler.service'

const CONDITION_ATOM_KEYS = Object.keys(CONDITION_ATOM_EMITS) as Array<keyof typeof CONDITION_ATOM_EMITS>

describe('Issue #1494 — condition atom emit dispatch decision', () => {
  describe.each(CONDITION_ATOM_KEYS)('atom %s', (key) => {
    it('capabilityStatus 升级为 pr3a-condition', () => {
      expect(ATOM_CONTRACT_REGISTRY[key].emit.capabilityStatus).toBe('pr3a-condition')
    })

    it('REGISTRY 拿到的 irShape === CONDITION_ATOM_EMITS 源引用', () => {
      expect(ATOM_CONTRACT_REGISTRY[key].emit.irShape).toBe(CONDITION_ATOM_EMITS[key].irShape)
    })
  })
})

// 端到端 snapshot：通过完整 CanonicalSpecV2 走 compile() 路径，行为与生产链路等价。
const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1h',
  positionPct: 10,
}

function buildSpec(condition: CanonicalStrategySpecV2['rules'][number]['condition']): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '1h',
    },
    indicators: [],
    sizing: { mode: 'QUOTE', value: 10 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['1h'] },
    rules: [{
      id: 'rule-0',
      phase: 'entry',
      sideScope: 'long',
      priority: 200,
      condition,
      actions: [{ type: 'OPEN_LONG' }],
    }],
  } satisfies CanonicalStrategySpecV2
}

function projectIr(condition: CanonicalStrategySpecV2['rules'][number]['condition']): {
  predicates: ReadonlyArray<{ id: string; kind: string; args: ReadonlyArray<string> }>
  seriesKinds: ReadonlyArray<{ id: string; kind: string }>
  helpers: ReadonlyArray<string>
} {
  const compiler = new CanonicalSpecV2IrCompilerService()
  const result = compiler.compile({ canonicalSpec: buildSpec(condition), fallback })
  return {
    predicates: result.ir.signalCatalog.predicates.map(p => ({ id: p.id, kind: p.kind, args: p.args })),
    seriesKinds: result.ir.signalCatalog.series.map(s => ({ id: s.id, kind: s.kind })),
    helpers: [...result.ir.runtimeRequirements.helpers].sort(),
  }
}

describe('Issue #1494 — core condition atom emit shape snapshot', () => {
  it('execution.on_start', () => {
    expect(projectIr({ kind: 'atom', key: 'execution.on_start' })).toMatchSnapshot()
  })

  it('indicator.above (sma period=20)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'indicator.above',
      params: { indicator: 'sma', period: 20 },
    })).toMatchSnapshot()
  })

  it('indicator.below (sma period=20)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'indicator.below',
      params: { indicator: 'sma', period: 20 },
    })).toMatchSnapshot()
  })

  it('indicator.cross_over (ma golden cross)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'indicator.cross_over',
      params: { indicator: 'ma', fast: 7, slow: 30 },
    })).toMatchSnapshot()
  })

  it('indicator.cross_under (ma death cross)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'indicator.cross_under',
      params: { indicator: 'ma', fast: 7, slow: 30 },
    })).toMatchSnapshot()
  })

  it('oscillator.rsi_lte (period=14 threshold=30)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      op: 'LTE',
      value: 30,
      params: { period: 14 },
    })).toMatchSnapshot()
  })

  it('oscillator.rsi_gte (period=14 threshold=70)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'oscillator.rsi_gte',
      op: 'GTE',
      value: 70,
      params: { period: 14 },
    })).toMatchSnapshot()
  })

  it('bollinger.touch_upper (default touch semantics)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'bollinger.touch_upper',
      params: {},
    })).toMatchSnapshot()
  })
})

// Issue #1498 S1 — condition.sequence 五个 sequenceKind 分支 snapshot 守门
describe('Issue #1498 S1 — condition.sequence emit shape snapshot', () => {
  it('sequenceKind=pullback_reclaim (ma period=20)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'condition.sequence',
      params: { sequenceKind: 'pullback_reclaim', 'reference.indicator': 'ma', 'reference.period': 20 },
    })).toMatchSnapshot()
  })

  it('sequenceKind=rsi_reclaim (period=14 threshold=30)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'condition.sequence',
      params: { sequenceKind: 'rsi_reclaim', period: 14, threshold: 30 },
    })).toMatchSnapshot()
  })

  it('sequenceKind=consecutive_body (count=3 direction=up)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'condition.sequence',
      params: { sequenceKind: 'consecutive_body', count: 3, direction: 'up' },
    })).toMatchSnapshot()
  })

  it('sequenceKind=breakout_then_retest (direction=up lookback=24)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'condition.sequence',
      params: { sequenceKind: 'breakout_then_retest', direction: 'up', lookbackBars: 24 },
    })).toMatchSnapshot()
  })

  it('sequenceKind=pattern_then_volume_spike (direction=up lookback=20)', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'condition.sequence',
      params: { sequenceKind: 'pattern_then_volume_spike', direction: 'up', lookbackBars: 20 },
    })).toMatchSnapshot()
  })
})

// Issue #1498 S2 — price.previous_extrema_retest 两个组合 snapshot 守门
describe('Issue #1498 S2 — price.previous_extrema_retest emit shape snapshot', () => {
  it('direction=up extremaType=high memoryKey 显式', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'price.previous_extrema_retest',
      params: {
        extremaType: 'high',
        retestKind: 'not_break',
        lookbackBars: 24,
        memoryKey: 'breakout_high_24',
      },
    })).toMatchSnapshot()
  })

  it('direction=down extremaType=low memoryKey 默认 auto', () => {
    expect(projectIr({
      kind: 'atom',
      key: 'price.previous_extrema_retest',
      params: {
        extremaType: 'low',
        retestKind: 'not_break',
        lookbackBars: 24,
        memoryKey: 'auto',
      },
    })).toMatchSnapshot()
  })
})

