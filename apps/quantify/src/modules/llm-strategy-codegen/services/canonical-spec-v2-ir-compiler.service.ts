import type {
  ActionDef,
  CanonicalStrategyIrV1,
  IrOrchestrationGate,
  IrOrchestrationPortfolioRisk,
  OrderProgram,
  PredicateDef,
  RiskGuard,
  RiskPredicateDef,
  RuleBlock,
  SeriesDef,
  LevelSetDef,
} from '../types/canonical-strategy-ir'
import type {
  CanonicalConditionAtom,
  CanonicalConditionGroup,
  CanonicalConditionNode,
  CanonicalExpressionCondition,
  CanonicalOrchestrationGate,
  CanonicalOrchestrationPortfolioRisk,
  CanonicalOrderProgramIntent,
  CanonicalRuleAction,
  CanonicalRuleSideScope,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec'
import type { SemanticExpressionOperand } from '../types/semantic-state'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { Injectable } from '@nestjs/common'
import { CANONICAL_RULE_KEYS, DEFAULT_INDICATOR_PARAMS } from '../constants/canonical-strategy-capabilities'
import { CanonicalSpecV2DigestService } from './canonical-spec-v2-digest.service'
import { CanonicalStrategyIrCanonicalizerService } from './canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from './canonical-strategy-ir-validator.service'
import { CodegenGraphSnapshotService } from './codegen-graph-snapshot.service'
import { SpecDescBuilderService } from './spec-desc-builder.service'

interface CompileCanonicalSpecV2ToIrInput {
  canonicalSpec: CanonicalStrategySpecV2
  fallback: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
    executionTags?: string[]
  }
}

interface CompileCanonicalSpecV2ToIrResult {
  graphSnapshot: StrategyLogicGraphSnapshot
  semanticView: Record<string, unknown>
  ir: CanonicalStrategyIrV1
}

interface CompileContext {
  timeframe: string
  seriesMap: Map<string, SeriesDef>
  levelSetMap: Map<string, LevelSetDef>
  predicateMap: Map<string, PredicateDef>
  orderProgramActivePredicateMap: Map<string, string>
  movingAverage: {
    kind: 'EMA' | 'SMA'
    fast: number
    slow: number
  }
  rsi: {
    period: number
  }
  macd: {
    fastPeriod: number
    slowPeriod: number
    signalPeriod: number
  }
  bollinger: {
    period: number
    stdDev: number
  }
  runtimeRequirements: {
    helpers: Set<string>
    stateKeys: Set<string>
  }
}

@Injectable()
export class CanonicalSpecV2IrCompilerService {
  constructor(
    private readonly digest: CanonicalSpecV2DigestService = new CanonicalSpecV2DigestService(),
    private readonly specDescBuilder: SpecDescBuilderService = new SpecDescBuilderService(),
    private readonly validator: CanonicalStrategyIrValidatorService = new CanonicalStrategyIrValidatorService(),
    private readonly canonicalizer: CanonicalStrategyIrCanonicalizerService = new CanonicalStrategyIrCanonicalizerService(),
    private readonly graphSnapshotService: CodegenGraphSnapshotService = new CodegenGraphSnapshotService(),
  ) {}

  compile(input: CompileCanonicalSpecV2ToIrInput): CompileCanonicalSpecV2ToIrResult {
    if (input.canonicalSpec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }

    const specHash = this.digest.hash(input.canonicalSpec)
    const graphSnapshot = this.buildGraphSnapshot(input)
    const rawIr = this.buildIr(input, specHash, specHash, graphSnapshot.version)
    rawIr.source.graphDigest = this.hashCanonicalJson(
      this.graphSnapshotService.buildFromSemanticArtifacts({ canonicalSpec: input.canonicalSpec }),
    )
    const ir = this.canonicalizer.canonicalize(rawIr)
    this.validator.validate(ir)

    return {
      graphSnapshot,
      semanticView: this.specDescBuilder.buildFromCanonicalSpec(input.canonicalSpec, ''),
      ir,
    }
  }

  private buildIr(
    input: CompileCanonicalSpecV2ToIrInput,
    specHash: `sha256:${string}`,
    graphDigest: `sha256:${string}`,
    graphVersion: number,
  ): CanonicalStrategyIrV1 {
    const exchange = input.canonicalSpec.market.exchange || input.fallback.exchange
    const symbol = input.canonicalSpec.market.symbol || input.fallback.symbol
    const timeframe = input.canonicalSpec.market.defaultTimeframe || input.canonicalSpec.market.timeframe || input.fallback.baseTimeframe
    const requiredTimeframes = this.resolveRequiredTimeframes(input.canonicalSpec, timeframe)
    const seriesMap = new Map<string, SeriesDef>()
    const levelSetMap = new Map<string, LevelSetDef>()
    const predicateMap = new Map<string, PredicateDef>()
    const context: CompileContext = {
      timeframe,
      seriesMap,
      levelSetMap,
      predicateMap,
      orderProgramActivePredicateMap: new Map(),
      movingAverage: this.resolveMovingAverageConfig(input.canonicalSpec),
      rsi: this.resolveRsiConfig(input.canonicalSpec),
      macd: this.resolveMacdConfig(input.canonicalSpec),
      bollinger: this.resolveBollingerConfig(input.canonicalSpec),
      runtimeRequirements: {
        helpers: new Set(),
        stateKeys: new Set(),
      },
    }

    const orderPrograms = this.compileOrderPrograms(input.canonicalSpec.orderPrograms ?? [], context)
    const orderProgramLevelCount = this.resolveOrderProgramLevelCount(input.canonicalSpec.orderPrograms ?? [])
    const hasOrderPrograms = orderPrograms.length > 0
    const ruleBlocks: RuleBlock[] = []
    const guards: RiskGuard[] = []
    const riskPredicates: RiskPredicateDef[] = []

    for (const rule of input.canonicalSpec.rules) {
      const riskPredicate = this.tryCompileRiskPredicate(rule, context)
      if (riskPredicate) {
        riskPredicates.push(riskPredicate)
        continue
      }

      const partialTakeProfitBlock = this.tryCompileReduceActionRule(rule, input.canonicalSpec, input.fallback.positionPct, context)
      if (partialTakeProfitBlock) {
        ruleBlocks.push(partialTakeProfitBlock)
        continue
      }

      const compiledGuards = this.tryCompileRiskGuards(rule, context)
      if (compiledGuards.length > 0) {
        guards.push(...compiledGuards)
        continue
      }

      if (hasOrderPrograms && this.isOrderProgramShadowRule(rule)) {
        continue
      }

      const when = this.compileCondition(rule.condition, context, rule.id)
      const actions = this.compileActions(rule, input.canonicalSpec, input.fallback.positionPct)
      if (actions.length === 0) {
        continue
      }
      this.collectPositionLifecycleRuntimeRequirements(rule, actions, context)
      const metadata = rule.metadata ? this.toRuleBlockMetadata(rule.metadata) : undefined

      ruleBlocks.push({
        id: rule.id,
        phase: this.mapRulePhase(rule, actions),
        when,
        priority: rule.priority,
        cooldownBars: typeof rule.cooldownBars === 'number' && rule.cooldownBars > 0 ? rule.cooldownBars : undefined,
        actions,
        ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
      })
    }

    const orchestrationGates = this.compileOrchestrationGates(input.canonicalSpec, context)
    const orchestrationPortfolioRisks = this.compileOrchestrationPortfolioRisks(input.canonicalSpec)

    const maxLookback = this.resolveMaxLookback(seriesMap)
    const positionMode = hasOrderPrograms
      ? this.resolveOrderProgramPositionMode(input.canonicalSpec.orderPrograms ?? [])
      : this.resolvePositionMode(input.canonicalSpec.rules)
    const lifecyclePyramiding = this.resolveLifecyclePyramiding(input.canonicalSpec.rules)

    return {
      irVersion: 'csi.v1',
      source: {
        graphVersion,
        graphDigest,
        specHash,
      },
      market: {
        venue: exchange,
        instrumentType: input.canonicalSpec.market.marketType === 'perp' ? 'perpetual' : 'spot',
        symbol,
        timeframes: requiredTimeframes,
        priceFeed: 'close',
      },
      portfolio: {
        positionMode,
        sizing: this.resolvePortfolioSizing(input.canonicalSpec, input.fallback.positionPct),
        maxConcurrentPositions: hasOrderPrograms ? orderProgramLevelCount : 1,
        allowPyramiding: hasOrderPrograms || lifecyclePyramiding.allow,
        maxPyramidingLayers: hasOrderPrograms ? orderProgramLevelCount : lifecyclePyramiding.maxLayers,
      },
      dataRequirements: {
        warmupBars: maxLookback,
        maxLookback,
        requiredTimeframes,
      },
      signalCatalog: {
        series: [...seriesMap.values()],
        levelSets: [...levelSetMap.values()],
        predicates: [...predicateMap.values()],
      },
      runtimeRequirements: {
        helpers: [...context.runtimeRequirements.helpers].sort(),
        stateKeys: [...context.runtimeRequirements.stateKeys].sort(),
      },
      ruleBlocks,
      orderPrograms,
      orchestrationGates,
      orchestrationPortfolioRisks,
      riskPolicy: {
        guards,
        riskPredicates,
      },
      executionPolicy: {
        signalEvaluation: 'bar_close',
        fillPolicy: hasOrderPrograms ? 'exchange_order_update' : 'next_bar_open',
        timeframeAlignment: 'strict',
        orderTypeDefault: hasOrderPrograms ? 'limit' : 'market',
        timeInForce: 'gtc',
        allowPartialFill: hasOrderPrograms,
      },
    }
  }

  private isOrderProgramShadowRule(rule: CanonicalStrategySpecV2['rules'][number]): boolean {
    if (rule.metadata?.normalized?.family === 'grid.range_rebalance') {
      return true
    }

    return this.conditionContainsAtom(rule.condition, 'grid.range_rebalance')
  }

  private conditionContainsAtom(condition: CanonicalStrategySpecV2['rules'][number]['condition'], key: string): boolean {
    if (condition.kind === 'atom') {
      return condition.key === key
    }

    if (condition.kind === 'expression') {
      return false
    }

    return condition.children.some(child => this.conditionContainsAtom(child, key))
  }

  private hashCanonicalJson(value: unknown): `sha256:${string}` {
    return `sha256:${createHash('sha256').update(canonicalSerialize(value)).digest('hex')}`
  }

  private compileOrderPrograms(
    intents: readonly CanonicalOrderProgramIntent[],
    context: CompileContext,
  ): OrderProgram[] {
    return intents.map(intent => {
      const levelCount = this.resolveIntentLevelCount(intent)
      const levelSetRefs = this.ensureOrderProgramLevelSet(context, intent, levelCount)
      const compiledId = intent.id.replace(/\W+/g, '_')
      context.orderProgramActivePredicateMap.set(intent.id, levelSetRefs.activeWhen)
      context.orderProgramActivePredicateMap.set(compiledId, levelSetRefs.activeWhen)

      return {
        id: compiledId,
        kind: 'LIMIT_LADDER',
        activeWhen: levelSetRefs.activeWhen,
        side: this.resolveOrderProgramSide(intent.mode),
        sidePolicy: this.resolveOrderProgramSidePolicy(intent.mode),
        priceSource: 'level_set',
        levelSetRef: levelSetRefs.levelSetRef,
        tickPolicy: 'round',
        quantity: this.resolveOrderProgramQuantity(intent, levelCount),
        orderType: 'limit',
        timeInForce: 'gtc',
        recycleOnFill: intent.recycleOnFill,
        pairingPolicy: 'adjacent_level',
        cancelScope: 'program_orders',
        maxWorkingOrders: levelCount,
        group: intent.id,
      }
    })
  }

  private ensureOrderProgramLevelSet(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
  ): { levelSetRef: string, activeWhen: string } {
    if (intent.levelSet.mode === 'centered_percent_range') {
      const centerRef = this.ensureOrderProgramCenterSeries(context, intent)
      const levelSetRef = this.ensureCenteredContractLevelSet(context, intent, levelCount, centerRef)
      return {
        levelSetRef,
        activeWhen: this.ensureOrderProgramActiveLevelSetPredicate(context, intent, levelSetRef),
      }
    }

    const lower = typeof intent.levelSet.lower === 'number' ? intent.levelSet.lower : null
    const upper = typeof intent.levelSet.upper === 'number' ? intent.levelSet.upper : null
    if (lower === null || upper === null) {
      throw new Error(`static_order_program_level_set_bounds_required:${intent.id}`)
    }

    const lowerRef = this.ensureConstSeries(context, lower)
    const upperRef = this.ensureConstSeries(context, upper)
    return {
      levelSetRef: this.ensureContractLevelSet(context, intent, levelCount, lowerRef, upperRef),
      activeWhen: this.ensureOrderProgramActiveRangePredicate(context, intent, lowerRef, upperRef),
    }
  }

