import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'

function atom(key: string, params: Record<string, unknown> = {}): AtomExprAtom {
  return { kind: 'atom', key, params }
}

function buildSemanticStateWithTypedRules(rules: SemanticRule[]): SemanticState {
  return {
    version: 1,
    families: ['grid'],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ETHUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
      timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
    },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
    rules,
  }
}

describe('stage1 corpus to script consistency', () => {
  it('keeps program rules through canonical and script generation', () => {
    const semanticState = buildSemanticStateWithTypedRules([{
      id: 'program-grid-1',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        actions: [],
        risks: [atom('risk.stop_loss_pct', { valuePct: 5, basis: 'entry_avg_price' })],
        positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        orchestration: [atom('scope.symbol', { symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' })],
        programs: [atom('program.fixed_grid_gated', {
          anchorPrice: 3200,
          lowerBound: 3000,
          upperBound: 3400,
          levelCount: 10,
          stepPct: 0.4,
          onDeactivate: 'cancel',
        })],
      },
    }])

    const canonical = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
    const program = canonical.orchestration?.programs?.find(item => item.programKind === 'fixed_grid_gated')

    expect(program).toMatchObject({
      programKind: 'fixed_grid_gated',
      gridParams: {
        anchorPrice: 3200,
        lowerBound: 3000,
        upperBound: 3400,
        levelCount: 10,
        stepPct: 0.4,
      },
      sizing: { mode: 'fixed_quote', value: 10 },
    })
    expect(canonical.orchestration?.scopes).toEqual([
      expect.objectContaining({
        scopeKind: 'symbol',
        symbols: ['ETHUSDT'],
        primarySymbol: 'ETHUSDT',
      }),
    ])
    expect(canonical.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({ key: 'position_loss_pct' }),
      }),
    ]))

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: canonical,
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(canonical, 'long_short'),
    })

    expect(JSON.stringify(compiled.ir.orchestrationPrograms)).toContain('fixed_grid_gated')
    expect(script).toContain('ORCHESTRATION_PROGRAMS')
    expect(script).toContain('fixed_grid_gated')
    expect(script).toContain('ETHUSDT')
  })
})
