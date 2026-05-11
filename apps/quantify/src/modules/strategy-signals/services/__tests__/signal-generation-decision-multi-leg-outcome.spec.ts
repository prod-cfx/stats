/**
 * #1186 PR4a — multi-leg dispatch fan-out outcome builder.
 *
 * Covers the new `SignalGenerationDecisionStage.buildPublishedRuntimeMultiLegOutcome`
 * which converts a single onBar decision + ≥2 leg scopes into N per-leg
 * `AiSignalPayload`s with leg metadata. Single-leg / 0-leg fan-out is
 * intentionally NOT exercised here — the outer caller short-circuits to the
 * existing `buildPublishedRuntimeSignalOutcomeFromDecision` path which is
 * already covered by the legacy spec; that contract is byte-equal.
 */
import type { StrategyDecisionV1 } from '@ai/shared'
import { Logger } from '@nestjs/common'
import type { AiService } from '@/modules/ai/ai.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../../types/strategy-signals-config.type'
import {
  SignalGenerationDecisionStage,
  type MultiLegFanOutScope,
} from '../signal-generation-decision.stage'

const baseDecision: StrategyDecisionV1 = {
  action: 'OPEN_LONG',
  size: { mode: 'QUOTE', value: 0 },
  reason: 'multi_leg_dispatch_test',
  confidence: 80,
  risk: { stopLoss: 100, takeProfit: 200 },
} as unknown as StrategyDecisionV1

const baseCtx = {
  exchange: 'binance',
  marketType: 'spot' as const,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  referencePrice: 50_000,
}

const stage = new SignalGenerationDecisionStage(
  {} as AiService,
  new Logger('SignalGenerationDecisionStageMultiLegSpec'),
)

