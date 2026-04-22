import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { SemanticState } from '../types/semantic-state'
import type { StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import type { StrategySummary } from '../types/strategy-summary'
import type { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import type { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
import type { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
import type { CompiledScriptEmitterService } from './compiled-script-emitter.service'
import type { CompiledScriptExecutionEnvelopeService } from './compiled-script-execution-envelope.service'
import type { CompiledScriptParserService } from './compiled-script-parser.service'
import type { SpecDescBuilderService } from './spec-desc-builder.service'
import type { StrategyConsistencyService } from './strategy-consistency.service'
import type { StrategySummaryBuilderService } from './strategy-summary-builder.service'
import type { StrategySummaryObservationReport } from './strategy-summary-observation.service'
import { buildNormalizedIntentFromSemanticState } from './semantic-state-normalization'
import { StrategySummaryObservationService } from './strategy-summary-observation.service'

export interface CompiledScriptValidationResult {
  passed: boolean
  scriptCode: string
  reason?: string
  staticPassed: boolean
  runtimePassed: boolean
  outputPassed: boolean
}

function normalizePublishedSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
}

export interface CodegenPublicationArtifacts {
  canonicalSpec: CanonicalStrategySpecV2
  semanticView: Record<string, unknown>
  sessionSpecDesc: Record<string, unknown>
  compiled: ReturnType<CanonicalSpecV2IrCompilerService['compile']>
  executionEnvelope: ReturnType<CompiledScriptExecutionEnvelopeService['build']>
  ast: ReturnType<CanonicalStrategyAstCompilerService['compile']>
  compiledScript: string
  validation: CompiledScriptValidationResult
  semanticConsistency: StrategyConsistencyReport
  userIntentSummary: StrategySummary
  strategySummary: StrategySummary
  scriptSummary: StrategySummary
  summaryObservation: StrategySummaryObservationReport
  normalizedIntent: StrategyNormalizedIntent
  lockedParams: Record<string, unknown>
  publishParams: {
    symbol: string
    timeframe: string
    marketType: 'spot' | 'perp'
  }
}

export interface CodegenPublicationGenerationInput {
  semanticState: SemanticState
  canonicalSpecOverride?: CanonicalStrategySpecV2
}

export class CodegenPublicationGenerationStage {
  constructor(
    private readonly canonicalSpecBuilder: CanonicalSpecBuilderService,
    private readonly specDescBuilder: SpecDescBuilderService,
    private readonly strategySummaryBuilder: StrategySummaryBuilderService,
    private readonly strategyConsistencyService: StrategyConsistencyService,
    private readonly canonicalSpecV2IrCompiler: CanonicalSpecV2IrCompilerService,
    private readonly canonicalStrategyAstCompiler: CanonicalStrategyAstCompilerService,
    private readonly compiledScriptEmitter: CompiledScriptEmitterService,
    private readonly compiledScriptExecutionEnvelope: CompiledScriptExecutionEnvelopeService,
    private readonly compiledScriptParser: CompiledScriptParserService,
    private readonly strategySummaryObservation: StrategySummaryObservationService = new StrategySummaryObservationService(),
  ) {}

  async generate(input: CodegenPublicationGenerationInput): Promise<CodegenPublicationArtifacts> {
    const normalization = this.buildNormalizationFromSemanticState(input.semanticState)
    const canonicalSpec = input.canonicalSpecOverride
      ?? this.canonicalSpecBuilder.buildFromNormalizedIntent(
        this.buildSemanticCanonicalContext(input.semanticState),
        normalization.normalizedIntent,
      )
    const semanticView = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
    })
    const userIntentSummary = this.strategySummaryBuilder.buildStrategySummary(canonicalSpec)
    const lockedParams = this.buildSemanticLockedParams({
      semanticState: input.semanticState,
      canonicalSpec,
      normalizedIntent: normalization.normalizedIntent,
    })
    const publishParams = this.buildSemanticPublishParams({
      canonicalSpec,
      semanticState: input.semanticState,
    })
    const compiled = this.canonicalSpecV2IrCompiler.compile({
      canonicalSpec,
      fallback: this.buildCompiledIrFallback({
        lockedParams,
        publishParams,
      }),
    })
    const executionEnvelope = this.compiledScriptExecutionEnvelope.build(canonicalSpec)
    const ast = this.canonicalStrategyAstCompiler.compile(compiled.ir)
    let compiledScript = this.compiledScriptEmitter.emit({
      ast,
      executionEnvelope,
    })
    const validation = this.validateCompiledScript(compiledScript)
    compiledScript = validation.scriptCode
    const semanticConsistency = this.strategyConsistencyService.evaluate({
      canonicalSpec,
      scriptCode: compiledScript,
    })
    const strategySummary = this.strategySummaryBuilder.buildSummaryFromProfile({
      profile: semanticConsistency.specProfile,
      market: {
        symbol: canonicalSpec.market.symbol ?? undefined,
        timeframe: canonicalSpec.market.timeframe ?? undefined,
        marketType: canonicalSpec.market.marketType,
      },
    })
    const scriptSummary = this.strategySummaryBuilder.buildSummaryFromProfile({
      profile: semanticConsistency.scriptProfile,
    })
    const summaryObservation = this.strategySummaryObservation.build({
      userIntentSummary,
      strategySummary,
      scriptSummary,
    })
    const sessionSpecDesc = {
      ...semanticView,
      normalizedIntent: normalization.normalizedIntent,
      canonicalSpec,
      userIntentSummary,
      strategySummary,
      scriptSummary,
      summaryObservation,
      lockedParams,
      consistencyReport: semanticConsistency,
    } satisfies Record<string, unknown>

    return {
      canonicalSpec,
      semanticView,
      sessionSpecDesc,
      compiled,
      executionEnvelope,
      ast,
      compiledScript,
      validation,
      semanticConsistency,
      userIntentSummary,
      strategySummary,
      scriptSummary,
      summaryObservation,
      normalizedIntent: normalization.normalizedIntent,
      lockedParams,
      publishParams,
    }
  }

  validateCompiledScript(scriptCode: string): CompiledScriptValidationResult {
    try {
      this.compiledScriptParser.parse(scriptCode)
      return {
        passed: true,
        scriptCode,
        staticPassed: true,
        runtimePassed: true,
        outputPassed: true,
      }
    } catch (error) {
      return {
        passed: false,
        scriptCode,
        reason: `编译脚本结构校验失败: ${error instanceof Error ? error.message : 'unknown'}`,
        staticPassed: true,
        runtimePassed: false,
        outputPassed: false,
      }
    }
  }

  private buildCompiledIrFallback(args: {
    lockedParams: Record<string, unknown>
    publishParams: {
      symbol: string
      timeframe: string
      marketType: 'spot' | 'perp'
    }
  }): {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
    executionTags?: string[]
  } {
    const exchange = args.lockedParams.exchange
    const positionPct = args.lockedParams.positionPct

    return {
      exchange: exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid'
        ? exchange
        : 'binance',
      symbol: args.publishParams.symbol,
      baseTimeframe: args.publishParams.timeframe,
      positionPct: typeof positionPct === 'number' && Number.isFinite(positionPct)
        ? positionPct
        : 10,
    }
  }

  private buildSemanticLockedParams(args: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpecV2
    normalizedIntent: StrategyNormalizedIntent
  }): Record<string, unknown> {
    const locked: Record<string, unknown> = {}
    const exchange = this.readSemanticContextValue(args.semanticState.contextSlots.exchange)
    const symbol = this.readSemanticContextValue(args.semanticState.contextSlots.symbol)
    const marketType = this.readSemanticContextValue(args.semanticState.contextSlots.marketType)
    const timeframe = this.readSemanticContextValue(args.semanticState.contextSlots.timeframe)

    if (symbol) {
      locked.symbol = normalizePublishedSymbol(symbol)
    } else if (args.canonicalSpec.market.symbol) {
      locked.symbol = normalizePublishedSymbol(args.canonicalSpec.market.symbol)
    }

    const resolvedTimeframe = args.canonicalSpec.dataRequirements.requiredTimeframes[0]
      ?? args.canonicalSpec.market.defaultTimeframe
      ?? timeframe
    if (resolvedTimeframe) {
      locked.timeframe = resolvedTimeframe
    }

    if (exchange) {
      locked.exchange = exchange
    } else if (args.canonicalSpec.market.exchange) {
      locked.exchange = args.canonicalSpec.market.exchange
    }

    if (marketType === 'spot' || marketType === 'perp') {
      locked.marketType = marketType
    } else {
      locked.marketType = args.canonicalSpec.market.marketType
    }

    if (args.normalizedIntent.position?.mode === 'fixed_ratio' && Number.isFinite(args.normalizedIntent.position.value)) {
      locked.positionPct = args.normalizedIntent.position.value <= 1
        ? args.normalizedIntent.position.value * 100
        : args.normalizedIntent.position.value
    }

    for (const risk of args.normalizedIntent.risk) {
      if (risk.key === 'risk.stop_loss_pct' && typeof risk.params.valuePct === 'number') {
        locked.stopLossPct = risk.params.valuePct
      }
      if (risk.key === 'risk.take_profit_pct' && typeof risk.params.valuePct === 'number') {
        locked.takeProfitPct = risk.params.valuePct
      }
      if (
        (risk.key === 'risk.stop_loss_pct' || risk.key === 'risk.take_profit_pct')
        && typeof risk.params.basis === 'string'
      ) {
        if (risk.key === 'risk.stop_loss_pct') {
          locked.stopLossBasis = risk.params.basis
        }
        if (risk.key === 'risk.take_profit_pct') {
          locked.takeProfitBasis = risk.params.basis
        }
      }
    }

    return locked
  }

  private buildSemanticPublishParams(args: {
    canonicalSpec: CanonicalStrategySpecV2
    semanticState: SemanticState
  }): {
    symbol: string
    timeframe: string
    marketType: 'spot' | 'perp'
  } {
    const semanticSymbol = this.readSemanticContextValue(args.semanticState.contextSlots.symbol)
    const semanticMarketType = this.readSemanticContextValue(args.semanticState.contextSlots.marketType)
    const semanticTimeframe = this.readSemanticContextValue(args.semanticState.contextSlots.timeframe)
    const symbol = semanticSymbol ?? args.canonicalSpec.market.symbol
    const timeframe = args.canonicalSpec.dataRequirements.requiredTimeframes[0]
      ?? args.canonicalSpec.market.defaultTimeframe
      ?? semanticTimeframe

    if (!symbol || !timeframe) {
      throw new Error('codegen.publication_context_missing')
    }

    return {
      symbol: normalizePublishedSymbol(symbol),
      timeframe,
      marketType: semanticMarketType === 'spot' || semanticMarketType === 'perp'
        ? semanticMarketType
        : args.canonicalSpec.market.marketType,
    }
  }

  private buildNormalizationFromSemanticState(semanticState: SemanticState): {
    normalizedIntent: StrategyNormalizedIntent
    blocked: boolean
  } {
    return {
      normalizedIntent: buildNormalizedIntentFromSemanticState(semanticState),
      blocked: false,
    }
  }

  private buildSemanticCanonicalContext(semanticState: SemanticState): {
    market: {
      exchange?: 'binance' | 'okx' | 'hyperliquid'
      marketType?: 'spot' | 'perp'
      defaultTimeframe?: string | null
    }
    symbols?: string[]
    timeframes?: string[]
  } {
    const exchange = this.readSemanticContextValue(semanticState.contextSlots.exchange)
    const symbol = this.readSemanticContextValue(semanticState.contextSlots.symbol)
    const marketType = this.readSemanticContextValue(semanticState.contextSlots.marketType)
    const timeframe = this.readSemanticContextValue(semanticState.contextSlots.timeframe)

    return {
      market: {
        ...(exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid'
          ? { exchange }
          : {}),
        ...(marketType === 'spot' || marketType === 'perp'
          ? { marketType }
          : {}),
        ...(timeframe ? { defaultTimeframe: timeframe } : {}),
      },
      ...(symbol ? { symbols: [symbol] } : {}),
      ...(timeframe ? { timeframes: [timeframe] } : {}),
    }
  }

  private readSemanticContextValue(slot: SemanticState['contextSlots'][keyof SemanticState['contextSlots']]): string | null {
    if (slot?.status !== 'locked' || typeof slot.value !== 'string' || slot.value.trim().length === 0) {
      return null
    }
    return slot.value.trim()
  }
}
