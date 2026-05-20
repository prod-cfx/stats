import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function makeStateWithRiskGuardExitRules(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [
      {
        id: 'entry-drop-cond',
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          basis: 'entry_avg_price',
          window: '3m',
          valuePct: 1,
          direction: 'down',
        },
      },
      {
        id: 'exit-rise-cond',
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          basis: 'entry_avg_price',
          window: '15m',
          valuePct: 2,
          direction: 'up',
        },
      },
      {
        id: 'risk-stoploss-position-cond',
        key: 'position.has_position',
        phase: 'exit',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
      },
      {
        id: 'risk-takeprofit-position-cond',
        key: 'position.has_position',
        phase: 'exit',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
      },
    ],
    action: [
      {
        id: 'entry-open-long',
        key: 'action.open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {},
      },
      {
        id: 'exit-close-long',
        key: 'action.close_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {},
      },
    ],
    risk: [
      {
        id: 'risk-stoploss',
        key: 'risk.stop_loss_pct',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { basis: 'entry_avg_price', valuePct: 5 },
      },
      {
        id: 'risk-takeprofit',
        key: 'risk.take_profit_pct',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { basis: 'entry_avg_price', valuePct: 10 },
      },
    ],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
      constraints: [],
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '交易所',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '标的',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '15m',
        status: 'locked',
        priority: 'context',
        questionHint: '周期',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'perp',
        status: 'locked',
        priority: 'context',
        questionHint: '市场类型',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
  }
}

describe('CanonicalSpecBuilderService position.has_position risk guard handling', () => {
  it('does not turn risk guard position.has_position into executable exit rules', () => {
    const builder = new CanonicalSpecBuilderService()
    const spec = builder.buildFromSemanticState(makeStateWithRiskGuardExitRules())

    expect(spec.rules.filter(rule =>
      rule.phase === 'exit'
      && rule.condition.kind === 'atom'
      && rule.condition.key === 'position.has_position',
    )).toEqual([])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'semantic-risk-stop-loss', phase: 'risk' }),
      expect.objectContaining({ id: 'semantic-risk-take-profit', phase: 'risk' }),
    ]))

    const compiler = new CanonicalSpecV2IrCompilerService()
    expect(() => compiler.compile({
      canonicalSpec: spec,
      fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
    })).not.toThrow(/position\.has_position/)
  })
})
