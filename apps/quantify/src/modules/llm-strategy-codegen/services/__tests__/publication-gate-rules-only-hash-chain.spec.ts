import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { buildStrategyAstDigestProjection, CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'

function newGate(): CompiledPublicationGateService {
  return new CompiledPublicationGateService(
    { create: jest.fn() } as never,
    { withTransaction: (cb: () => Promise<unknown>) => cb() } as never,
  )
}

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
}

function linkFixtureHashes(input: {
  rules: unknown[]
  canonicalSpec: Record<string, unknown>
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
}): {
  canonicalSpecHash: string
  irHash: string
  astHash: string
} {
  const rulesHash = hashCanonical(input.rules)
  input.canonicalSpec.metadata = { rulesHash }
  const canonicalSpecHash = hashCanonical(input.canonicalSpec)
  input.ir.source.graphDigest = `sha256:${canonicalSpecHash}`
  input.ir.source.specHash = `sha256:${canonicalSpecHash}`
  const irHash = hashCanonical(input.ir)
  input.ast.manifest.irHash = `sha256:${irHash}`
  input.ast.manifest.specHash = `sha256:${canonicalSpecHash}`
  const astHash = hashCanonical(buildStrategyAstDigestProjection(input.ast))
  input.ast.manifest.astDigest = `sha256:${astHash}`
  input.ast.manifest.structuralDigest = `sha256:${astHash}`
  return { canonicalSpecHash, irHash, astHash }
}

function emitScript(ast: StrategyAstV1): string {
  return new CompiledScriptEmitterService().emit({
    ast,
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cross',
      tickSize: 0.1,
      pricePrecision: 1,
      quantityPrecision: 3,
      fillAssumption: 'strict',
    },
  })
}

function fixture(): {
  rules: unknown[]
  canonicalSpec: Record<string, unknown>
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
  script: string
} {
  const zeroHash = `sha256:${'0'.repeat(64)}` as const
  const rules = [{
    id: 'rule-entry',
    phase: 'entry',
    condition: { kind: 'atom', key: 'price.above' },
    effects: {
      actions: [{ kind: 'atom', key: 'action.open_long' }],
    },
  }]
  const canonicalSpec = {
    schemaVersion: 2,
    rules: [{
      id: 'semantic-entry-rule-entry',
      phase: 'entry',
      priority: 100,
      condition: { kind: 'atom', key: 'price.above' },
      actions: [{ type: 'OPEN_LONG', sourcePath: 'rules[0].effects.actions[0]' }],
      metadata: { sourcePath: 'rules[0]' },
    }],
  }
  const ir = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 1,
      graphDigest: zeroHash,
      specHash: zeroHash,
    },
    market: {
      venue: 'binance',
      instrumentType: 'perpetual',
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
      warmupBars: 1,
      maxLookback: 1,
      requiredTimeframes: ['15m'],
    },
    signalCatalog: {
      series: [],
      levelSets: [],
      predicates: [{ id: 'semantic-entry-rule-entry_predicate', kind: 'GT', args: [] }],
    },
    ruleBlocks: [{
      id: 'semantic-entry-rule-entry',
      phase: 'entry',
      when: 'semantic-entry-rule-entry_predicate',
      priority: 100,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
      metadata: { sourcePath: 'rules[0]' },
    }],
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
  } satisfies CanonicalStrategyIrV1
  const ast = {
    astVersion: 'csa.v1',
    manifest: {
      irVersion: 'csi.v1',
      irHash: zeroHash,
      specHash: zeroHash,
      astDigest: zeroHash,
      compileVersion: 'compiler.v1',
      structuralDigest: zeroHash,
    },
    executionModel: {
      venue: 'binance',
      instrumentType: 'perpetual',
      symbol: 'BTCUSDT',
      primaryTimeframe: '15m',
      timeframeAlignment: 'strict',
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      defaultOrderType: 'market',
      allowPartialFill: false,
    },
    dataRequirements: ir.dataRequirements,
    exprPool: [{
      id: 'expr_01_semantic-entry-rule-entry_predicate',
      sourceRef: 'semantic-entry-rule-entry_predicate',
      nodeType: 'predicate',
      payload: { id: 'semantic-entry-rule-entry_predicate', kind: 'GT', args: [] },
      deps: [],
    }],
    guards: [],
    decisionPrograms: [{
      id: 'decision_01_semantic-entry-rule-entry',
      sourceRef: 'semantic-entry-rule-entry',
      phase: 'entry',
      when: 'expr_01_semantic-entry-rule-entry_predicate',
      priority: 100,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
      metadata: { sourcePath: 'rules[0]' },
    }],
    orderPrograms: [],
    topology: {
      exprOrder: ['expr_01_semantic-entry-rule-entry_predicate'],
      guardOrder: [],
      decisionOrder: ['decision_01_semantic-entry-rule-entry'],
      orderProgramOrder: [],
    },
  } satisfies StrategyAstV1
  linkFixtureHashes({ rules, canonicalSpec, ir, ast })
  const script = emitScript(ast)

  return { rules, canonicalSpec, ir, ast, script }
}