  private ensureContractLevelSet(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
    lowerRef: string,
    upperRef: string,
  ): string {
    const spacingMode = intent.levelSet.spacingMode === 'geometric' ? 'GEOMETRIC_LEVEL_SET' : 'ARITHMETIC_LEVEL_SET'
    const spacing = this.resolveOrderProgramSpacing(intent, levelCount)
    const lower = typeof intent.levelSet.lower === 'number' ? intent.levelSet.lower : 0
    const upper = typeof intent.levelSet.upper === 'number' ? intent.levelSet.upper : lower
    const id = [
      intent.id,
      intent.levelSet.spacingMode,
      this.normalizeNumberToken(lower),
      this.normalizeNumberToken(upper),
      levelCount,
      this.normalizeNumberToken(spacing.value),
      ...this.normalizedLevelSetShapeTokens(intent),
    ].join('_').replace(/\W+/g, '_')

    if (!context.levelSetMap.has(id)) {
      context.levelSetMap.set(id, {
        id,
        kind: spacingMode,
        anchorRef: lowerRef,
        spacing,
        levelsPerSide: {
          down: 0,
          up: Math.max(0, levelCount - 1),
        },
        hardBounds: {
          lowerRef,
          upperRef,
        },
      })
    }

    return id
  }

  private ensureCenteredContractLevelSet(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
    centerRef: string,
  ): string {
    const spacingMode = intent.levelSet.spacingMode === 'geometric' ? 'GEOMETRIC_LEVEL_SET' : 'ARITHMETIC_LEVEL_SET'
    const spacing = this.resolveOrderProgramSpacing(intent, levelCount)
    const levelsBelowCenter = Math.floor(levelCount / 2)
    const levelsAboveCenter = Math.max(0, levelCount - levelsBelowCenter)
    const id = [
      intent.id,
      intent.levelSet.mode,
      intent.levelSet.centerTiming ?? 'deployment',
      intent.levelSet.centerSource ?? 'last_price',
      this.normalizeNumberToken(intent.levelSet.halfRangePct ?? 0),
      intent.levelSet.spacingMode,
      levelCount,
      this.normalizeNumberToken(spacing.value),
      ...this.normalizedLevelSetShapeTokens(intent),
    ].join('_').replace(/\W+/g, '_')

    if (!context.levelSetMap.has(id)) {
      context.levelSetMap.set(id, {
        id,
        kind: spacingMode,
        anchorRef: centerRef,
        spacing,
        levelsPerSide: {
          down: levelsBelowCenter,
          up: levelsAboveCenter,
        },
      })
    }

    return id
  }

  private ensureOrderProgramActiveRangePredicate(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    lowerRef: string,
    upperRef: string,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const seed = intent.id.replace(/\W+/g, '_')
    const aboveLower = this.upsertPredicate(context.predicateMap, `${seed}_active_lower`, 'GTE', [closeRef, lowerRef])
    const belowUpper = this.upsertPredicate(context.predicateMap, `${seed}_active_upper`, 'LTE', [closeRef, upperRef])
    return this.upsertPredicate(context.predicateMap, `${seed}_active_range`, 'AND', [aboveLower, belowUpper])
  }

  private ensureOrderProgramActiveLevelSetPredicate(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    levelSetRef: string,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const seed = intent.id.replace(/\W+/g, '_')
    return this.upsertPredicate(context.predicateMap, `${seed}_active_level_set`, 'WITHIN_LEVEL_SET', [closeRef, levelSetRef])
  }

  private resolveOrderProgramSpacing(
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
  ): LevelSetDef['spacing'] {
    if (
      intent.levelSet.mode !== 'centered_percent_range'
      && typeof intent.levelSet.absoluteSpacing === 'number'
      && Number.isFinite(intent.levelSet.absoluteSpacing)
      && intent.levelSet.absoluteSpacing > 0
    ) {
      return {
        mode: 'absolute',
        value: intent.levelSet.absoluteSpacing,
      }
    }

    if (typeof intent.levelSet.spacingPct === 'number' && Number.isFinite(intent.levelSet.spacingPct)) {
      return {
        mode: 'pct',
        value: intent.levelSet.spacingPct,
      }
    }

    if (intent.levelSet.spacingMode === 'geometric') {
      if (intent.levelSet.mode === 'centered_percent_range') {
        return {
          mode: 'pct',
          value: this.resolveCenteredOrderProgramSpacingPct(intent, levelCount),
        }
      }

      const lower = typeof intent.levelSet.lower === 'number' ? intent.levelSet.lower : 1
      const upper = typeof intent.levelSet.upper === 'number' ? intent.levelSet.upper : lower
      const ratio = (upper / lower)**(1 / Math.max(1, levelCount - 1)) - 1
      return {
        mode: 'pct',
        value: Number((ratio * 100).toFixed(8)),
      }
    }

    if (intent.levelSet.mode === 'centered_percent_range') {
      return {
        mode: 'pct',
        value: this.resolveCenteredOrderProgramSpacingPct(intent, levelCount),
      }
    }

    const lower = typeof intent.levelSet.lower === 'number' ? intent.levelSet.lower : 0
    const upper = typeof intent.levelSet.upper === 'number' ? intent.levelSet.upper : lower
    return {
      mode: 'absolute',
      value: Number(((upper - lower) / Math.max(1, levelCount - 1)).toFixed(8)),
    }
  }

  private normalizedLevelSetShapeTokens(intent: CanonicalOrderProgramIntent): string[] {
    return [
      typeof intent.levelSet.gridIntervals === 'number' && Number.isFinite(intent.levelSet.gridIntervals)
        ? `intervals_${this.normalizeNumberToken(intent.levelSet.gridIntervals)}`
        : null,
      typeof intent.levelSet.absoluteSpacing === 'number' && Number.isFinite(intent.levelSet.absoluteSpacing)
        ? `absolute_${this.normalizeNumberToken(intent.levelSet.absoluteSpacing)}`
        : null,
    ].filter((token): token is string => token !== null)
  }

  private resolveCenteredOrderProgramSpacingPct(
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
  ): number {
    const halfRangePct = typeof intent.levelSet.halfRangePct === 'number' ? intent.levelSet.halfRangePct : 0
    const levelsPerWiderSide = Math.max(1, Math.ceil(levelCount / 2))
    return Number((halfRangePct / levelsPerWiderSide).toFixed(8))
  }

  private ensureOrderProgramCenterSeries(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
  ): string {
    const centerSource = intent.levelSet.centerSource ?? 'last_price'
    if (intent.levelSet.centerTiming !== 'runtime') {
      return this.ensureDeploymentPriceSeries(context, this.resolveOrderProgramCenterField(centerSource))
    }

    return this.ensurePriceSeries(context, this.resolveOrderProgramCenterField(centerSource))
  }

  private resolveOrderProgramCenterField(centerSource: string): NonNullable<SeriesDef['field']> {
    if (centerSource === 'open') return 'open'
    if (centerSource === 'high') return 'high'
    if (centerSource === 'low') return 'low'
    return 'close'
  }

  private resolveOrderProgramQuantity(
    intent: CanonicalOrderProgramIntent,
    levelCount: number,
  ): OrderProgram['quantity'] {
    const value = intent.budget.mode === 'total_quote'
      ? Number((intent.budget.value / levelCount).toFixed(8))
      : intent.budget.value

    if (intent.budget.mode === 'per_order_pct_equity') {
      return {
        mode: 'pct_equity',
        value,
      }
    }

    return {
      mode: 'fixed_quote',
      value,
      asset: intent.budget.asset ?? 'USDT',
    }
  }

  private resolveOrderProgramSide(mode: CanonicalOrderProgramIntent['mode']): OrderProgram['side'] {
    return mode === 'perp_short' ? 'sell' : 'buy'
  }

  private resolveOrderProgramSidePolicy(mode: CanonicalOrderProgramIntent['mode']): OrderProgram['sidePolicy'] {
    if (mode === 'spot') return 'spot_grid'
    return mode
  }

  private resolveOrderProgramLevelCount(intents: readonly CanonicalOrderProgramIntent[]): number {
    return Math.max(1, ...intents.map(intent => this.resolveIntentLevelCount(intent)))
  }

  private resolveIntentLevelCount(intent: CanonicalOrderProgramIntent): number {
    const explicitGridCount = this.toPositiveInteger(intent.levelSet.gridCount)
    if (explicitGridCount !== null) {
      return Math.max(2, explicitGridCount)
    }

    const derivedGridCount = this.deriveLevelCountFromSpacing(intent)
    if (derivedGridCount !== null) {
      return Math.max(2, derivedGridCount)
    }

    return 2
  }

  private deriveLevelCountFromSpacing(intent: CanonicalOrderProgramIntent): number | null {
    if (intent.levelSet.mode === 'centered_percent_range') {
      const halfRangePct = typeof intent.levelSet.halfRangePct === 'number' ? intent.levelSet.halfRangePct : null
      const spacingPct = typeof intent.levelSet.spacingPct === 'number' ? intent.levelSet.spacingPct : null
      if (halfRangePct === null || spacingPct === null || halfRangePct <= 0 || spacingPct <= 0) {
        return null
      }

      return Math.floor((halfRangePct * 2) / spacingPct)
    }

    const lower = typeof intent.levelSet.lower === 'number' ? intent.levelSet.lower : null
    const upper = typeof intent.levelSet.upper === 'number' ? intent.levelSet.upper : null
    if (lower === null || upper === null || upper <= lower) {
      return null
    }

    const absoluteSpacing = typeof intent.levelSet.absoluteSpacing === 'number' ? intent.levelSet.absoluteSpacing : null
    if (absoluteSpacing !== null && absoluteSpacing > 0) {
      return Math.floor((upper - lower) / absoluteSpacing) + 1
    }

    const spacingPct = typeof intent.levelSet.spacingPct === 'number' ? intent.levelSet.spacingPct : null
    if (spacingPct === null || spacingPct <= 0 || lower <= 0) {
      return null
    }

    return Math.floor(Math.log(upper / lower) / Math.log(1 + spacingPct / 100)) + 1
  }

  private toPositiveInteger(value: number | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null
    }

