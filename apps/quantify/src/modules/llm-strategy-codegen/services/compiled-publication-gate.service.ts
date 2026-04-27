import type { StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1 } from '../types/canonical-strategy-ir'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
import type {
  PublicationGateCheck,
  PublicationGateReport,
  PublishedRuntimeExecutionSemantic,
  PublishedStrategyAstSnapshot,
} from '../types/publication-gate'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
import { CompiledScriptParserService } from './compiled-script-parser.service'

type ExprNode = StrategyAstV1['exprPool'][number]
type RuntimeActionKind = CanonicalStrategyIrV1['ruleBlocks'][number]['actions'][number]['kind']

interface PublishCompiledSnapshotInput {
  sessionId: string
  strategyTemplateId?: string | null
  strategyInstanceId?: string | null
  canonicalSnapshot: Record<string, unknown>
  semanticView: Record<string, unknown>
  graphSnapshot: StrategyLogicGraphSnapshot
  clarificationState?: StrategyClarificationState | null
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
  executionEnvelope: CompiledScriptExecutionEnvelope
  script: string
  semanticConsistencyReport: Record<string, unknown>
  userIntentSummary: Record<string, unknown>
  strategySummary: Record<string, unknown>
  scriptSummary: Record<string, unknown>
  lockedParams: Record<string, unknown>
}

interface FormalStrategyConfig {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  baseTimeframe: string | null
  stateTimeframes?: string[]
  positionPct: number | null
  strategyDeclaredLeverageRange: null
}

interface FormalBacktestConfigDefaults {
  initialCash: number
  leverage: number
  slippageBps: number
  feeBps: number
  priceSource: 'open' | 'close' | 'mid'
  allowPartial: boolean
}

interface FormalDeploymentExecutionDefaults {
  leverage: number
  priceSource: 'open' | 'close' | 'mid'
  orderType: 'market' | 'limit'
  timeInForce: 'gtc' | 'ioc' | 'fok'
}

interface FormalDeploymentExecutionConstraints {
  platformRiskMaxLeverage: number
  strategyDeclaredLeverageRange: null
  defaultLeverage: number
  effectiveAllowedLeverageRange: { min: number; max: number }
  supportedPriceSources: Array<'open' | 'close' | 'mid'>
  supportedOrderTypes: Array<'market' | 'limit'>
  supportedTimeInForce: Array<'gtc' | 'ioc' | 'fok'>
  constraintExplanation: string
}

const ON_START_SOURCE_REF_PATTERN = /(^|[_-])(?:execution[_-])?on_start([_-]|$)/i
const DEFAULT_PERP_PLATFORM_MAX_LEVERAGE = 5

@Injectable()
export class CompiledPublicationGateService {
  constructor(
    private readonly publishedSnapshotsRepo: PublishedStrategySnapshotsRepository,
    private readonly scriptParser: CompiledScriptParserService = new CompiledScriptParserService(),
  ) {}

