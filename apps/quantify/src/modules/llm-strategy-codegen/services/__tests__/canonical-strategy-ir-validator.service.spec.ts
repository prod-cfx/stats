import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyIrValidatorService } from '../canonical-strategy-ir-validator.service'

describe('canonicalStrategyIrValidatorService', () => {
  function buildValidIr(): CanonicalStrategyIrV1 {
    return {
      irVersion: 'csi.v1',
      source: {
        graphVersion: 1,
        graphDigest: 'sha256:graph',
        specHash: 'sha256:graph',
      },
      market: {
        venue: 'binance',
        instrumentType: 'spot',
        symbol: 'BTCUSDT',
        timeframes: ['15m'],
        priceFeed: 'close',
      },
      portfolio: {
        positionMode: 'long_only',
        sizing: { mode: 'pct_equity', value: 10 },
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: 21,
        maxLookback: 21,
        requiredTimeframes: ['15m'],
      },
      signalCatalog: {
        series: [
          { id: 'close_15m', kind: 'PRICE', timeframe: '15m', field: 'close' },
        ],
        levelSets: [],
        predicates: [
          { id: 'entry_predicate', kind: 'GT', args: ['close_15m'] },
        ],
      },
      ruleBlocks: [
        {
          id: 'entry_001',
          phase: 'entry',
          when: 'entry_predicate',
          priority: 200,
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
        },
      ],
      orderPrograms: [],
      riskPolicy: { guards: [] },
      executionPolicy: {
        signalEvaluation: 'bar_close',
        fillPolicy: 'next_bar_open',
        timeframeAlignment: 'strict',
        orderTypeDefault: 'market',
        timeInForce: 'gtc',
        allowPartialFill: false,
      },
    }
  }

  it('rejects predicates that mix timeframes under strict alignment', () => {
    const validator = new CanonicalStrategyIrValidatorService()

    const ir: CanonicalStrategyIrV1 = {
      irVersion: 'csi.v1',
      source: {
        graphVersion: 1,
        graphDigest: 'sha256:graph',
        specHash: 'sha256:graph',
      },
      market: {
        venue: 'binance',
        instrumentType: 'spot',
        symbol: 'BTCUSDT',
        timeframes: ['15m', '1h'],
        priceFeed: 'close',
      },
      portfolio: {
        positionMode: 'long_only',
        sizing: { mode: 'pct_equity', value: 10 },
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: 21,
        maxLookback: 21,
        requiredTimeframes: ['15m', '1h'],
      },
      signalCatalog: {
        series: [
          { id: 'close_15m', kind: 'PRICE', timeframe: '15m', field: 'close' },
          { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
        ],
        levelSets: [],
        predicates: [
          { id: 'mixed_predicate', kind: 'GT', args: ['close_15m', 'close_1h'] },
        ],
      },
      ruleBlocks: [
        {
          id: 'entry_001',
          phase: 'entry',
          when: 'mixed_predicate',
          priority: 200,
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
        },
      ],
      orderPrograms: [],
      riskPolicy: { guards: [] },
      executionPolicy: {
        signalEvaluation: 'bar_close',
        fillPolicy: 'next_bar_open',
        timeframeAlignment: 'strict',
        orderTypeDefault: 'market',
        timeInForce: 'gtc',
        allowPartialFill: false,
      },
    }

    expect(() => validator.validate(ir)).toThrow('codegen.ir_timeframe_mismatch')
  })

  it('rejects risk guards with invalid appliesTo values', () => {
    const validator = new CanonicalStrategyIrValidatorService()
    const ir = buildValidIr()
    ir.riskPolicy.guards = [{
      id: 'risk-invalid-side',
      kind: 'STOP_LOSS_PCT',
      scope: 'position',
      appliesTo: 'inverse' as never,
      value: 5,
      onBreach: 'FORCE_EXIT',
    }]

    expect(() => validator.validate(ir)).toThrow('codegen.ir_guard_applies_to_invalid')
  })
})