describe('publication gate rules-only hash chain', () => {
  it('passes when canonical, ir, ast, and script trace to rules hash', () => {
    const result = newGate().validateRulesOnlyHashChain(fixture())

    expect(result).toEqual(expect.objectContaining({
      passed: true,
      blocked: false,
      hashes: expect.objectContaining({
        rulesHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        canonicalSpecHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        irHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        astHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        scriptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }))
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trace.canonical', passed: true }),
      expect.objectContaining({ key: 'trace.ir', passed: true }),
      expect.objectContaining({ key: 'trace.ast', passed: true }),
      expect.objectContaining({ key: 'trace.script', passed: true }),
    ]))
  })

  it('passes when compiler omits empty riskPredicates from AST entity', () => {
    const input = fixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(input.ir)
    expect(ast.riskPredicates).toBeUndefined()
    input.ast = ast
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(true)
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.ast.astDigest', passed: true }),
      expect.objectContaining({ key: 'hash.script.astDigest', passed: true }),
    ]))
  })

  it('passes rules-only trace for top-level order programs', () => {
    const input = fixture()
    input.rules = [{
      id: 'program-grid',
      phase: 'program',
      condition: { kind: 'atom', key: 'grid.range_rebalance' },
      effects: { programs: [{ kind: 'atom', key: 'program.fixed_grid_gated' }] },
    }]
    input.canonicalSpec.rules = []
    input.canonicalSpec.orderPrograms = [{
      id: 'semantic-order-program-program-grid-rules-0-condition',
      kind: 'contract_order_program',
      sourcePath: 'rules[0].condition',
    }]
    input.ir.ruleBlocks = []
    input.ir.orderPrograms = [{
      id: 'semantic_order_program_program_grid_rules_0_condition',
      kind: 'LIMIT_LADDER',
      sourcePath: 'rules[0].condition',
      activeWhen: 'semantic_order_program_program_grid_rules_0_condition_active_range',
      side: 'buy',
      sidePolicy: 'perp_neutral',
      tickPolicy: 'round',
      priceSource: 'level_set',
      levelSetRef: 'grid_levels',
      quantity: { mode: 'pct_equity', value: 10 },
      orderType: 'limit',
      timeInForce: 'gtc',
      recycleOnFill: true,
      pairingPolicy: 'adjacent_level',
      cancelScope: 'program_orders',
      maxWorkingOrders: 10,
      group: 'semantic-order-program-program-grid-rules-0-condition',
    }]
    input.ast = new CanonicalStrategyAstCompilerService().compile(input.ir)
    linkFixtureHashes(input)
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trace.canonical', passed: true }),
      expect.objectContaining({ key: 'trace.ir', passed: true }),
      expect.objectContaining({ key: 'trace.ast', passed: true }),
    ]))
    expect(result.passed).toBe(true)
  })

  it('changes AST digest projection when orchestration scopes change', () => {
    const input = fixture()
    input.ast.orchestrationScopes = [
      { id: 'scope-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
    ]
    input.ast.orchestrationLegScopes = [
      { id: 'leg-long-btc', scopeKind: 'leg', legId: 'leg.long.btc', direction: 'long', instrumentRef: 'scope-btc' },
    ]
    const before = hashCanonical(buildStrategyAstDigestProjection(input.ast))

    input.ast.orchestrationScopes = [
      { id: 'scope-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ]
    input.ast.orchestrationLegScopes = [
      { id: 'leg-short-eth', scopeKind: 'leg', legId: 'leg.short.eth', direction: 'short', instrumentRef: 'scope-eth' },
    ]

    expect(hashCanonical(buildStrategyAstDigestProjection(input.ast))).not.toBe(before)
  })

  it('blocks when IR omits source path trace', () => {
    const input = fixture()
    delete input.ir.ruleBlocks[0].metadata
    linkFixtureHashes(input)
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_trace_missing')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trace.ir', passed: false }),
    ]))
  })

  it('blocks when IR and AST source paths are outside canonical trace set', () => {
    const input = fixture()
    input.ir.ruleBlocks[0].metadata = { sourcePath: 'rules[999]' }
    input.ast.decisionPrograms[0].metadata = { sourcePath: 'rules[999]' }
    linkFixtureHashes(input)
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_trace_missing')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trace.ir', passed: false }),
      expect.objectContaining({ key: 'trace.ast', passed: false }),
    ]))
  })

  it('blocks when canonical rulesHash is missing', () => {
    const input = fixture()
    delete input.canonicalSpec.metadata
    const canonicalSpecHash = hashCanonical(input.canonicalSpec)
    input.ir.source.graphDigest = `sha256:${canonicalSpecHash}`
    input.ir.source.specHash = `sha256:${canonicalSpecHash}`
    const irHash = hashCanonical(input.ir)
    input.ast.manifest.irHash = `sha256:${irHash}`
    input.ast.manifest.specHash = `sha256:${canonicalSpecHash}`
    input.ast.manifest.astDigest = input.ast.manifest.structuralDigest
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.canonical.rulesHash', passed: false }),
    ]))
  })

  it('blocks when IR hash linkage mismatches AST manifest', () => {
    const input = fixture()
    input.ast.manifest.irHash = `sha256:${'1'.repeat(64)}`

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.ast.irHash', passed: false }),
    ]))
  })

  it('blocks when AST manifest required field is missing', () => {
    const input = fixture()
    delete input.ast.manifest.astDigest
    input.script = emitScript(input.ast)

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.ast.astDigest', passed: false }),
    ]))
  })

  it('blocks when script compiled manifest is missing', () => {
    const input = fixture()
    input.script = [
      '/* @generated by compiler.v1 */',
      `/* irHash: ${input.ast.manifest.irHash} */`,
      `/* specHash: ${input.ast.manifest.specHash} */`,
      `/* astDigest: ${input.ast.manifest.astDigest} */`,
      `/* structuralDigest: ${input.ast.manifest.structuralDigest} */`,
      '',
      '// header only, no compiled manifest',
    ].join('\n')

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.script.manifest', passed: false }),
      expect.objectContaining({ key: 'trace.script', passed: false }),
    ]))
  })

  it('blocks when script compiled manifest specHash is missing', () => {
    const input = fixture()
    input.script = input.script.replace(/,"specHash":"sha256:[a-f0-9]+"/u, '')

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.script.specHash', passed: false }),
    ]))
  })

  it('blocks when script only mentions rules path string but manifest hash mismatches', () => {
    const input = fixture()
    input.script = input.script
      .replace(/"irHash":"sha256:[a-f0-9]+"/u, `"irHash":"sha256:${'2'.repeat(64)}"`)
      .replace(/"specHash":"sha256:[a-f0-9]+"/u, `"specHash":"sha256:${'3'.repeat(64)}"`)
      .concat('\n// rules[0]')

    const result = newGate().validateRulesOnlyHashChain(input)

    expect(result.passed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('rules_only_hash_mismatch')
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'hash.script.irHash', passed: false }),
      expect.objectContaining({ key: 'hash.script.specHash', passed: false }),
      expect.objectContaining({ key: 'trace.script', passed: false }),
    ]))
  })
})
