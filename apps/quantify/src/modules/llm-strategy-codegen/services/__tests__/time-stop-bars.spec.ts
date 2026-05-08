import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  positionPct: 10,
}

function makeTimeStopRiskSpec(params: {
  maxBars?: unknown
  scope?: unknown
  effect?: unknown
  reducePct?: unknown
  actionType?: 'CLOSE_LONG' | 'CLOSE_SHORT' | 'FORCE_EXIT'
}): CanonicalStrategySpecV2 {
  const conditionParams: Record<string, unknown> = {}
  if (params.maxBars !== undefined) conditionParams.maxBars = params.maxBars
  if (params.scope !== undefined) conditionParams.scope = params.scope
  if (params.effect !== undefined) conditionParams.effect = params.effect
  if (params.reducePct !== undefined) conditionParams.reducePct = params.reducePct

  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    },
    indicators: [],
    sizing: { mode: 'RATIO', value: 0.1 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['15m'] },
    rules: [
      {
        id: 'risk-time-stop-bars',
        phase: 'risk',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'risk.time_stop_bars',
          semanticScope: 'position',
          op: 'GTE',
          params: conditionParams as Record<string, number | string | boolean>,
        },
        actions: [{ type: params.actionType ?? 'FORCE_EXIT' }],
      },
    ],
  }
}

describe('phase 3 risk.time_stop_bars', () => {
  describe('semantic atom registry', () => {
    const registry = new SemanticAtomRegistryService()

    it('registers risk.time_stop_bars as supported_executable with bars_held + market_close requirements', () => {
      const atom = registry.get('risk.time_stop_bars')
      expect(atom).toMatchObject({
        key: 'risk.time_stop_bars',
        category: 'risk',
        supportStatus: 'supported_executable',
        executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
      })
      expect(atom.requiredParams).toEqual(expect.arrayContaining(['maxBars', 'scope', 'effect']))
      if (atom.supportStatus !== 'recognized_unsupported') {
        expect(atom.contractSubstrate?.runtimeRequirements).toEqual(expect.arrayContaining([
          expect.objectContaining({ verb: 'read', object: 'position.bars_held' }),
        ]))
        expect(atom.contractSubstrate?.orderRequirements).toEqual(expect.arrayContaining([
          expect.objectContaining({ verb: 'submit', object: 'market_close' }),
        ]))
      }
    })
  })

  describe('ir compiler', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    it('compiles risk.time_stop_bars (effect=close_position) into a TIME_STOP_BARS risk predicate', () => {
      const spec = makeTimeStopRiskSpec({
        maxBars: 10,
        scope: 'both',
        effect: 'close_position',
        actionType: 'FORCE_EXIT',
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })

      expect(result.ir.riskPolicy.riskPredicates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'timeStopBars',
          params: expect.objectContaining({ maxBars: 10, scope: 'both' }),
        }),
      ]))
    })

    it('preserves CLOSE_LONG side action for scope=long close_position', () => {
      const spec = makeTimeStopRiskSpec({
        maxBars: 5,
        scope: 'long',
        effect: 'close_position',
        actionType: 'CLOSE_LONG',
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const predicate = result.ir.riskPolicy.riskPredicates?.find(p => p.kind === 'timeStopBars')
      expect(predicate).toBeDefined()
      expect(predicate?.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'CLOSE_LONG' }),
      ]))
    })

    it('does not emit risk predicate when effect=reduce_position (MVP: routes to follow-up)', () => {
      // effect=reduce_position requires reducePct + a partial-reduce rule block; out of MVP scope.
      const spec = makeTimeStopRiskSpec({
        maxBars: 10,
        scope: 'both',
        effect: 'reduce_position',
        actionType: 'FORCE_EXIT',
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const predicates = result.ir.riskPolicy.riskPredicates ?? []
      expect(predicates.find(p => p.kind === 'timeStopBars')).toBeUndefined()
    })

    it('does not emit risk predicate when maxBars=0 (fail-closed)', () => {
      const spec = makeTimeStopRiskSpec({
        maxBars: 0,
        scope: 'both',
        effect: 'close_position',
        actionType: 'FORCE_EXIT',
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const predicates = result.ir.riskPolicy.riskPredicates ?? []
      expect(predicates.find(p => p.kind === 'timeStopBars')).toBeUndefined()
    })

    it('does not emit risk predicate when maxBars is fractional (fail-closed)', () => {
      const spec = makeTimeStopRiskSpec({
        maxBars: 2.5,
        scope: 'both',
        effect: 'close_position',
        actionType: 'FORCE_EXIT',
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })
      const predicates = result.ir.riskPolicy.riskPredicates ?? []
      expect(predicates.find(p => p.kind === 'timeStopBars')).toBeUndefined()
    })
  })
})
