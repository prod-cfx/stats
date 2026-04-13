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
    const canonicalSpec = {
      version: 2 as const,
      market: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        marketType: 'spot' as const,
        timeframe: '15m',
      },
      indicators: [{ kind: 'ema' as const, params: { fast: 7, slow: 21 } }],
      sizing: { mode: 'RATIO' as const, value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE' as const,
        fillTiming: 'NEXT_BAR_OPEN' as const,
      },
      dataRequirements: {
        requiredTimeframes: ['15m'],
      },
      rules: [
        {
          id: 'entry-long',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          priority: 200,
          condition: {
            kind: 'atom' as const,
            key: 'ma.golden_cross',
            semanticScope: 'market' as const,
            op: 'CROSS_OVER' as const,
          },
          actions: [{ type: 'OPEN_LONG' as const, sizing: { mode: 'RATIO' as const, value: 0.1 } }],
        },
        {
          id: 'exit-long',
          phase: 'exit' as const,
          sideScope: 'long' as const,
          priority: 100,
          condition: {
            kind: 'atom' as const,
            key: 'ma.death_cross',
            semanticScope: 'market' as const,
            op: 'CROSS_UNDER' as const,
          },
          actions: [{ type: 'CLOSE_LONG' as const }],
        },
      ],
    }
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

  it('passes when compiled execution keeps short_only positionMode aligned with canonical spec intent', () => {
    const canonicalSpec = {
      version: 2 as const,
      market: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        marketType: 'perp' as const,
        timeframe: '15m',
      },
      indicators: [{ kind: 'ema' as const, params: { fast: 7, slow: 21 } }],
      sizing: { mode: 'RATIO' as const, value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE' as const,
        fillTiming: 'NEXT_BAR_OPEN' as const,
      },
      dataRequirements: {
        requiredTimeframes: ['15m'],
      },
      rules: [
        {
          id: 'entry-short',
          phase: 'entry' as const,
          sideScope: 'short' as const,
          priority: 200,
          condition: {
            kind: 'atom' as const,
            key: 'ma.death_cross',
            semanticScope: 'market' as const,
            op: 'CROSS_UNDER' as const,
          },
          actions: [{ type: 'OPEN_SHORT' as const, sizing: { mode: 'RATIO' as const, value: 0.1 } }],
        },
        {
          id: 'exit-short',
          phase: 'exit' as const,
          sideScope: 'short' as const,
          priority: 100,
          condition: {
            kind: 'atom' as const,
            key: 'ma.golden_cross',
            semanticScope: 'market' as const,
            op: 'CROSS_OVER' as const,
          },
          actions: [{ type: 'CLOSE_SHORT' as const }],
        },
      ],
    }
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
      executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(canonicalSpec),
    })

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: script,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(
      check => check.key === 'market.execution_model' && check.status === 'passed',
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

  it('passes bollinger middle-band consistency without requiring sma', () => {
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘价突破布林带上轨时做空'],
      exitRules: ['价格回到布林带中轨时平仓'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    }
    const canonicalSpec = canonicalBuilder.build(checklist)
    const userIntentSummary = summaryBuilder.buildUserIntentSummary({
      checklist,
      message: '我要一个收盘价突破布林带上轨做空，价格回到布林带中轨时平仓的策略。',
    })
    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    const ratio = ctx.paramsNormalized?.positionPct ? Math.min(ctx.paramsNormalized.positionPct / 100, 1) : 0.1
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: ratio } }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'long') return { action: 'CLOSE_LONG' }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1 && ctx.position?.side === 'short') return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
      userIntentSummary,
      strategySummary,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.find(check => check.key === 'indicators.required')?.status).toBe('passed')
    expect(report.checks.find(check => check.key === 'summary.alignment')?.status).toBe('passed')
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

  it('passes when canonical spec v2 compiles into an RSI-threshold momentum script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['RSI 14 高于 70 时平多'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
    expect(report.specProfile.indicators.some(item => item.kind === 'rsi')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a MACD momentum script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['MACD 金叉时做多'],
      exitRules: ['MACD 死叉时平多'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
    expect(report.specProfile.indicators.some(item => item.kind === 'macd')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a grid rebalance script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['在固定区间 60000-80000 内执行网格买入，网格步长 1%，共 10 格'],
      exitRules: ['价格触达上方网格时执行网格卖出平仓'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)
    expect(strategySummary.entryRule).toBe('grid.range_rebalance')
    expect(strategySummary.exitRule).toBe('grid.range_rebalance')

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
    expect(report.specProfile.rules.some(rule => rule.key === 'grid.range_rebalance')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'grid.range_rebalance')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a short-grid rebalance script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['在固定区间 60000-80000 内执行上方网格做空，网格步长 1%，共 10 格'],
      exitRules: ['价格回落触达下方网格买回平空'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'perp' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.specProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'short')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'short')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a bidirectional grid script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: [
        '在固定区间 60000-80000 内执行区间网格买入，网格步长 1%，共 10 格',
        '在固定区间 60000-80000 内执行上方网格做空，网格步长 1%，共 10 格',
      ],
      exitRules: [
        '价格触达上方网格卖出',
        '价格回落触达下方网格买回平空',
      ],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'perp' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(compiled.ir.portfolio.positionMode).toBe('long_short')
    expect(report.specProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'long')).toBe(true)
    expect(report.specProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'short')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'long')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'grid.range_rebalance' && rule.sideScope === 'short')).toBe(true)
  })

  it('passes future-compatible breakout channel-high mapping across summary and consistency', () => {
    const canonicalSpec = {
      version: 2 as const,
      market: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        marketType: 'spot' as const,
        timeframe: '1h',
      },
      indicators: [{ kind: 'custom' as const, params: { family: 'breakout' } }],
      sizing: { mode: 'RATIO' as const, value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE' as const,
        fillTiming: 'NEXT_BAR_OPEN' as const,
      },
      dataRequirements: { requiredTimeframes: ['1h'] },
      rules: [{
        id: 'entry-breakout-high',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        priority: 100,
        condition: {
          kind: 'atom' as const,
          key: 'breakout.channel_high_break',
          semanticScope: 'market' as const,
          op: 'CROSS_OVER' as const,
          params: { period: 20 },
        },
        actions: [{
          type: 'OPEN_LONG' as const,
          sizing: { mode: 'RATIO' as const, value: 0.1 },
        }],
      }],
    }

    const scriptCode = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = ctx.bars ?? []
    const highs = bars.map(item => item.high)
    const closes = bars.map(item => item.close)
    const channelHigh = ctx.helpers?.signal?.highest(highs, 20)
    if (typeof channelHigh !== 'number') return { action: 'NOOP' }
    if (closes.at(-1)! > channelHigh) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    return { action: 'NOOP' }
  },
}
strategy
`

    const strategySummary = summaryBuilder.buildStrategySummary(canonicalSpec)
    const scriptSummary = summaryBuilder.buildScriptSummary({ scriptCode })

    expect(strategySummary.entryRule).toBe('breakout.channel_high_break')
    expect(scriptSummary.entryRule).toBe('breakout.channel_high_break')

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode,
      strategySummary,
      scriptSummary,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
  })

  it('passes future-compatible take-profit and trailing-stop guard mappings', () => {
    const canonicalSpec = {
      version: 2 as const,
      market: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        marketType: 'spot' as const,
        timeframe: '1h',
      },
      indicators: [],
      sizing: null,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE' as const,
        fillTiming: 'NEXT_BAR_OPEN' as const,
      },
      dataRequirements: { requiredTimeframes: ['1h'] },
      rules: [
        {
          id: 'risk-take-profit',
          phase: 'risk' as const,
          sideScope: 'both' as const,
          priority: 80,
          condition: {
            kind: 'atom' as const,
            key: 'risk.take_profit_pct',
            semanticScope: 'position' as const,
            op: 'GTE' as const,
            value: 0.02,
          },
          actions: [{ type: 'FORCE_EXIT' as const }],
        },
        {
          id: 'risk-trailing-stop',
          phase: 'risk' as const,
          sideScope: 'both' as const,
          priority: 70,
          condition: {
            kind: 'atom' as const,
            key: 'risk.trailing_stop_pct',
            semanticScope: 'position' as const,
            op: 'GTE' as const,
            value: 0.015,
          },
          actions: [{ type: 'FORCE_EXIT' as const }],
        },
      ],
    }

    const scriptCode = `
