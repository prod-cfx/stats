/**
 * Issue #1498 — RISK_PREDICATE_ATOM_EMITS dispatch + end-to-end snapshot spec
 *
 * 1. `ATOM_CONTRACT_REGISTRY[key].emit.riskPredicateShape === RISK_PREDICATE_ATOM_EMITS[key].riskPredicateShape`
 *    引用相等（守门 completePr1bRegistry 合并链路）。
 * 2. `capabilityStatus === 'pr3e-risk-predicate'`，确保 dispatcher 走 REGISTRY 调度。
 * 3. 4 个 atom（risk.atr_take_profit / risk.atr_multiple_stop /
 *    risk.atr_multiple_take_profit / risk.remembered_level_stop）通过
 *    `CanonicalSpecV2IrCompilerService.compile()` 端到端走一遍 emit.riskPredicateShape →
 *    snapshot riskPredicates 投影，锁定 byte-equal 行为。
 */

import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { RISK_PREDICATE_ATOM_EMITS } from '../atom-contract-risk-predicate-emits'
import { CanonicalSpecV2IrCompilerService } from '../../services/canonical-spec-v2-ir-compiler.service'

const RISK_PREDICATE_ATOM_KEYS = Object.keys(RISK_PREDICATE_ATOM_EMITS) as Array<keyof typeof RISK_PREDICATE_ATOM_EMITS>

describe('Issue #1498 — risk predicate atom emit dispatch decision', () => {
  describe.each(RISK_PREDICATE_ATOM_KEYS)('atom %s', (key) => {
    it('capabilityStatus 升级为 pr3e-risk-predicate', () => {
      expect(ATOM_CONTRACT_REGISTRY[key].emit.capabilityStatus).toBe('pr3e-risk-predicate')
    })

    it('REGISTRY 拿到的 riskPredicateShape === RISK_PREDICATE_ATOM_EMITS 源引用', () => {
      expect(ATOM_CONTRACT_REGISTRY[key].emit.riskPredicateShape)
        .toBe(RISK_PREDICATE_ATOM_EMITS[key].riskPredicateShape)
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

function buildSpec(riskCondition: CanonicalStrategySpecV2['rules'][number]['condition']): CanonicalStrategySpecV2 {
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
    rules: [
      {
        id: 'rule-entry',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: { kind: 'atom', key: 'execution.on_start' },
        actions: [{ type: 'OPEN_LONG' }],
      },
      {
        id: 'rule-risk',
        phase: 'risk',
        sideScope: 'long',
        priority: 100,
        condition: riskCondition,
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ],
  } satisfies CanonicalStrategySpecV2
}

function projectRiskPredicates(
  riskCondition: CanonicalStrategySpecV2['rules'][number]['condition'],
): {
  riskPredicates: ReadonlyArray<{ id: string; kind: string; params: Record<string, unknown>; actions?: ReadonlyArray<{ kind: string }> }>
  helpers: ReadonlyArray<string>
  stateKeys: ReadonlyArray<string>
} {
  const compiler = new CanonicalSpecV2IrCompilerService()
  const result = compiler.compile({ canonicalSpec: buildSpec(riskCondition), fallback })
  return {
    riskPredicates: (result.ir.riskPolicy?.riskPredicates ?? []).map(p => ({
      id: p.id,
      kind: p.kind,
      params: p.params,
      actions: p.actions,
    })),
    helpers: [...result.ir.runtimeRequirements.helpers].sort(),
    stateKeys: [...result.ir.runtimeRequirements.stateKeys].sort(),
  }
}

describe('Issue #1498 — risk predicate atom emit shape snapshot', () => {
  it('risk.atr_take_profit (period=14 multiple=3)', () => {
    expect(projectRiskPredicates({
      kind: 'atom',
      key: 'risk.atr_take_profit',
      params: { period: 14, multiple: 3 },
    })).toMatchSnapshot()
  })

  it('risk.atr_multiple_stop (multiple=2)', () => {
    expect(projectRiskPredicates({
      kind: 'atom',
      key: 'risk.atr_multiple_stop',
      params: { multiple: 2 },
    })).toMatchSnapshot()
  })

  it('risk.atr_multiple_take_profit (multiple=3)', () => {
    expect(projectRiskPredicates({
      kind: 'atom',
      key: 'risk.atr_multiple_take_profit',
      params: { multiple: 3 },
    })).toMatchSnapshot()
  })

  it('risk.remembered_level_stop (levelKey=breakout_price)', () => {
    expect(projectRiskPredicates({
      kind: 'atom',
      key: 'risk.remembered_level_stop',
      params: { levelKey: 'breakout_price' },
    })).toMatchSnapshot()
  })
})