describe('SignalGenerationDecisionStage#buildPublishedRuntimeMultiLegOutcome (#1186 PR4a)', () => {
  it('fans out 2 leg scopes (fixed_quote 100 + fixed_quote 200) into 2 BUY ENTRY payloads with sizing override', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-A-scope',
        legId: 'leg-A',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100, asset: 'USDT' },
      },
      {
        id: 'leg-B-scope',
        legId: 'leg-B',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 200, asset: 'USDT' },
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('multi_leg')
    if (outcome.kind !== 'multi_leg') return

    expect(outcome.legs).toHaveLength(2)
    expect(outcome.legs[0].legId).toBe('leg-A')
    expect(outcome.legs[0].totalLegs).toBe(2)
    expect(outcome.legs[0].payload.direction).toBe('BUY')
    expect(outcome.legs[0].payload.signalType).toBe('ENTRY')
    expect(outcome.legs[0].payload.positionSizeQuote).toBe(100)
    expect(outcome.legs[0].payload.positionSizeRatio).toBeUndefined()
    expect(outcome.legs[0].payload.entryPrice).toBe(50_000)
    expect(outcome.legs[0].payload.reasoning).toContain('leg-A')

    expect(outcome.legs[1].legId).toBe('leg-B')
    expect(outcome.legs[1].payload.positionSizeQuote).toBe(200)
    expect(outcome.legs[1].payload.reasoning).toContain('leg-B')
  })

  it('hedge pair (long + short) emits BUY for long leg and SELL for short leg', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-spot-scope',
        legId: 'leg-spot',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100, asset: 'USDT' },
      },
      {
        id: 'leg-hedge-scope',
        legId: 'leg-hedge',
        direction: 'short',
        legSizing: { mode: 'fixed_quote', value: 100, asset: 'USDT', pairedLegId: 'leg-spot' },
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('multi_leg')
    if (outcome.kind !== 'multi_leg') return
    expect(outcome.legs[0].payload.direction).toBe('BUY')
    expect(outcome.legs[1].payload.direction).toBe('SELL')
    expect(outcome.legs[1].legSizing.pairedLegId).toBe('leg-spot')
  })

  it('axis heterogeneity: leg-A fixed_quote 100, leg-B fixed_pct 25 → leg-B yields positionSizeRatio=0.25', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-A-scope',
        legId: 'leg-A',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100 },
      },
      {
        id: 'leg-B-scope',
        legId: 'leg-B',
        direction: 'long',
        legSizing: { mode: 'fixed_pct', value: 25 },
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('multi_leg')
    if (outcome.kind !== 'multi_leg') return
    expect(outcome.legs[0].payload.positionSizeQuote).toBe(100)
    expect(outcome.legs[0].payload.positionSizeRatio).toBeUndefined()
    expect(outcome.legs[1].payload.positionSizeRatio).toBeCloseTo(0.25)
    expect(outcome.legs[1].payload.positionSizeQuote).toBeUndefined()
  })

  it('fail-fast emit-stage validation: leg with fixed_base axis → missing_required_truth (entire batch rejected)', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-A-scope',
        legId: 'leg-A',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100 },
      },
      {
        id: 'leg-B-scope',
        legId: 'leg-B',
        direction: 'long',
        legSizing: { mode: 'fixed_base', value: 0.001, asset: 'BTC' },
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('missing_required_truth')
    if (outcome.kind !== 'missing_required_truth') return
    expect(outcome.reasonCode).toBe('MULTI_LEG_DISPATCH_LEG_SIZING_MODE_UNSUPPORTED')
    expect(outcome.fields).toEqual(expect.arrayContaining([expect.stringContaining('leg-B')]))
  })

  it('fail-fast emit-stage validation: leg missing legSizing → missing_required_truth', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-A-scope',
        legId: 'leg-A',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100 },
      },
      {
        id: 'leg-B-scope',
        legId: 'leg-B',
        direction: 'long',
        // legSizing omitted on purpose
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('missing_required_truth')
    if (outcome.kind !== 'missing_required_truth') return
    expect(outcome.reasonCode).toBe('MULTI_LEG_DISPATCH_LEG_SIZING_MISSING')
  })

  it('guard: <2 leg scopes returns missing_required_truth (caller is responsible for pre-filtering, defense-in-depth)', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      {
        id: 'leg-only-scope',
        legId: 'leg-only',
        direction: 'long',
        legSizing: { mode: 'fixed_quote', value: 100 },
      },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('missing_required_truth')
    if (outcome.kind !== 'missing_required_truth') return
    expect(outcome.reasonCode).toBe('MULTI_LEG_DISPATCH_REQUIRES_TWO_OR_MORE_LEGS')
  })

  it('guard: missing referencePrice → missing_required_truth', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      { id: 'a', legId: 'a', direction: 'long', legSizing: { mode: 'fixed_quote', value: 100 } },
      { id: 'b', legId: 'b', direction: 'long', legSizing: { mode: 'fixed_quote', value: 200 } },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      baseDecision,
      legScopes,
      { ...baseCtx, referencePrice: undefined },
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('missing_required_truth')
    if (outcome.kind !== 'missing_required_truth') return
    expect(outcome.reasonCode).toBe('MULTI_LEG_DISPATCH_REFERENCE_PRICE_MISSING')
  })

  it('guard: blank reason → missing_required_truth', () => {
    const legScopes: readonly MultiLegFanOutScope[] = [
      { id: 'a', legId: 'a', direction: 'long', legSizing: { mode: 'fixed_quote', value: 100 } },
      { id: 'b', legId: 'b', direction: 'long', legSizing: { mode: 'fixed_quote', value: 200 } },
    ]

    const outcome = stage.buildPublishedRuntimeMultiLegOutcome(
      { ...baseDecision, reason: '   ' } as StrategyDecisionV1,
      legScopes,
      baseCtx,
      DEFAULT_STRATEGY_SIGNALS_CONFIG,
    )

    expect(outcome.kind).toBe('missing_required_truth')
    if (outcome.kind !== 'missing_required_truth') return
    expect(outcome.reasonCode).toBe('MULTI_LEG_DISPATCH_REASONING_MISSING')
  })
})