  async publish(input: PublishCompiledSnapshotInput): Promise<{
    snapshotId: string
    snapshotHash: string
    consistencyReport: Record<string, unknown>
  }> {
    if (input.clarificationState?.items.some(item => item.status === 'pending')) {
      throw new Error('clarification unresolved')
    }

    const parsed = this.scriptParser.parse(input.script)
    const manifest = parsed.compiledManifest
    const publicationGate = this.buildPublicationGateReport(input, parsed)
    const blockingChecks = publicationGate.checks.filter(check => check.blocking && check.status === 'failed')
    if (blockingChecks.length > 0) {
      const error = new Error(`publication gate blocked: ${blockingChecks.map(check => check.message).join('；')}`) as Error & {
        publicationGate?: PublicationGateReport
      }
      error.publicationGate = publicationGate
      throw error
    }

    const compilerConsistency = this.buildCompilerConsistency(input, parsed, publicationGate)
    const strategyConfig = this.buildStrategyConfig(input)
    const backtestConfigDefaults = this.buildBacktestConfigDefaults(input)
    const deploymentExecutionDefaults = this.buildDeploymentExecutionDefaults(input)
    const deploymentExecutionConstraints = this.buildDeploymentExecutionConstraints(input, deploymentExecutionDefaults)
    const astSnapshot = this.buildPublicationAstSnapshot(input.ast)
    const semanticStatus = input.semanticConsistencyReport.status
    const consistencyReport = {
      status:
        semanticStatus === 'PASSED' && compilerConsistency.status === 'PASSED'
          ? 'PASSED'
          : 'FAILED',
      semanticConsistency: input.semanticConsistencyReport,
      compilerConsistency,
    }

    const snapshot = await this.publishedSnapshotsRepo.create({
      sessionId: input.sessionId,
      strategyTemplateId: input.strategyTemplateId ?? null,
      strategyInstanceId: input.strategyInstanceId ?? null,
      scriptSnapshot: input.script,
      specSnapshot: input.canonicalSnapshot,
      semanticGraph: input.semanticView,
      compiledIr: input.ir as unknown as Record<string, unknown>,
      irSnapshot: input.ir as unknown as Record<string, unknown>,
      astSnapshot,
      compiledManifest: manifest as unknown as Record<string, unknown>,
      consistencyReport,
      userIntentSummary: input.userIntentSummary,
      strategySummary: input.strategySummary,
      scriptSummary: input.scriptSummary,
      lockedParams: input.lockedParams,
      snapshotVersion: 3,
      paramsSnapshot: {
        exchange: strategyConfig.exchange,
        symbol: strategyConfig.symbol,
        timeframe: strategyConfig.baseTimeframe,
        marketType: strategyConfig.marketType,
        positionPct: strategyConfig.positionPct,
      },
      strategyConfig: strategyConfig as unknown as Record<string, unknown>,
      backtestConfigDefaults: backtestConfigDefaults as unknown as Record<string, unknown>,
      deploymentExecutionDefaults: deploymentExecutionDefaults as unknown as Record<string, unknown>,
      deploymentExecutionConstraints: deploymentExecutionConstraints as unknown as Record<string, unknown>,
      executionEnvelope: input.executionEnvelope as unknown as Record<string, unknown>,
      executionPolicy: input.ir.executionPolicy as unknown as Record<string, unknown>,
      dataRequirements: input.ast.dataRequirements as unknown as Record<string, unknown>,
    })

    return {
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      consistencyReport,
    }
  }

  private buildCompilerConsistency(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
    publicationGate: PublicationGateReport,
  ): Record<string, unknown> {
    const graphVsIrPassed = input.ir.source.graphDigest === input.ir.source.specHash
    const irVsScriptPassed = parsed.compiledManifest.irHash === input.ast.manifest.irHash
    const manifestSelfCheckPassed = parsed.compiledManifest.specHash === input.ast.manifest.specHash

    return {
      status: graphVsIrPassed && irVsScriptPassed && manifestSelfCheckPassed && publicationGate.status === 'PASSED'
        ? 'PASSED'
        : 'FAILED',
      graphVsIr: {
        passed: graphVsIrPassed,
        graphDigest: input.ir.source.graphDigest,
        specHash: input.ir.source.specHash,
      },
      irVsScript: {
        passed: irVsScriptPassed,
        irHash: parsed.compiledManifest.irHash,
        astDigest: parsed.compiledManifest.astDigest,
      },
      manifestSelfCheck: {
        passed: manifestSelfCheckPassed,
        irHash: parsed.compiledManifest.irHash,
        specHash: parsed.compiledManifest.specHash,
        astDigest: parsed.compiledManifest.astDigest,
        structuralDigest: parsed.compiledManifest.structuralDigest,
      },
      publicationGate,
    }
  }

  private buildPublicationAstSnapshot(ast: StrategyAstV1): PublishedStrategyAstSnapshot {
    const runtimeExecutionSemantics = this.buildRuntimeExecutionSemantics(ast)
    return {
      ...ast,
      ...(runtimeExecutionSemantics.length > 0 ? { runtimeExecutionSemantics } : {}),
    }
  }

  private buildRuntimeExecutionSemantics(ast: StrategyAstV1): PublishedRuntimeExecutionSemantic[] {
    const firstMarkedProgram = ast.decisionPrograms.find((program) => {
      const markerSource = `${program.sourceRef} ${program.id}`
      return ON_START_SOURCE_REF_PATTERN.test(markerSource)
    })

    if (!firstMarkedProgram) {
      return []
    }

    return [{
      semanticKey: `on_start.${firstMarkedProgram.phase}.${this.resolveSemanticLabel(1)}`,
      trigger: 'on_start',
      phase: firstMarkedProgram.phase,
      consumePolicy: 'once',
      requiredRuntimeContext: {
        barIndex: 1,
        requiresReferenceBar: true,
        requiresSymbol: true,
        requiresTimeframe: true,
      },
      sourceRefs: [firstMarkedProgram.sourceRef],
    }]
  }