const guardPrograms = [
  { kind: 'TAKE_PROFIT_PCT', value: 0.02, onBreach: 'FORCE_EXIT' },
  { kind: 'TRAILING_STOP_PCT', value: 0.015, onBreach: 'FORCE_EXIT' },
]
const strategy = { guardPrograms }
strategy
`

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.take_profit_pct')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.trailing_stop_pct')).toBe(true)
  })

  it('passes future-compatible cooldown and time-stop semantic mappings without compiler support', () => {
    const canonicalSpec = {
      version: 2 as const,
      market: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        marketType: 'spot' as const,
        timeframe: '1h',
      },
      indicators: [],
      sizing: { mode: 'RATIO' as const, value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE' as const,
        fillTiming: 'NEXT_BAR_OPEN' as const,
      },
      dataRequirements: { requiredTimeframes: ['1h'] },
      rules: [
        {
          id: 'entry-cooldown',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          priority: 90,
          condition: {
            kind: 'atom' as const,
            key: 'risk.cooldown_bars',
            semanticScope: 'portfolio' as const,
            op: 'GTE' as const,
            value: 5,
          },
          actions: [{
            type: 'OPEN_LONG' as const,
            sizing: { mode: 'RATIO' as const, value: 0.1 },
          }],
        },
        {
          id: 'exit-time-stop',
          phase: 'exit' as const,
          sideScope: 'long' as const,
          priority: 80,
          condition: {
            kind: 'atom' as const,
            key: 'risk.time_stop_bars',
            semanticScope: 'position' as const,
            op: 'GTE' as const,
            value: 12,
          },
          actions: [{ type: 'CLOSE_LONG' as const }],
        },
      ],
    }

    const scriptCode = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  cooldownBars: 5,
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    if (closes.length < 3) return { action: 'NOOP' }
    const heldBars = ctx.position?.barsHeld ?? 0
    if (heldBars >= 12 && ctx.position?.side === 'long') return { action: 'CLOSE_LONG' }
    if (closes.at(-1)! > closes.at(-2)!) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    return { action: 'NOOP' }
  },
}
strategy
`

    const scriptSummary = summaryBuilder.buildScriptSummary({ scriptCode })
    expect(scriptSummary.exitRule).toBe('risk.time_stop_bars')

    const report = consistency.evaluate({
      canonicalSpec,
      scriptCode,
      scriptSummary,
    })

    expect(report.status).toBe('PASSED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'passed')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.cooldown_bars')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.time_stop_bars')).toBe(true)
  })

  it('passes when canonical spec v2 compiles into a breakout script', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破前20根K线最高价时做多，冷却 5 根K线'],
      exitRules: ['回到布林带中轨时平仓'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.specProfile.rules.some(rule => rule.key === 'breakout.channel_high_break')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'breakout.channel_high_break')).toBe(true)
  })

  it('passes when Donchian breakout aliases map into breakout semantic rules', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破唐奇安上轨时做多'],
      exitRules: ['跌破唐奇安下轨时平多'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.specProfile.rules.some(rule => rule.key === 'breakout.channel_high_break')).toBe(true)
  })

  it('passes when canonical spec v2 compiles take-profit, trailing-stop and time-stop semantics', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 止盈', '移动止损 10%', '持仓超过 12 根K线平仓'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(compiled.ir.riskPolicy.guards.some(guard => guard.kind === 'TAKE_PROFIT_PCT')).toBe(true)
    expect(compiled.ir.riskPolicy.guards.some(guard => guard.kind === 'TRAILING_STOP_PCT')).toBe(true)
    expect(report.specProfile.rules.some(rule => rule.key === 'risk.time_stop_bars')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.time_stop_bars')).toBe(true)
  })

  it('passes when canonical spec v2 compiles short breakout and short-side trade management', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['跌破前20根K线最低价时做空，冷却 5 根K线'],
      exitRules: ['空单止盈 5%', '移动止损 10% 平空', '持仓超过 12 根K线平空'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'perp' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(report.specProfile.rules.some(rule => rule.key === 'breakout.channel_low_break' && rule.sideScope === 'short')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'breakout.channel_low_break' && rule.sideScope === 'short')).toBe(true)
    expect(report.specProfile.rules.some(rule => rule.key === 'risk.take_profit_pct' && rule.sideScope === 'short')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.take_profit_pct' && rule.sideScope === 'short')).toBe(true)
    expect(report.specProfile.rules.some(rule => rule.key === 'risk.trailing_stop_pct' && rule.sideScope === 'both')).toBe(true)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.trailing_stop_pct' && rule.sideScope === 'both')).toBe(true)
  })

  it('passes when canonical spec v2 compiles partial take-profit into reduce actions', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓止盈'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(compiled.ir.ruleBlocks.some(block => block.actions.some(action => action.kind === 'REDUCE_LONG'))).toBe(true)
    expect(compiled.ir.riskPolicy.guards.some(guard => guard.kind === 'TAKE_PROFIT_PCT')).toBe(false)
    expect(report.scriptProfile.rules.some(rule => rule.key === 'risk.take_profit_pct' && rule.action === 'REDUCE_LONG')).toBe(true)
  })

  it('passes when canonical spec v2 compiles partial take-profit ratio into reduce actions', () => {
    const canonicalSpec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓 30% 止盈'],
      riskRules: { positionPct: 10, exchange: 'binance', marketType: 'spot' },
    })

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
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
      strategySummary: summaryBuilder.buildStrategySummary(canonicalSpec),
    })

    expect(report.status).toBe('PASSED')
    expect(compiled.ir.ruleBlocks.some(block =>
      block.actions.some(action => action.kind === 'REDUCE_LONG' && action.quantity.value === 30),
    )).toBe(true)
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
