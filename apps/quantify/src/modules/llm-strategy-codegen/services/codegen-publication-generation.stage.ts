import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { SemanticState } from '../types/semantic-state'
import type { SemanticPredicateStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import type { StrategySemanticProfile } from '../types/strategy-semantic-profile'
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
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { SemanticAtomInvariantService } from './semantic-atom-invariant.service'
import { CodegenGraphSnapshotService as DefaultCodegenGraphSnapshotService } from './codegen-graph-snapshot.service'
import { StrategySummaryObservationService } from './strategy-summary-observation.service'
import { collectAtomLeaves, isRuleEffectsByRole } from '../types/atom-expr'

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
  rulesOnlyHashChain?: ReturnType<CompiledPublicationGateService['validateRulesOnlyHashChain']>
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

    const hasTypedRulesOnlyInput = this.hasTypedRulesOnlyInput(input.semanticState.rules)
    const canonicalSpec = hasTypedRulesOnlyInput
      ? this.canonicalSpecBuilder.buildFromSemanticState(input.semanticState)
      : input.canonicalSpecOverride ?? this.canonicalSpecBuilder.buildFromSemanticState(input.semanticState)
    const semanticPredicateGraph = this.graphSnapshotService.buildFromSemanticArtifacts({ canonicalSpec })
    const normalizedIntent = this.buildRulesOnlyNormalizedIntentSnapshot({
      semanticState: input.semanticState,
      canonicalSpec,
    })
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
    const canValidateRulesOnlyHashChain = validation.passed
      && typeof this.publicationGate?.validateRulesOnlyHashChain === 'function'
    const rulesOnlyHashChain = canValidateRulesOnlyHashChain
      ? hasTypedRulesOnlyInput
        ? this.publicationGate?.validateRulesOnlyHashChain({
            rules: input.semanticState.rules ?? [],
            canonicalSpec: canonicalSpec as unknown as Record<string, unknown>,
            ir: compiled.ir,
            ast,
            script: compiledScript,
          })
        : this.buildUnsupportedRulesOnlyInputGate({
            rules: input.semanticState.rules,
            canonicalSpec,
            ir: compiled.ir,
            ast,
            script: compiledScript,
          })
      : undefined

    if (rulesOnlyHashChain?.blocked) {
      const error = new Error(`publication gate blocked: ${rulesOnlyHashChain.reason}`) as Error & {
        publicationGate?: typeof rulesOnlyHashChain
        rulesOnlyHashChain?: typeof rulesOnlyHashChain
      }
      error.publicationGate = rulesOnlyHashChain
      error.rulesOnlyHashChain = rulesOnlyHashChain
      throw error
    }

    const semanticConsistency = validation.passed
      ? this.strategyConsistencyService.evaluate({
          canonicalSpec,
          scriptCode: compiledScript,
        })
      : this.buildValidationFailedConsistencyReport(validation)
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
    const compiledScriptProjection = validation.passed
      ? this.compiledScriptParser.parse(compiledScript)
      : null
    const stage1ConsistencyEvidence = validation.passed
      ? {
          rulesHash: rulesOnlyHashChain?.hashes.rulesHash ?? this.hashCanonicalJson(input.semanticState.rules ?? []),
          canonicalSpecHash: rulesOnlyHashChain?.hashes.canonicalSpecHash ?? this.hashCanonicalJson(canonicalSpec),
          irHash: rulesOnlyHashChain?.hashes.irHash ?? this.readCompiledIrHash(compiled) ?? this.hashCanonicalJson(compiled.ir),
          astHash: rulesOnlyHashChain?.hashes.astHash ?? this.readAstDigest(ast) ?? this.readParsedAstDigest(compiledScriptProjection),
          scriptHash: rulesOnlyHashChain?.hashes.scriptHash ?? this.hashText(compiledScript),
        }
      : undefined
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
      ...(rulesOnlyHashChain ? { rulesOnlyHashChain } : {}),
      ...(stage1ConsistencyEvidence ? { stage1ConsistencyEvidence } : {}),
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
      ...(rulesOnlyHashChain ? { rulesOnlyHashChain } : {}),
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

  private buildValidationFailedConsistencyReport(
    validation: CompiledScriptValidationResult,
  ): StrategyConsistencyReport {
    const emptyProfile = this.buildEmptySemanticProfile()
    return {
      status: 'FAILED',
      specProfile: emptyProfile,
      scriptProfile: emptyProfile,
      checks: [{
        key: 'script.structural_validation',
        level: 'critical',
        status: 'failed',
        expected: 'compiled script structural validation passed',
        actual: validation.reason ?? 'compiled script structural validation failed',
        message: validation.reason ?? '编译脚本结构校验失败',
      }],
      summary: {
        criticalFailed: 1,
        warningFailed: 0,
        unprovable: 0,
      },
    }
  }

  private buildEmptySemanticProfile(): StrategySemanticProfile {
    return {
      indicators: [],
      actions: [],
      ruleMappings: [],
      rules: [],
      sizing: null,
      requiredParams: [],
      fallbackDetected: false,
    }
  }

  private hashCanonicalJson(value: unknown): string {
    return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
  }

  private hashText(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex')
  }

  private readCompiledIrHash(compiled: ReturnType<CanonicalSpecV2IrCompilerService['compile']>): string | null {
    const maybeHash = (compiled as unknown as { irHash?: unknown }).irHash
    return typeof maybeHash === 'string' ? this.stripSha256Prefix(maybeHash) : null
  }

  private readAstDigest(ast: ReturnType<CanonicalStrategyAstCompilerService['compile']>): string | null {
    const maybeDigest = (ast as unknown as { manifest?: { astDigest?: unknown } }).manifest?.astDigest
    return typeof maybeDigest === 'string' ? this.stripSha256Prefix(maybeDigest) : null
  }

  private readParsedAstDigest(parsed: ReturnType<CompiledScriptParserService['parse']> | null): string | null {
    const maybeDigest = (parsed as unknown as { compiledManifest?: { astDigest?: unknown } } | null)
      ?.compiledManifest?.astDigest
    return typeof maybeDigest === 'string' ? this.stripSha256Prefix(maybeDigest) : null
  }

  private stripSha256Prefix(value: string): string {
    return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value
  }

  private hasTypedRulesOnlyInput(rules: unknown): boolean {
    return Array.isArray(rules)
      && rules.length > 0
      && rules.every((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false
        const effects = (rule as { effects?: unknown }).effects
        if (!isRuleEffectsByRole(effects as never)) return false
        const effectRecord = effects as Record<string, unknown>
        return ['actions', 'risks', 'positions', 'orchestration', 'programs']
          .every(key => Array.isArray(effectRecord[key]))
      })
  }

  private buildUnsupportedRulesOnlyInputGate(args: {
    rules: unknown
    canonicalSpec: CanonicalStrategySpecV2
    ir: ReturnType<CanonicalSpecV2IrCompilerService['compile']>['ir']
    ast: ReturnType<CanonicalStrategyAstCompilerService['compile']>
    script: string
  }): ReturnType<CompiledPublicationGateService['validateRulesOnlyHashChain']> {
    return {
      passed: false,
      blocked: true,
      reason: 'rules_only_trace_missing',
      hashes: {
        rulesHash: this.hashCanonicalJson(args.rules ?? []),
        canonicalSpecHash: this.hashCanonicalJson(args.canonicalSpec),
        irHash: this.hashCanonicalJson(args.ir),
        astHash: this.readAstDigest(args.ast) ?? this.hashCanonicalJson(args.ast),
        scriptHash: this.hashText(args.script),
      },
      checks: [{
        key: 'trace.rules_only_input',
        passed: false,
        expected: 'non-empty typed rules-only input with role-partitioned effects',
        actual: Array.isArray(args.rules)
          ? { rulesCount: args.rules.length, typed: false }
          : { rulesType: typeof args.rules },
      }],
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
        : 'okx',
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
    const rulesPositionPct = this.readRulesOnlyPositionPct(args.semanticState)
    if (rulesPositionPct !== null) {
      locked.positionPct = rulesPositionPct
    } else if (
      position?.status === 'locked'
      && position.mode === 'fixed_ratio'
      && Number.isFinite(position.value)
    ) {
      locked.positionPct = position.value <= 1 ? position.value * 100 : position.value
    }

    for (const riskLeaf of this.collectRulesOnlyEffectAtoms(args.semanticState, 'risks')) {
      const valuePct = this.readRuleRiskValuePct(riskLeaf.params)
      if (riskLeaf.key === 'risk.stop_loss_pct' && valuePct !== null) {
        locked.stopLossPct = valuePct
        const basis = this.readRuleRiskBasis(riskLeaf.params)
        if (basis) locked.stopLossBasis = basis
      }
      if (riskLeaf.key === 'risk.take_profit_pct' && valuePct !== null) {
        locked.takeProfitPct = valuePct
        const basis = this.readRuleRiskBasis(riskLeaf.params)
        if (basis) locked.takeProfitBasis = basis
      }
    }

    for (const rule of args.canonicalSpec.rules) {
      const semanticKey = this.readCanonicalRuleSemanticKey(rule.metadata)
      const valuePct = this.readCanonicalRiskValuePct(rule)
      if (semanticKey === 'risk.stop_loss_pct' && valuePct !== null) {
        locked.stopLossPct = valuePct
      }
      if (semanticKey === 'risk.take_profit_pct' && valuePct !== null) {
        locked.takeProfitPct = valuePct
      }
      if ((semanticKey === 'risk.stop_loss_pct' || semanticKey === 'risk.take_profit_pct') && typeof rule.metadata?.basis === 'string') {
        if (semanticKey === 'risk.stop_loss_pct') locked.stopLossBasis = rule.metadata.basis
        if (semanticKey === 'risk.take_profit_pct') locked.takeProfitBasis = rule.metadata.basis
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

  private buildRulesOnlyNormalizedIntentSnapshot(args: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpecV2
  }): StrategyNormalizedIntent {
    const families = new Set(args.semanticState.families)
    if (args.canonicalSpec.rules.some(rule => rule.phase === 'gate')) {
      families.add('state-gated')
    }
    return {
      families: Array.from(families) as StrategyNormalizedIntent['families'],
      triggers: args.canonicalSpec.rules
        .filter(rule => rule.phase === 'entry' || rule.phase === 'exit' || rule.phase === 'gate')
        .map(rule => ({
          key: (rule.metadata?.semanticKey ?? rule.condition.kind) as StrategyNormalizedIntent['triggers'][number]['key'],
          phase: rule.phase as StrategyNormalizedIntent['triggers'][number]['phase'],
          sideScope: rule.sideScope as StrategyNormalizedIntent['triggers'][number]['sideScope'],
          params: {},
          closureStatus: 'closed',
          unresolvedSlots: [],
        })),
      actions: this.collectRulesOnlyEffectAtoms(args.semanticState, 'actions').map(action => ({
        key: action.key,
        params: action.params,
      })),
      risk: this.collectRulesOnlyEffectAtoms(args.semanticState, 'risks').map(risk => ({
        key: risk.key,
        params: risk.params,
      })),
      position: this.buildRulesOnlyNormalizedPosition(args.semanticState),
      unresolved: [],
      normalizationNotes: [...args.semanticState.normalizationNotes],
    }
  }

  private collectRulesOnlyEffectAtoms(
    semanticState: SemanticState,
    role: 'actions' | 'risks' | 'positions' | 'orchestration' | 'programs',
  ) {
    const rules = semanticState.rules ?? []
    if (!this.hasTypedRulesOnlyInput(rules)) return []
    return rules.flatMap(rule =>
      isRuleEffectsByRole(rule.effects)
        ? rule.effects[role].flatMap(effect => collectAtomLeaves(effect))
        : [],
    )
  }

  private buildRulesOnlyNormalizedPosition(semanticState: SemanticState): StrategyNormalizedIntent['position'] {
    const positionPct = this.readRulesOnlyPositionPct(semanticState)
    if (positionPct === null) {
      return null as unknown as StrategyNormalizedIntent['position']
    }
    return {
      mode: 'fixed_ratio',
      value: positionPct <= 1 ? positionPct : positionPct / 100,
      positionMode: this.readRulesOnlyPositionMode(semanticState),
    }
  }

  private readRulesOnlyPositionPct(semanticState: SemanticState): number | null {
    for (const leaf of this.collectRulesOnlyEffectAtoms(semanticState, 'positions')) {
      if (leaf.key !== 'position.per_order_budget' && leaf.key !== 'position.sizing') continue
      const value = leaf.params.value
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value <= 1 ? Number((value * 100).toFixed(8)) : value
      }
    }
    return null
  }

  private readRulesOnlyPositionMode(semanticState: SemanticState): StrategyNormalizedIntent['position']['positionMode'] {
    const actions = this.collectRulesOnlyEffectAtoms(semanticState, 'actions').map(action => action.key)
    const hasLong = actions.includes('action.open_long') || actions.includes('action.close_long')
    const hasShort = actions.includes('action.open_short') || actions.includes('action.close_short')
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private readRuleRiskValuePct(params: Record<string, unknown>): number | null {
    const value = params.valuePct
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
    return null
  }

  private readRuleRiskBasis(params: Record<string, unknown>): string | null {
    return typeof params.basis === 'string' ? params.basis : null
  }

  private readCanonicalRuleSemanticKey(metadata: CanonicalStrategySpecV2['rules'][number]['metadata']): string | null {
    return typeof metadata?.semanticKey === 'string' ? metadata.semanticKey : null
  }

  private readCanonicalRiskValuePct(rule: CanonicalStrategySpecV2['rules'][number]): number | null {
    if (rule.condition.kind === 'atom' && typeof rule.condition.value === 'number') {
      return Number((rule.condition.value * 100).toFixed(8))
    }
    if (rule.condition.kind === 'expression' && rule.condition.right.kind === 'constant' && typeof rule.condition.right.value === 'number') {
      return Math.abs(rule.condition.right.value)
    }
    return null
  }

  private resolveSemanticPositionMode(
    semanticState: SemanticState,
    canonicalSpec: CanonicalStrategySpecV2,
  ): ReturnType<CompiledScriptExecutionEnvelopeService['build']>['positionMode'] | undefined {
    // Issue #1391：真相源优先级 —— action 暴露（canonical spec rules）> positionConstraint sideMode 声明。
    // 多轮对话下 state.position.positionMode 第一次锁定后不会随 action 暴露重算，
    // 因此 canonical spec 推得出真实暴露时必须以 canonical 为准，避免与 IR expected positionMode 漂移。
    const hasLong = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_LONG' || action.type === 'CLOSE_LONG' || action.type === 'REDUCE_LONG',
    ))
    const hasShort = canonicalSpec.rules.some(rule => rule.actions.some(action =>
      action.type === 'OPEN_SHORT' || action.type === 'CLOSE_SHORT' || action.type === 'REDUCE_SHORT',
    ))
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    if (hasLong) return 'long_only'

    const hasGridProgram = (canonicalSpec.orchestration?.programs ?? []).some(program =>
      program.programKind === 'fixed_grid_gated'
      || program.programKind === 'dynamic_grid'
      || program.programKind === 'adaptive_volatility_grid',
    )
    const canonicalSpecWithOrderPrograms = canonicalSpec as unknown as { orderPrograms?: unknown }
    const orderPrograms = Array.isArray(canonicalSpecWithOrderPrograms.orderPrograms)
      ? canonicalSpecWithOrderPrograms.orderPrograms as Array<{ programKind?: unknown, mode?: unknown }>
      : []
    if (orderPrograms.some(program => program.mode === 'perp_neutral')) return 'long_short'
    if (orderPrograms.some(program => program.mode === 'perp_short')) return 'short_only'
    if (orderPrograms.some(program => program.programKind === 'fixed_grid_gated')) return 'long_only'
    if (hasGridProgram) return canonicalSpec.market.marketType === 'perp' ? 'long_short' : 'long_only'

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
