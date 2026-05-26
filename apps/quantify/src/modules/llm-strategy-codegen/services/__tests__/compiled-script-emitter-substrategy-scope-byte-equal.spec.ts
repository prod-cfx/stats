import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptProjection, CompiledScriptExecutionEnvelope } from '../../types/compiled-script-projection'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

/**
 * Phase 5 S10 (#1111) — byte-equal snapshot 防退化 (镜像 S2 byte-equal spec)
 *
 * 验证 plan §11.5 / §7 字节兼容承诺：
 *   1. 零 sub ast → emit 输出**不含** ORCHESTRATION_SCOPES const（旧策略字节零侵入）
 *   2. 单 sub ast → emit 输出**仍含** ORCHESTRATION_SCOPES const（plan §11.5 "非空就 emit"）
 *      但 structuralDigest 不含 scopes（旧 v1 hash 不变）
 *   3. 双 sub ast → emit 输出含 ORCHESTRATION_SCOPES const + 双变体 round-trip parser 等价
 *   4. round-trip：零 sub emit → parse → orchestrationScopes === undefined
 *   5. round-trip：双 sub emit → parse → orchestrationScopes 双变体 union narrowing 等价
 */

const baseAst: StrategyAstV1 = {
  astVersion: 'csa.v1',
  manifest: {
    irVersion: 'csi.v1',
    irHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    specHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    astDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    compileVersion: 'compiler.v1',
    structuralDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  },
  executionModel: {
    venue: 'binance',
    instrumentType: 'spot',
    symbol: 'BTCUSDT',
    primaryTimeframe: '1h',
    timeframeAlignment: 'strict',
    signalEvaluation: 'bar_close',
    fillPolicy: 'next_bar_open',
    defaultOrderType: 'market',
    allowPartialFill: false,
  },
  dataRequirements: { warmupBars: 0, maxLookback: 0, requiredTimeframes: ['1h'] },
  exprPool: [],
  guards: [],
  decisionPrograms: [],
  orderPrograms: [],
  topology: {
    exprOrder: [],
    guardOrder: [],
    decisionOrder: [],
    orderProgramOrder: [],
  },
}

const envelope: CompiledScriptExecutionEnvelope = {
  positionMode: 'long_only',
  marginMode: 'cash',
  tickSize: 0.01,
  pricePrecision: 2,
  quantityPrecision: 4,
  fillAssumption: 'strict',
}

const trendSub = {
  id: 'ss-trend',
  scopeKind: 'subStrategy' as const,
  subStrategyId: 'trend_sub',
  subStrategyLabel: '趋势子策略',
  positionHandlingOnDeactivate: 'close' as const,
  orderHandlingOnDeactivate: 'cancel' as const,
}
const rangeSub = {
  id: 'ss-range',
  scopeKind: 'subStrategy' as const,
  subStrategyId: 'range_sub',
  subStrategyLabel: '震荡子策略',
  positionHandlingOnDeactivate: 'keep' as const,
  orderHandlingOnDeactivate: 'keep' as const,
}

describe('compiled-script-emitter — scope.subStrategy byte-equal snapshot (Phase 5 S10 #1111)', () => {
  const emitter = new CompiledScriptEmitterService()
  const parser = new CompiledScriptParserService()

  it('零 sub ast → emit 输出不含 ORCHESTRATION_SCOPES 字面 const', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    expect(script).not.toContain('const ORCHESTRATION_SCOPES')
  })

  it('单 sub ast → emit 输出仍含 const ORCHESTRATION_SCOPES = [...]（plan §11.5 非空就 emit）', () => {
    const astSingle: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [trendSub],
    }
    const script = emitter.emit({ ast: astSingle, executionEnvelope: envelope })
    expect(script).toContain('const ORCHESTRATION_SCOPES')
    expect(script).toContain('"id":"ss-trend"')
    expect(script).toContain('"scopeKind":"subStrategy"')
    expect(script).toContain('"subStrategyId":"trend_sub"')
  })

  it('单 sub ast 的 structuralDigest 与零 sub ast 相同（structuralProjection 不含 scopes）', () => {
    const projectionNoScope = emitter.buildProjection({ ast: baseAst, executionEnvelope: envelope })
    const astSingle: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [trendSub],
    }
    const projectionSingle = emitter.buildProjection({ ast: astSingle, executionEnvelope: envelope })
    // 旧 v1 hash 兼容：scopes 不参与 structuralDigest
    expect(projectionSingle.compiledManifest.structuralDigest).toBe(
      projectionNoScope.compiledManifest.structuralDigest,
    )
  })

  it('双 sub ast → emit 输出含 const ORCHESTRATION_SCOPES = [...] + 双变体 round-trip parser 等价', () => {
    const astDouble: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [trendSub, rangeSub],
    }
    const script = emitter.emit({ ast: astDouble, executionEnvelope: envelope })
    expect(script).toContain('const ORCHESTRATION_SCOPES')
    expect(script).toContain('"id":"ss-trend"')
    expect(script).toContain('"id":"ss-range"')
    expect(script).toContain('"subStrategyId":"trend_sub"')
    expect(script).toContain('"subStrategyId":"range_sub"')
  })

  it('round-trip: 零 sub emit → parse → projection.orchestrationScopes === undefined', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    const projection: CompiledScriptProjection = parser.parse(script)
    expect(projection.orchestrationScopes).toBeUndefined()
  })

  it('round-trip: 双 sub emit → parse → orchestrationScopes 双变体 union narrowing 等价', () => {
    const astDouble: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [trendSub, rangeSub],
    }
    const script = emitter.emit({ ast: astDouble, executionEnvelope: envelope })
    const projection = parser.parse(script)
    const scopes = projection.orchestrationScopes ?? []
    expect(scopes.length).toBe(2)
    // discriminated union narrowing
    for (const scope of scopes) {
      expect(scope.scopeKind).toBe('subStrategy')
      if (scope.scopeKind === 'subStrategy') {
        expect(['trend_sub', 'range_sub']).toContain(scope.subStrategyId)
        expect(['close', 'keep']).toContain(scope.positionHandlingOnDeactivate)
        expect(['cancel', 'keep']).toContain(scope.orderHandlingOnDeactivate)
      }
    }
    // 双向等价
    expect(scopes).toEqual([trendSub, rangeSub])
  })
})
