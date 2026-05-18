import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { SemanticState } from '../types/semantic-state'
import type { SemanticPredicateStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import type { StrategySummary } from '../types/strategy-summary'
import type { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import type { CompiledPublicationGateService } from './compiled-publication-gate.service'
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
import { normalizeRiskSemantics } from './semantic-state-normalization'
import { StrategySummaryObservationService } from './strategy-summary-observation.service'
import { readFlatActions, readFlatRisks, readFlatTriggers } from '../types/semantic-state-flat-readers'
import { assertSymbolWellFormed, buildSymbol } from './execution-model-source-invariant'

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

/**
 * Issue #1459 闸 4：symbol 拼接收敛——所有 IR build 入口必须经 buildSymbol
 *   (contextSlots 优先) 或 normalizePublishedSymbolValidated (fallback 路径)。
 *
 * 形态正则始终强制，BTCUSDTUSDT 等双 quote 拼接当场 reject。
 */
function normalizePublishedSymbolValidated(raw: string): string {
  const normalized = raw.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
  assertSymbolWellFormed(normalized)
  return normalized
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
  /**
   * Issue #1456 闸 1：未澄清的 clarificationState 传入时，IR builder 入口
   *   必须 fail-closed 拒绝产出。可选字段保留对老调用方的兼容；后续 follow-up
   *   收敛所有调用方后再升级为必填。
   */
  clarificationState?: StrategyClarificationState | null
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
    /**
     * Issue #1456 闸 1：注入 publication-gate 以便在 IR build 入口立刻 fail-closed。
     *   可选，旧测试可以不传；上线后由 pipeline 统一注入。
     */
    private readonly publicationGate?: CompiledPublicationGateService,
  ) {}

  async generate(input: CodegenPublicationGenerationInput): Promise<CodegenPublicationArtifacts> {
    // Issue #1456 闸 1：IR builder 入口 assertion —— 未过 publication gate
    //   不允许进入 IR / 脚本编译。任何 clarificationState 未结束的会话都会
    //   在此抛 PublicationGateClarificationBlockedError，pipeline catch 分支
    //   把结构化 payload 持久化到 session.specDesc.publicationGate。
    // 兼容老 spec 注入的 partial mock：只在 method 真实存在时调用。
    if (typeof this.publicationGate?.assertClarificationResolvedForIrBuild === 'function') {
      this.publicationGate.assertClarificationResolvedForIrBuild(input.clarificationState)
    }

    const canonicalSpec = input.canonicalSpecOverride
      ?? this.canonicalSpecBuilder.buildFromSemanticState(input.semanticState)
    const semanticPredicateGraph = this.graphSnapshotService.buildFromSemanticArtifacts({ canonicalSpec })
    const normalizedIntent = this.buildLegacyNormalizedIntentSnapshot(input.semanticState)
    const semanticView = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent,
      semanticState: input.semanticState,
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
        timeframe: canonicalSpec.market.defaultTimeframe
          ?? canonicalSpec.market.timeframe
          ?? canonicalSpec.dataRequirements?.requiredTimeframes?.[0]
          ?? undefined,
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
      // Issue #1459 闸 4：symbol 拼接收敛入口；优先经 buildSymbol(contextSlots)
      //   走形态正则；contextSlots 缺失再回退到旧 normalize 路径。
      locked.symbol = args.semanticState.contextSlots.symbol
        ? buildSymbol({ contextSlots: args.semanticState.contextSlots })
        : normalizePublishedSymbolValidated(symbol)
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

    for (const risk of normalizeRiskSemantics(readFlatRisks(args.semanticState))) {
      if (risk.status !== 'locked') {
        continue
      }
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key === 'risk.stop_loss_pct' && typeof risk.params.valuePct === 'number') {
        locked.stopLossPct = risk.params.valuePct
      }
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key === 'risk.take_profit_pct' && typeof risk.params.valuePct === 'number') {
        locked.takeProfitPct = risk.params.valuePct
      }
      if (
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
        (risk.key === 'risk.stop_loss_pct' || risk.key === 'risk.take_profit_pct')
        && typeof risk.params.basis === 'string'
      ) {
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
        if (risk.key === 'risk.stop_loss_pct') {
          locked.stopLossBasis = risk.params.basis
        }
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
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

    // Issue #1459 闸 4：symbol 拼接收敛入口；优先经 buildSymbol(contextSlots)
    //   走形态正则；contextSlots 缺失再回退到 canonicalSpec 路径并 validate。
    const resolvedSymbol = args.semanticState.contextSlots.symbol
      ? buildSymbol({ contextSlots: args.semanticState.contextSlots })
      : normalizePublishedSymbolValidated(symbol)

    return {
      symbol: resolvedSymbol,
      timeframe,
      marketType: semanticMarketType === 'spot' || semanticMarketType === 'perp'
        ? semanticMarketType
        : args.canonicalSpec.market.marketType,
    }
  }

  private buildLegacyNormalizedIntentSnapshot(semanticState: SemanticState): StrategyNormalizedIntent {
    const families = new Set(semanticState.families)
    if (readFlatTriggers(semanticState).some(trigger => trigger.phase === 'gate')) {
      families.add('state-gated')
    }
    const gridTrigger = readFlatTriggers(semanticState).find(trigger =>
      trigger.key === 'grid.range_rebalance'
      && trigger.status !== 'superseded'
      && typeof trigger.params.rangeLower === 'number'
      && typeof trigger.params.rangeUpper === 'number'
      && typeof trigger.params.stepPct === 'number',
    )

    return {
      families: Array.from(families) as StrategyNormalizedIntent['families'],
      triggers: readFlatTriggers(semanticState)
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
      actions: readFlatActions(semanticState).map(action => ({
        key: action.key,
        ...(action.params ? { params: { ...action.params } } : {}),
      })),
      risk: normalizeRiskSemantics(readFlatRisks(semanticState)).map(risk => ({
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
    // Issue #1391：真相源优先级 —— action 暴露（canonical spec rules）> positionConstraint sideMode 声明。
    // 多轮对话下 state.position.positionMode 第一次锁定后不会随 action 暴露重算，
    // 因此 canonical spec 推得出真实暴露时必须以 canonical 为准，避免与 IR expected positionMode 漂移。
    const hasLong = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_LONG' || action.type === 'REDUCE_LONG',
    ))
    const hasShort = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_SHORT' || action.type === 'REDUCE_SHORT',
    ))
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    if (hasLong) return 'long_only'

    const semanticMode = semanticState.position?.positionMode
    if (semanticMode === 'long_only' || semanticMode === 'short_only' || semanticMode === 'long_short') {
      return semanticMode
    }
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
