import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { SemanticState } from '../types/semantic-state'
import type { SemanticPredicateStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import type { StrategySummary } from '../types/strategy-summary'
import type { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import type { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
import type { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
import type { CompiledScriptEmitterService } from './compiled-script-emitter.service'
import type { CompiledScriptExecutionEnvelopeService } from './compiled-script-execution-envelope.service'
import type { CompiledScriptParserService } from './compiled-script-parser.service'
import type { CodegenGraphSnapshotService } from './codegen-graph-snapshot.service'
import type { SpecDescBuilderService } from './spec-desc-builder.service'
import type { StrategyConsistencyService } from './strategy-consistency.service'
import type { StrategySummaryBuilderService } from './strategy-summary-builder.service'
import type { StrategySummaryObservationReport } from './strategy-summary-observation.service'
import { SemanticAtomInvariantService } from './semantic-atom-invariant.service'
import { CodegenGraphSnapshotService as DefaultCodegenGraphSnapshotService } from './codegen-graph-snapshot.service'
import { StrategySummaryObservationService } from './strategy-summary-observation.service'

export interface CompiledScriptValidationResult {
  passed: boolean
  scriptCode: string
  reason?: string
  staticPassed: boolean
  runtimePassed: boolean
  outputPassed: boolean
}

export interface SemanticAtomInvariantReport {
  status: 'PASSED' | 'FAILED'
  checks: StrategyConsistencyCheck[]
  summary: {
    criticalFailed: number
    warningFailed: number
    unprovable: number
  }
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
  semanticAtomInvariant: SemanticAtomInvariantReport
  semanticConsistency: StrategyConsistencyReport
  userIntentSummary: StrategySummary
  strategySummary: StrategySummary
  scriptSummary: StrategySummary
  summaryObservation: StrategySummaryObservationReport
  semanticPredicateGraph: SemanticPredicateStrategyGraph
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
    private readonly semanticAtomInvariant: SemanticAtomInvariantService = new SemanticAtomInvariantService(),
    private readonly graphSnapshotService: CodegenGraphSnapshotService = new DefaultCodegenGraphSnapshotService(),
  ) {}

  async generate(input: CodegenPublicationGenerationInput): Promise<CodegenPublicationArtifacts> {
    const canonicalSpec = input.canonicalSpecOverride
      ?? this.canonicalSpecBuilder.buildFromSemanticState(input.semanticState)
    const semanticPredicateGraph = this.graphSnapshotService.buildFromSemanticArtifacts({ canonicalSpec })
    const normalizedIntent = this.buildLegacyNormalizedIntentSnapshot(input.semanticState)
    const semanticView = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent,
    })
    const userIntentSummary = this.strategySummaryBuilder.buildStrategySummary(canonicalSpec)
    const lockedParams = this.buildSemanticLockedParams({
      semanticState: input.semanticState,
      canonicalSpec,
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
    const executionEnvelope = this.compiledScriptExecutionEnvelope.build(
      canonicalSpec,
      this.resolveSemanticPositionMode(input.semanticState, canonicalSpec),
    )
    const ast = this.canonicalStrategyAstCompiler.compile(compiled.ir)
    const semanticAtomInvariant = this.buildSemanticAtomInvariantReport(this.semanticAtomInvariant.validate({
      semanticState: input.semanticState,
      canonicalSpec,
      ir: compiled.ir,
      ast,
    }))
    const criticalFailedAtomChecks = semanticAtomInvariant.checks.filter(check =>
      check.level === 'critical' && check.status === 'failed',
    )

    if (criticalFailedAtomChecks.length > 0) {
      throw new Error(`codegen.semantic_atom_drift: ${criticalFailedAtomChecks.map(check => check.message).join('; ')}`)
    }

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
      normalizedIntent,
      canonicalSpec,
      userIntentSummary,
      strategySummary,
      scriptSummary,
      summaryObservation,
      lockedParams,
      consistencyReport: semanticConsistency,
      semanticAtomInvariant,
      semanticPredicateGraph,
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
      semanticAtomInvariant,
      semanticConsistency,
      userIntentSummary,
      strategySummary,
      scriptSummary,
      summaryObservation,
      semanticPredicateGraph,
      normalizedIntent,
      lockedParams,
      publishParams,
    }
  }

  private buildSemanticAtomInvariantReport(checks: StrategyConsistencyCheck[]): SemanticAtomInvariantReport {
    const summary = checks.reduce(
      (acc, check) => {
        if (check.level === 'critical' && check.status === 'failed') {
          acc.criticalFailed += 1
        }
        if (check.level === 'warning' && check.status === 'failed') {
          acc.warningFailed += 1
        }
        if (check.status === 'unprovable') {
          acc.unprovable += 1
        }
        return acc
      },
      { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
    )

    return {
      status: summary.criticalFailed > 0 ? 'FAILED' : 'PASSED',
      checks,
      summary,
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
  }): Record<string, unknown> {
    const locked: Record<string, unknown> = {}
    const exchange = this.readSemanticContextValue(args.semanticState.contextSlots.exchange)
    const symbol = this.readSemanticContextValue(args.semanticState.contextSlots.symbol)
    const marketType = this.readSemanticContextValue(args.semanticState.contextSlots.marketType)
    const timeframe = this.readSemanticContextValue(args.semanticState.contextSlots.timeframe)

    if (symbol) {
      locked.symbol = normalizePublishedSymbol(symbol)
    }

    if (timeframe) {
      locked.timeframe = timeframe
    }

    if (exchange) {
      locked.exchange = exchange
    }

    if (marketType === 'spot' || marketType === 'perp') {
      locked.marketType = marketType
    }

    const position = args.semanticState.position
    if (
      position?.status === 'locked'
      && position.mode === 'fixed_ratio'
      && Number.isFinite(position.value)
    ) {
      locked.positionPct = position.value <= 1 ? position.value * 100 : position.value
    }

    for (const risk of args.semanticState.risk) {
      if (risk.status !== 'locked') {
        continue
      }
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

  private buildLegacyNormalizedIntentSnapshot(semanticState: SemanticState): StrategyNormalizedIntent {
    const families = new Set(semanticState.families)
    if (semanticState.triggers.some(trigger => trigger.phase === 'gate')) {
      families.add('state-gated')
    }
    const gridTrigger = semanticState.triggers.find(trigger =>
      trigger.key === 'grid.range_rebalance'
      && trigger.status !== 'superseded'
      && typeof trigger.params.rangeLower === 'number'
      && typeof trigger.params.rangeUpper === 'number'
      && typeof trigger.params.stepPct === 'number',
    )

    return {
      families: Array.from(families) as StrategyNormalizedIntent['families'],
      triggers: semanticState.triggers
        .filter(trigger => trigger.status !== 'superseded')
        .map(trigger => ({
          key: trigger.key as StrategyNormalizedIntent['triggers'][number]['key'],
          phase: trigger.phase,
          ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
          params: { ...trigger.params } as StrategyNormalizedIntent['triggers'][number]['params'],
          closureStatus: trigger.status === 'locked' && trigger.openSlots.length === 0 ? 'closed' : 'open',
          unresolvedSlots: trigger.openSlots.map(slot => ({
            slotKey: slot.slotKey,
            fieldPath: slot.fieldPath,
            reason: 'missing_definition' as const,
            questionHint: slot.questionHint,
            priority: slot.priority,
            affectsExecution: slot.affectsExecution,
            ...(slot.evidence?.text ? { evidenceText: slot.evidence.text } : {}),
          })),
          ...(trigger.evidence?.text ? { evidenceText: trigger.evidence.text } : {}),
        })),
      actions: semanticState.actions.map(action => ({
        key: action.key,
        ...(action.params ? { params: { ...action.params } } : {}),
      })),
      risk: semanticState.risk.map(risk => ({
        key: risk.key,
        params: { ...risk.params },
      })),
      position: semanticState.position
        ? {
            mode: semanticState.position.mode as StrategyNormalizedIntent['position']['mode'],
            value: semanticState.position.value,
            positionMode: semanticState.position.positionMode as StrategyNormalizedIntent['position']['positionMode'],
          }
        : null,
      ...(gridTrigger
        ? {
            grid: {
              family: 'grid.range_rebalance',
              range: {
                lower: gridTrigger.params.rangeLower as number,
                upper: gridTrigger.params.rangeUpper as number,
              },
              stepPct: gridTrigger.params.stepPct as number,
              sideMode: (gridTrigger.params.sideMode as StrategyNormalizedIntent['grid']['sideMode']) ?? 'bidirectional',
              recycle: gridTrigger.params.recycle !== false,
              ...(gridTrigger.params.breakoutAction === 'pause' || gridTrigger.params.breakoutAction === 'continue'
                ? { breakoutAction: gridTrigger.params.breakoutAction }
                : {}),
            },
          }
        : {}),
      unresolved: [],
      normalizationNotes: [...semanticState.normalizationNotes],
    }
  }

  private resolveSemanticPositionMode(
    semanticState: SemanticState,
    canonicalSpec: CanonicalStrategySpecV2,
  ): ReturnType<CompiledScriptExecutionEnvelopeService['build']>['positionMode'] | undefined {
    const semanticMode = semanticState.position?.positionMode
    if (semanticMode === 'long_only' || semanticMode === 'short_only' || semanticMode === 'long_short') {
      return semanticMode
    }

    const hasLong = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_LONG' || action.type === 'REDUCE_LONG',
    ))
    const hasShort = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_SHORT' || action.type === 'REDUCE_SHORT',
    ))
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    if (hasLong) return 'long_only'
    return undefined
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
