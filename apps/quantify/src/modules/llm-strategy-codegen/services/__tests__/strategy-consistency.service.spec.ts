import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SemanticGraphCompilerService } from '../semantic-graph-compiler.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

describe('strategyConsistencyService', () => {
  const consistency = new StrategyConsistencyService(
    new ScriptProfileExtractorService(),
    new CompiledScriptParserService(),
  )
  const canonicalBuilder = new CanonicalSpecBuilderService()
  const summaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

  it('passes when script aligns with canonical bollinger spec', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10 },
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < bb.lower) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'long') return { action: 'CLOSE_LONG' }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'short') return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('PASSED')
    expect(report.summary.criticalFailed).toBe(0)
  })

  it('passes when semantic graph, ir and compiled script stay aligned', () => {
    const semanticGraph = createBollingerSemanticGraph()
    const ir = new SemanticGraphCompilerService().compile(semanticGraph)
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: createExecutionEnvelope(),
    })

    const report = consistency.audit({
      semanticGraph,
      ir,
      scriptCode: script,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.every(check => check.status === 'passed')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a published-aligned script with ratio sizing', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10, stopLossPct: 5, exchange: 'okx', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(canonicalSpec),
    })

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: script,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'sizing.mode' && check.status === 'passed')).toBe(true)
    expect(report.checks.some(check => check.key === 'actions.required' && check.status === 'passed')).toBe(true)
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
  })

  it('fails when compiled execution market metadata drifts from canonical spec', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10, stopLossPct: 5, exchange: 'okx', marketType: 'perp' },
    })
    const driftedSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10, stopLossPct: 5, exchange: 'binance', marketType: 'perp' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: driftedSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(driftedSpec),
    })

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: script,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'market.execution_model' && check.status === 'failed')).toBe(true)
  })

  it('fails when compiled execution positionMode drifts from canonical spec intent', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带下轨时做多'],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: {
        ...new CompiledScriptExecutionEnvelopeService().build(canonicalSpec),
        positionMode: 'long_short',
      },
    })

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: script,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'market.execution_model' && check.status === 'failed')).toBe(true)
    expect(report.checks.some(
      check => check.key === 'market.execution_model'
        && String(check.message).includes('positionMode'),
    )).toBe(true)
  })

  it('fails when compiled script no longer matches ir manifest', () => {
    const semanticGraph = createBollingerSemanticGraph()
    const ir = new SemanticGraphCompilerService().compile(semanticGraph)

    const report = consistency.audit({
      semanticGraph,
      ir,
      scriptCode: `export default function strategy() { return { action: 'OPEN_LONG' } }`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'script.ir_manifest' && check.status === 'failed')).toBe(true)
  })

  it('fails when fallback script is detected', () => {
    const spec = canonicalBuilder.build({
      entryRules: ['rsi < 30 做多'],
      exitRules: ['rsi > 70 平仓'],
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = (ctx.bars ?? []).map(item => item.close)
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (fast > slow) return { action: 'OPEN_LONG', reason: 'fallback: fast SMA above slow SMA' }
    return { action: 'NOOP', reason: 'fallback: neutral trend' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.summary.criticalFailed).toBeGreaterThan(0)
    expect(report.checks.some(check => check.key === 'script.fallback_forbidden' && check.status === 'failed')).toBe(true)
  })

  it('fails when bollinger branch directions are reversed even if action set matches', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < bb.lower) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    return { action: 'ADJUST_POSITION', reason: 'middle' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'failed')).toBe(true)
  })

  it('passes when ratio sizing is derived from normalized positionPct params', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10 },
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    const positionPct = ctx.paramsNormalized?.positionPct
    const ratio = typeof positionPct === 'number' && positionPct > 0
      ? Math.min(positionPct / 100, 1)
      : 0.1
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: ratio } }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'long') return { action: 'CLOSE_LONG' }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'short') return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'sizing.mode' && check.status === 'passed')).toBe(true)
  })

  it('fails when ratio sizing uses raw positionPct without normalization', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10 },
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    const params = ctx.paramsNormalized || {}
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: params.positionPct } }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1) return { action: 'ADJUST_POSITION', reason: 'middle' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'sizing.mode' && check.status === 'failed')).toBe(true)
  })

  it('fails when bollinger intent cannot be evidenced by script summary', () => {
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['回到布林带中轨时平仓'],
      riskRules: { positionPct: 10 },
    }
    const canonicalSpec = canonicalBuilder.build(checklist)
    const userIntentSummary = summaryBuilder.buildUserIntentSummary({
      checklist,
      message: '我要一个布林带策略',
    })
    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = ctx.bars ?? []
    const closes = bars.map(item => item.close)
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP' }
    if (fast > slow) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    return { action: 'NOOP' }
  },
}
strategy
`,
      userIntentSummary,
      strategySummary,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'indicators.required' && check.status === 'failed')).toBe(true)
    expect(report.checks.some(check => check.key === 'summary.alignment' && check.status === 'failed')).toBe(true)
  })

  it('fails when moving-average script uses SMA filters without crossover semantics', () => {
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线上穿长均线（金叉）入场'],
      exitRules: ['短均线下穿长均线（死叉）出场'],
      riskRules: { positionPct: 10 },
    }
    const canonicalSpec = canonicalBuilder.build(checklist)
    const userIntentSummary = summaryBuilder.buildUserIntentSummary({
      checklist,
      message: '我要一个均线金叉入场、死叉出场的策略',
    })
    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP' }
    if (closes.at(-1)! > fast) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < slow) return { action: 'CLOSE_LONG' }
    return { action: 'NOOP' }
  },
}
strategy
`,
      userIntentSummary,
      strategySummary,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'summary.alignment' && check.status === 'failed')).toBe(true)
  })

  it('passes when moving-average short entry and short exit use death/golden cross in the correct stage', () => {
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线下穿长均线（死叉）时做空'],
      exitRules: ['短均线上穿长均线（金叉）时平空'],
      riskRules: { positionPct: 10 },
    }
    const canonicalSpec = canonicalBuilder.build(checklist)
    const userIntentSummary = summaryBuilder.buildUserIntentSummary({
      checklist,
      message: '我要一个均线死叉开空、金叉平空的策略',
    })
    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    const ratio = ctx.paramsNormalized?.positionPct ? Math.min(ctx.paramsNormalized.positionPct / 100, 1) : 0.1
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP' }
    if (fast < slow) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: ratio } }
    if (fast > slow) return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
      userIntentSummary,
      strategySummary,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'summary.alignment' && check.status === 'passed')).toBe(true)
  })
})

