import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'

const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1m',
  positionPct: 10,
}

function baseSpec(overrides: Partial<CanonicalStrategySpecV2>): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'spot', defaultTimeframe: '1m' },
    indicators: [],
    sizing: { mode: 'QUOTE', value: 100 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['1m'] },
    rules: [],
    ...overrides,
  } satisfies CanonicalStrategySpecV2
}

describe('rules atom follow-up runtime closure', () => {
  it.each([
    ['action.limit_order', { orderType: 'limit', limitPrice: 65000, timeInForce: 'ioc' }],
    ['action.conditional_order', { orderType: 'limit', limitPrice: 70000, timeInForce: 'ioc', triggerConditionRef: 'rules[0].condition' }],
  ] as const)('%s compiles order metadata into decision program actions', (atomKey, expectedOrder) => {
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: baseSpec({
        rules: [{
          id: `entry-${atomKey}`,
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          metadata: { sourcePath: 'rules[0]' },
          condition: { kind: 'expression', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'series', source: 'bar', field: 'open' } },
          actions: [{ type: 'OPEN_LONG', atomKey, params: { limitPrice: expectedOrder.limitPrice, timeInForce: 'ioc' } }],
        }],
      }),
      fallback,
    })

    expect(ir.ruleBlocks[0]?.actions[0]).toEqual(expect.objectContaining({ order: expectedOrder }))
  })

  it('action.limit_order without limitPrice compiles as signal-price limit order', () => {
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: baseSpec({
        rules: [{
          id: 'entry-limit-without-price',
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          condition: { kind: 'expression', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'series', source: 'bar', field: 'open' } },
          actions: [{ type: 'OPEN_LONG', atomKey: 'action.limit_order' }],
        }],
      }),
      fallback,
    })

    expect(ir.ruleBlocks[0]?.actions[0]?.order).toEqual({ orderType: 'limit', timeInForce: 'gtc' })
  })

  it.each(['twap', 'dca', 'martingale', 'rebalance', 'iceberg'] as const)(
    'program.%s compiles to deploy script payload and live order fan-out payload',
    (programKind) => {
      const { ir } = new CanonicalSpecV2IrCompilerService().compile({
        canonicalSpec: baseSpec({
          orchestration: {
            gates: [{
              id: 'gate-entry',
              activeWhen: { kind: 'expression', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'series', source: 'bar', field: 'open' } },
              target: 'order_programs',
              effectWhenFalse: 'cancel',
            }],
            programs: [{
              id: `program-${programKind}`,
              sourcePath: `rules[0].effects.programs.${programKind}`,
              programKind,
              activeWhenRef: 'gate-entry',
              onDeactivate: 'cancel',
              params: { totalSize: 1000, sliceCount: 10 },
            }],
          },
        }),
        fallback,
      })

      const ast = new CanonicalStrategyAstCompilerService().compile(ir)
      const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope: { mode: 'backtest' } })
      expect(script).toContain(`"programKind":"${programKind}"`)

      const state = runOrderPrograms(
        {} as never,
        [],
        { [ir.orchestrationPrograms[0]!.activeWhenExprId]: true },
        { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false } as never,
        [],
        {} as never,
        ir.orchestrationPrograms as never,
      )

      expect(state.workingOrders).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: `program-${programKind}`,
          sourceRef: `orchestration:program.${programKind}`,
          payload: expect.objectContaining({ programKind, params: { totalSize: 1000, sliceCount: 10 } }),
        }),
      ]))
    },
  )

  it('foundation predicate indicator_boundary compiles direct atom into backtest predicate payload', () => {
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: baseSpec({
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        rules: [{
          id: 'entry-indicator-boundary',
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'price.detect.indicator_boundary',
            semanticScope: 'market',
            params: { indicator: { name: 'bollinger', period: 20, stdDev: 2 }, boundaryRole: 'lower', confirmationMode: 'touch' },
          },
          actions: [{ type: 'OPEN_LONG' }],
        }],
      }),
      fallback,
    })

    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'LTE', args: expect.arrayContaining(['low_1m']) }),
    ]))
    expect(ir.runtimeRequirements.helpers).toContain('bollinger')
  })

  it('foundation risk atr_stop compiles to backtest/deploy risk predicate payload', () => {
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: baseSpec({
        rules: [{
          id: 'risk-atr-stop',
          phase: 'risk',
          sideScope: 'both',
          priority: 100,
          condition: { kind: 'atom', key: 'risk.atr_stop', semanticScope: 'position', params: { multiple: 2, period: 14 } },
          actions: [{ type: 'FORCE_EXIT' }],
        }],
      }),
      fallback,
    })

    expect(ir.riskPolicy.riskPredicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'risk-atr-stop', kind: 'atrTrailingStop', params: { multiplier: 2, period: 14 } }),
    ]))
  })

  it('foundation position fixed_notional compiles to fixed quote sizing payload', () => {
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: baseSpec({
        sizing: { mode: 'QUOTE', value: 250 },
        rules: [{
          id: 'entry-fixed-notional',
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          condition: { kind: 'expression', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'series', source: 'bar', field: 'open' } },
          actions: [{ type: 'OPEN_LONG' }],
        }],
      }),
      fallback,
    })

    expect(ir.portfolio.sizing).toEqual({ mode: 'fixed_quote', value: 250 })
    expect(ir.ruleBlocks[0]?.actions[0]?.quantity).toEqual({ mode: 'fixed_quote', value: 250 })
  })
})