  private resolveSemanticLabel(index: number): string {
    const labels = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
    return labels[index - 1] ?? `slot_${index}`
  }

  private buildStrategyConfig(input: PublishCompiledSnapshotInput): FormalStrategyConfig {
    const [baseTimeframe, ...stateTimeframes] = input.ir.market.timeframes
    return {
      exchange: input.ir.market.venue,
      symbol: input.ir.market.symbol,
      marketType: input.ir.market.instrumentType === 'perpetual' ? 'perp' : 'spot',
      baseTimeframe: baseTimeframe ?? null,
      stateTimeframes,
      positionPct: input.ir.portfolio.sizing.mode === 'pct_equity'
        ? input.ir.portfolio.sizing.value
        : null,
      strategyDeclaredLeverageRange: null,
    }
  }

  private buildBacktestConfigDefaults(input: PublishCompiledSnapshotInput): FormalBacktestConfigDefaults {
    return {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: this.resolvePriceSource(input.ir.market.priceFeed),
      allowPartial: input.ir.executionPolicy.allowPartialFill,
    }
  }

  private buildDeploymentExecutionDefaults(
    input: PublishCompiledSnapshotInput,
  ): FormalDeploymentExecutionDefaults {
    return {
      leverage: 1,
      priceSource: this.resolvePriceSource(input.ir.market.priceFeed),
      orderType: input.ir.executionPolicy.orderTypeDefault,
      timeInForce: input.ir.executionPolicy.timeInForce,
    }
  }

  private buildDeploymentExecutionConstraints(
    input: PublishCompiledSnapshotInput,
    defaults: FormalDeploymentExecutionDefaults,
  ): FormalDeploymentExecutionConstraints {
    const platformRiskMaxLeverage = input.ir.market.instrumentType === 'perpetual'
      ? DEFAULT_PERP_PLATFORM_MAX_LEVERAGE
      : 1
    return {
      platformRiskMaxLeverage,
      strategyDeclaredLeverageRange: null,
      defaultLeverage: defaults.leverage,
      effectiveAllowedLeverageRange: { min: 1, max: platformRiskMaxLeverage },
      supportedPriceSources: [defaults.priceSource],
      supportedOrderTypes: [defaults.orderType],
      supportedTimeInForce: [defaults.timeInForce],
      constraintExplanation: 'strategy/default constraints pending account-capability intersection',
    }
  }

  private resolvePriceSource(priceFeed: CanonicalStrategyIrV1['market']['priceFeed']): 'open' | 'close' | 'mid' {
    if (priceFeed === 'hlc3' || priceFeed === 'ohlc4') return 'mid'
    return 'close'
  }

  private buildPublicationGateReport(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateReport {
    const checks: PublicationGateCheck[] = [
      ...this.buildMarketMetadataChecks(input, parsed),
      ...this.buildPositionModeChecks(input, parsed),
      ...this.buildOutsideBandRiskChecks(input, parsed),
    ]

    return {
      status: checks.some(check => check.blocking && check.status === 'failed') ? 'FAILED' : 'PASSED',
      checks,
    }
  }

  private buildMarketMetadataChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const market = this.readCanonicalMarket(input.canonicalSnapshot)
    if (!market) return []

    const actual = {
      ir: {
        exchange: input.ir.market.venue,
        marketType: input.ir.market.instrumentType === 'perpetual' ? 'perp' : 'spot',
        symbol: input.ir.market.symbol,
        timeframe: input.ir.market.timeframes[0] ?? null,
      },
      script: {
        exchange: parsed.executionModel.venue,
        marketType: parsed.executionModel.instrumentType === 'perpetual' ? 'perp' : 'spot',
        symbol: parsed.executionModel.symbol,
        timeframe: parsed.executionModel.primaryTimeframe,
      },
    }

    const entries: Array<[keyof typeof market, string | null]> = [
      ['exchange', market.exchange],
      ['marketType', market.marketType],
      ['symbol', market.symbol],
      ['timeframe', market.timeframe],
    ]

    return entries
      .filter(([, expected]) => typeof expected === 'string' && expected.trim().length > 0)
      .map(([field, expected]) => {
        const irValue = actual.ir[field]
        const scriptValue = actual.script[field]
        const passed = irValue === expected && scriptValue === expected
        return {
          key: `market.${field}`,
          blocking: true,
          status: passed ? 'passed' : 'failed',
          expected,
          actual: {
            ir: irValue,
            script: scriptValue,
          },
          message: passed
            ? `confirmed ${field} 与 IR/脚本一致。`
            : `confirmed ${field}=${expected}，但 IR=${irValue}、script=${scriptValue}`,
        }
      })
  }