    return Math.floor(value)
  }

  private resolveOrderProgramPositionMode(
    intents: readonly CanonicalOrderProgramIntent[],
  ): CanonicalStrategyIrV1['portfolio']['positionMode'] {
    const modes = new Set(intents.map(intent => intent.mode))
    if (modes.has('perp_neutral')) return 'long_short'
    if (modes.has('perp_long')) return 'long_only'
    if (modes.has('perp_short')) return 'short_only'
    return 'long_only'
  }

  private buildGraphSnapshot(input: CompileCanonicalSpecV2ToIrInput): StrategyLogicGraphSnapshot {
    const symbol = input.canonicalSpec.market.symbol || input.fallback.symbol
    const timeframe = input.canonicalSpec.market.defaultTimeframe || input.canonicalSpec.market.timeframe || input.fallback.baseTimeframe
    const positionPct = this.resolvePositionPct(input.canonicalSpec.sizing, input.fallback.positionPct)
    const defaultSizingAmount = this.formatGraphSizingAmount(input.canonicalSpec.sizing, input.fallback.positionPct, symbol)
    const movingAverage = this.resolveMovingAverageConfig(input.canonicalSpec)
    const rsi = this.resolveRsiConfig(input.canonicalSpec)
    const macd = this.resolveMacdConfig(input.canonicalSpec)
    const bollinger = this.resolveBollingerConfig(input.canonicalSpec)

    return {
      version: 3,
      status: 'confirmed',
      trigger: input.canonicalSpec.rules
        .filter((rule): rule is CanonicalRuleV2 & { phase: 'entry' | 'exit' } =>
          rule.phase === 'entry' || rule.phase === 'exit')
        .map((rule, index) => ({
          id: `trigger-${rule.id}`,
          phase: rule.phase,
          operator: this.describeCondition(rule.condition, { movingAverage, rsi, macd, bollinger }),
          join: index > 0 ? 'AND' : undefined,
        })),
      actions: input.canonicalSpec.rules.flatMap((rule, ruleIndex) => {
        return rule.actions
          .map((action, actionIndex) => ({
            action: this.mapGraphAction(action),
            actionIndex,
          }))
          .filter((mapped): mapped is {
            action: StrategyLogicGraphSnapshot['actions'][number]['action']
            actionIndex: number
          } => mapped.action !== null)
          .map(mapped => ({
            id: `action-${ruleIndex + 1}-${mapped.actionIndex + 1}`,
            action: mapped.action,
            target: symbol,
            amount: this.formatGraphSizingAmount(rule.actions[mapped.actionIndex]?.sizing ?? input.canonicalSpec.sizing, input.fallback.positionPct, symbol),
          }))
      }),
      risk: input.canonicalSpec.rules
        .filter(rule => rule.phase === 'risk')
        .map(rule => `${rule.id}: ${this.describeCondition(rule.condition, { movingAverage, rsi, macd, bollinger })}`),
      meta: {
        exchange: input.canonicalSpec.market.exchange || input.fallback.exchange,
        symbol,
        timeframe,
        positionPct,
        positionSizing: defaultSizingAmount,
        executionTags: input.fallback.executionTags ?? [],
      },
    }
  }

  private resolveRequiredTimeframes(spec: CanonicalStrategySpecV2, timeframe: string): string[] {
    const ordered = new Set<string>()
    const defaultTimeframe = spec.market.defaultTimeframe || spec.market.timeframe || timeframe
    if (defaultTimeframe) {
      ordered.add(defaultTimeframe)
    }
    for (const item of spec.dataRequirements.requiredTimeframes) {
      if (item.trim().length > 0) {
        ordered.add(item.trim())
      }
    }
    for (const rule of spec.rules) {
      this.collectRuleTimeframes(rule.condition, ordered, defaultTimeframe)
    }
    return [...ordered]
  }

  private collectRuleTimeframes(
    condition: CanonicalConditionNode,
    ordered: Set<string>,
    fallbackTimeframe: string,
  ): void {
    if (condition.kind === 'AND' || condition.kind === 'OR' || condition.kind === 'NOT') {
      for (const child of condition.children) {
        this.collectRuleTimeframes(child, ordered, fallbackTimeframe)
      }
      return
    }

    if (condition.kind === 'expression') {
      this.collectExpressionOperandTimeframes(condition.left, ordered, fallbackTimeframe)
      this.collectExpressionOperandTimeframes(condition.right, ordered, fallbackTimeframe)
      return
    }

    const atom = condition as CanonicalConditionAtom
    const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
      ? atom.params.timeframe.trim()
      : fallbackTimeframe
    if (timeframe) {
      ordered.add(timeframe)
    }
  }

  private collectExpressionOperandTimeframes(
    operand: SemanticExpressionOperand,
    ordered: Set<string>,
    fallbackTimeframe: string,
  ): void {
    if (operand.kind === 'series') {
      ordered.add(this.resolveOperandTimeframe(operand.timeframe, fallbackTimeframe))
      return
    }

    if (operand.kind === 'indicator') {
      ordered.add(this.resolveOperandTimeframe(this.readStringParam(operand.params.timeframe), fallbackTimeframe))
    }
  }

  private resolveMovingAverageConfig(spec: CanonicalStrategySpecV2): CompileContext['movingAverage'] {
    const movingAverageIndicator = spec.indicators.find(indicator => indicator.kind === 'ema' || indicator.kind === 'sma')
    const fast = this.readNumber([
      movingAverageIndicator?.params.fast,
      movingAverageIndicator?.params.short,
      movingAverageIndicator?.params.fastPeriod,
    ], 7)
    const slow = this.readNumber([
      movingAverageIndicator?.params.slow,
      movingAverageIndicator?.params.long,
      movingAverageIndicator?.params.slowPeriod,
      movingAverageIndicator?.params.period,
    ], 21)

    return {
      kind: movingAverageIndicator?.kind === 'sma' ? 'SMA' : 'EMA',
      fast,
      slow: slow > fast ? slow : fast + 14,
    }
  }

  private resolveBollingerConfig(spec: CanonicalStrategySpecV2): CompileContext['bollinger'] {
    const bollinger = spec.indicators.find(indicator => indicator.kind === 'bollingerBands')
    return {
      period: this.readNumber([bollinger?.params.period], 20),
      stdDev: this.readNumber([bollinger?.params.stdDev], 2),
    }
  }

  private resolveRsiConfig(spec: CanonicalStrategySpecV2): CompileContext['rsi'] {
    const rsi = spec.indicators.find(indicator => indicator.kind === 'rsi')
    return {
      period: this.readNumber([rsi?.params.period], DEFAULT_INDICATOR_PARAMS.rsi.period),
    }
  }

  private resolveMacdConfig(spec: CanonicalStrategySpecV2): CompileContext['macd'] {
    const macd = spec.indicators.find(indicator => indicator.kind === 'macd')
    return {
      fastPeriod: this.readNumber([macd?.params.fastPeriod], DEFAULT_INDICATOR_PARAMS.macd.fastPeriod),
      slowPeriod: this.readNumber([macd?.params.slowPeriod], DEFAULT_INDICATOR_PARAMS.macd.slowPeriod),
      signalPeriod: this.readNumber([macd?.params.signalPeriod], DEFAULT_INDICATOR_PARAMS.macd.signalPeriod),
    }
  }

  private compileCondition(
    condition: CanonicalConditionNode,
    context: CompileContext,
    seed: string,
  ): string {
    if (condition.kind === 'AND' || condition.kind === 'OR') {
      const childRefs = condition.children.map((child, index) => this.compileCondition(child, context, `${seed}_${index + 1}`))
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_${condition.kind.toLowerCase()}`,
        this.resolveLogicalPredicateKind(condition),
        childRefs,
      )
    }

    if (condition.kind === 'NOT') {
      const childRef = this.compileCondition(condition.children[0] ?? {
        kind: 'atom',
        key: 'unknown.false',
        op: 'EQ',
        value: false,
      }, context, `${seed}_not`)
      return this.upsertPredicate(context.predicateMap, `${seed}_not`, 'NOT', [childRef])
    }

    if (this.isConditionAtom(condition)) {
      return this.compileAtom(condition, context, seed)
    }

    if (condition.kind === 'expression') {
      return this.compileExpressionCondition(condition, context, seed)
    }

    throw new Error('codegen.canonical_spec_v2_condition_unsupported')
  }

  private compileOrchestrationGates(
    spec: CanonicalStrategySpecV2,
    context: CompileContext,
  ): IrOrchestrationGate[] {
    const gates = spec.orchestration?.gates ?? []
    return gates.map((gate: CanonicalOrchestrationGate) => {
      const exprId = this.compileCondition(
        gate.activeWhen,
        context,
        `orchestration_gate_${gate.id}`,
      )
      return {
        id: gate.id,
        exprId,
        target: gate.target,
        effectWhenFalse: gate.effectWhenFalse,
      }
    })
  }

  private compileOrchestrationPortfolioRisks(
    spec: CanonicalStrategySpecV2,
  ): IrOrchestrationPortfolioRisk[] {
    const risks = spec.orchestration?.portfolioRisks ?? []
    return risks.map((risk: CanonicalOrchestrationPortfolioRisk) => ({
      id: risk.id,
      scope: risk.scope,
      mode: risk.mode,
      thresholdPct: risk.thresholdPct,
      effectWhenTriggered: risk.effectWhenTriggered,
    }))
  }

  private compileExpressionCondition(
    condition: CanonicalExpressionCondition,
    context: CompileContext,
    seed: string,
  ): string {
    const leftRef = this.compileExpressionOperand(condition.left, context)
    const rightRef = this.compileExpressionOperand(condition.right, context)
    return this.upsertPredicate(
      context.predicateMap,
      `${seed}_expression`,
      condition.op,
      [leftRef, rightRef],
    )
  }

  private resolveLogicalPredicateKind(
    condition: CanonicalConditionGroup,
  ): PredicateDef['kind'] {
    if (condition.predicateForm !== 'generic') {
      return condition.kind
    }

    return condition.kind === 'AND' ? 'allOf' : 'anyOf'
  }

  private compileExpressionOperand(
    operand: SemanticExpressionOperand,
    context: CompileContext,
  ): string {
    switch (operand.kind) {
      case 'series': {
        if (operand.source !== 'bar') {
          throw new Error(`codegen.semantic_expression_operand_unsupported:series:${operand.source}`)
        }

        return this.ensurePriceSeries(
          context,
          operand.field,
          this.resolveOperandTimeframe(operand.timeframe, context.timeframe),
          operand.offsetBars ?? 0,
        )
      }

      case 'constant':
        if (typeof operand.value === 'boolean') {
          throw new TypeError('codegen.semantic_expression_operand_unsupported:constant:boolean')
        }
        return this.ensureConstSeries(context, operand.value)

      case 'indicator':
        return this.compileIndicatorExpressionOperand(operand, context)

      case 'position':
        return this.compilePositionExpressionOperand(operand, context)

      default: {
        const unsupported = operand as { kind?: string }
        throw new Error(`codegen.semantic_expression_operand_unsupported:${unsupported.kind ?? 'unknown'}`)
      }
    }
  }

  private compileIndicatorExpressionOperand(
    operand: Extract<SemanticExpressionOperand, { kind: 'indicator' }>,
    context: CompileContext,
  ): string {
    const timeframe = this.resolveOperandTimeframe(
      this.readStringParam(operand.params.timeframe),
      context.timeframe,
    )

    if (operand.name === 'sma' || operand.name === 'ema') {
      this.assertIndicatorOutputSupported(operand, ['value'])
      return this.ensureIndicatorSeries(
        context,
        operand.name === 'sma' ? 'SMA' : 'EMA',
        this.readNumber([
          operand.params.period,
          operand.params.fastPeriod,
          operand.params.slowPeriod,
          operand.params.fast,
          operand.params.slow,
        ], operand.name === 'sma' ? context.movingAverage.slow : context.movingAverage.fast),
        timeframe,
      )
    }

    if (operand.name === 'rsi') {
      this.assertIndicatorOutputSupported(operand, ['value'])
      return this.ensureIndicatorSeries(
        context,
        'RSI',
        this.readNumber([operand.params.period], context.rsi.period),
        timeframe,
      )
    }

    if (operand.name === 'macd') {
      const macd = this.resolveMacdExpressionConfig(operand, context.macd)
      const output = operand.output ?? 'line'
      if (output === 'line' || output === 'macd') {
        return this.ensureMacdSeries(context, 'MACD_LINE', timeframe, macd)
      }
      if (output === 'signal') {
        return this.ensureMacdSeries(context, 'MACD_SIGNAL', timeframe, macd)
      }
      throw new Error(`codegen.semantic_expression_operand_unsupported:indicator:${operand.name}`)
    }

    throw new Error(`codegen.semantic_expression_operand_unsupported:indicator:${operand.name}`)
  }

  private compilePositionExpressionOperand(
    operand: Extract<SemanticExpressionOperand, { kind: 'position' }>,
    context: CompileContext,
  ): string {
    switch (operand.field) {
      case 'avg_price':
        return this.ensurePositionSeries(context, 'POSITION_AVG_PRICE', 'position_avg_price')

      case 'pnl_pct':
        return this.ensurePositionSeries(context, 'POSITION_PNL_PCT', 'position_pnl_pct')

      case 'bars_held':
        return this.ensurePositionHeldBarsSeries(context)

      case 'has_position':
        throw new Error('codegen.semantic_expression_operand_unsupported:position:has_position')

      default: {
        const unsupported = operand as { field?: string }
        throw new Error(`codegen.semantic_expression_operand_unsupported:position:${unsupported.field ?? 'unknown'}`)
      }
    }
  }

  private assertIndicatorOutputSupported(
    operand: Extract<SemanticExpressionOperand, { kind: 'indicator' }>,
    supportedOutputs: string[],
  ): void {
    if (operand.output && !supportedOutputs.includes(operand.output)) {
      throw new Error(`codegen.semantic_expression_operand_unsupported:indicator:${operand.name}`)
    }
  }

  private resolveMacdExpressionConfig(
    operand: Extract<SemanticExpressionOperand, { kind: 'indicator' }>,
    fallback: CompileContext['macd'],
  ): CompileContext['macd'] {
    return {
      fastPeriod: this.readNumber([operand.params.fastPeriod, operand.params.fast], fallback.fastPeriod),
      slowPeriod: this.readNumber([operand.params.slowPeriod, operand.params.slow], fallback.slowPeriod),
      signalPeriod: this.readNumber([operand.params.signalPeriod, operand.params.signal], fallback.signalPeriod),
    }
  }

  private compileAtom(atom: CanonicalConditionAtom, context: CompileContext, seed: string): string {
    const closeRef = this.ensurePriceSeries(context, 'close')

    switch (atom.key) {
      case 'execution.on_start': {
        const barIndexRef = 'bar_index'
        if (!context.seriesMap.has(barIndexRef)) {
          context.seriesMap.set(barIndexRef, {
            id: barIndexRef,
            kind: 'BAR_INDEX',
          })
        }
        const thresholdRef = this.ensureConstSeries(context, 1)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          'EQ',
          [barIndexRef, thresholdRef],
        )
      }

      case 'price.change_pct': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const lookbackBars = this.readNumber([atom.params?.lookbackBars], 1)
        const latestPriceRef = this.ensurePriceSeries(context, 'close', timeframe, 0)
        const previousPriceRef = this.ensurePriceSeries(context, 'close', timeframe, lookbackBars)
        const seriesId = `price_change_pct_${timeframe}_${lookbackBars}`
        if (!context.seriesMap.has(seriesId)) {
          context.seriesMap.set(seriesId, {
            id: seriesId,
            kind: 'PRICE_CHANGE_PCT',
            timeframe,
            inputs: [latestPriceRef, previousPriceRef],
            params: { lookbackBars },
          })
        }
        const thresholdRef = this.ensureConstSeries(context, this.readNumber([atom.value], 0))
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          this.resolveComparisonKind(atom.op),
          [seriesId, thresholdRef],
        )
      }

      case 'position_gain_pct': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const pnlRef = `position_pnl_pct_${timeframe}`
        if (!context.seriesMap.has(pnlRef)) {
          context.seriesMap.set(pnlRef, {
            id: pnlRef,
            kind: 'POSITION_PNL_PCT',
            timeframe,
          })
        }
        const thresholdRef = this.ensureConstSeries(
          context,
          this.normalizePositionPnlPctThreshold(this.readNumber([atom.value], 0)),
        )
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          this.resolveComparisonKind(atom.op),
          [pnlRef, thresholdRef],
        )
      }

      case 'price.range_position_lte':
      case 'price.range_position_gte': {
        const period = this.readNumber([atom.params?.period, atom.params?.lookbackBars], 20)
        const rangePositionRef = this.ensureRangePositionSeries(context, period)
        const thresholdRef = this.ensureConstSeries(
          context,
          this.normalizeRangePositionThreshold(this.readNumber([atom.value, atom.params?.thresholdPct], 0.5)),
        )
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.key === 'price.range_position_lte' ? 'LTE' : 'GTE',
          [rangePositionRef, thresholdRef],
        )
      }

      case 'ma.golden_cross':
      case 'ma.death_cross': {
        const fastRef = this.ensureMovingAverageSeries(context, context.movingAverage.fast)
        const slowRef = this.ensureMovingAverageSeries(context, context.movingAverage.slow)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.key === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER',
          [fastRef, slowRef],
        )
      }

      case 'indicator.above':
      case 'indicator.below': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const closeRef = this.ensurePriceSeries(context, 'close', timeframe)
        const indicatorRef = this.ensureIndicatorReferenceSeries(context, atom, timeframe)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
          atom.key === 'indicator.above' ? 'GTE' : 'LTE',
          [closeRef, indicatorRef],
        )
      }

      case 'volume.relative_average': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const volumeRef = this.ensureVolumeSeries(context, timeframe)
        const lookbackBars = this.readNumber([atom.params?.lookbackBars], 20)
        const multiplier = this.readNumber([atom.params?.multiplier], 1)
        const averageRef = this.ensureSmaVolumeSeries(context, lookbackBars, multiplier, timeframe)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
          'compare',
          [volumeRef, averageRef],
          { op: this.resolveComparisonKind(atom.op) },
        )
      }

      case 'price.rolling_extrema_breakout': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const closeRef = this.ensurePriceSeries(context, 'close', timeframe)
        const period = this.readNumber([atom.params?.lookbackBars, atom.params?.period], 20)
        const extrema = typeof atom.params?.extrema === 'string' ? atom.params.extrema : 'high'
        const channelRef = extrema === 'low'
          ? this.ensureChannelSeries(context, 'LOWEST_LOW', period, timeframe)
          : this.ensureChannelSeries(context, 'HIGHEST_HIGH', period, timeframe)
        context.runtimeRequirements.helpers.add(extrema === 'low' ? 'rollingLow' : 'rollingHigh')
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
          'compare',
          [closeRef, channelRef],
          { op: this.resolveComparisonKind(atom.op ?? (extrema === 'low' ? 'LT' : 'GT')) },
        )
      }

      case 'rsi.threshold_lte':
      case 'rsi.threshold_gte':
      case 'rsi.cross_over':
      case 'rsi.cross_under': {
        const rsiRef = this.ensureRsiSeries(
          context,
          this.readNumber([atom.params?.period], context.rsi.period),
        )
        const thresholdRef = this.ensureConstSeries(context, this.readNumber([atom.value], 50))
        if (atom.key === CANONICAL_RULE_KEYS.rsiCrossOver || atom.key === CANONICAL_RULE_KEYS.rsiCrossUnder) {
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}`,
            atom.key === CANONICAL_RULE_KEYS.rsiCrossOver ? 'CROSS_OVER' : 'CROSS_UNDER',
            [rsiRef, thresholdRef],
          )
        }

        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          this.resolveComparisonKind(atom.op),
          [rsiRef, thresholdRef],
        )
      }

      case 'macd.golden_cross':
      case 'macd.death_cross': {
        const macdLineRef = this.ensureMacdSeries(context, 'MACD_LINE')
        const macdSignalRef = this.ensureMacdSeries(context, 'MACD_SIGNAL')
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.key === CANONICAL_RULE_KEYS.macdGoldenCross ? 'CROSS_OVER' : 'CROSS_UNDER',
          [macdLineRef, macdSignalRef],
        )
      }

      case 'grid.range_rebalance': {
        const closeRef = this.ensurePriceSeries(context, 'close')
        const levelSetId = this.ensureGridLevelSet(context, atom)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.op === 'GTE' ? 'TOUCH_LEVEL_UP' : 'TOUCH_LEVEL_DOWN',
          [closeRef, levelSetId],
        )
      }

      case 'order_program.active_range': {
        const programId = typeof atom.params?.programId === 'string' ? atom.params.programId : null
        const activePredicate = programId ? context.orderProgramActivePredicateMap.get(programId) : null
        if (!activePredicate) {
          throw new Error(`order_program_active_range_not_found:${programId ?? 'unknown'}`)
        }
        return activePredicate
      }

      case 'breakout.channel_high_break':
      case 'breakout.channel_low_break': {
        const closeRef = this.ensurePriceSeries(context, 'close')
        const period = this.readNumber([atom.params?.period], 20)
        const channelRef = atom.key === 'breakout.channel_high_break'
          ? this.ensureChannelSeries(context, 'HIGHEST_HIGH', period)
          : this.ensureChannelSeries(context, 'LOWEST_LOW', period)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.key === 'breakout.channel_high_break' ? 'CROSS_OVER' : 'CROSS_UNDER',
          [closeRef, channelRef],
        )
      }

      case 'price.previous_extrema': {
        // Phase 3 MVP — price.previous_extrema：
        //   - kind: 'prev_high'|'swing_high' -> HIGHEST_HIGH，触发 close >= channel
        //   - kind: 'prev_low'|'swing_low'  -> LOWEST_LOW， 触发 close <= channel
        //   - lookback: 滚动窗口；缺失或非正整数 -> 直接抛 fail-closed
        //   - memoryKey: contract 占位，runtime 由 ensureChannelSeries 通道供给序列；通过
        //                runtimeRequirements.stateKeys.add(memoryKey) 让 contract 体现 state write 意图
        // 任一参数非法 -> 抛 codegen.canonical_spec_v2_condition_unsupported:price.previous_extrema，fail-closed，
        // 与 readiness 层"未补齐 supported_requires_slot 不应进入 IR"形成双层保护。
        const kindRaw = typeof atom.params?.kind === 'string' ? atom.params.kind : null
        if (kindRaw !== 'prev_high' && kindRaw !== 'prev_low' && kindRaw !== 'swing_high' && kindRaw !== 'swing_low') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}`)
        }
        const lookback = this.readNumber([atom.params?.lookback], Number.NaN)
        // ensureChannelSeries / series id / 上游 LRU 都假定 lookback 是正整数；
        // fallback 故意置为 NaN，避免悄悄落入默认值绕过 readiness。
        if (!Number.isInteger(lookback) || lookback <= 0) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}`)
        }
        const closeRef = this.ensurePriceSeries(context, 'close')
        const isHigh = kindRaw === 'prev_high' || kindRaw === 'swing_high'
        const channelRef = isHigh
          ? this.ensureChannelSeries(context, 'HIGHEST_HIGH', lookback)
          : this.ensureChannelSeries(context, 'LOWEST_LOW', lookback)
        const memoryKey = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
          ? atom.params.memoryKey.trim()
          : null
        if (memoryKey) {
          context.runtimeRequirements.stateKeys.add(memoryKey)
        }
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_previous_extrema_${kindRaw}_${lookback}`,
          isHigh ? 'GTE' : 'LTE',
          [closeRef, channelRef],
        )
      }

      case 'risk.time_stop_bars': {
        const heldBarsRef = this.ensurePositionHeldBarsSeries(context)
        const thresholdRef = this.ensureConstSeries(context, this.readNumber([atom.value], 0))
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          this.resolveComparisonKind(atom.op),
          [heldBarsRef, thresholdRef],
        )
      }

      case 'risk.take_profit_pct': {
        const pnlRef = 'position_pnl_pct'
        if (!context.seriesMap.has(pnlRef)) {
          context.seriesMap.set(pnlRef, {
            id: pnlRef,
            kind: 'POSITION_PNL_PCT',
          })
        }
        const thresholdRef = this.ensureConstSeries(
          context,
          this.normalizePositionPnlPctThreshold(this.readNumber([atom.value], 0)),
        )
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          this.resolveComparisonKind(atom.op),
          [pnlRef, thresholdRef],
        )
      }

      case 'bollinger.upper_break':
      case 'bollinger.lower_break': {
        context.runtimeRequirements.helpers.add('bollinger')
        const bandRef = atom.key === 'bollinger.upper_break'
          ? this.ensureBollingerSeries(context, 'UPPER_BAND')
          : this.ensureBollingerSeries(context, 'LOWER_BAND')
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          'compare',
          [closeRef, bandRef],
          { op: atom.op ?? (atom.key === 'bollinger.upper_break' ? 'CROSS_OVER' : 'CROSS_UNDER') },
        )
      }

      case 'bollinger.middle_revert': {
        context.runtimeRequirements.helpers.add('bollinger')
        const midRef = this.ensureBollingerSeries(context, 'MID_BAND')
        const over = this.upsertPredicate(context.predicateMap, `${seed}_middle_over`, 'CROSS_OVER', [closeRef, midRef])
        const under = this.upsertPredicate(context.predicateMap, `${seed}_middle_under`, 'CROSS_UNDER', [closeRef, midRef])
        return this.upsertPredicate(context.predicateMap, `${seed}_middle_revert`, 'OR', [over, under])
      }

      case 'bollinger.bars_outside': {
        const bars = this.readNumber([atom.params?.bars, atom.value], 1)
        const seriesId = `bollinger_bars_outside_${context.bollinger.period}_${this.normalizeNumberToken(context.bollinger.stdDev)}_${bars}_${context.timeframe}`
        if (!context.seriesMap.has(seriesId)) {
          context.seriesMap.set(seriesId, {
            id: seriesId,
            kind: 'BOLLINGER_BARS_OUTSIDE',
            inputs: [closeRef],
            params: {
              period: context.bollinger.period,
              stdDev: context.bollinger.stdDev,
              bars,
            },
          })
        }
        const thresholdRef = this.ensureConstSeries(context, this.readNumber([atom.value, atom.params?.bars], bars))
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_outside_bars`,
          this.resolveComparisonKind(atom.op),
          [seriesId, thresholdRef],
        )
      }

      case 'position_loss_pct': {
        const lossRef = 'position_pnl_pct'
        if (!context.seriesMap.has(lossRef)) {
          context.seriesMap.set(lossRef, {
            id: lossRef,
            kind: 'POSITION_PNL_PCT',
          })
        }
        const threshold = -Math.abs(
          this.normalizePositionPnlPctThreshold(this.readNumber([atom.value], 0)),
        )
        const thresholdRef = this.ensureConstSeries(
          context,
          threshold,
        )
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_position_loss_pct`,
          'LTE',
          [lossRef, thresholdRef],
        )
      }

      case 'market.regime':
      case 'trend.direction':
      case 'volatility.state': {
        const stateSeriesRef = this.ensureStateContextSeries(atom.key, context)
        const expectedValueRef = this.ensureConstSeries(
          context,
          typeof atom.value === 'string' ? atom.value : '',
        )
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          'EQ',
          [stateSeriesRef, expectedValueRef],
        )
      }

      case 'condition.sequence': {
        const sequenceKind = typeof atom.params?.sequenceKind === 'string' ? atom.params.sequenceKind : 'sequence'
        if (sequenceKind === 'pullback_reclaim') {
          const referenceIndicator = this.readStringParam(atom.params?.['reference.indicator']) ?? 'ma'
          const referencePeriod = this.readNumber([atom.params?.['reference.period'], atom.params?.period], context.movingAverage.slow)
          const referenceRef = referenceIndicator.toLowerCase() === 'ema'
            ? this.ensureIndicatorSeries(context, 'EMA', referencePeriod, context.timeframe)
            : this.ensureIndicatorSeries(context, 'SMA', referencePeriod, context.timeframe)
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${referenceIndicator}_${referencePeriod}`,
            'cross',
            [closeRef, referenceRef],
            {
              sequenceKind,
              direction: 'CROSS_OVER',
              'reference.indicator': referenceIndicator.toLowerCase() === 'ema' ? 'ema' : 'ma',
              'reference.period': referencePeriod,
            },
          )
        }

        if (sequenceKind === 'rsi_reclaim') {
          const period = this.readNumber([atom.params?.period], context.rsi.period)
          const threshold = this.readNumber([atom.params?.threshold, atom.value], 30)
          const rsiRef = this.ensureRsiSeries(context, period)
          const thresholdRef = this.ensureConstSeries(context, threshold)
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${period}_${this.normalizeNumberToken(threshold)}`,
            'cross',
            [rsiRef, thresholdRef],
            {
              sequenceKind,
              direction: 'CROSS_OVER',
              period,
              threshold,
            },
          )
        }

        const memoryKey = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
          ? atom.params.memoryKey.trim()
          : null
        if (memoryKey) {
          context.runtimeRequirements.stateKeys.add(memoryKey)
        }
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}`,
          'sequence',
          [],
          {
            sequenceKind,
            ...(typeof atom.params?.lookbackWindow === 'string' ? { lookbackWindow: atom.params.lookbackWindow } : {}),
            ...(typeof atom.params?.lookbackBars === 'number' ? { lookbackBars: atom.params.lookbackBars } : {}),
            ...(typeof atom.params?.count === 'number' ? { count: atom.params.count } : {}),
            ...(typeof atom.params?.direction === 'string' ? { direction: atom.params.direction } : {}),
            ...(memoryKey ? { memoryKey } : {}),
          },
        )
      }

      case 'indicator.divergence': {
        // P4-1: RSI / MACD 顶背离（bearish）/ 底背离（bullish）
        // IR 通过 INDICATOR_DIVERGENCE 系列 + 谓词封装 divergence predicate。
        // fail-closed：indicator / direction 非白名单值直接抛错，避免静默降级。
        //
        // ⚠️ critic round 1 A-C1 公开标记：当前 strategy-runtime / backtesting / compiled-runtime
        // 全仓 0 个 INDICATOR_DIVERGENCE 系列 evaluator 实现 (grep 验证 0 命中)，priceHighsLows helper
        // 同样 0 实现。该 atom codegen 路径已闭环，但 runtime 信号永远 fail-closed
        // (series.evaluate undefined → predicate EQ 永不真) 直到 follow-up issue #1062 落地。
        // 设计取舍：维持 supported_executable 让 P4-2/3/4 后续 atom 共用同模式，避免 train 回退。
        const divIndicator = typeof atom.params?.indicator === 'string'
          ? atom.params.indicator.trim().toLowerCase()
          : null
        if (divIndicator !== 'rsi' && divIndicator !== 'macd') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:indicator`)
        }
        const divDirection = typeof atom.params?.direction === 'string'
          ? atom.params.direction.trim().toLowerCase()
          : null
        if (divDirection !== 'bullish' && divDirection !== 'bearish') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
        }
        const pivotWindow = this.readNumber([atom.params?.pivotWindow], 14)
        const confirmationBars = this.readNumber([atom.params?.confirmationBars], 3)
        const divSeriesId = `indicator_divergence_${divIndicator}_${divDirection}_${pivotWindow}_${confirmationBars}_${context.timeframe}`
        if (!context.seriesMap.has(divSeriesId)) {
          context.seriesMap.set(divSeriesId, {
            id: divSeriesId,
            kind: 'INDICATOR_DIVERGENCE',
            timeframe: context.timeframe,
            params: {
              indicator: divIndicator,
              direction: divDirection,
              pivotWindow,
              confirmationBars,
            },
          })
        }
        context.runtimeRequirements.helpers.add(divIndicator === 'macd' ? 'macd' : 'rsi')
        context.runtimeRequirements.helpers.add('priceHighsLows')
        const constOneRef = this.ensureConstSeries(context, 1)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_indicator_divergence_${divIndicator}_${divDirection}`,
          'EQ',
          [divSeriesId, constOneRef],
        )
      }

      case 'price.candle_pattern': {
        // P4-2: 白名单 4 patterns：engulfing / hammer / doji / consecutive_body
        // IR 通过 CANDLE_PATTERN 系列 + EQ predicate 封装 candle pattern 信号。
        // fail-closed：pattern / direction 非白名单值直接抛错，避免静默降级。
        //
        // ⚠️ runtime gap 公开标记（同 P4-1 A-C1 模式）：当前 strategy-runtime / backtesting /
        // compiled-runtime 全仓 0 个 CANDLE_PATTERN 系列 evaluator 实现（grep 验证 0 命中），
        // candlePatternDetector helper 同样 0 实现。该 atom codegen 路径已闭环，但 runtime
        // 信号永远 fail-closed（series.evaluate undefined → predicate EQ 永不真）直到
        // follow-up issue #1062 落地。
        // 设计取舍：维持 supported_executable 让后续 atom 共用同模式，避免 train 回退。
        const cpPattern = typeof atom.params?.pattern === 'string'
          ? atom.params.pattern.trim().toLowerCase()
          : null
        if (
          cpPattern !== 'engulfing'
          && cpPattern !== 'hammer'
          && cpPattern !== 'doji'
          && cpPattern !== 'consecutive_body'
        ) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:pattern`)
        }
        const cpDirection = typeof atom.params?.direction === 'string'
          ? atom.params.direction.trim().toLowerCase()
          : null
        if (cpDirection !== 'bullish' && cpDirection !== 'bearish') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
        }
        const cpMinBars = cpPattern === 'consecutive_body'
          && typeof atom.params?.minBars === 'number'
          && Number.isInteger(atom.params.minBars)
          && atom.params.minBars > 0
          ? atom.params.minBars
          : undefined
        if (cpPattern === 'consecutive_body' && cpMinBars === undefined) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:minBars`)
        }
        const cpSeriesId = cpMinBars !== undefined
          ? `candle_pattern_${cpPattern}_${cpDirection}_${cpMinBars}_${context.timeframe}`
          : `candle_pattern_${cpPattern}_${cpDirection}_${context.timeframe}`
        if (!context.seriesMap.has(cpSeriesId)) {
          context.seriesMap.set(cpSeriesId, {
            id: cpSeriesId,
            kind: 'CANDLE_PATTERN',
            timeframe: context.timeframe,
            params: {
              pattern: cpPattern,
              direction: cpDirection,
              ...(cpMinBars !== undefined ? { minBars: cpMinBars } : {}),
            },
          })
        }
        context.runtimeRequirements.helpers.add('candlePatternDetector')
        const constOneRef = this.ensureConstSeries(context, 1)
        return this.upsertPredicate(
          context.predicateMap,
          cpMinBars !== undefined
            ? `${seed}_candle_pattern_${cpPattern}_${cpDirection}_${cpMinBars}`
            : `${seed}_candle_pattern_${cpPattern}_${cpDirection}`,
          'EQ',
          [cpSeriesId, constOneRef],
        )
      }

      default:
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}`)
    }
  }


  private ensurePriceSeries(
    context: CompileContext,
    field: NonNullable<SeriesDef['field']>,
    timeframe = context.timeframe,
    offsetBars = 0,
  ): string {
    const id = `${field}_${timeframe}${offsetBars > 0 ? `_${offsetBars}` : ''}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'PRICE',
        timeframe,
        field,
        ...(offsetBars > 0 ? { offsetBars } : {}),
      })
    }
    return id
  }

  private ensureDeploymentPriceSeries(
    context: CompileContext,
    field: NonNullable<SeriesDef['field']>,
    timeframe = context.timeframe,
  ): string {
    const id = `deployment_${field}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'DEPLOYMENT_PRICE',
        timeframe,
        field,
      })
    }
    return id
  }

  private ensureIndicatorSeries(
    context: CompileContext,
    kind: Extract<SeriesDef['kind'], 'SMA' | 'EMA' | 'RSI'>,
    period: number,
    timeframe = context.timeframe,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close', timeframe)
    const id = `${kind.toLowerCase()}_${period}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
        timeframe,
        inputs: [closeRef],
        params: { period },
      })
    }
    return id
  }

  private ensureMovingAverageSeries(context: CompileContext, period: number): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const prefix = context.movingAverage.kind.toLowerCase()
    const id = `${prefix}_${period}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: context.movingAverage.kind,
        inputs: [closeRef],
        params: { period },
      })
    }
    return id
  }

  private ensureIndicatorReferenceSeries(
    context: CompileContext,
    atom: CanonicalConditionAtom,
    timeframe: string,
  ): string {
    const indicator = typeof atom.params?.indicator === 'string'
      ? atom.params.indicator.trim().toLowerCase()
      : ''
    const period = this.readNumber([atom.params?.['reference.period'], atom.params?.period], context.movingAverage.slow)

    if (indicator === 'ema') {
      return this.ensureIndicatorSeries(context, 'EMA', period, timeframe)
    }

    if (indicator === 'ma' || indicator === 'sma' || indicator.length === 0) {
      return this.ensureIndicatorSeries(context, 'SMA', period, timeframe)
    }

    throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:${indicator}`)
  }

  private ensureRsiSeries(context: CompileContext, period: number): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const id = `rsi_${period}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'RSI',
        inputs: [closeRef],
        params: { period },
      })
    }
    return id
  }

  private ensureMacdSeries(
    context: CompileContext,
    kind: Extract<SeriesDef['kind'], 'MACD_LINE' | 'MACD_SIGNAL'>,
    timeframe = context.timeframe,
    macd = context.macd,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close', timeframe)
    const id = `${kind.toLowerCase()}_${macd.fastPeriod}_${macd.slowPeriod}_${macd.signalPeriod}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
        inputs: [closeRef],
        params: {
          fastPeriod: macd.fastPeriod,
          slowPeriod: macd.slowPeriod,
          signalPeriod: macd.signalPeriod,
        },
      })
    }
    return id
  }

  private ensureGridLevelSet(
    context: CompileContext,
    atom: CanonicalConditionAtom,
  ): string {
    const rangeMin = this.readNumber([atom.params?.rangeMin], 0)
    const rangeMax = this.readNumber([atom.params?.rangeMax], rangeMin)
    const stepPct = this.readNumber([atom.params?.stepPct], 1)
    const levelCount = this.readNumber([atom.params?.levelCount], 1)
    const lowerRef = this.ensureConstSeries(context, rangeMin)
    const upperRef = this.ensureConstSeries(context, rangeMax)
    const id = `grid_${context.timeframe}_${this.normalizeNumberToken(rangeMin)}_${this.normalizeNumberToken(rangeMax)}_${this.normalizeNumberToken(stepPct)}_${this.normalizeNumberToken(levelCount)}`
    if (!context.levelSetMap.has(id)) {
      context.levelSetMap.set(id, {
        id,
        kind: 'ARITHMETIC_LEVEL_SET',
        anchorRef: lowerRef,
        spacing: {
          mode: 'pct',
          value: stepPct,
        },
        levelsPerSide: {
          down: 0,
          up: Math.max(0, levelCount - 1),
        },
        hardBounds: {
          lowerRef,
          upperRef,
        },
      })
    }
    return id
  }

  private ensureChannelSeries(
    context: CompileContext,
    kind: Extract<SeriesDef['kind'], 'HIGHEST_HIGH' | 'LOWEST_LOW'>,
    period: number,
    timeframe = context.timeframe,
  ): string {
    const id = `${kind.toLowerCase()}_${period}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
        timeframe,
        params: { period },
      })
    }
    return id
  }

  private ensureRangePositionSeries(context: CompileContext, period: number): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const highRef = this.ensureChannelSeries(context, 'HIGHEST_HIGH', period)
    const lowRef = this.ensureChannelSeries(context, 'LOWEST_LOW', period)
    const id = `range_position_pct_${period}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'RANGE_POSITION_PCT',
        timeframe: context.timeframe,
        inputs: [closeRef, highRef, lowRef],
        params: { period },
      })
    }
    return id
  }

  private ensurePositionHeldBarsSeries(context: CompileContext): string {
    const id = `position_bars_held_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'POSITION_BARS_HELD',
        timeframe: context.timeframe,
      })
    }
    return id
  }

  private ensurePositionSeries(
    context: CompileContext,
    kind: Extract<SeriesDef['kind'], 'POSITION_AVG_PRICE' | 'POSITION_PNL_PCT'>,
    id: string,
  ): string {
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
      })
    }
    return id
  }

  private ensureBollingerSeries(
    context: CompileContext,
    kind: Extract<SeriesDef['kind'], 'UPPER_BAND' | 'MID_BAND' | 'LOWER_BAND'>,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const id = `${kind.toLowerCase()}_${context.bollinger.period}_${this.normalizeNumberToken(context.bollinger.stdDev)}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
        inputs: [closeRef],
        params: {
          period: context.bollinger.period,
          stdDev: context.bollinger.stdDev,
        },
      })
    }
    return id
  }

  private ensureVolumeSeries(context: CompileContext, timeframe = context.timeframe): string {
    const id = `volume_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'VOLUME',
        timeframe,
      })
    }
    return id
  }

  private ensureAtrSeries(context: CompileContext, period: number, timeframe = context.timeframe): string {
    context.runtimeRequirements.helpers.add('atr')
    const id = `atr_${period}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'ATR',
        timeframe,
        params: { period },
      })
    }
    return id
  }

  private ensureTimeWindowSeries(
    context: CompileContext,
    timezone: string,
    windows: ReadonlyArray<{ daysOfWeek?: readonly number[]; start: string; end: string }>,
  ): string {
    context.runtimeRequirements.helpers.add('timezone_clock')
    const windowsJson = JSON.stringify(windows)
    const hash = createHash('sha256').update(`${timezone}|${windowsJson}`).digest('hex').slice(0, 12)
    const id = `in_time_window_${hash}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'IN_TIME_WINDOW',
        timezone,
        windows,
      })
    }
    return id
  }

  private ensureSmaVolumeSeries(
    context: CompileContext,
    period: number,
    multiplier: number,
    timeframe = context.timeframe,
  ): string {
    context.runtimeRequirements.helpers.add('smaVolume')
    const volumeRef = this.ensureVolumeSeries(context, timeframe)
    const id = `sma_volume_${period}_${this.normalizeNumberToken(multiplier)}_${timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'SMA_VOLUME',
        timeframe,
        inputs: [volumeRef],
        params: { period, multiplier },
      })
    }
    return id
  }

  private ensureConstSeries(context: CompileContext, value: number | string): string {
    const id = typeof value === 'string'
      ? `const_text_${this.normalizeTextToken(value)}`
      : `const_${this.normalizeNumberToken(value)}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'CONST',
        value,
      })
    }
    return id
  }

  private ensureStateContextSeries(
    key: 'market.regime' | 'trend.direction' | 'volatility.state',
    context: CompileContext,
  ): string {
    const kindMap = {
      'market.regime': 'MARKET_REGIME',
      'trend.direction': 'TREND_DIRECTION',
      'volatility.state': 'VOLATILITY_STATE',
    } as const
    const id = key.replace(/\./g, '_')
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: kindMap[key],
      })
    }
    return id
  }

  private upsertPredicate(
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ): string {
    const paramsSignature = params ? JSON.stringify(Object.keys(params).sort().reduce<Record<string, number | string | boolean>>((acc, key) => {
      const value = params[key]
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {})) : ''
    const signature = `${kind}:${args.join('|')}:${paramsSignature}`
    const existing = [...predicateMap.values()].find(predicate => {
      const existingParamsSignature = predicate.params ? JSON.stringify(Object.keys(predicate.params).sort().reduce<Record<string, number | string | boolean>>((acc, key) => {
        const value = predicate.params?.[key]
        if (value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {})) : ''
      return `${predicate.kind}:${predicate.args.join('|')}:${existingParamsSignature}` === signature
    })
    if (existing) {
      return existing.id
    }

    const id = baseId.replace(/\W+/g, '_')
    predicateMap.set(id, {
      id,
      kind,
      args,
      ...(params ? { params } : {}),
    })
    return id
  }

  private tryCompileRiskPredicate(rule: CanonicalRuleV2, context: CompileContext): RiskPredicateDef | null {
    if (rule.phase !== 'risk' || rule.condition.kind !== 'atom') {
      return null
    }

    if (rule.condition.key === 'risk.atr_multiple_stop' || rule.condition.key === 'risk.atr_multiple_take_profit') {
      const multiple = this.readNumber([rule.condition.params?.multiple], 0)
      if (multiple <= 0) {
        return null
      }
      context.runtimeRequirements.helpers.add('atr')
      return {
        id: rule.id,
        kind: rule.condition.key === 'risk.atr_multiple_stop' ? 'atrMultipleStop' : 'atrMultipleTakeProfit',
        params: { multiple },
        actions: this.compileRiskPredicateActions(rule),
      }
    }

    if (rule.condition.key === 'risk.time_stop_bars') {
      const params = rule.condition.params ?? {}
      const maxBarsRaw = params.maxBars
      const maxBars = typeof maxBarsRaw === 'number' ? maxBarsRaw : Number(maxBarsRaw)
      if (!Number.isInteger(maxBars) || maxBars <= 0) {
        return null
      }
      const scopeRaw = typeof params.scope === 'string' ? params.scope : 'both'
      const scope = scopeRaw === 'long' || scopeRaw === 'short' ? scopeRaw : 'both'
      const effect = typeof params.effect === 'string' ? params.effect : 'close_position'
      // MVP: only effect=close_position routes through risk predicate (force_exit / close-side action).
      // effect=reduce_position requires a partial-reduce rule block + reducePct; out of scope this PR.
      if (effect !== 'close_position') {
        return null
      }
      context.runtimeRequirements.helpers.add('positionBarsHeld')
      return {
        id: rule.id,
        kind: 'timeStopBars',
        params: { maxBars, scope },
        actions: this.compileRiskPredicateActions(rule),
      }
    }

    if (rule.condition.key === 'risk.remembered_level_stop') {
      const levelKey = typeof rule.condition.params?.levelKey === 'string' && rule.condition.params.levelKey.trim().length > 0
        ? rule.condition.params.levelKey.trim()
        : null
      if (!levelKey) {
        return null
      }
      context.runtimeRequirements.stateKeys.add(levelKey)
      return {
        id: rule.id,
        kind: 'rememberedLevelStop',
        params: { levelKey },
        actions: this.compileRiskPredicateActions(rule),
      }
    }

    return null
  }

  private compileRiskPredicateActions(rule: CanonicalRuleV2): RiskPredicateDef['actions'] {
    const actions = rule.actions
      .map(action => action.type)
      .filter((action): action is 'FORCE_EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT' =>
        action === 'FORCE_EXIT' || action === 'CLOSE_LONG' || action === 'CLOSE_SHORT',
      )

    if (actions.length === 0) {
      return [{ kind: 'FORCE_EXIT' }]
    }

    return Array.from(new Set(actions)).map(kind => ({ kind }))
  }

  private tryCompileRiskGuard(rule: CanonicalRuleV2, context: CompileContext): RiskGuard | null {
    if (rule.phase === 'risk' && rule.condition.kind !== 'atom') {
      const predicateRef = this.compileCondition(rule.condition, context, rule.id)
      if (rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')) {
        return {
          id: `guard_${rule.id}`,
          kind: 'EXPRESSION_GUARD',
          scope: 'strategy',
          appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
          predicateRef,
          onBreach: 'HALT_STRATEGY',
        }
      }

      if (rule.actions.some(action => action.type === 'FORCE_EXIT')) {
        return {
          id: `guard_${rule.id}`,
          kind: 'EXPRESSION_GUARD',
          scope: 'position',
          appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
          predicateRef,
          onBreach: 'FORCE_EXIT',
        }
      }
    }

    if (rule.condition.kind !== 'atom') {
      return null
    }

    if (
      rule.phase === 'gate'
      && (rule.condition.key === 'position.has_position' || rule.condition.key === 'position.no_position')
      && rule.condition.op === 'EQ'
      && rule.condition.value === false
      && rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')
    ) {
      // critic round 1 C-A2 修复：必须传 appliesTo 以保留 sideScope 语义
      // ("已有多头仓位时不再开多" 必须只阻止做多，不能阻止做空)；
      // 没传时 silent collapse 为全方向 block。
      // sideScope 优先从 condition.params.side 取（builder 写入），
      // fallback 到 rule.sideScope（顶层规则方向）。
      const conditionSide = (rule.condition.params as { side?: string } | undefined)?.side
      const effectiveSide = (conditionSide === 'long' || conditionSide === 'short' || conditionSide === 'both')
        ? conditionSide as CanonicalRuleSideScope
        : rule.sideScope
      return {
        id: `guard_${rule.id}`,
        kind: 'MAX_POSITION_PCT',
        scope: 'position',
        value: 0,
        onBreach: 'BLOCK_NEW_ENTRY',
        appliesTo: this.toRiskGuardAppliesTo(effectiveSide),
      }
    }

    if (
      rule.phase === 'gate'
      && (rule.condition.key === 'volume.threshold'
        || rule.condition.key === 'volatility.atr_threshold'
        || rule.condition.key === 'strategy.time_window'
        || rule.condition.key === 'strategy.multi_timeframe')
      && rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')
    ) {
      const predicateRef = this.compilePhase1GateAtom(rule.condition, context, rule.id)
      if (!predicateRef) {
        return null
      }
      return {
        id: `guard_${rule.id}`,
        kind: 'EXPRESSION_GUARD',
        scope: 'strategy',
        appliesTo: 'both',
        predicateRef,
        onBreach: 'BLOCK_NEW_ENTRY',
      }
    }

    if (rule.phase !== 'risk') {
      return null
    }

    const threshold = this.readNumber([rule.condition.value], 0)
    const onBreach = rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')
      ? 'BLOCK_NEW_ENTRY'
      : 'FORCE_EXIT'
    const hasReduceAction = rule.actions.some(action => action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT')

    if (rule.condition.key === 'position_loss_pct') {
      return {
        id: `guard_${rule.id}`,
        kind: 'STOP_LOSS_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: threshold <= 1 ? Number((threshold * 100).toFixed(4)) : threshold,
        onBreach,
      }
    }

    if (rule.condition.key === 'risk.take_profit_pct') {
      const hasSpecificCloseAction = rule.actions.every(action => action.type === 'CLOSE_LONG' || action.type === 'CLOSE_SHORT')
      if (hasReduceAction || hasSpecificCloseAction) return null
      return {
        id: `guard_${rule.id}`,
        kind: 'TAKE_PROFIT_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: threshold <= 1 ? Number((threshold * 100).toFixed(4)) : threshold,
        onBreach,
      }
    }

    if (rule.condition.key === 'risk.trailing_stop_pct') {
      return {
        id: `guard_${rule.id}`,
        kind: 'TRAILING_STOP_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: threshold <= 1 ? Number((threshold * 100).toFixed(4)) : threshold,
        onBreach,
      }
    }

    return null
  }

  private tryCompileReduceActionRule(
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
    context: CompileContext,
  ): RuleBlock | null {
    const ptpMeta = rule.metadata?.partialTakeProfit
    if (
      !ptpMeta
      || rule.phase !== 'risk'
      || rule.condition.kind !== 'atom'
      || rule.condition.key !== 'risk.partial_take_profit'
    ) {
      return null
    }

    const reduceActions = rule.actions.filter(action =>
      action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT',
    )
    if (reduceActions.length === 0) {
      return null
    }

    const threshold = this.readNumber([rule.condition.value], Number.NaN)
    if (!Number.isFinite(threshold)) {
      return null
    }

    const pnlSeriesId = this.ensurePositionSeries(context, 'POSITION_PNL_PCT', 'position_pnl_pct')
    const constSeriesId = this.ensureConstSeries(context, threshold)
    const predicateRef = this.upsertPredicate(
      context.predicateMap,
      `${rule.id}_pnl_gte`,
      'GTE',
      [pnlSeriesId, constSeriesId],
    )

    const compiledActions = this.compileActions(
      { ...rule, actions: reduceActions },
      spec,
      fallbackPositionPct,
    )
    if (compiledActions.length === 0) {
      return null
    }

    // Partial take profit firing is gated by tier_*_fired flags in
    // semanticRuntimeState (see run-decision-programs.ts), so cooldownBars
    // would be redundant and could only mask a real bug. Intentionally drop it.
    return {
      id: rule.id,
      phase: 'exit',
      when: predicateRef,
      priority: rule.priority,
      actions: compiledActions,
      metadata: { partialTakeProfit: { ...ptpMeta } },
    }
  }

  private tryCompileRiskGuards(rule: CanonicalRuleV2, context: CompileContext): RiskGuard[] {
    const boundaryCancelGuards = this.tryCompileBoundaryCancelGuards(rule, context)
    if (boundaryCancelGuards.length > 0) {
      return boundaryCancelGuards
    }

    const guard = this.tryCompileRiskGuard(rule, context)
    return guard ? [guard] : []
  }

  private tryCompileBoundaryCancelGuards(rule: CanonicalRuleV2, context: CompileContext): RiskGuard[] {
    if (
      rule.phase !== 'risk'
      || rule.condition.kind === 'atom'
      || rule.metadata?.guard !== 'boundary_cancel'
      || rule.metadata?.cancelOrders !== true
    ) {
      return []
    }

    const predicateRef = this.compileCondition(rule.condition, context, rule.id)
    const baseGuard = {
      kind: 'EXPRESSION_GUARD' as const,
      scope: 'strategy' as const,
      appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
      predicateRef,
    }

    return [
      {
        ...baseGuard,
        id: `guard_${rule.id}_halt`,
        onBreach: 'HALT_STRATEGY',
      },
      {
        ...baseGuard,
        id: `guard_${rule.id}_cancel_orders`,
        onBreach: 'CANCEL_ORDER_PROGRAMS',
      },
    ]
  }

  private flipGateOperator(op: 'GT' | 'GTE' | 'LT' | 'LTE'): 'LTE' | 'LT' | 'GTE' | 'GT' {
    switch (op) {
      case 'GT': return 'LTE'
      case 'GTE': return 'LT'
      case 'LT': return 'GTE'
      case 'LTE': return 'GT'
    }
  }

  private compilePhase1GateAtom(
    atom: CanonicalConditionAtom,
    context: CompileContext,
    seed: string,
  ): string | null {
    if (atom.key === 'volume.threshold') {
      const value = this.readNumber([atom.value], Number.NaN)
      if (!Number.isFinite(value)) return null
      const userOp = atom.op === 'GT' || atom.op === 'GTE' || atom.op === 'LT' || atom.op === 'LTE' ? atom.op : 'GT'
      const predicateKind = this.flipGateOperator(userOp)
      const volumeRef = this.ensureVolumeSeries(context)
      const constRef = this.ensureConstSeries(context, value)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_volume_threshold`,
        predicateKind,
        [volumeRef, constRef],
      )
    }

    if (atom.key === 'volatility.atr_threshold') {
      const value = this.readNumber([atom.value], Number.NaN)
      if (!Number.isFinite(value)) return null
      const userOp = atom.op === 'GT' || atom.op === 'GTE' || atom.op === 'LT' || atom.op === 'LTE' ? atom.op : 'GT'
      const predicateKind = this.flipGateOperator(userOp)
      const period = this.readNumber([atom.params?.period], 14)
      const atrRef = this.ensureAtrSeries(context, period)
      const constRef = this.ensureConstSeries(context, value)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_atr_threshold`,
        predicateKind,
        [atrRef, constRef],
      )
    }

    if (atom.key === 'strategy.multi_timeframe') {
      // strategy.multi_timeframe 的 IR EXPRESSION_GUARD 由 5 个解构参数构成：
      //   htfTimeframe (string)   -> ensureIndicatorSeries / ensurePriceSeries 的 timeframe
      //   htfIndicator (string)   -> 'ma' | 'sma' | 'ema' | 'rsi'，决定 SMA/EMA/RSI 系列
      //   htfPeriod    (number>0) -> 指标周期
      //   htfOp        (compare)  -> 'GT' | 'GTE' | 'LT' | 'LTE'，flipGateOperator 反转后即 guard 触发条件
      //   htfRhs       (enum)     -> 'price' | 'value'；为 'value' 时 htfValue 必填
      // 与 semantic-atom-registry.service.ts MULTI_TIMEFRAME_OPEN_SLOTS / requiredParams 严格对齐。
      // 任一键不合法 -> return null -> tryCompileRiskGuard 返回 null -> compileCondition 走 default
      //   throw `codegen.canonical_spec_v2_condition_unsupported:strategy.multi_timeframe`，
      //   保持 fail-closed 而非静默吞掉 BLOCK_NEW_ENTRY guard。
      const htfTimeframe = typeof atom.params?.htfTimeframe === 'string' && atom.params.htfTimeframe.trim().length > 0
        ? atom.params.htfTimeframe.trim()
        : null
      const htfIndicator = typeof atom.params?.htfIndicator === 'string'
        ? atom.params.htfIndicator.trim().toLowerCase()
        : null
      const htfOp = atom.params?.htfOp
      const htfPeriod = this.readNumber([atom.params?.htfPeriod], Number.NaN)
      const htfRhs = typeof atom.params?.htfRhs === 'string' ? atom.params.htfRhs.trim().toLowerCase() : null

      if (
        !htfTimeframe
        || !htfIndicator
        || (htfOp !== 'GT' && htfOp !== 'GTE' && htfOp !== 'LT' && htfOp !== 'LTE')
        || !Number.isFinite(htfPeriod)
        || htfPeriod <= 0
      ) {
        return null
      }

      // htfRhs 显式白名单：避免 typo（如 'pric' / 'rpice'）静默落入数值分支改语义。
      if (htfRhs !== 'price' && htfRhs !== 'value') {
        return null
      }

      let leftRef: string
      if (htfIndicator === 'ema') {
        leftRef = this.ensureIndicatorSeries(context, 'EMA', htfPeriod, htfTimeframe)
      }
      else if (htfIndicator === 'rsi') {
        leftRef = this.ensureIndicatorSeries(context, 'RSI', htfPeriod, htfTimeframe)
      }
      else if (htfIndicator === 'ma' || htfIndicator === 'sma') {
        leftRef = this.ensureIndicatorSeries(context, 'SMA', htfPeriod, htfTimeframe)
      }
      else {
        return null
      }

      let rightRef: string
      if (htfRhs === 'price') {
        rightRef = this.ensurePriceSeries(context, 'close', htfTimeframe)
      }
      else {
        // htfRhs === 'value'：htfValue 必填。
        const htfValue = this.readNumber([atom.params?.htfValue], Number.NaN)
        if (!Number.isFinite(htfValue)) return null
        rightRef = this.ensureConstSeries(context, htfValue)
      }

      const predicateKind = this.flipGateOperator(htfOp)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_multi_timeframe`,
        predicateKind,
        [leftRef, rightRef],
      )
    }

    if (atom.key === 'strategy.time_window') {
      const timezone = typeof atom.params?.timezone === 'string' ? atom.params.timezone : null
      const windowsRaw = atom.params?.windows
      if (!timezone || typeof windowsRaw !== 'string') return null
      let parsedWindows: Array<{ daysOfWeek?: number[]; start: string; end: string }>
      try {
        const parsed = JSON.parse(windowsRaw)
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        parsedWindows = parsed
      }
      catch {
        return null
      }
      const timeWindowRef = this.ensureTimeWindowSeries(context, timezone, parsedWindows)
      const constRef = this.ensureConstSeries(context, 0)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_time_window`,
        'EQ',
        [timeWindowRef, constRef],
      )
    }

    return null
  }

  private toRiskGuardAppliesTo(sideScope: CanonicalRuleSideScope | undefined): NonNullable<RiskGuard['appliesTo']> {
    if (sideScope === 'long' || sideScope === 'short') return sideScope
    return 'both'
  }

  private compileActions(
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
  ): ActionDef[] {
    const actions: ActionDef[] = []

    for (const action of rule.actions) {
      switch (action.type) {
        case 'OPEN_LONG':
        case 'OPEN_SHORT':
        case 'ADD_LONG':
        case 'ADD_SHORT':
          actions.push({
            kind: action.type,
            quantity: this.resolveActionQuantity(action, spec.sizing, fallbackPositionPct),
          })
          break

        case 'CLOSE_LONG':
        case 'CLOSE_SHORT':
          actions.push({
            kind: action.type,
            quantity: { mode: 'position_pct', value: 100 },
          })
          break

        case 'REDUCE_LONG':
        case 'REDUCE_SHORT':
          actions.push({
            kind: action.type,
            quantity: action.sizing
              ? this.resolveReduceActionQuantity(action, spec.sizing, fallbackPositionPct)
              : { mode: 'position_pct', value: 50 },
          })
          break

        case 'FORCE_EXIT':
          actions.push(
            { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
            { kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } },
          )
          break

        case 'BLOCK_NEW_ENTRY':
          break
      }
    }

    return actions
  }

  private collectPositionLifecycleRuntimeRequirements(
    rule: CanonicalRuleV2,
    actions: ActionDef[],
    context: CompileContext,
  ): void {
    if (!this.isPositionLifecycleRule(rule, actions)) {
      return
    }

    context.runtimeRequirements.helpers.add('positionLifecycle')
    if (rule.metadata?.addPosition) {
      context.runtimeRequirements.stateKeys.add(rule.metadata.addPosition.stateKey)
    }
    if (rule.metadata?.dcaSchedule) {
      context.runtimeRequirements.stateKeys.add(rule.metadata.dcaSchedule.stateKey)
    }
  }

  private isPositionLifecycleRule(rule: CanonicalRuleV2, actions: ActionDef[]): boolean {
    return actions.some(action => action.kind === 'ADD_LONG' || action.kind === 'ADD_SHORT')
      || Boolean(rule.metadata?.reversePosition || rule.metadata?.addPosition || rule.metadata?.dcaSchedule)
      || rule.actions.some(action =>
        (action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT')
        && action.params?.lifecycle === true,
      )
  }

  private toRuleBlockMetadata(metadata: NonNullable<CanonicalRuleV2['metadata']>): RuleBlock['metadata'] {
    return {
      ...(metadata.partialTakeProfit ? { partialTakeProfit: { ...metadata.partialTakeProfit } } : {}),
      ...(metadata.reversePosition ? { reversePosition: { ...metadata.reversePosition } } : {}),
      ...(metadata.addPosition ? { addPosition: { ...metadata.addPosition } } : {}),
      ...(metadata.dcaSchedule ? { dcaSchedule: { ...metadata.dcaSchedule } } : {}),
    }
  }

  private resolveReduceActionQuantity(
    action: CanonicalRuleAction,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
  ): ActionDef['quantity'] {
    const sizing = action.sizing ?? defaultSizing
    if (sizing?.mode === 'RATIO') {
      return {
        mode: 'position_pct',
        value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value,
      }
    }

    return this.resolveActionQuantity(action, defaultSizing, fallbackPositionPct)
  }

  private resolveActionQuantity(
    action: CanonicalRuleAction,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
  ): ActionDef['quantity'] {
    const sizing = action.sizing ?? defaultSizing
    if (action.params?.quantityMode === 'position_pct' && sizing?.mode === 'RATIO') {
      return {
        mode: 'position_pct',
        value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value,
      }
    }

    if (!sizing) {
      return {
        mode: 'pct_equity',
        value: fallbackPositionPct,
      }
    }

    if (sizing.mode === 'RATIO') {
      return {
        mode: 'pct_equity',
        value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value,
      }
    }

    if (sizing.mode === 'QUOTE') {
      return {
        mode: 'fixed_quote',
        value: sizing.value,
        ...(sizing.asset ? { asset: sizing.asset } : {}),
      }
    }

    return {
      mode: 'fixed_base',
      value: sizing.value,
      ...(sizing.asset ? { asset: sizing.asset } : {}),
    }
  }

  private resolvePortfolioSizing(
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
  ): CanonicalStrategyIrV1['portfolio']['sizing'] {
    if (!spec.sizing) {
      return {
        mode: 'pct_equity',
        value: fallbackPositionPct,
      }
    }

    if (spec.sizing.mode === 'RATIO') {
      return {
        mode: 'pct_equity',
        value: spec.sizing.value <= 1 ? Number((spec.sizing.value * 100).toFixed(4)) : spec.sizing.value,
      }
    }

    if (spec.sizing.mode === 'QUOTE') {
      return {
        mode: 'fixed_quote',
        value: spec.sizing.value,
        ...(spec.sizing.asset ? { asset: spec.sizing.asset } : {}),
      }
    }

    return {
      mode: 'fixed_base',
      value: spec.sizing.value,
      ...(spec.sizing.asset ? { asset: spec.sizing.asset } : {}),
    }
  }

  private resolveLifecyclePyramiding(rules: CanonicalRuleV2[]): { allow: boolean, maxLayers: number } {
    const addPositionMetadata = rules
      .map(rule => rule.metadata?.addPosition)
      .filter((metadata): metadata is NonNullable<NonNullable<CanonicalRuleV2['metadata']>['addPosition']> => metadata !== undefined)
    const hasAddAction = rules.some(rule => rule.actions.some(action => action.type === 'ADD_LONG' || action.type === 'ADD_SHORT'))
    const maxLayers = Math.max(1, ...addPositionMetadata.map(metadata =>
      typeof metadata.maxLayers === 'number' && Number.isFinite(metadata.maxLayers) && metadata.maxLayers > 0
        ? Math.floor(metadata.maxLayers)
        : 1,
    ))

    return {
      allow: hasAddAction || addPositionMetadata.length > 0,
      maxLayers,
    }
  }

  private mapRulePhase(rule: CanonicalRuleV2, actions: ActionDef[]): RuleBlock['phase'] {
    if (rule.phase === 'entry' || rule.phase === 'exit') {
      return rule.phase
    }

    const closesOnly = actions.every(action => action.kind === 'CLOSE_LONG' || action.kind === 'CLOSE_SHORT')
    return closesOnly ? 'exit' : 'rebalance'
  }

  private resolvePositionMode(rules: CanonicalRuleV2[]): CanonicalStrategyIrV1['portfolio']['positionMode'] {
    const hasLong = rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_LONG'
      || action.type === 'REDUCE_LONG'
      || action.type === 'ADD_LONG'
    )))
    const hasShort = rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
      || action.type === 'REDUCE_SHORT'
      || action.type === 'ADD_SHORT'
    )))

    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private resolveMaxLookback(seriesMap: Map<string, SeriesDef>): number {
    return Math.max(1, ...[...seriesMap.values()].map(series => {
      const period = typeof series.params?.period === 'number' ? series.params.period : 1
      const bars = typeof series.params?.bars === 'number' ? series.params.bars : 1
      const slowPeriod = typeof series.params?.slowPeriod === 'number' ? series.params.slowPeriod : 1
      const signalPeriod = typeof series.params?.signalPeriod === 'number' ? series.params.signalPeriod : 1
      return Math.max(period, bars, slowPeriod + signalPeriod)
    }))
  }

  private describeCondition(
    condition: CanonicalConditionNode,
    config: {
      movingAverage: CompileContext['movingAverage']
      rsi: CompileContext['rsi']
      macd: CompileContext['macd']
      bollinger: CompileContext['bollinger']
    },
  ): string {
    if (condition.kind === 'AND' || condition.kind === 'OR') {
      return `${condition.kind}(${condition.children.map(child => this.describeCondition(child, config)).join(',')})`
    }

    if (condition.kind === 'NOT') {
      return `NOT(${this.describeCondition(condition.children[0] ?? { kind: 'atom', key: 'unknown' }, config)})`
    }

    if (condition.kind === 'expression') {
      return `${condition.op}(${this.describeExpressionOperand(condition.left, config)},${this.describeExpressionOperand(condition.right, config)})`
    }

    if (!this.isConditionAtom(condition)) {
      return 'unsupported'
    }

    switch (condition.key) {
      case 'execution.on_start':
        return 'EQ(BAR_INDEX,1)'

      case 'ma.golden_cross':
      case 'ma.death_cross': {
        const operator = condition.key === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER'
        return `${operator}(${config.movingAverage.kind}(CLOSE,${config.movingAverage.fast}),${config.movingAverage.kind}(CLOSE,${config.movingAverage.slow}))`
      }

      case 'rsi.threshold_lte':
        return `LTE(RSI(CLOSE,${config.rsi.period}),${this.readNumber([condition.value], 30)})`

      case 'rsi.threshold_gte':
        return `GTE(RSI(CLOSE,${config.rsi.period}),${this.readNumber([condition.value], 70)})`

      case 'rsi.cross_over':
        return `CROSS_OVER(RSI(CLOSE,${config.rsi.period}),${this.readNumber([condition.value], 50)})`

      case 'rsi.cross_under':
        return `CROSS_UNDER(RSI(CLOSE,${config.rsi.period}),${this.readNumber([condition.value], 50)})`

      case 'macd.golden_cross':
      case 'macd.death_cross': {
        const operator = condition.key === 'macd.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER'
        return `${operator}(MACD_LINE(CLOSE,${config.macd.fastPeriod},${config.macd.slowPeriod},${config.macd.signalPeriod}),MACD_SIGNAL(CLOSE,${config.macd.fastPeriod},${config.macd.slowPeriod},${config.macd.signalPeriod}))`
      }

      case 'breakout.channel_high_break':
        return `CROSS_OVER(CLOSE,HIGHEST_HIGH(${this.readNumber([condition.params?.period], 20)}))`

      case 'breakout.channel_low_break':
        return `CROSS_UNDER(CLOSE,LOWEST_LOW(${this.readNumber([condition.params?.period], 20)}))`

      case 'price.range_position_lte':
      case 'price.range_position_gte': {
        const operator = condition.key === 'price.range_position_lte' ? 'LTE' : 'GTE'
        const period = this.readNumber([condition.params?.period, condition.params?.lookbackBars], 20)
        const threshold = this.normalizeRangePositionThreshold(this.readNumber([condition.value, condition.params?.thresholdPct], 0.5))
        return `${operator}(RANGE_POSITION_PCT(CLOSE,HIGHEST_HIGH(${period}),LOWEST_LOW(${period})),${threshold})`
      }

      case 'risk.time_stop_bars':
        return `GTE(POSITION_BARS_HELD,${this.readNumber([condition.value], 0)})`

      case 'risk.take_profit_pct':
        return `GTE(POSITION_PNL_PCT,${this.normalizePositionPnlPctThreshold(this.readNumber([condition.value], 0))})`

      case 'position_gain_pct':
        return `GTE(POSITION_PNL_PCT,${this.normalizePositionPnlPctThreshold(this.readNumber([condition.value], 0))})`

      case 'bollinger.upper_break':
        return condition.op === 'GTE'
          ? `GTE(CLOSE,UPPER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`
          : `CROSS_OVER(CLOSE,UPPER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`

      case 'bollinger.lower_break':
        return condition.op === 'LTE'
          ? `LTE(CLOSE,LOWER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`
          : `CROSS_UNDER(CLOSE,LOWER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`

      case 'bollinger.middle_revert':
        return `OR(CROSS_OVER(CLOSE,MID_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})),CROSS_UNDER(CLOSE,MID_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})))`

      case 'bollinger.bars_outside': {
        const bars = this.readNumber([condition.params?.bars, condition.value], 1)
        return `GTE(BOLLINGER_BARS_OUTSIDE(CLOSE,${config.bollinger.period},${config.bollinger.stdDev},${bars}),${this.readNumber([condition.value], bars)})`
      }

      case 'position_loss_pct':
        return `LTE(POSITION_PNL_PCT,${-Math.abs(this.normalizePositionPnlPctThreshold(this.readNumber([condition.value], 0)))})`

      default:
        return condition.key
    }
  }

  private describeExpressionOperand(
    operand: SemanticExpressionOperand,
    config: {
      movingAverage: CompileContext['movingAverage']
      rsi: CompileContext['rsi']
      macd: CompileContext['macd']
      bollinger: CompileContext['bollinger']
    },
  ): string {
    switch (operand.kind) {
      case 'series':
        return operand.offsetBars && operand.offsetBars > 0
          ? `${operand.field.toUpperCase()}[${operand.offsetBars}]`
          : operand.field.toUpperCase()

      case 'constant':
        return String(operand.value)

      case 'indicator': {
        if (operand.name === 'sma' || operand.name === 'ema') {
          const period = this.readNumber([
            operand.params.period,
            operand.params.fastPeriod,
            operand.params.slowPeriod,
            operand.params.fast,
            operand.params.slow,
          ], operand.name === 'sma' ? config.movingAverage.slow : config.movingAverage.fast)
          return `${operand.name.toUpperCase()}(CLOSE,${period})`
        }

        if (operand.name === 'rsi') {
          return `RSI(CLOSE,${this.readNumber([operand.params.period], config.rsi.period)})`
        }

        if (operand.name === 'macd') {
          const macd = this.resolveMacdExpressionConfig(operand, config.macd)
          const output = operand.output === 'signal' ? 'MACD_SIGNAL' : 'MACD_LINE'
          return `${output}(CLOSE,${macd.fastPeriod},${macd.slowPeriod},${macd.signalPeriod})`
        }

        return `INDICATOR(${operand.name})`
      }

      case 'position':
        return `POSITION_${operand.field.toUpperCase()}`

      default: {
        const unsupported = operand as { kind?: string }
        return `UNSUPPORTED(${unsupported.kind ?? 'unknown'})`
      }
    }
  }

  private mapGraphAction(action: CanonicalRuleAction): StrategyLogicGraphSnapshot['actions'][number]['action'] | null {
    switch (action.type) {
      case 'OPEN_LONG':
      case 'ADD_LONG':
        return 'BUY'
      case 'OPEN_SHORT':
      case 'ADD_SHORT':
        return 'SELL'
      case 'CLOSE_LONG':
      case 'CLOSE_SHORT':
      case 'REDUCE_LONG':
      case 'REDUCE_SHORT':
      case 'FORCE_EXIT':
        return 'CLOSE'
      case 'BLOCK_NEW_ENTRY':
        return null
    }
  }

  private resolvePositionPct(
    sizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
  ): number {
    if (!sizing || sizing.mode !== 'RATIO') {
      return fallbackPositionPct
    }

    return sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value
  }

  private formatGraphSizingAmount(
    sizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
    symbol: string,
  ): string {
    if (!sizing) {
      return `${fallbackPositionPct}%`
    }

    if (sizing.mode === 'RATIO') {
      return `${this.formatDisplayNumber(this.resolvePositionPct(sizing, fallbackPositionPct))}%`
    }

    if (sizing.mode === 'QUOTE') {
      return `${this.formatDisplayNumber(sizing.value)} ${sizing.asset ?? this.inferQuoteAsset(symbol)}`
    }

    return `${this.formatDisplayNumber(sizing.value)} ${sizing.asset ?? this.inferBaseAsset(symbol)}`
  }

  private inferQuoteAsset(symbol: string): string {
    const normalized = symbol.toUpperCase()
    for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH'] as const) {
      if (normalized.endsWith(quote) && normalized.length > quote.length) {
        return quote
      }
    }

    return 'QUOTE'
  }

  private inferBaseAsset(symbol: string): string {
    const normalized = symbol.toUpperCase()
    const quote = this.inferQuoteAsset(normalized)
    if (quote !== 'QUOTE' && normalized.endsWith(quote)) {
      return normalized.slice(0, -quote.length)
    }

    return 'BASE'
  }

  private formatDisplayNumber(value: number): string {
    return Number(value.toFixed(8)).toString()
  }

  private resolveComparisonKind(op: CanonicalConditionAtom['op']): Extract<PredicateDef['kind'], 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'> {
    if (op === 'GT' || op === 'GTE' || op === 'LT' || op === 'LTE' || op === 'EQ') {
      return op
    }

    return 'GTE'
  }

  private isConditionAtom(node: CanonicalConditionNode): node is CanonicalConditionAtom {
    return node.kind === 'atom'
  }

  private normalizeNumberToken(value: number): string {
    return String(value).replace(/\./g, '_')
  }

  private normalizeTextToken(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'empty'
  }

  private resolveOperandTimeframe(value: string | undefined, fallbackTimeframe: string): string {
    return value && value.trim().length > 0 ? value.trim() : fallbackTimeframe
  }

  private readStringParam(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }

  private readNumber(candidates: unknown[], fallback: number): number {
    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate
      }
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        const parsed = Number(candidate)
        if (Number.isFinite(parsed)) {
          return parsed
        }
      }
    }

    return fallback
  }

  private normalizePositionPnlPctThreshold(value: number): number {
    if (!Number.isFinite(value)) return value
    return Math.abs(value) <= 1 ? value * 100 : value
  }

  private normalizeRangePositionThreshold(value: number): number {
    if (!Number.isFinite(value)) return 0.5
    const normalized = value > 1 ? value / 100 : value
    return Number(Math.min(1, Math.max(0, normalized)).toFixed(4))
  }
}
