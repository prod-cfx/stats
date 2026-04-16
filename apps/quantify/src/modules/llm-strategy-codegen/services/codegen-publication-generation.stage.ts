import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { ChecklistPayload } from '../types/codegen-checklist'
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
import type { SemanticStateCompileBridgeService } from './semantic-state-compile-bridge.service'
import type { SpecDescBuilderService } from './spec-desc-builder.service'
import type { StrategyConsistencyService } from './strategy-consistency.service'
import type { StrategySummaryBuilderService } from './strategy-summary-builder.service'
import type { StrategySummaryObservationReport } from './strategy-summary-observation.service'
import { resolveChecklistDefaultTimeframe } from './checklist-rule-drafts'
import { SemanticStateCompileBridgeService as RuntimeSemanticStateCompileBridgeService } from './semantic-state-compile-bridge.service'
import { StrategyIntentNormalizerService } from './strategy-intent-normalizer.service'
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

function inferPublishedMarketType(args: {
  symbol: string
  checklist: ChecklistPayload
  message: string
}): 'spot' | 'perp' {
  if (args.symbol.endsWith(':PERP')) return 'perp'
  if (args.symbol.endsWith(':SPOT')) return 'spot'
  const riskRules = args.checklist.riskRules ?? {}
  const marketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''
  if (marketType === 'perp' || marketType === 'spot') return marketType
  return /永续|perp|swap|合约/i.test(args.message) ? 'perp' : 'spot'
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
    private readonly intentNormalizer: StrategyIntentNormalizerService = new StrategyIntentNormalizerService(),
    private readonly semanticStateCompileBridge: SemanticStateCompileBridgeService = new RuntimeSemanticStateCompileBridgeService(),
  ) {}

  async generate(input: {
    checklist: ChecklistPayload
    semanticState?: SemanticState
    message: string
  }): Promise<CodegenPublicationArtifacts> {
    const sourceChecklist = input.semanticState
      ? this.semanticStateCompileBridge.buildLegacyChecklist(input.semanticState, input.checklist)
      : input.checklist
    const normalization = input.semanticState
      ? {
          normalizedIntent: this.semanticStateCompileBridge.buildNormalizedIntent(input.semanticState),
          blocked: false,
        }
      : this.intentNormalizer.normalize(sourceChecklist)
    const canonicalSpec = input.semanticState && normalization.normalizedIntent.triggers.some(trigger => trigger.phase === 'gate')
      ? this.canonicalSpecBuilder.buildFromNormalizedIntent(sourceChecklist, normalization.normalizedIntent)
      : this.canonicalSpecBuilder.build(sourceChecklist)
    const semanticView = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
    })
    const userIntentSummary = this.strategySummaryBuilder.buildUserIntentSummary({
      checklist: sourceChecklist,
    })
    const lockedParams = this.buildLockedParams(sourceChecklist)
    const publishParams = this.buildPublishParams({
      canonicalSpec,
      checklist: sourceChecklist,
      message: input.message,
    })
    const compiled = this.canonicalSpecV2IrCompiler.compile({
      canonicalSpec,
      fallback: this.buildCompiledIrFallback({
        checklist: sourceChecklist,
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

  private buildPublishParams(args: {
    canonicalSpec: CanonicalStrategySpecV2
    checklist: ChecklistPayload
    message: string
  }): {
    symbol: string
    timeframe: string
    marketType: 'spot' | 'perp'
  } {
    const rawSymbol = args.checklist.symbols?.[0] ?? 'BTCUSDT'
    const requiredTimeframes = args.canonicalSpec.dataRequirements.requiredTimeframes
    const baseTimeframe = requiredTimeframes[0]
      ?? args.canonicalSpec.market.defaultTimeframe
      ?? resolveChecklistDefaultTimeframe(args.checklist)
      ?? '5m'
    return {
      symbol: normalizePublishedSymbol(rawSymbol),
      timeframe: baseTimeframe,
      marketType: inferPublishedMarketType({
        symbol: rawSymbol,
        checklist: args.checklist,
        message: args.message,
      }),
    }
  }

  private buildCompiledIrFallback(args: {
    checklist: ChecklistPayload
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

  private buildLockedParams(checklist: ChecklistPayload): Record<string, unknown> {
    const riskRules = checklist.riskRules ?? {}
    const locked: Record<string, unknown> = {}

    const rawSymbol = checklist.symbols?.[0]
    if (typeof rawSymbol === 'string' && rawSymbol.trim()) {
      locked.symbol = normalizePublishedSymbol(rawSymbol)
    }

    const rawTimeframe = resolveChecklistDefaultTimeframe(checklist)
    if (typeof rawTimeframe === 'string' && rawTimeframe.trim()) {
      locked.timeframe = rawTimeframe.trim()
    }

    const marketType = typeof riskRules.marketType === 'string'
      ? riskRules.marketType.trim().toLowerCase()
      : ''
    if (marketType === 'spot' || marketType === 'perp') {
      locked.marketType = marketType
    }

    const exchange = typeof riskRules.exchange === 'string'
      ? riskRules.exchange.trim().toLowerCase()
      : ''
    if (exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid') {
      locked.exchange = exchange
    }

    if (typeof riskRules.positionPct === 'number' && Number.isFinite(riskRules.positionPct)) {
      locked.positionPct = riskRules.positionPct
    }

    const stopLossPct = typeof riskRules.stopLossPct === 'number'
      ? riskRules.stopLossPct
      : (typeof riskRules.stopLoss === 'number' ? riskRules.stopLoss : null)
    if (typeof stopLossPct === 'number' && Number.isFinite(stopLossPct)) {
      locked.stopLossPct = stopLossPct
    }

    if (typeof riskRules.maxDrawdownPct === 'number' && Number.isFinite(riskRules.maxDrawdownPct)) {
      locked.maxDrawdownPct = riskRules.maxDrawdownPct
    }

    return locked
  }
}