  private buildOutsideBandRiskChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const expectedRules = this.readOutsideBandRules(input.canonicalSnapshot)
    if (expectedRules.length === 0) return []

    const irOutsideBars = new Set(
      input.ir.signalCatalog.series
        .filter(series => series.kind === 'BOLLINGER_BARS_OUTSIDE')
        .map(series => typeof series.params?.bars === 'number' ? series.params.bars : 1),
    )
    const scriptOutsideSeries = parsed.exprPool
      .filter(this.isSeriesExprNode)
      .filter(expr => expr.payload.kind === 'BOLLINGER_BARS_OUTSIDE')
    const scriptOutsideBars = new Set(
      scriptOutsideSeries
        .map(series => typeof series.payload.params?.bars === 'number' ? series.payload.params.bars : 1),
    )
    const outsideSeriesIds = new Set(scriptOutsideSeries.map(series => series.id))
    const outsidePredicateIds = new Set(
      parsed.exprPool
        .filter(this.isPredicateExprNode)
        .filter(expr =>
          expr.sourceRef.toLowerCase().includes('outside')
          || expr.payload.args.some(arg => outsideSeriesIds.has(arg)))
        .map(expr => expr.id),
    )
    const scriptOutsideActions = new Set(
      parsed.decisionPrograms
        .filter(program => outsidePredicateIds.has(program.when) || program.sourceRef.toLowerCase().includes('outside'))
        .flatMap(program => program.actions.map(action => action.kind)),
    )

    const missingBars = expectedRules
      .map(rule => rule.bars)
      .filter(bars => !irOutsideBars.has(bars) || !scriptOutsideBars.has(bars))
    const missingActions = Array.from(new Set(
      expectedRules
        .flatMap(rule => rule.actions)
        .flatMap(action => this.mapOutsideRuleActionsToRuntimeActions(action))
        .filter(action => !scriptOutsideActions.has(action)),
    ))

    const passed = missingBars.length === 0 && missingActions.length === 0