function createBollingerSemanticGraph() {
  return {
    version: 1 as const,
    market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
    nodes: [
      {
        id: 'entry-upper-short',
        phase: 'entry' as const,
        kind: 'bollinger_band_touch' as const,
        params: {
          timeframe: '15m',
          band: 'upper' as const,
          direction: 'breakout' as const,
          actionBias: 'short' as const,
          period: 20,
          stdDev: 2,
        },
      },
      {
        id: 'entry-lower-long',
        phase: 'entry' as const,
        kind: 'bollinger_band_touch' as const,
        params: {
          timeframe: '15m',
          band: 'lower' as const,
          direction: 'breakdown' as const,
          actionBias: 'long' as const,
          period: 20,
          stdDev: 2,
        },
      },
      {
        id: 'exit-middle-close',
        phase: 'exit' as const,
        kind: 'bollinger_band_touch' as const,
        params: {
          timeframe: '15m',
          band: 'middle' as const,
          direction: 'breakout' as const,
          actionBias: 'long' as const,
          period: 20,
          stdDev: 2,
        },
      },
    ],
    actions: [
      { id: 'open-long', kind: 'OPEN_LONG' as const, sizePct: 10 },
      { id: 'open-short', kind: 'OPEN_SHORT' as const, sizePct: 10 },
      { id: 'close-long', kind: 'CLOSE_LONG' as const, sizePct: 100 },
      { id: 'close-short', kind: 'CLOSE_SHORT' as const, sizePct: 100 },
    ],
    risk: [],
  }
}

function createExecutionEnvelope() {
  return {
    positionMode: 'long_short' as const,
    marginMode: 'cash' as const,
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict' as const,
  }
}
