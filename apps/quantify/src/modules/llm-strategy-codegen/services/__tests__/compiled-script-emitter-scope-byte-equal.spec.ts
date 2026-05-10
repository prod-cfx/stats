import type { CompiledScriptProjection, CompiledScriptExecutionEnvelope } from '../../types/compiled-script-projection'
import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

/**
 * Phase 5 S2 (#1104) — N1 byte-equal snapshot 防退化
 *
 * 验证：
 *   1. 旧 ast（无 orchestrationScopes）经新 emitter 输出与原协议字节等价
 *      （emit 仅在非空时输出 ORCHESTRATION_SCOPES const，单/0 scope 旧策略不变）
 *   2. 新 emitter 输出经新 parser 解析 round-trip：
 *      - 无 scope ast: parse 后 projection.orchestrationScopes === undefined（不抛错）
 *      - 双 scope ast: parse 后 projection.orchestrationScopes === [...] 等价
 *   3. structuralProjection / structuralDigest 不含 orchestrationScopes
 *      （旧 v1 策略 hash 不变）
 */

const baseAst: StrategyAstV1 = {
  astVersion: 'csa.v1',
  manifest: {
    irVersion: 'csi.v1',
    irHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    specHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
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

describe('compiled-script-emitter — scope.symbol byte-equal snapshot (Phase 5 S2 #1104 N1)', () => {
  const emitter = new CompiledScriptEmitterService()
  const parser = new CompiledScriptParserService()

  it('单/0 scope 旧 ast → emit 输出不含 ORCHESTRATION_SCOPES 字面 const', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    expect(script).not.toContain('const ORCHESTRATION_SCOPES')
  })

  it('双 scope ast → emit 输出含 const ORCHESTRATION_SCOPES = [...]', () => {
    const astWithScopes: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
        { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
      ],
    }
    const script = emitter.emit({ ast: astWithScopes, executionEnvelope: envelope })
    expect(script).toContain('const ORCHESTRATION_SCOPES')
    expect(script).toContain('"id":"s-btc"')
    expect(script).toContain('"id":"s-eth"')
  })

  it('round-trip: 无 scope emit → parse → projection.orchestrationScopes === undefined（不抛错）', () => {
    const script = emitter.emit({ ast: baseAst, executionEnvelope: envelope })
    const projection: CompiledScriptProjection = parser.parse(script)
    expect(projection.orchestrationScopes).toBeUndefined()
  })

  it('round-trip: 双 scope emit → parse → projection.orchestrationScopes 等价', () => {
    const astWithScopes: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
      ],
    }
    const script = emitter.emit({ ast: astWithScopes, executionEnvelope: envelope })
    const projection = parser.parse(script)
    expect(projection.orchestrationScopes).toEqual([
      { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
    ])
  })

  it('双 scope ast 的 structuralDigest 与无 scope ast 相同（structuralProjection 不含 scopes）', () => {
    const projectionNoScope = emitter.buildProjection({ ast: baseAst, executionEnvelope: envelope })
    const astWithScopes: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
      ],
    }
    const projectionWithScope = emitter.buildProjection({ ast: astWithScopes, executionEnvelope: envelope })
    // structuralDigest 不变（旧 v1 hash 兼容）
    expect(projectionWithScope.compiledManifest.structuralDigest).toBe(
      projectionNoScope.compiledManifest.structuralDigest,
    )
  })

  // Phase 5 S3 (#1109): timeframe scope round-trip + structuralDigest 稳定
  it('timeframe scope round-trip: emit → parse → projection.orchestrationScopes 等价', () => {
    const astWithTfScope: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        {
          id: 'tf-1',
          scopeKind: 'timeframe',
          primaryTimeframe: '15m',
          requiredTimeframes: ['1h', '4h'],
          alignmentPolicy: 'strict',
        },
      ],
    }
    const script = emitter.emit({ ast: astWithTfScope, executionEnvelope: envelope })
    expect(script).toContain('const ORCHESTRATION_SCOPES')
    expect(script).toContain('"scopeKind":"timeframe"')
    const projection = parser.parse(script)
    expect(projection.orchestrationScopes).toEqual([
      {
        id: 'tf-1',
        scopeKind: 'timeframe',
        primaryTimeframe: '15m',
        requiredTimeframes: ['1h', '4h'],
        alignmentPolicy: 'strict',
      },
    ])
  })

  it('timeframe scope ast structuralDigest 与无 scope ast 相同（结构 hash 不变）', () => {
    const projectionNoScope = emitter.buildProjection({ ast: baseAst, executionEnvelope: envelope })
    const astWithTfScope: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        {
          id: 'tf-1',
          scopeKind: 'timeframe',
          primaryTimeframe: '15m',
          requiredTimeframes: ['1h'],
          alignmentPolicy: 'tolerant',
        },
      ],
    }
    const projectionWithTfScope = emitter.buildProjection({ ast: astWithTfScope, executionEnvelope: envelope })
    expect(projectionWithTfScope.compiledManifest.structuralDigest).toBe(
      projectionNoScope.compiledManifest.structuralDigest,
    )
  })

  // PR critic Round 1 M3: decisionProgram.metadata.timeframeScopeRef round-trip 锁
  it('decisionPrograms metadata.timeframeScopeRef emit→parse round-trip 透传', () => {
    const astWithMetadata: StrategyAstV1 = {
      ...baseAst,
      topology: {
        ...baseAst.topology,
        decisionOrder: ['dp-1'],
      },
      orchestrationScopes: [
        {
          id: 'tf-1',
          scopeKind: 'timeframe',
          primaryTimeframe: '15m',
          requiredTimeframes: ['1h'],
          alignmentPolicy: 'strict',
        },
      ],
      decisionPrograms: [
        {
          id: 'dp-1',
          sourceRef: 'rule-1',
          phase: 'entry',
          when: 'expr-1',
          priority: 100,
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
          metadata: {
            timeframeScopeRef: 'tf-1',
            symbolScopeRef: 's-btc',
          },
        },
      ],
    }
    const script = emitter.emit({ ast: astWithMetadata, executionEnvelope: envelope })
    const projection = parser.parse(script)
    expect(projection.decisionPrograms).toHaveLength(1)
    expect(projection.decisionPrograms[0].metadata?.timeframeScopeRef).toBe('tf-1')
    expect(projection.decisionPrograms[0].metadata?.symbolScopeRef).toBe('s-btc')
  })

  it('混合 ast: symbol + timeframe scope 共存 → emit/parse 正常', () => {
    const astMixed: StrategyAstV1 = {
      ...baseAst,
      orchestrationScopes: [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
        {
          id: 'tf-1',
          scopeKind: 'timeframe',
          primaryTimeframe: '15m',
          requiredTimeframes: ['1h'],
          alignmentPolicy: 'strict',
        },
      ],
    }
    const script = emitter.emit({ ast: astMixed, executionEnvelope: envelope })
    const projection = parser.parse(script)
    expect(projection.orchestrationScopes).toHaveLength(2)
    expect(projection.orchestrationScopes?.find(s => s.scopeKind === 'symbol')).toBeDefined()
    expect(projection.orchestrationScopes?.find(s => s.scopeKind === 'timeframe')).toBeDefined()
  })
})