    return [{
      key: 'risk.bollinger_bars_outside',
      blocking: true,
      status: passed ? 'passed' : 'failed',
      expected: expectedRules,
      actual: {
        irBars: Array.from(irOutsideBars),
        scriptBars: Array.from(scriptOutsideBars),
        scriptActions: Array.from(scriptOutsideActions),
      },
      message: passed
        ? '轨外连续 K 线风险规则已完整落到 IR 和脚本。'
        : [
            missingBars.length > 0 ? `缺少轨外 bars=${missingBars.join(',')}` : '',
            missingActions.length > 0 ? `缺少轨外动作=${missingActions.join(',')}` : '',
          ].filter(Boolean).join('；'),
    }]
  }

  private buildPositionModeChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const expected = this.readCanonicalPositionMode(input.canonicalSnapshot)
    if (!expected) return []

    const actual = {
      ir: input.ir.portfolio.positionMode,
      script: parsed.executionModel.positionMode,
    }
    const passed = actual.ir === expected && actual.script === expected

    return [{
      key: 'portfolio.positionMode',
      blocking: true,
      status: passed ? 'passed' : 'failed',
      expected,
      actual,
      message: passed
        ? 'confirmed positionMode 与 IR/脚本一致。'
        : `confirmed positionMode=${expected}，但 IR=${actual.ir}、script=${actual.script}`,
    }]
  }

  private readCanonicalMarket(snapshot: Record<string, unknown>): {
    exchange: string | null
    marketType: string | null
      symbol: string | null
      timeframe: string | null
  } | null {
    const market = snapshot.market
    if (!market || typeof market !== 'object' || Array.isArray(market)) return null

    const record = market as Record<string, unknown>
    return {
      exchange: typeof record.exchange === 'string' ? record.exchange : null,
      marketType: typeof record.marketType === 'string' ? record.marketType : null,
      symbol: typeof record.symbol === 'string' ? record.symbol : null,
      timeframe: typeof record.defaultTimeframe === 'string'
        ? record.defaultTimeframe
        : (typeof record.timeframe === 'string' ? record.timeframe : null),
    }
  }

  private readOutsideBandRules(snapshot: Record<string, unknown>): Array<{
    bars: number
    actions: string[]
  }> {
    const rules = snapshot.rules
    if (!Array.isArray(rules)) return []

    return rules.flatMap((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return []
      const record = rule as Record<string, unknown>
      const barsValues = this.collectOutsideBandBars(record.condition)
      if (barsValues.length === 0) return []

      const actions = Array.isArray(record.actions)
        ? record.actions
          .map((action) => {
            if (!action || typeof action !== 'object' || Array.isArray(action)) return null
            const type = (action as Record<string, unknown>).type
            return typeof type === 'string' ? type : null
          })
          .filter((action): action is string => action !== null)
        : []

      return barsValues.map(bars => ({ bars, actions }))
    })
  }

  private readCanonicalPositionMode(
    snapshot: Record<string, unknown>,
  ): 'long_only' | 'short_only' | 'long_short' | null {
    const rules = snapshot.rules
    if (!Array.isArray(rules) || rules.length === 0) return null

    const hasLongExposure = rules.some((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false
      const actions = (rule as Record<string, unknown>).actions
      if (!Array.isArray(actions)) return false

      return actions.some((action) => {
        if (!action || typeof action !== 'object' || Array.isArray(action)) return false
        const type = (action as Record<string, unknown>).type
        return type === 'OPEN_LONG' || type === 'REDUCE_LONG'
      })
    })
    const hasShortExposure = rules.some((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false
      const actions = (rule as Record<string, unknown>).actions
      if (!Array.isArray(actions)) return false

      return actions.some((action) => {
        if (!action || typeof action !== 'object' || Array.isArray(action)) return false
        const type = (action as Record<string, unknown>).type
        return type === 'OPEN_SHORT' || type === 'REDUCE_SHORT'
      })
    })

    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (hasShortExposure) return 'short_only'
    return 'long_only'
  }

  private collectOutsideBandBars(condition: unknown): number[] {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return []
    const record = condition as Record<string, unknown>

    if (record.kind === 'atom' && record.key === 'bollinger.bars_outside') {
      const params = record.params
      const paramBars = params && typeof params === 'object' && !Array.isArray(params)
        ? (params as Record<string, unknown>).bars
        : null
      const value = typeof record.value === 'number' ? record.value : null
      const bars = typeof paramBars === 'number' ? paramBars : value
      return typeof bars === 'number' ? [bars] : []
    }

    if (!Array.isArray(record.children)) return []
    return record.children.flatMap(child => this.collectOutsideBandBars(child))
  }

  private mapOutsideRuleActionsToRuntimeActions(action: string): RuntimeActionKind[] {
    const runtimeActions: RuntimeActionKind[] = []
    switch (action) {
      case 'FORCE_EXIT':
        runtimeActions.push('CLOSE_LONG', 'CLOSE_SHORT')
        break
      case 'REDUCE_LONG':
      case 'REDUCE_SHORT':
      case 'CLOSE_LONG':
      case 'CLOSE_SHORT':
        runtimeActions.push(action)
        break
      default:
        break
    }
    return runtimeActions
  }

  private isSeriesExprNode(expr: ExprNode): expr is ExprNode & { nodeType: 'series', payload: CanonicalStrategyIrV1['signalCatalog']['series'][number] } {
    return expr.nodeType === 'series'
  }

  private isPredicateExprNode(expr: ExprNode): expr is ExprNode & { nodeType: 'predicate', payload: CanonicalStrategyIrV1['signalCatalog']['predicates'][number] } {
    return expr.nodeType === 'predicate'
  }
}
