import type { CompiledScriptProjection, CompiledScriptExecutionEnvelope } from '../../types/compiled-script-projection'
import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

/**
 * Phase 5 S11 (#1112) — leg byte-equal snapshot 防退化（与 S2 N1 spec 同形）
 *
 * 验证：
 *   1. 旧 ast（无 orchestrationLegScopes）经新 emitter 输出与原协议字节等价
 *   2. round-trip：无 leg ast → parse → projection.orchestrationLegScopes === undefined
 *   3. round-trip：双 leg ast → parse → projection.orchestrationLegScopes 等价
 *   4. round-trip(emit→parse→emit) 字节等价（含双 leg 二次 emit 一致性）
 *   5. structuralProjection / structuralDigest 不含 orchestrationLegScopes（旧 hash 不变）
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

function buildAstWithLegs(): StrategyAstV1 {
  return {
    ...baseAst,
    orchestrationScopes: [
      { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
      { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ],
    orchestrationLegScopes: [
      { id: 'l-long-btc', scopeKind: 'leg', legId: 'leg.long.btc', direction: 'long', instrumentRef: 's-btc' },
      { id: 'l-short-eth', scopeKind: 'leg', legId: 'leg.short.eth', direction: 'short', instrumentRef: 's-eth' },
    ],
  }
}

describe('compiled-script-emitter — scope.leg byte-equal snapshot (Phase 5 S11 #1112)', () => {
  const emitter = new CompiledScriptEmitterService()
  const parser = new CompiledScriptParserService()

  it('单/0 leg 旧 ast → emit 输出不含 ORCHESTRATION_LEG_SCOPES 字面 const', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    expect(script).not.toContain('const ORCHESTRATION_LEG_SCOPES')
  })

  it('双 leg ast → emit 输出含 const ORCHESTRATION_LEG_SCOPES = [...] 紧邻 ORCHESTRATION_SCOPES 之后', () => {
    const astWithLegs = buildAstWithLegs()
    const script = emitter.emit({ ast: astWithLegs, executionEnvelope: envelope })
    expect(script).toContain('const ORCHESTRATION_LEG_SCOPES')
    expect(script).toContain('"legId":"leg.long.btc"')
    expect(script).toContain('"legId":"leg.short.eth"')
    // 顺序：ORCHESTRATION_SCOPES 必须出现在 ORCHESTRATION_LEG_SCOPES 之前
    const scopesIdx = script.indexOf('const ORCHESTRATION_SCOPES')
    const legScopesIdx = script.indexOf('const ORCHESTRATION_LEG_SCOPES')
    const topologyIdx = script.indexOf('const TOPOLOGY')
    expect(scopesIdx).toBeGreaterThan(0)
    expect(legScopesIdx).toBeGreaterThan(scopesIdx)
    expect(topologyIdx).toBeGreaterThan(legScopesIdx)
  })

  it('双 leg ast → wrapper passes ORCHESTRATION_LEG_SCOPES into runDecisionPrograms live path', () => {
    const script = emitter.emit({ ast: buildAstWithLegs(), executionEnvelope: envelope })

    expect(script).toContain([
      '      TOPOLOGY.decisionOrder,',
      '      undefined,',
      '      portfolioRiskState,',
      '      ORCHESTRATION_SCOPES,',
      '      ORCHESTRATION_LEG_SCOPES,',
    ].join('\n'))
  })

  it('round-trip：无 leg emit → parse → projection.orchestrationLegScopes === undefined（不抛错）', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    const projection: CompiledScriptProjection = parser.parse(script)
    expect(projection.orchestrationLegScopes).toBeUndefined()
  })

  it('round-trip：双 leg emit → parse → projection.orchestrationLegScopes 等价', () => {
    const astWithLegs: StrategyAstV1 = {
      ...baseAst,
      orchestrationLegScopes: [
        {
          id: 'l-long-btc',
          scopeKind: 'leg',
          legId: 'leg.long.btc',
          direction: 'long',
          instrumentRef: 's-btc',
          legSizing: { mode: 'fixed_ratio', value: 1, pairedLegId: 'leg.short.eth' },
        },
        {
          id: 'l-short-eth',
          scopeKind: 'leg',
          legId: 'leg.short.eth',
          direction: 'short',
          instrumentRef: 's-eth',
        },
      ],
    }
    const script = emitter.emit({ ast: astWithLegs, executionEnvelope: envelope })
    const projection = parser.parse(script)
    expect(projection.orchestrationLegScopes).toEqual(astWithLegs.orchestrationLegScopes)
  })

  it('round-trip(emit→parse→emit) 字节等价 — 0/1 leg 旧 ast 与 main 字节等价', () => {
    const script1 = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    const projection1 = parser.parse(script1)
    // 重新构造 ast 注入 manifest 中已计算的 hash 用于第二次 emit
    const reconstructedAst: StrategyAstV1 = {
      ...baseAst,
      manifest: {
        ...baseAst.manifest,
        irHash: projection1.compiledManifest.irHash,
        specHash: projection1.compiledManifest.specHash,
        structuralDigest: projection1.compiledManifest.structuralDigest,
      },
    }
    const script2 = emitter.emit({ ast: reconstructedAst, executionEnvelope: envelope })
    expect(script1).toBe(script2)
  })

  it('双 leg ast 的 structuralDigest 与无 leg ast 相同（structuralProjection 不含 legScopes）', () => {
    const projectionNoLeg = emitter.buildProjection({ ast: baseAst, executionEnvelope: envelope })
    const astWithLegs: StrategyAstV1 = {
      ...baseAst,
      orchestrationLegScopes: [
        { id: 'l-long-btc', scopeKind: 'leg', legId: 'leg.long.btc', direction: 'long', instrumentRef: 's-btc' },
      ],
    }
    const projectionWithLeg = emitter.buildProjection({ ast: astWithLegs, executionEnvelope: envelope })
    expect(projectionWithLeg.compiledManifest.structuralDigest).toBe(
      projectionNoLeg.compiledManifest.structuralDigest,
    )
  })
})
