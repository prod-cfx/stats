import type {
  ActionDef,
  CanonicalStrategyIrV1,
  IrOrchestrationGate,
  IrOrchestrationLegScope,
  IrOrchestrationPortfolioRisk,
  IrOrchestrationProgram,
  IrOrchestrationScope,
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
  CanonicalOrchestrationLegScope,
  CanonicalOrchestrationPortfolioRisk,
  CanonicalOrchestrationProgram,
  CanonicalOrchestrationScope,
  CanonicalOrderProgramIntent,
  CanonicalRuleAction,
  CanonicalRuleSideScope,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec'
import type { SemanticExpressionOperand } from '../types/semantic-state'
import { GRID_PROGRAM_KINDS } from '../types/semantic-state'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import type {
  IrBuildContext,
  IrCompileContext,
  IrCompileHelpers,
  LifecyclePyramidingShapeOutput,
  RuleLevelEmitContext,
  RuleLikeInput,
  SpecLevelEmitContext,
} from '../atom-contracts/atom-contract-emit.types'
import type { AtomContractEmit, AtomContractKey } from '../atom-contracts/atom-contract-types'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { extractAtrStopParams } from './atr-stop-params'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { Injectable, Logger } from '@nestjs/common'
import { CANONICAL_RULE_KEYS, DEFAULT_INDICATOR_PARAMS } from '../constants/canonical-strategy-capabilities'
import { SizingEvidenceMissingException } from '../exceptions/sizing-evidence-missing.exception'
import { LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS } from '../types/canonical-strategy-ir'
import { ACTIONABLE_RULE_ACTION_TYPES } from '../types/canonical-strategy-spec-v2'
import { CanonicalSpecV2DigestService } from './canonical-spec-v2-digest.service'
import { CanonicalStrategyIrCanonicalizerService } from './canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from './canonical-strategy-ir-validator.service'
import { CodegenGraphSnapshotService } from './codegen-graph-snapshot.service'
import {
  type BandTouchDirection,
  compileBandTouchPredicate,
  readBandTouchConfirmationMode,
} from './confirmation-mode-compiler'
import { EntryRuleRequiresEventLeafException } from '../exceptions/entry-rule-requires-event-leaf.exception'
import { collectEntryRuleLeafKinds, leafKindsContainEvent } from './predicate-kind-temporality'
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

/**
 * Issue #1279 PR3a：private CompileContext 与 atom-contracts 共享 shape
 *   `IrCompileContext` 同形（结构兼容），atom 的 emit.irShape 通过 ctx.compileContext
 *   读写 seriesMap / predicateMap / runtimeRequirements。
 *
 * 双向 `extends` 编译期断言（见 _compileContextShapeGuard）兜底，避免日后字段漂移：
 * CompileContext 缺字段 / 类型缩窄 / IrCompileContext 单边扩字段 → 编译失败，
 * 提示同步更新两侧定义。
 */
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

// 编译期守门：CompileContext 与 IrCompileContext 必须保持兼容（双向赋值）
type _CompileContextAssignableToIr = CompileContext extends IrCompileContext ? true : never
type _IrContextAssignableToCompile = IrCompileContext extends CompileContext ? true : never
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _compileContextShapeGuard: [_CompileContextAssignableToIr, _IrContextAssignableToCompile] = [true, true]

@Injectable()
export class CanonicalSpecV2IrCompilerService {
  private readonly logger = new Logger(CanonicalSpecV2IrCompilerService.name)

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

    this.assertSizingEvidence(input)

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

  /**
   * #1230 — compile-time sizing evidence guard.
   * actionable rule action（来自 ACTIONABLE_RULE_ACTION_TYPES）必须有 sizing 来源：
   *   action.sizing > spec.sizing > fallback.positionPct(>0)
   * 三者皆缺即 fail-closed，避免下游 runtime 静默回退 defaultQuoteAmount。
   *
   * 单一来源：判定集合在 canonical-strategy-spec-v2.ts 集中维护，新增需要
   * sizing 的 action type 时只改一处。
   */
  private assertSizingEvidence(input: CompileCanonicalSpecV2ToIrInput): void {
    const spec = input.canonicalSpec
    const fallbackPositionPct = input.fallback.positionPct ?? 0
    const rules = Array.isArray(spec.rules) ? spec.rules : []
    for (const rule of rules) {
      const actions = Array.isArray(rule?.actions) ? rule.actions : []
      for (const action of actions) {
        if (action?.type && ACTIONABLE_RULE_ACTION_TYPES.has(action.type)) {
          const effectiveSizing = action.sizing ?? spec.sizing
          if (!effectiveSizing && !fallbackPositionPct) {
            throw new SizingEvidenceMissingException({ ruleId: rule.id, actionType: action.type })
          }
        }
      }
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
    const rulePortfolioRisks: IrOrchestrationPortfolioRisk[] = []
    let maxConcurrentPositions = hasOrderPrograms ? orderProgramLevelCount : 1

    // Phase 5 S2/S3/S9/S10/S11: 收集 supported scope id 集合，供 toRuleBlockMetadata silent-skip
    const specScopes = input.canonicalSpec.orchestration?.scopes ?? []
    const supportedSymbolScopeIds = new Set<string>(
      specScopes.filter(s => s.scopeKind === 'symbol').map(s => s.id),
    )
    const supportedTimeframeScopeIds = new Set<string>(
      specScopes.filter(s => s.scopeKind === 'timeframe').map(s => s.id),
    )
    const supportedDataSourceScopeIds = new Set<string>(
      specScopes.filter(s => s.scopeKind === 'dataSource').map(s => s.id),
    )
    const supportedSubStrategyScopeIds = new Set<string>(
      specScopes.filter(s => s.scopeKind === 'subStrategy').map(s => s.id),
    )
    const supportedLegScopeIds = new Set<string>(
      (input.canonicalSpec.orchestration?.legScopes ?? []).map(l => l.id),
    )

    for (const rule of input.canonicalSpec.rules) {
      const riskPredicate = this.tryCompileRiskPredicate(rule, context)
      if (riskPredicate) {
        riskPredicates.push(this.withRuleSourcePath(riskPredicate, rule))
        continue
      }

      const partialTakeProfitBlock = this.tryCompileReduceActionRule(rule, input.canonicalSpec, input.fallback.positionPct, context)
      if (partialTakeProfitBlock) {
        ruleBlocks.push(this.withRuleBlockSourcePath(partialTakeProfitBlock, rule))
        continue
      }

      // action.add_position ghost-atom fix (#1251): validate required fields
      // before the rule reaches compileActions. Returns null on success (lets
      // the rule proceed through the normal ruleBlock path). Throws fail-closed
      // when addMode is absent/non-string or addRatio is out-of-range.
      this.tryCompileActionAddPosition(rule)

      const maxDrawdownRisk = this.tryCompileRiskMaxDrawdownPct(rule)
      if (maxDrawdownRisk) {
        rulePortfolioRisks.push(this.withRuleSourcePath(maxDrawdownRisk, rule))
        continue
      }

      const dailyLossRisk = this.tryCompileRiskDailyLossLimit(rule)
      if (dailyLossRisk) {
        rulePortfolioRisks.push(this.withRuleSourcePath(dailyLossRisk, rule))
        continue
      }

      const maxConcurrent = this.tryReadMaxConcurrentPositions(rule)
      if (maxConcurrent !== null) {
        maxConcurrentPositions = maxConcurrent
        continue
      }

      const reversePositionBlock = this.tryCompileActionReversePosition(
        rule,
        input.canonicalSpec,
        input.fallback.positionPct,
        context,
        supportedSymbolScopeIds,
        supportedLegScopeIds,
        supportedTimeframeScopeIds,
        supportedDataSourceScopeIds,
        supportedSubStrategyScopeIds,
      )
      if (reversePositionBlock) {
        ruleBlocks.push(reversePositionBlock)
        continue
      }

      const compiledGuards = this.tryCompileRiskGuards(rule, context)
      if (compiledGuards.length > 0) {
        guards.push(...compiledGuards.map(guard => this.withRuleSourcePath(guard, rule)))
        continue
      }

      if (hasOrderPrograms && this.isOrderProgramShadowRule(rule)) {
        continue
      }

      const when = this.compileCondition(rule.condition, context, rule.id)
      const actions = this.compileActions(rule, input.canonicalSpec, input.fallback.positionPct, context)
      if (actions.length === 0) {
        continue
      }
      this.collectPositionLifecycleRuntimeRequirements(rule, actions, context)
      const metadata = rule.metadata
        ? this.toRuleBlockMetadata(
            rule.metadata,
            supportedSymbolScopeIds,
            supportedLegScopeIds,
            supportedTimeframeScopeIds,
            supportedDataSourceScopeIds,
            supportedSubStrategyScopeIds,
          )
        : undefined

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

    const orchestrationScopes = this.compileOrchestrationScopes(input.canonicalSpec)
    const orchestrationLegScopes = this.compileOrchestrationLegScopes(input.canonicalSpec)
    const orchestrationGates = this.compileOrchestrationGates(input.canonicalSpec, context)
    const orchestrationPortfolioRisks = [
      ...this.compileOrchestrationPortfolioRisks(input.canonicalSpec, context),
      ...rulePortfolioRisks,
    ]
    const orchestrationPrograms = this.compileOrchestrationPrograms(input.canonicalSpec, orchestrationGates, context)

    const maxLookback = this.resolveMaxLookback(seriesMap)
    // Issue #1437：网格策略走 orchestration.programs（dynamic_grid / fixed_grid_gated /
    //   adaptive_volatility_grid）而非 orderPrograms；grid program 在 runtime 双向挂单，
    //   天然 long_short，但 rules.actions 中无 OPEN_LONG/SHORT。原推断只看 orderPrograms +
    //   rules → 网格 case 落 long_only，与 publication-gate 三方不一致。增加 grid 识别。
    const hasGridProgram = orchestrationPrograms.some(p => (GRID_PROGRAM_KINDS as ReadonlySet<string>).has(p.programKind))
    // 审查 Major #1：grid + orderPrograms 共存时仍优先 long_short（grid 双向语义覆盖
    //   orderPrograms 单边声明）。runtime 维护双向挂单 ⇒ 单边 orderProgram 在双向
    //   背景下仍只是其中一脚，全局 positionMode 应表达"能开两边"，与 publication-gate
    //   `readCanonicalPositionMode` 早返 grid → long_short 行为一致；三方对账无 drift。
    const positionMode = hasGridProgram
      ? 'long_short' as const
      : hasOrderPrograms
        ? this.resolveOrderProgramPositionMode(input.canonicalSpec.orderPrograms ?? [])
        : this.resolvePositionMode(input.canonicalSpec.rules)
    const lifecyclePyramiding = this.resolveLifecyclePyramiding(input.canonicalSpec.rules, context)

    // Issue #1457 闸 2 (review round 1 C1) — V2 生产管线 entry rule event-leaf invariant
    //   生产入口：identification of 状态谓词-only entry rule with bare OPEN_LONG/OPEN_SHORT
    //   动作 → reject 编译，强制策略提供事件性触发叶子（cross/touch/breakout 等）。
    //   闸内部仅对 OPEN_LONG/OPEN_SHORT 启用（持续加仓循环风险面）；ADD_*/REDUCE_*
    //   由 dca_schedule / addPosition lifecycle stateKey 兜底，闸跳过这些动作。
    if (hasOrderPrograms || lifecyclePyramiding.allow) {
      this.assertEntryRuleBlocksHaveEventLeaves(ruleBlocks, context)
    }

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
        maxConcurrentPositions,
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
      orchestrationPrograms,
      ...(orchestrationScopes.length > 0 ? { orchestrationScopes } : {}),
      ...(orchestrationLegScopes.length > 0 ? { orchestrationLegScopes } : {}),
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
        ...(intent.sourcePath ? { sourcePath: intent.sourcePath } : {}),
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
      const triggerPct = intent.levelSet.halfRangePct
      const levelSet: LevelSetDef = {
        id,
        kind: spacingMode,
        anchorRef: centerRef,
        spacing,
        levelsPerSide: {
          down: levelsBelowCenter,
          up: levelsAboveCenter,
        },
      }
      if (typeof triggerPct === 'number' && Number.isFinite(triggerPct) && triggerPct > 0) {
        levelSet.triggerPct = triggerPct
      }
      context.levelSetMap.set(id, levelSet)
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
    const aboveLower = this.insertPredicate(context.predicateMap, `${seed}_active_lower`, 'GTE', [closeRef, lowerRef])
    const belowUpper = this.insertPredicate(context.predicateMap, `${seed}_active_upper`, 'LTE', [closeRef, upperRef])
    return this.insertPredicate(context.predicateMap, `${seed}_active_range`, 'AND', [aboveLower, belowUpper])
  }

  private ensureOrderProgramActiveLevelSetPredicate(
    context: CompileContext,
    intent: CanonicalOrderProgramIntent,
    levelSetRef: string,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const seed = intent.id.replace(/\W+/g, '_')
    return this.insertPredicate(context.predicateMap, `${seed}_active_level_set`, 'WITHIN_LEVEL_SET', [closeRef, levelSetRef])
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
    const normalizedCondition = this.normalizeRsiReclaimConditionForCompile(condition)
    if (normalizedCondition !== condition) {
      return this.compileCondition(normalizedCondition, context, seed)
    }

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

  private normalizeRsiReclaimConditionForCompile(condition: CanonicalConditionNode): CanonicalConditionNode {
    if (condition.kind !== 'AND' && condition.kind !== 'OR' && condition.kind !== 'NOT') return condition

    const normalizedChildren = condition.children.map(child => this.normalizeRsiReclaimConditionForCompile(child))
    const normalizedGroup = normalizedChildren.every((child, index) => child === condition.children[index])
      ? condition
      : { ...condition, children: normalizedChildren }

    if (normalizedGroup.kind !== 'AND') return normalizedGroup

    const reclaim = this.findRsiReclaimSequence(normalizedGroup)
    if (!reclaim) return normalizedGroup

    const threshold = this.readNumber([reclaim.params?.threshold, reclaim.params?.value, reclaim.value], Number.NaN)
    if (!Number.isFinite(threshold)) return normalizedGroup

    const children = normalizedGroup.children.filter(child => !this.isRsiReclaimCompileNoise(child, threshold))
    if (children.length === normalizedGroup.children.length) return normalizedGroup
    if (children.length === 1) return children[0]!
    return { ...normalizedGroup, children }
  }

  private findRsiReclaimSequence(condition: CanonicalConditionNode): CanonicalConditionAtom | null {
    if (this.isRsiReclaimSequenceAtom(condition)) return condition
    if (condition.kind !== 'AND' && condition.kind !== 'OR' && condition.kind !== 'NOT') return null
    for (const child of condition.children) {
      const found = this.findRsiReclaimSequence(child)
      if (found) return found
    }
    return null
  }

  private isRsiReclaimSequenceAtom(condition: CanonicalConditionNode): condition is CanonicalConditionAtom {
    return this.isConditionAtom(condition)
      && condition.key === 'condition.sequence'
      && condition.params?.sequenceKind === 'rsi_reclaim'
  }

  private isRsiReclaimCompileNoise(condition: CanonicalConditionNode, reclaimThreshold: number): boolean {
    if (this.isRsiReclaimSequenceAtom(condition)) return false
    if (condition.kind === 'AND') {
      const leaves = this.collectCanonicalConditionLeaves(condition)
      return leaves.length > 0 && leaves.every(leaf => this.isRsiReclaimCompileNoiseLeaf(leaf, reclaimThreshold))
    }
    if (!this.isConditionAtom(condition)) return false
    return this.isRsiReclaimCompileNoiseLeaf(condition, reclaimThreshold)
  }

  private collectCanonicalConditionLeaves(condition: CanonicalConditionNode): CanonicalConditionAtom[] {
    if (this.isConditionAtom(condition)) return [condition]
    if (condition.kind !== 'AND' && condition.kind !== 'OR' && condition.kind !== 'NOT') return []
    return condition.children.flatMap(child => this.collectCanonicalConditionLeaves(child))
  }

  private isRsiReclaimCompileNoiseLeaf(condition: CanonicalConditionAtom, reclaimThreshold: number): boolean {
    if (condition.key === 'indicator.cross_over' && condition.params?.indicator === 'rsi') {
      const value = this.readNumber([condition.value, condition.params?.value, condition.params?.threshold], Number.NaN)
      return Number.isFinite(value) && Math.abs(value - reclaimThreshold) <= 1e-9
    }
    if (condition.key === 'indicator.threshold_lte' && condition.params?.indicator === 'rsi') {
      const value = this.readNumber([condition.value, condition.params?.value, condition.params?.threshold], Number.NaN)
      return Number.isFinite(value) && Math.abs(value - reclaimThreshold) <= 1e-9
    }
    if (condition.key === 'indicator.threshold_gte' && condition.params?.indicator === 'rsi') {
      const value = this.readNumber([condition.value, condition.params?.value, condition.params?.threshold], Number.NaN)
      return Number.isFinite(value) && Math.abs(value - 70) <= 1e-9 && Math.abs(value - reclaimThreshold) > 1e-9
    }
    return false
  }

  // Phase 5 S2 (#1104) + S3 (#1109) + S9 (#1110) + S10 (#1111): scope substrate IR compile
  // union: CanonicalOrchestrationSymbolScope | CanonicalOrchestrationTimeframeScope | CanonicalOrchestrationDataSourceScope | CanonicalOrchestrationSubStrategyScope
  private compileOrchestrationScopes(spec: CanonicalStrategySpecV2): IrOrchestrationScope[] {
    const scopes = spec.orchestration?.scopes ?? []
    return scopes
      // 裁剪 no-op timeframe scope：requiredTimeframes 去掉 primary 后为空时，
      // 该 scope 不施加任何跨周期对齐约束，却会让运行期对「未绑定 timeframeScopeRef
      // 的 decision program」一律 fail-closed NOOP（run-decision-programs.ts
      // applyTimeframeScopeAlignment: unbound_program），导致单周期策略零成交。
      .filter(scope => !this.isNoOpTimeframeScope(scope))
      .map((scope): IrOrchestrationScope => {
      switch (scope.scopeKind) {
        case 'symbol':
          return {
            id: scope.id,
            scopeKind: 'symbol',
            symbols: [...scope.symbols].sort(),
            ...(typeof scope.primarySymbol === 'string' && scope.primarySymbol.trim() !== ''
              ? { primarySymbol: scope.primarySymbol.trim() }
              : {}),
          }
        case 'leg':
          return {
            id: scope.id,
            scopeKind: 'leg',
            legId: scope.legId,
            direction: scope.direction,
            instrumentRef: scope.instrumentRef,
            ...(scope.legSizing
              ? {
                  legSizing: {
                    mode: scope.legSizing.mode,
                    value: scope.legSizing.value,
                    ...(typeof scope.legSizing.pairedLegId === 'string' && scope.legSizing.pairedLegId.trim() !== ''
                      ? { pairedLegId: scope.legSizing.pairedLegId.trim() }
                      : {}),
                  },
                }
              : {}),
            ...(scope.syncTriggerRequired === true ? { syncTriggerRequired: true } : {}),
          }
        case 'timeframe':
          return {
            id: scope.id,
            scopeKind: 'timeframe',
            primaryTimeframe: scope.primaryTimeframe,
            requiredTimeframes: [...scope.requiredTimeframes],
            alignmentPolicy: scope.alignmentPolicy,
          }
        case 'dataSource':
          return {
            id: scope.id,
            scopeKind: 'dataSource',
            role: scope.role,
            feedId: scope.feedId,
            schemaRef: scope.schemaRef,
          }
        case 'subStrategy':
          return {
            id: scope.id,
            scopeKind: 'subStrategy',
            subStrategyId: scope.subStrategyId,
            ...(typeof scope.subStrategyLabel === 'string' && scope.subStrategyLabel.trim() !== ''
              ? { subStrategyLabel: scope.subStrategyLabel.trim() }
              : {}),
            positionHandlingOnDeactivate: scope.positionHandlingOnDeactivate,
            orderHandlingOnDeactivate: scope.orderHandlingOnDeactivate,
          }
        default:
          throw new Error('codegen.orchestration_scope_unsupported')
      }
    })
  }

  // 单周期 timeframe scope（requiredTimeframes 仅含 primary 或为空）不构成真实跨周期
  // 对齐约束，属噪音 orchestration rule 产物，编译期直接剔除，避免运行期孤儿 fail-closed。
  private isNoOpTimeframeScope(scope: CanonicalOrchestrationScope): boolean {
    if (scope.scopeKind !== 'timeframe') return false
    const primary = scope.primaryTimeframe
    return scope.requiredTimeframes.every(tf => tf === primary)
  }

  // Phase 5 S11 (#1112): scope.leg substrate IR compile
  private compileOrchestrationLegScopes(spec: CanonicalStrategySpecV2): IrOrchestrationLegScope[] {
    const legScopes = spec.orchestration?.legScopes ?? []
    return legScopes.map((leg: CanonicalOrchestrationLegScope): IrOrchestrationLegScope => ({
      id: leg.id,
      scopeKind: 'leg',
      legId: leg.legId,
      direction: leg.direction,
      instrumentRef: leg.instrumentRef,
      ...(leg.legSizing
        ? {
            legSizing: {
              mode: leg.legSizing.mode,
              value: leg.legSizing.value,
              ...(typeof leg.legSizing.pairedLegId === 'string' && leg.legSizing.pairedLegId.trim() !== ''
                ? { pairedLegId: leg.legSizing.pairedLegId.trim() }
                : {}),
            },
          }
        : {}),
      ...(leg.syncTriggerRequired === true ? { syncTriggerRequired: true } : {}),
    }))
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
        ...(gate.sourcePath ? { sourcePath: gate.sourcePath } : {}),
        exprId,
        target: gate.target,
        effectWhenFalse: gate.effectWhenFalse,
      }
    })
  }

  /**
   * Phase 5 S8 (#1119): portfolioRisk union 三变体直透传
   *   - scope='portfolio' (drawdown_block, S7) — thresholdPct 透传
   *   - scope='symbol'    (symbol_exposure_cap) — notionalCapPct + symbolScopeRef 透传
   *   - scope='subStrategy' (substrategy_exposure_cap) — notionalCapPct + subStrategyScopeRef 透传
   *
   * byte-equal 兼容：旧 spec 仅 drawdown_block 路径输出与 S7 字面等价（无新字段污染）。
   */
  private compileOrchestrationPortfolioRisks(
    spec: CanonicalStrategySpecV2,
    context: CompileContext,
  ): IrOrchestrationPortfolioRisk[] {
    // Issue #1313 PR3：per-risk emit 沉淀至
    //   ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].emit.orchestrationPortfolioRiskShape
    //   （atom-contracts/atom-contract-orchestration-emits.ts，行为与原 inline body
    //    严格等价，Phase 5 S8 portfolioRisk union 三变体逐字段透传）。
    //   atom 实例是模板查询 key，运行期数据来自 spec.orchestration.portfolioRisks[]。
    const risks = spec.orchestration?.portfolioRisks ?? []
    if (risks.length === 0) return []
    const registryEntry = ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block']
    const emit = registryEntry.emit as AtomContractEmit
    const shape = emit.orchestrationPortfolioRiskShape
    if (!shape) return []
    const ctx = { compileContext: context, helpers: this.irHelpers }
    // `OrchestrationPortfolioRiskLikeInput` 仍是 `Readonly<Record<string, unknown>>`
    //   占位（PR2 / PR4 兼容）；shape 实现内部 cast 回 canonical union 类型。返回
    //   类型同样占位，dispatcher 端 cast 回 IR 真实类型聚合到 IR 输出。
    return (risks as readonly CanonicalOrchestrationPortfolioRisk[]).map(
      risk => shape(risk as unknown as Readonly<Record<string, unknown>>, ctx) as unknown as IrOrchestrationPortfolioRisk,
    )
  }

  private compileOrchestrationPrograms(
    spec: CanonicalStrategySpecV2,
    irGates: readonly IrOrchestrationGate[],
    context: CompileContext,
  ): IrOrchestrationProgram[] {
    const programs = spec.orchestration?.programs ?? []
    if (programs.length === 0) {
      return []
    }
    const gateRefToExprId = new Map(irGates.map(gate => [gate.id, gate.exprId]))
    const result: IrOrchestrationProgram[] = []
    for (const program of programs as readonly CanonicalOrchestrationProgram[]) {
      const exprId = this.resolveOrchestrationProgramActiveExprId(program, gateRefToExprId, context)
      if (exprId === undefined) {
        continue
      }
      if (program.programKind === 'fixed_grid_gated') {
        result.push({
          id: program.id,
          ...(program.sourcePath ? { sourcePath: program.sourcePath } : {}),
          programKind: 'fixed_grid_gated',
          activeWhenExprId: exprId,
          onDeactivate: program.onDeactivate,
          rebuildPolicy: 'static',
          gridParams: { ...program.gridParams },
          sizing: { ...program.sizing },
        })
        continue
      }
      // Phase 5 S5 (#984)
      if (program.programKind === 'dynamic_grid') {
        result.push({
          id: program.id,
          ...(program.sourcePath ? { sourcePath: program.sourcePath } : {}),
          programKind: 'dynamic_grid',
          activeWhenExprId: exprId,
          onDeactivate: program.onDeactivate,
          rebuildPolicy: 'anchor_on_state_change',
          dynamicGridParams: {
            ...program.dynamicGridParams,
            step: { ...program.dynamicGridParams.step },
          },
          sizing: { ...program.sizing },
        })
        continue
      }
      // Phase 5 S6 (#984)
      if (program.programKind === 'adaptive_volatility_grid') {
        result.push({
          id: program.id,
          ...(program.sourcePath ? { sourcePath: program.sourcePath } : {}),
          programKind: 'adaptive_volatility_grid',
          activeWhenExprId: exprId,
          onDeactivate: program.onDeactivate,
          rebuildPolicy: 'atr_window',
          adaptiveGridParams: { ...program.adaptiveGridParams },
          sizing: { ...program.sizing },
        })
        continue
      }
      // Phase 5 S12 (#1118)
      if (program.programKind === 'event_listener') {
        // 解引用 sourceRef → spec.orchestration.scopes[].feedId（找 scope.dataSource role='event'）
        const scopes = spec.orchestration?.scopes ?? []
        const dataSourceScope = scopes.find(
          (s): s is Extract<typeof s, { scopeKind: 'dataSource' }> =>
            s.scopeKind === 'dataSource' && s.id === program.sourceRef,
        )
        if (!dataSourceScope) continue
        if (dataSourceScope.role !== 'event') continue
        if (typeof dataSourceScope.feedId !== 'string' || dataSourceScope.feedId.length === 0) continue
        result.push({
          id: program.id,
          ...(program.sourcePath ? { sourcePath: program.sourcePath } : {}),
          programKind: 'event_listener',
          activeWhenExprId: exprId,
          onDeactivate: program.onDeactivate,
          rebuildPolicy: program.rebuildPolicy,
          eventSchemaRef: program.eventSchemaRef,
          sourceFeedId: dataSourceScope.feedId,
          permissionScope: program.permissionScope,
          idempotencyKey: { fieldPath: program.idempotencyKey.fieldPath },
          dedupWindowMs: program.dedupWindowMs,
          expirationTtlMs: program.expirationTtlMs,
          expirationPolicy: program.expirationPolicy,
        })
        continue
      }
      if (
        program.programKind === 'twap'
        || program.programKind === 'dca'
        || program.programKind === 'martingale'
        || program.programKind === 'rebalance'
        || program.programKind === 'iceberg'
      ) {
        result.push({
          id: program.id,
          ...(program.sourcePath ? { sourcePath: program.sourcePath } : {}),
          programKind: program.programKind,
          activeWhenExprId: exprId,
          onDeactivate: program.onDeactivate,
          rebuildPolicy: 'static',
          params: { ...program.params },
        })
        continue
      }
    }
    return result
  }

  private resolveOrchestrationProgramActiveExprId(
    program: CanonicalOrchestrationProgram,
    gateRefToExprId: ReadonlyMap<string, string>,
    context: CompileContext,
  ): string | undefined {
    if (typeof program.activeWhenRef === 'string' && program.activeWhenRef.trim().length > 0) {
      return gateRefToExprId.get(program.activeWhenRef)
    }

    const one = this.ensureConstSeries(context, 1)
    return this.upsertPredicate(
      context.predicateMap,
      `orchestration_program_${program.id}_always_active`,
      'EQ',
      [one, one],
    )
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

  /**
   * Issue #1494 — AtomExpr leaf 接入 atom-emit registry
   *
   * 把 SemanticRule.condition (AtomExpr 树) 递归归约为 PredicateDef.id。
   *   - and  → allOf
   *   - or   → anyOf
   *   - not  → NOT
   *   - sequence → sequence（withinBars / nextBarOnly 编码进 params）
   *   - atom → 适配为 CanonicalConditionAtom 后 delegate 到 `compileAtom`，
   *     由 ATOM_CONTRACT_REGISTRY `emit.irShape`（pr3a-condition）或 legacy switch 兜底；
   *     未注册 atom 触发 `codegen.canonical_spec_v2_condition_unsupported:<key>` fail-closed。
   *
   * #1395 时代的 `const(1) === const(1)` 占位逻辑已移除：表达式树骨架仍由
   * and/or/not/sequence 分支保持；leaf 行为与 CanonicalConditionAtom 完全等价。
   */
  private compileAtomExpr(
    expr: import('../types/atom-expr').AtomExpr,
    context: CompileContext,
    seed: string,
  ): string {
    switch (expr.kind) {
      case 'atom': {
        // 契约守门（#1494-M3）：本 case 不做 REGISTRY 预检；leaf 是否可编译由 compileAtom
        // 自身负责——`ATOM_CONTRACT_REGISTRY[key].emit.irShape === 'pr3a-condition'` 走
        // REGISTRY emit dispatch，其余 atom 命中 compileAtom 内 legacy switch；两者都
        // 不命中 → compileAtom default 分支抛 `codegen.canonical_spec_v2_condition_unsupported:<key>`
        // (参见同文件 default case)。此错误码字符串是「未注册 atom」的稳定契约，被
        // `services/__tests__/compile-atom-expr-leaf-dispatch.spec.ts` 显式守门
        // （`__test.unsupported_atom` case）；任何重构禁止改写或吞掉此字符串。
        //
        // 为什么不在此处加 REGISTRY/legacy-switch 并行白名单？compileAtom switch 是 source
        // of truth，并行白名单只会引入 DRY 漂移风险——legacy case 增减需双改两处。
        const atom = this.atomExprAtomToConditionAtom(expr)
        return this.compileAtom(atom, context, seed)
      }
      case 'and':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_and`,
          'allOf',
          expr.children.map((child, i) => this.compileAtomExpr(child, context, `${seed}_a${i}`)),
        )
      case 'or':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_or`,
          'anyOf',
          expr.children.map((child, i) => this.compileAtomExpr(child, context, `${seed}_o${i}`)),
        )
      case 'not':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_not`,
          'NOT',
          [this.compileAtomExpr(expr.child, context, `${seed}_n`)],
        )
      case 'sequence': {
        const params: Record<string, number | boolean> = {}
        if (typeof expr.withinBars === 'number') params.withinBars = expr.withinBars
        if (typeof expr.nextBarOnly === 'boolean') params.nextBarOnly = expr.nextBarOnly
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_seq`,
          'sequence',
          expr.steps.map((step, i) => this.compileAtomExpr(step, context, `${seed}_s${i}`)),
          Object.keys(params).length > 0 ? params : undefined,
        )
      }
    }
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

  /**
   * Issue #1494 — AtomExpr leaf → CanonicalConditionAtom 适配器
   *
   * AtomExprAtom 只携带 `key` / `params` / `sideScope`；CanonicalConditionAtom
   * 额外有 `op` / `value` 两个顶层字段（threshold 类 atom emit body 直读）。
   * 调用方约定把 `op` / `value` 放进 AtomExprAtom.params（旧 spec / planner 流
   * 把它们顶在 CanonicalConditionAtom 自身）；此处把它们拎到顶层、其余 params
   * 透传，保证 emit.irShape `helpers.readNumber([atom.value, ...])` 与
   * `helpers.resolveComparisonKind(atom.op)` 行为与 spec-v2 入口完全等价。
   *
   * `params` 是 `Record<string, unknown>`，需要把非 primitive（含 object / null /
   * undefined）剔掉以匹配 `CanonicalConditionAtom.params` 的窄类型
   * （`Record<string, number | string | boolean>`）。
   */
  /**
   * Issue #1494 — `op` 字段白名单。
   *
   * `CanonicalConditionAtom['op']` 是窄字面量联合（`'EQ' | 'LTE' | 'GTE' |
   * 'CROSS_OVER' | 'CROSS_UNDER' | 'GT' | 'LT'`）。adapter 收到的 `params.op`
   * 是 `unknown`，旧实现 `v as CanonicalConditionAtom['op']` 把任意字符串硬转
   * 进联合，绕过编译期检查。改成显式白名单后非法值会保持 `op = undefined`，
   * 由下游 `resolveComparisonKind` 默认分支兜底（返回 `'GTE'`）。
   */
  private static readonly VALID_CONDITION_ATOM_OPS: ReadonlySet<NonNullable<CanonicalConditionAtom['op']>>
    = new Set(['EQ', 'LTE', 'GTE', 'CROSS_OVER', 'CROSS_UNDER', 'GT', 'LT'])

  private atomExprAtomToConditionAtom(
    expr: import('../types/atom-expr').AtomExprAtom,
  ): CanonicalConditionAtom {
    const raw = expr.params ?? {}
    const params: Record<string, number | string | boolean> = {}
    let op: CanonicalConditionAtom['op']
    let value: CanonicalConditionAtom['value']
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v !== 'number' && typeof v !== 'string' && typeof v !== 'boolean') {
        // Issue #1494 M2 — 当前 condition emit 范围内 params 全为 primitive，无回归；
        // PR3d/PR3e 接入 action / risk atom 时 params 会含嵌套对象（如 `levels: { tp1, tp2 }`），
        // 静默 `continue` 会丢数据。这里记一条结构化 warn 暴露调用点，便于后续
        // 升级 CanonicalConditionAtom.params 类型或换 adapter。
        this.logger.warn(
          `[#1494] atomExprAtomToConditionAtom dropping non-primitive param: atomKey=${expr.key} paramKey=${k} valueType=${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`,
        )
        continue
      }
      if (k === 'op') {
        if (
          typeof v === 'string'
          && CanonicalSpecV2IrCompilerService.VALID_CONDITION_ATOM_OPS.has(
            v as NonNullable<CanonicalConditionAtom['op']>,
          )
        ) {
          op = v as CanonicalConditionAtom['op']
        }
        continue
      }
      if (k === 'value') {
        value = v
        continue
      }
      params[k] = v
    }
    const atom: CanonicalConditionAtom = { kind: 'atom', key: expr.key, params }
    if (op !== undefined) atom.op = op
    if (value !== undefined) atom.value = value
    return atom
  }

  private compileAtom(atom: CanonicalConditionAtom, context: CompileContext, seed: string): string {
    const closeRef = this.ensurePriceSeries(context, 'close')

    // Issue #1279 PR3a Phase 2：condition predicate 类 atom 已迁移至 atom-contract-registry
    //   `emit.irShape` 真实实现。命中 'pr3a-condition' 状态的 atom 走 REGISTRY 调度；
    //   未迁移的 atom（包括重命名前的旧 key，如 `price.change_pct` / `rsi.threshold_*` /
    //   `ma.golden_cross` / `breakout.channel_*_break`）继续走下方 legacy switch 兜底，
    //   100% 行为不变。
    //
    // 类型注：CompletedPr1bRegistry 在所有 atom 均为 stub 时把 `capabilityStatus` 收窄为
    //   `'pr1b-stub'` 字面量，直接 `=== 'pr3a-condition'` 会触发 TS2367；通过
    //   AtomContractEmit 父类型拓宽再做运行时分流，等迁移完成后字面量联合会自然回退。
    // TODO Issue #1279 PR3d/PR3e：当 action/risk/portfolio atom 也走 REGISTRY 真实兑现后，
    //   capabilityStatus 字面量联合会自然包含 'pr3a-condition'，此处的 `as AtomContractEmit`
    //   拓宽 cast 应一并移除。
    const registryEntry = ATOM_CONTRACT_REGISTRY[atom.key as AtomContractKey]
    const emit = registryEntry?.emit as AtomContractEmit | undefined
    if (emit?.capabilityStatus === 'pr3a-condition') {
      return emit.irShape(atom, this.buildAtomIrShapeContext(context, seed, closeRef))
    }

    switch (atom.key) {
      case 'strategy.time_window': {
        const timezone = typeof atom.params?.timezone === 'string' ? atom.params.timezone : null
        const windowsRaw = atom.params?.windows
        if (!timezone || typeof windowsRaw !== 'string') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:windows`)
        }
        let parsedWindows: Array<{ daysOfWeek?: number[]; start: string; end: string }>
        try {
          const parsed = JSON.parse(windowsRaw)
          if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('empty')
          }
          parsedWindows = parsed
        }
        catch {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:windows`)
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
        const period = this.readNumber([atom.params?.['reference.period'], atom.params?.period], NaN)
        const fastPeriod = this.readNumber([atom.params?.fastPeriod], NaN)
        const slowPeriod = this.readNumber([atom.params?.slowPeriod], NaN)
        if ((atom.params?.priceCross === true && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(period) && (!Number.isFinite(fastPeriod) || fastPeriod === period))) {
          const referencePeriod = Number.isFinite(period) ? period : fastPeriod
          const kind = typeof atom.params?.indicator === 'string' && atom.params.indicator.toLowerCase() === 'sma' ? 'SMA' : 'EMA'
          const closeRef = this.ensurePriceSeries(context, 'close')
          const ref = this.ensureIndicatorSeries(context, kind, referencePeriod, context.timeframe)
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_price_${referencePeriod}`,
            atom.key === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER',
            [closeRef, ref],
          )
        }
        const movingAverage = this.resolveMovingAverageAtomConfig(atom, context.movingAverage)
        const fastRef = this.ensureMovingAverageSeries(context, movingAverage.kind, movingAverage.fast)
        const slowRef = this.ensureMovingAverageSeries(context, movingAverage.kind, movingAverage.slow)
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
        const indicatorSeed = this.indicatorComparePredicateSeed(atom, timeframe)
        const leftRef = this.resolveIndicatorCompareLeftRef(context, atom, timeframe)
        const rightRef = this.ensureIndicatorReferenceSeries(context, atom, timeframe)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${indicatorSeed}`,
          atom.key === 'indicator.above' ? 'GTE' : 'LTE',
          [leftRef, rightRef],
        )
      }

      case 'price.detect.indicator_boundary': {
        const indicator = this.readNestedParam(atom.params, 'indicator', 'name') ?? atom.params?.indicator
        if (typeof indicator !== 'string' || indicator.toLowerCase() !== 'bollinger') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:indicator`)
        }
        const boundaryRole = this.readStringParam(atom.params?.boundaryRole)
          ?? this.readStringParam(atom.params?.boundary)
        const confirmationMode = this.readStringParam(atom.params?.confirmationMode)
        const period = this.readOptionalNumber(this.readNestedParam(atom.params, 'indicator', 'period'))
          ?? this.readOptionalNumber(atom.params?.period)
        const stdDev = this.readOptionalNumber(this.readNestedParam(atom.params, 'indicator', 'stdDev'))
          ?? this.readOptionalNumber(atom.params?.stdDev)
          ?? this.readOptionalNumber(atom.params?.multiplier)
        const bandParams = {
          ...(period !== null ? { period } : {}),
          ...(stdDev !== null ? { stdDev } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        }
        context.runtimeRequirements.helpers.add('bollinger')
        if (boundaryRole === 'upper' || boundaryRole === 'lower') {
          const direction: BandTouchDirection = boundaryRole
          const bandRef = direction === 'upper'
            ? this.ensureBollingerSeries(context, 'UPPER_BAND', bandParams)
            : this.ensureBollingerSeries(context, 'LOWER_BAND', bandParams)
          const rawMode = readBandTouchConfirmationMode(bandParams)
          const mode = rawMode ?? (atom.op === undefined ? 'touch' : undefined)
          return compileBandTouchPredicate({
            direction,
            confirmationMode: mode,
            bandRef,
            priceRefs: {
              close: closeRef,
              high: mode === 'touch' && direction === 'upper' ? this.ensurePriceSeries(context, 'high') : closeRef,
              low: mode === 'touch' && direction === 'lower' ? this.ensurePriceSeries(context, 'low') : closeRef,
            },
            defaultOp: atom.op,
            predicateMap: context.predicateMap,
            seed: `${seed}_${atom.key.replace(/\./g, '_')}_${boundaryRole}`,
            upsertPredicate: (predicateMap, baseId, kind, args, params) =>
              this.upsertPredicate(predicateMap, baseId, kind, args, params),
          })
        }
        if (boundaryRole === 'middle') {
          const midRef = this.ensureBollingerSeries(context, 'MID_BAND', bandParams)
          const over = this.upsertPredicate(context.predicateMap, `${seed}_indicator_boundary_middle_over`, 'CROSS_OVER', [closeRef, midRef])
          const under = this.upsertPredicate(context.predicateMap, `${seed}_indicator_boundary_middle_under`, 'CROSS_UNDER', [closeRef, midRef])
          return this.upsertPredicate(context.predicateMap, `${seed}_indicator_boundary_middle`, 'OR', [over, under])
        }
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:boundaryRole`)
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

      // Issue #1403 子故障 C — volume.threshold 在 condition-predicate 路径上的 emit 分支。
      //   #1396 B4 仅兑现了 condition.sequence / price.previous_extrema_retest /
      //   risk.atr_take_profit；volume.threshold 之前只在 phase=gate + BLOCK_NEW_ENTRY
      //   组合下走 compilePhase1GateAtom（L3335），entry-predicate（如 S4 BOLL 下轨 AND
      //   量×1.5）落在 compileAtom 默认分支，抛 codegen.canonical_spec_v2_condition_unsupported:volume.threshold。
      //
      // 与 compilePhase1GateAtom 路径的关键差异（审查 M4 集中说明）：
      //   - Entry-predicate（本路径）：op 直用 resolveComparisonKind(atom.op)。
      //     语义是 signal-emit——「volume > threshold 时信号触发」，op 即 predicate op。
      //   - Gate（L3335，compilePhase1GateAtom）：predicateKind 走 flipGateOperator(userOp)。
      //     语义是 BLOCK_NEW_ENTRY——「volume > threshold 时阻断入场」，predicate 触发即
      //     阻断，需要把用户语义的"满足条件就允许入场"反转为"满足条件就阻断"。
      //   两条路径的 op 处理差异是领域语义要求，不是 bug。
      //
      // 参数语义：
      //   - mode = 'relative_to_sma' + Number.isFinite(multiplier) → volume OP (multiplier × sma_volume(refWindow))
      //     等价于 volume.relative_average，复用 ensureSmaVolumeSeries 把 multiplier 编进 series id。
      //   - mode = 'absolute'（或缺省）+ atom.value 是有限正数 → volume OP const(value)。
      //   - 审查 M4 fail-closed：absolute 模式 atom.value 缺失/NaN/<=0 时显式抛 fail-closed，
      //     避免静默生成 `volume > 0` 这种恒真 predicate（策略安全风险）。
      //   - timeframe 缺省取 context.timeframe，与 volume.relative_average 对齐。
      case 'volume.threshold': {
        const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
          ? atom.params.timeframe.trim()
          : context.timeframe
        const volumeRef = this.ensureVolumeSeries(context, timeframe)
        const op = this.resolveComparisonKind(atom.op ?? 'GT')
        const mode = typeof atom.params?.mode === 'string' ? atom.params.mode : undefined
        const multiplier = this.readNumber([atom.params?.multiplier], Number.NaN)
        const refWindow = this.readNumber([atom.params?.refWindow], 20)
        const isRelative = mode === 'relative_to_sma' && Number.isFinite(multiplier)

        let rightRef: string
        if (isRelative) {
          rightRef = this.ensureSmaVolumeSeries(context, refWindow, multiplier, timeframe)
        }
        else {
          // 审查 M4 修复：absolute 模式缺 value 不再退化为 const(0) 恒真，显式 fail-closed。
          const absoluteValue = this.readNumber([atom.value], Number.NaN)
          if (!Number.isFinite(absoluteValue) || absoluteValue <= 0) {
            throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:value`)
          }
          rightRef = this.ensureConstSeries(context, absoluteValue)
        }
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
          'compare',
          [volumeRef, rightRef],
          { op },
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
        const macd = this.resolveMacdAtomConfig(atom, context.macd, 'codegen.canonical_spec_v2_macd_cross')
        const macdLineRef = this.ensureMacdSeries(context, 'MACD_LINE', context.timeframe, macd)
        const macdSignalRef = this.ensureMacdSeries(context, 'MACD_SIGNAL', context.timeframe, macd)
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

      case 'pattern.range': {
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_pattern_range`,
          'compare',
          [],
          {
            op: 'EQ',
            mode: typeof atom.params?.mode === 'string' ? atom.params.mode : 'inside_range',
            lowerRole: typeof atom.params?.lowerRole === 'string' ? atom.params.lowerRole : 'range_low',
            upperRole: typeof atom.params?.upperRole === 'string' ? atom.params.upperRole : 'range_high',
            lookbackBars: this.readNumber([atom.params?.lookbackBars], 48),
            ...(typeof atom.params?.timeframe === 'string' ? { timeframe: atom.params.timeframe } : {}),
          },
        )
      }

      case 'external.signal': {
        const provider = typeof atom.params?.provider === 'string'
          ? atom.params.provider.trim().toLowerCase()
          : 'webhook'
        const signalId = typeof atom.params?.signalId === 'string'
          ? atom.params.signalId.trim()
          : null
        const secret = typeof atom.params?.secret === 'string'
          ? atom.params.secret.trim()
          : 'configured'
        if (provider !== 'webhook' || !signalId || signalId === 'REQUIRED_SIGNAL_ID' || secret !== 'configured') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}`)
        }
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_external_signal_${signalId}`,
          'externalSignal',
          [],
          { provider, signalId, secret, sourceFeedId: `webhook.${signalId}`, ttlMs: 60_000 },
        )
      }

      case 'orderbook.imbalance':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_orderbook_imbalance`,
          'orderbookImbalance',
          [],
          this.buildMarketDataPredicateParams(atom, 'orderbook', 'orderbook.imbalance'),
        )

      case 'fundingRate.condition':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_funding_rate_condition`,
          'fundingRateCondition',
          [],
          this.buildMarketDataPredicateParams(atom, 'funding', 'funding.rate'),
        )

      case 'openInterest.condition':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_open_interest_condition`,
          'openInterestCondition',
          [],
          this.buildMarketDataPredicateParams(atom, 'open_interest', 'open_interest'),
        )

      case 'liquidation.condition':
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_liquidation_condition`,
          'liquidationCondition',
          [],
          this.buildMarketDataPredicateParams(atom, 'liquidation', 'liquidation.events'),
        )

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
      case 'bollinger.lower_break':
      case 'bollinger.touch_upper':
      case 'bollinger.touch_lower': {
        context.runtimeRequirements.helpers.add('bollinger')
        const direction: BandTouchDirection =
          atom.key === 'bollinger.upper_break' || atom.key === 'bollinger.touch_upper' ? 'upper' : 'lower'
        const bandRef = direction === 'upper'
          ? this.ensureBollingerSeries(context, 'UPPER_BAND', atom.params)
          : this.ensureBollingerSeries(context, 'LOWER_BAND', atom.params)
        const isTouchKey = atom.key === 'bollinger.touch_upper' || atom.key === 'bollinger.touch_lower'
        // touch_* 系 key 在 confirmationMode 缺省 且未显式传 atom.op 时默认 'touch'，与
        // #1444 引入 touch_* 时的 happy path 语义保持一致；upper_break / lower_break 维持
        // helper 内的 breakout 默认（CROSS_*）。显式传 atom.op 时（如 op=GT）尊重 defaultOp 通路，
        // 避免被默认 touch 语义覆盖。
        const rawMode = readBandTouchConfirmationMode(atom.params)
        const confirmationMode = rawMode ?? (isTouchKey && atom.op === undefined ? 'touch' : undefined)
        const highRef = confirmationMode === 'touch' && direction === 'upper'
          ? this.ensurePriceSeries(context, 'high')
          : closeRef
        const lowRef = confirmationMode === 'touch' && direction === 'lower'
          ? this.ensurePriceSeries(context, 'low')
          : closeRef
        return compileBandTouchPredicate({
          direction,
          confirmationMode,
          bandRef,
          priceRefs: { close: closeRef, high: highRef, low: lowRef },
          defaultOp: atom.op,
          predicateMap: context.predicateMap,
          seed: `${seed}_${atom.key.replace(/\./g, '_')}`,
          upsertPredicate: (predicateMap, baseId, kind, args, params) =>
            this.upsertPredicate(predicateMap, baseId, kind, args, params),
        })
      }

      case 'bollinger.middle_revert':
      case 'bollinger.touch_middle': {
        context.runtimeRequirements.helpers.add('bollinger')
        const midRef = this.ensureBollingerSeries(context, 'MID_BAND', atom.params)
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
          this.normalizeRiskGuardPctThreshold(
            this.readNumber([atom.value, atom.params?.valuePct], Number.NaN),
            'canonical_spec_v2_position_loss_pct_invalid_pct',
            seed,
          ),
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

      // Issue #1498 S1 — dispatched-via CONDITION_ATOM_EMITS['condition.sequence']
      //   主路径在 atom-contract-condition-emits.ts；下方 legacy case 保留作 fail-safe 兜底
      //   （与 #1494 同 pattern；ATOM_CONTRACT_REGISTRY 注册校验由 condition-emit-dispatch.spec 守门）。
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

        // Issue #1395 — 三种新 sequenceKind 真实兑现：consecutive_body /
        //   breakout_then_retest / pattern_then_volume_spike。各 step 实测可参与
        //   compiled-runtime evaluateGenericSequence。
        const direction = atom.params?.direction === 'down' ? 'down' : 'up'
        const openRef = this.ensurePriceSeries(context, 'open')
        const seqParamsNew: Record<string, number | string | boolean> = { sequenceKind }
        if (typeof atom.params?.withinBars === 'number' && atom.params.withinBars > 0) {
          seqParamsNew.withinBars = atom.params.withinBars
        }
        const nextBarOnlyRaw = atom.params?.nextBarOnly
        if (nextBarOnlyRaw === true || nextBarOnlyRaw === 'true') {
          seqParamsNew.nextBarOnly = true
        }
        if (typeof atom.params?.direction === 'string') {
          seqParamsNew.direction = atom.params.direction
        }
        const memoryKeyNew = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
          ? atom.params.memoryKey.trim()
          : null
        if (memoryKeyNew && memoryKeyNew !== 'auto') {
          context.runtimeRequirements.stateKeys.add(memoryKeyNew)
        }

        if (sequenceKind === 'consecutive_body') {
          const count = this.readNumber([atom.params?.count], 3)
          if (!Number.isInteger(count) || count <= 0) {
            throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:count`)
          }
          const steps: string[] = []
          for (let i = 0; i < count; i += 1) {
            steps.push(this.upsertPredicate(
              context.predicateMap,
              `${seed}_seq_body_${direction}_${i}`,
              direction === 'down' ? 'LT' : 'GT',
              [closeRef, openRef],
            ))
          }
          seqParamsNew.count = count
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
            'sequence',
            steps,
            seqParamsNew,
          )
        }

        if (sequenceKind === 'breakout_then_retest') {
          const lookback = this.readNumber([atom.params?.lookbackBars], 24)
          if (!Number.isInteger(lookback) || lookback <= 0) {
            throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:lookbackBars`)
          }
          const isUp = direction === 'up'
          const channelRef = isUp
            ? this.ensureChannelSeries(context, 'HIGHEST_HIGH', lookback)
            : this.ensureChannelSeries(context, 'LOWEST_LOW', lookback)
          context.runtimeRequirements.helpers.add(isUp ? 'rollingHigh' : 'rollingLow')
          const breakoutStep = this.upsertPredicate(
            context.predicateMap,
            `${seed}_seq_breakout_${direction}_${lookback}`,
            isUp ? 'GT' : 'LT',
            [closeRef, channelRef],
          )
          const retestStep = this.upsertPredicate(
            context.predicateMap,
            `${seed}_seq_retest_${direction}_${lookback}`,
            isUp ? 'GTE' : 'LTE',
            [closeRef, channelRef],
          )
          seqParamsNew.lookbackBars = lookback
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
            'sequence',
            [breakoutStep, retestStep],
            seqParamsNew,
          )
        }

        if (sequenceKind === 'pattern_then_volume_spike') {
          const lookback = this.readNumber([atom.params?.lookbackBars], 20)
          const count = this.readNumber([atom.params?.count], 1)
          const volumeRef = this.ensureVolumeSeries(context, context.timeframe)
          const smaVolRef = this.ensureSmaVolumeSeries(context, lookback, 1, context.timeframe)
          if (!Number.isInteger(count) || count <= 0) {
            throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:count`)
          }
          const steps: string[] = []
          for (let i = 0; i < count; i += 1) {
            steps.push(this.upsertPredicate(
              context.predicateMap,
              `${seed}_seq_pattern_${direction}_${i}`,
              direction === 'down' ? 'LT' : 'GT',
              [closeRef, openRef],
            ))
          }
          const reboundDirection = typeof atom.params?.reboundDirection === 'string'
            ? atom.params.reboundDirection
            : null
          if (reboundDirection === 'up' || reboundDirection === 'down') {
            steps.push(this.upsertPredicate(
              context.predicateMap,
              `${seed}_seq_rebound_${reboundDirection}`,
              reboundDirection === 'down' ? 'LT' : 'GT',
              [closeRef, openRef],
            ))
          }
          const volumeStep = this.upsertPredicate(
            context.predicateMap,
            `${seed}_seq_volume_spike_${lookback}`,
            'compare',
            [volumeRef, smaVolRef],
            { op: 'GTE' },
          )
          steps.push(volumeStep)
          seqParamsNew.lookbackBars = lookback
          seqParamsNew.count = count
          return this.upsertPredicate(
            context.predicateMap,
            `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
            'sequence',
            steps,
            seqParamsNew,
          )
        }

        // 兜底：未知 sequenceKind / 仅做占位（保持 #1395 之前的向后兼容行为）
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
            ...(memoryKeyNew ? { memoryKey: memoryKeyNew } : {}),
          },
        )
      }

      case 'indicator.divergence': {
        // P4-1: RSI / MACD 顶背离（bearish）/ 底背离（bullish）
        // IR 通过 INDICATOR_DIVERGENCE 系列 + 谓词封装 divergence predicate。
        // fail-closed：indicator / direction 非白名单值直接抛错，避免静默降级。
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
        // P4-2: 白名单 patterns（Issue #1391 后续加 single_bull_bar / single_bear_bar）
        // IR 通过 CANDLE_PATTERN 系列 + EQ predicate 封装 candle pattern 信号。
        // fail-closed：pattern / direction 非白名单值直接抛错，避免静默降级。
        // compiled-runtime 通过 candlePatternDetector 消费 CANDLE_PATTERN series，
        // backtest 与 live signal 共用 evaluateExprPool 路径。
        const cpPattern = typeof atom.params?.pattern === 'string'
          ? atom.params.pattern.trim().toLowerCase()
          : null
        if (
          cpPattern !== 'engulfing'
          && cpPattern !== 'hammer'
          && cpPattern !== 'doji'
          && cpPattern !== 'consecutive_body'
          && cpPattern !== 'single_bull_bar'
          && cpPattern !== 'single_bear_bar'
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

      case 'price.chart_pattern': {
        // P4-3: 白名单 4 patterns：head_and_shoulders / double_top / double_bottom / triangle
        // IR 通过 CHART_PATTERN 系列 + EQ predicate 封装图形形态信号。
        // fail-closed：pattern / direction 非白名单值直接抛错，runtime 由 shared compiled-runtime
        // 的 chartPatternDetector 基于 priceHighsLows pivot helper 统一评估。
        const chPattern = typeof atom.params?.pattern === 'string'
          ? atom.params.pattern.trim().toLowerCase()
          : null
        if (
          chPattern !== 'head_and_shoulders'
          && chPattern !== 'double_top'
          && chPattern !== 'double_bottom'
          && chPattern !== 'triangle'
        ) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:pattern`)
        }
        const chDirection = typeof atom.params?.direction === 'string'
          ? atom.params.direction.trim().toLowerCase()
          : null
        if (chDirection !== 'bullish' && chDirection !== 'bearish') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
        }
        const chDirectionPatternConflict = (chPattern === 'double_top' && chDirection !== 'bearish')
          || (chPattern === 'double_bottom' && chDirection !== 'bullish')
        if (chDirectionPatternConflict) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction_pattern_conflict`)
        }
        const chSeriesId = `chart_pattern_${chPattern}_${chDirection}_${context.timeframe}`
        if (!context.seriesMap.has(chSeriesId)) {
          context.seriesMap.set(chSeriesId, {
            id: chSeriesId,
            kind: 'CHART_PATTERN',
            timeframe: context.timeframe,
            params: {
              pattern: chPattern,
              direction: chDirection,
            },
          })
        }
        context.runtimeRequirements.helpers.add('chartPatternDetector')
        const constOneRef = this.ensureConstSeries(context, 1)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_chart_pattern_${chPattern}_${chDirection}`,
          'EQ',
          [chSeriesId, constOneRef],
        )
      }

      case 'liquidity.sweep': {
        // P4-4: 白名单方向 (bullish/bearish) + 4 reference (prev_low/prev_high/session_low/session_high)。
        // IR 通过 LIQUIDITY_SWEEP 系列 + EQ predicate 封装流动性扫荡信号。
        // fail-closed：direction / reference 非白名单值直接抛错；reclaimBars 默认 3。
        // compiled-runtime 消费同名 series，通过 liquiditySweepDetector 输出 1/0 供 EQ predicate 使用。
        const lsDirection = typeof atom.params?.direction === 'string'
          ? atom.params.direction.trim().toLowerCase()
          : null
        if (lsDirection !== 'bullish' && lsDirection !== 'bearish') {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
        }
        const lsReference = typeof atom.params?.reference === 'string'
          ? atom.params.reference.trim().toLowerCase()
          : null
        if (
          lsReference !== 'prev_low'
          && lsReference !== 'prev_high'
          && lsReference !== 'session_low'
          && lsReference !== 'session_high'
        ) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:reference`)
        }
        // critic round 1 A2 修复：IR 层拒绝 SMC 语义不可能的 direction × reference 组合
        const lsImpossibleCombo = (lsDirection === 'bullish' && (lsReference === 'prev_high' || lsReference === 'session_high'))
          || (lsDirection === 'bearish' && (lsReference === 'prev_low' || lsReference === 'session_low'))
        if (lsImpossibleCombo) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction_reference_conflict`)
        }
        const lsReclaimBars = typeof atom.params?.reclaimBars === 'number'
          && Number.isInteger(atom.params.reclaimBars)
          && atom.params.reclaimBars > 0
          ? atom.params.reclaimBars
          : LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS
        const lsSeriesId = `liquidity_sweep_${lsDirection}_${lsReference}_${lsReclaimBars}_${context.timeframe}`
        if (!context.seriesMap.has(lsSeriesId)) {
          context.seriesMap.set(lsSeriesId, {
            id: lsSeriesId,
            kind: 'LIQUIDITY_SWEEP',
            timeframe: context.timeframe,
            params: {
              direction: lsDirection,
              reference: lsReference,
              reclaimBars: lsReclaimBars,
            },
          })
        }
        context.runtimeRequirements.helpers.add('liquiditySweepDetector')
        const constOneRef = this.ensureConstSeries(context, 1)
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_liquidity_sweep_${lsDirection}_${lsReference}_${lsReclaimBars}`,
          'EQ',
          [lsSeriesId, constOneRef],
        )
      }

      // Issue #1395 — price.previous_extrema_retest atom emit
      //   "突破后回踩不破" 语义 — 2 步 sequence：
      //     1) 突破 N 周期 high/low（close 越过 rolling extrema）
      //     2) 回踩到突破位 ±tolerance% 仍不破（close 仍位于突破位上/下方）
      //
      //   params：
      //     - retestKind: 'not_break'（默认）| 'break_through'
      //     - lookbackBars / window: rolling 窗口，默认 24
      //     - extremaType: 'high'（默认）| 'low'
      //     - tolerancePct / maxBars / memoryKey: 透传到 sequence params + stateKeys
      // Issue #1498 S2 — dispatched-via CONDITION_ATOM_EMITS['price.previous_extrema_retest']
      //   主路径在 atom-contract-condition-emits.ts；下方 legacy case 保留作 fail-safe 兜底。
      case 'price.previous_extrema_retest': {
        const lookback = this.readNumber([
          atom.params?.lookbackBars,
          atom.params?.window,
          atom.params?.period,
        ], 24)
        if (!Number.isInteger(lookback) || lookback <= 0) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:lookbackBars`)
        }
        const extremaType = atom.params?.extremaType === 'low' ? 'low' : 'high'
        const retestKindRaw = atom.params?.retestKind
        const retestKind = retestKindRaw === 'break_through' ? 'break_through' : 'not_break'
        const isHigh = extremaType === 'high'
        const channelRef = isHigh
          ? this.ensureChannelSeries(context, 'HIGHEST_HIGH', lookback)
          : this.ensureChannelSeries(context, 'LOWEST_LOW', lookback)
        context.runtimeRequirements.helpers.add(isHigh ? 'rollingHigh' : 'rollingLow')

        const breakoutStep = this.upsertPredicate(
          context.predicateMap,
          `${seed}_prev_extrema_breakout_${extremaType}_${lookback}`,
          isHigh ? 'GT' : 'LT',
          [closeRef, channelRef],
        )

        // retest step
        //   not_break: close 仍站稳突破位（GTE for high, LTE for low）
        //   break_through: close 已跌破/突破回突破位（LT for high, GT for low）
        let retestKindOp: PredicateDef['kind']
        if (retestKind === 'not_break') {
          retestKindOp = isHigh ? 'GTE' : 'LTE'
        }
        else {
          retestKindOp = isHigh ? 'LT' : 'GT'
        }
        const retestStep = this.upsertPredicate(
          context.predicateMap,
          `${seed}_prev_extrema_retest_${retestKind}_${extremaType}_${lookback}`,
          retestKindOp,
          [closeRef, channelRef],
        )

        const memoryKey = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
          ? atom.params.memoryKey.trim()
          : null
        if (memoryKey && memoryKey !== 'auto') {
          context.runtimeRequirements.stateKeys.add(memoryKey)
        }

        const seqParams: Record<string, number | string> = {}
        if (typeof atom.params?.maxBars === 'number' && atom.params.maxBars > 0) {
          seqParams.withinBars = atom.params.maxBars
        }
        if (typeof atom.params?.tolerancePct === 'number') {
          seqParams.tolerancePct = atom.params.tolerancePct
        }
        seqParams.extremaType = extremaType
        seqParams.retestKind = retestKind

        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${retestKind}_${extremaType}_${lookback}`,
          'sequence',
          [breakoutStep, retestStep],
          seqParams,
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

  private ensureMovingAverageSeries(context: CompileContext, kind: 'EMA' | 'SMA', period: number): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const prefix = kind.toLowerCase()
    const id = `${prefix}_${period}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
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
    const period = this.readNumber([this.readNestedParam(atom.params, 'reference', 'period'), atom.params?.['reference.period'], atom.params?.period], context.movingAverage.slow)

    if (indicator === 'ema') {
      return this.ensureIndicatorSeries(context, 'EMA', period, timeframe)
    }

    if (indicator === 'ma' || indicator === 'sma' || indicator.length === 0) {
      return this.ensureIndicatorSeries(context, 'SMA', period, timeframe)
    }

    throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:${indicator}`)
  }

  private indicatorComparePredicateSeed(
    atom: CanonicalConditionAtom,
    timeframe: string,
  ): string {
    const indicator = typeof atom.params?.indicator === 'string' && atom.params.indicator.trim().length > 0
      ? atom.params.indicator.trim().toLowerCase()
      : 'sma'
    const period = this.readNumber([this.readNestedParam(atom.params, 'reference', 'period'), atom.params?.['reference.period'], atom.params?.period], 0)
    return `${indicator}_${period}_${timeframe}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  }

  private resolveIndicatorCompareLeftRef(
    context: CompileContext,
    atom: CanonicalConditionAtom,
    timeframe: string,
  ): string {
    const ownPeriod = this.readOptionalNumber(atom.params?.period)
    const referencePeriod = this.readOptionalNumber(this.readNestedParam(atom.params, 'reference', 'period'))
      ?? this.readOptionalNumber(atom.params?.['reference.period'])
    if (ownPeriod === null || referencePeriod === null) {
      return this.ensurePriceSeries(context, 'close', timeframe)
    }

    const indicator = typeof atom.params?.indicator === 'string'
      ? atom.params.indicator.trim().toLowerCase()
      : ''
    if (indicator === 'ema') {
      return this.ensureIndicatorSeries(context, 'EMA', ownPeriod, timeframe)
    }
    if (indicator === 'ma' || indicator === 'sma' || indicator.length === 0) {
      return this.ensureIndicatorSeries(context, 'SMA', ownPeriod, timeframe)
    }
    return this.ensurePriceSeries(context, 'close', timeframe)
  }

  private resolveMovingAverageAtomConfig(
    atom: CanonicalConditionAtom,
    fallback: CompileContext['movingAverage'],
  ): CompileContext['movingAverage'] {
    const rawIndicator = this.readStringParam(atom.params?.indicator)?.toLowerCase()
    const kind = rawIndicator === 'sma' || rawIndicator === 'ma'
      ? 'SMA'
      : (rawIndicator === 'ema' ? 'EMA' : fallback.kind)
    const fast = this.readNumber([
      atom.params?.fast,
      atom.params?.short,
      atom.params?.fastPeriod,
    ], fallback.fast)
    const slow = this.readNumber([
      atom.params?.slow,
      atom.params?.long,
      atom.params?.slowPeriod,
      atom.params?.period,
    ], fallback.slow)

    return {
      kind,
      fast,
      slow: slow > fast ? slow : fast + 14,
    }
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
    params?: Record<string, unknown>,
  ): string {
    const closeRef = this.ensurePriceSeries(context, 'close')
    const period = this.readNumber([params?.period], context.bollinger.period)
    const stdDev = this.readNumber([params?.stdDev, params?.multiplier], context.bollinger.stdDev)
    const id = `${kind.toLowerCase()}_${period}_${this.normalizeNumberToken(stdDev)}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind,
        inputs: [closeRef],
        params: {
          period,
          stdDev,
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

  /**
   * Issue #1457 闸 2 (review round 1 C1)：V2 compiler 的 entry rule event-leaf invariant。
   *
   * 与 legacy CanonicalStrategyIrCompilerService.assertEntryRuleHasEventLeaf 等价：
   *   - 遍历每条 phase='entry' 的 ruleBlock 的 when 谓词树
   *   - leaf 全部为 'state' / 'NOT:event'（NOT 翻转视为 state）→ 抛 EntryRuleRequiresEventLeafException
   *   - 至少一个 'event' leaf → 放行
   *
   * 单一真相源：collectEntryRuleLeafKinds / leafKindsContainEvent（predicate-kind-temporality.ts）。
   *
   * review round 1 M4 注：atom 层 'structural' temporality（scope/action/risk/orchestration/
   *   positionConstraint）的 atom 由构造保证不会进入 SemanticRule.condition 谓词树，
   *   也就不会成为本判定的 leaf。compiler 层 invariant 不读 atom temporality（M1：
   *   两层语义独立），完全以 IR PredicateDef.kind 为准。
   */
  private assertEntryRuleBlocksHaveEventLeaves(
    ruleBlocks: readonly RuleBlock[],
    context: CompileContext,
  ): void {
    for (const block of ruleBlocks) {
      if (block.phase !== 'entry') continue
      if (!block.when) continue
      // 仅对带"裸 OPEN_LONG/OPEN_SHORT"动作的 entry rule 启用闸——这正是 #1457
      //   关注的"持续加仓循环"场景。ADD_LONG/ADD_SHORT/REDUCE_* 等 lifecycle
      //   动作由 dca_schedule maxCount / addPosition maxLayers / position.lifecycle
      //   stateKey 兜底，即便 entry rule 为纯状态也不会无限加仓。
      const opensRawPosition = block.actions.some(action =>
        action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT',
      )
      if (!opensRawPosition) continue
      if (block.metadata?.dcaSchedule) continue
      if (block.metadata?.addPosition) continue
      if (this.predicateTreeContainsExecutionOnStart(block.when, context.predicateMap)) continue
      const leafKinds = collectEntryRuleLeafKinds(block.when, context.predicateMap)
      if (leafKinds.length === 0) continue
      if (leafKindsContainEvent(leafKinds)) continue
      throw new EntryRuleRequiresEventLeafException({ ruleId: block.id, leafKinds })
    }
  }

  private predicateTreeContainsExecutionOnStart(
    rootPredicateId: string,
    predicateById: ReadonlyMap<string, PredicateDef>,
  ): boolean {
    const visited = new Set<string>()
    const visit = (predicateId: string): boolean => {
      if (visited.has(predicateId)) return false
      visited.add(predicateId)
      if (predicateId.includes('execution_on_start')) return true
      const predicate = predicateById.get(predicateId)
      if (!predicate) return false
      return predicate.args.some(arg => visit(arg))
    }
    return visit(rootPredicateId)
  }

  private upsertPredicate(
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ): string {
    const signature = this.buildPredicateSignature(kind, args, params)
    const existing = [...predicateMap.values()].find(predicate => {
      return this.buildPredicateSignature(predicate.kind, predicate.args, predicate.params) === signature
    })
    if (existing) {
      return existing.id
    }

    const id = this.resolveCollisionFreePredicateId(predicateMap, baseId, signature)
    predicateMap.set(id, {
      id,
      kind,
      args,
      ...(params ? { params } : {}),
    })
    return id
  }

  private insertPredicate(
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ): string {
    const signature = this.buildPredicateSignature(kind, args, params)
    const id = this.resolveCollisionFreePredicateId(predicateMap, baseId, `${baseId}:${signature}`)
    predicateMap.set(id, {
      id,
      kind,
      args,
      ...(params ? { params } : {}),
    })
    return id
  }

  private resolveCollisionFreePredicateId(
    predicateMap: ReadonlyMap<string, PredicateDef>,
    baseId: string,
    signature: string,
  ): string {
    const sanitized = baseId.replace(/\W+/g, '_')
    const current = predicateMap.get(sanitized)
    if (!current) {
      return sanitized
    }
    const currentSignature = this.buildPredicateSignature(current.kind, current.args, current.params)
    if (currentSignature === signature) {
      return sanitized
    }
    const hash = createHash('sha256').update(signature).digest('hex').slice(0, 12)
    return `${sanitized}_${hash}`
  }

  private buildPredicateSignature(
    kind: PredicateDef['kind'],
    args: readonly string[],
    params?: PredicateDef['params'],
  ): string {
    const paramsSignature = params ? JSON.stringify(Object.keys(params).sort().reduce<Record<string, number | string | boolean>>((acc, key) => {
      const value = params[key]
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {})) : ''
    return `${kind}:${args.join('|')}:${paramsSignature}`
  }

  private tryCompileRiskPredicate(rule: CanonicalRuleV2, context: CompileContext): RiskPredicateDef | null {
    if (rule.phase !== 'risk' || rule.condition.kind !== 'atom') {
      return null
    }

    // Issue #1498 S3：risk-level RiskPredicate 类 atom 走 REGISTRY 调度。命中
    //   `capabilityStatus === 'pr3e-risk-predicate'` + `emit.riskPredicateShape`
    //   的 atom（risk.atr_take_profit / risk.atr_multiple_stop /
    //   risk.atr_multiple_take_profit / risk.remembered_level_stop）走 REGISTRY shape；
    //   返回 null 时 fall-through 到下方 legacy switch 兜底（守门 100% 行为等价）。
    //   IR snapshot byte-equal 由 canonical-spec-v2-ir-compiler.service.spec.ts 与
    //   atom-contract-risk-predicate-emits.spec.ts 守门。
    const riskPredicateEntry = ATOM_CONTRACT_REGISTRY[rule.condition.key as AtomContractKey]
    const riskPredicateEmit = riskPredicateEntry?.emit as AtomContractEmit | undefined
    if (riskPredicateEmit?.capabilityStatus === 'pr3e-risk-predicate' && riskPredicateEmit.riskPredicateShape) {
      const predicate = riskPredicateEmit.riskPredicateShape(
        rule.condition,
        rule as unknown as Readonly<Record<string, unknown>>,
        {
          compileContext: context,
          helpers: this.irHelpers,
          seed: rule.id,
        },
        (r) => this.compileRiskPredicateActions(r as unknown as CanonicalRuleV2),
      )
      if (predicate !== null) {
        return predicate
      }
    }

    // dispatched-via RISK_PREDICATE_ATOM_EMITS['risk.atr_multiple_stop' / 'risk.atr_multiple_take_profit']
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

    // Issue #1395 — risk.atr_take_profit atom emit
    //   语义"达到 N 倍 ATR 止盈"。复用 atrMultipleTakeProfit RiskPredicateDef 形态。
    //   params：
    //     - period: ATR 计算周期（registry 默认 14）
    //     - multiple / multiplier: ATR 倍数（registry 必填）
    if (rule.condition.key === 'risk.atr_take_profit') {
      const multiple = this.readNumber(
        [rule.condition.params?.multiple, rule.condition.params?.multiplier],
        0,
      )
      if (multiple <= 0) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${rule.condition.key}:multiple`)
      }
      const period = this.readNumber([rule.condition.params?.period, rule.condition.params?.atrPeriod], 14)
      context.runtimeRequirements.helpers.add('atr')
      return {
        id: rule.id,
        kind: 'atrMultipleTakeProfit',
        params: { multiple, period },
        actions: this.compileRiskPredicateActions(rule),
      }
    }

    if (rule.condition.key === 'risk.atr_stop') {
      // Issue #1383 Round 1 M3/M4：参数提取走 extractAtrStopParams 单一来源，
      //   与 canonical-spec-builder 复用同规则，period 严格 typeof number，
      //   避免双源漂移。
      const atrParams = extractAtrStopParams(rule.condition.params)
      if (atrParams === null) {
        return null
      }
      context.runtimeRequirements.helpers.add('atr')
      return {
        id: rule.id,
        kind: 'atrTrailingStop',
        params: atrParams,
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

    // risk.cooldown_bars ghost-atom fix (P3, #1264).
    //
    // The registry declares risk.cooldown_bars as executableRisk('risk.cooldown_bars', ['bars']).
    // canonical-spec-builder has no case for it, so rules reach tryCompileRiskPredicate directly.
    // Previously there was no matching branch → rule fell through to compileConditionAtom → throw
    // condition_unsupported (ghost atom).
    //
    // Shape contract: phase:'risk', condition.kind:'atom', condition.key:'risk.cooldown_bars',
    // condition.params.bars: positive integer (bars to suppress new entries after fill/exit).
    //
    // Fail-closed: non-integer, ≤ 0, or missing bars → throw a distinct invalid_bars error.
    // Silent return-null is forbidden here because cooldown_bars is a safety-affecting parameter;
    // falling through to condition_unsupported would mask the contract violation.
    if (rule.condition.key === 'risk.cooldown_bars') {
      const barsRaw = (rule.condition.params ?? {}).bars
      const bars = typeof barsRaw === 'number' ? barsRaw : Number(barsRaw)
      if (!Number.isInteger(bars) || bars <= 0) {
        throw new Error(
          `codegen.canonical_spec_v2_cooldown_bars_invalid_bars:${rule.id}:${barsRaw}`,
        )
      }
      return {
        id: rule.id,
        kind: 'cooldownBars',
        params: { bars },
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
      .filter((action): action is 'FORCE_EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'BLOCK_NEW_ENTRY' =>
        action === 'FORCE_EXIT' || action === 'CLOSE_LONG' || action === 'CLOSE_SHORT' || action === 'BLOCK_NEW_ENTRY',
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

    // Issue #1313 PR2：rule-level RiskGuard 类 atom（capabilityStatus = 'pr3e-risk-guard'）
    //   走 REGISTRY 调度。命中 atom 的 `emit.riskGuardShape` 实现返回 RiskGuard | null：
    //     - 返回 RiskGuard → 等价于原 atom-specific case body 的命中分支；
    //     - 返回 null → 守门不命中（如 phase / op / value / actions 任一不匹配），
    //       继续走下方 legacy 兜底（与原行为 100% 等价：原 case body 守门不命中
    //       时也是 fall-through 到后续分支）。
    //
    //   IR snapshot byte-equal 由 canonical-spec-v2-ir-compiler.service.spec.ts 守门。
    //   capabilityStatus 字面量联合在 PR3a 阶段被收窄为 'pr3a-condition'，此处仍用
    //   `as AtomContractEmit` 拓宽（与 compileAtom dispatcher L1346 同因素）。
    const riskGuardEntry = ATOM_CONTRACT_REGISTRY[rule.condition.key as AtomContractKey]
    const riskGuardEmit = riskGuardEntry?.emit as AtomContractEmit | undefined
    if (riskGuardEmit?.capabilityStatus === 'pr3e-risk-guard' && riskGuardEmit.riskGuardShape) {
      const guard = riskGuardEmit.riskGuardShape(
        rule.condition,
        rule as unknown as Readonly<Record<string, unknown>>,
        {
          compileContext: context,
          helpers: this.irHelpers,
          seed: rule.id,
        },
      )
      if (guard !== null) {
        // `RiskGuardShapeOutput` 在 PR1 阶段是占位 `Readonly<Record<string, unknown>> | null`，
        //   未来 atom-contract-emit.types.ts 替换为 RiskGuard 真实类型后此 cast 可移除。
        return guard as unknown as RiskGuard
      }
    }

    if (
      rule.phase === 'gate'
      && (rule.condition.key === 'volume.threshold'
        || rule.condition.key === 'volatility.atr_threshold'
        || rule.condition.key === 'strategy.time_window'
        || rule.condition.key === 'strategy.multi_timeframe'
        || rule.condition.key === 'indicator.cross_over'
        || rule.condition.key === 'indicator.cross_under'
        || rule.condition.key === 'indicator.threshold_gte'
        || rule.condition.key === 'indicator.threshold_lte')
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
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        predicateRef,
        onBreach: 'BLOCK_NEW_ENTRY',
      }
    }

    // #1633 staging30 s23：LLM 在 entry 的 effects.risks 已经声明 risk.atr_multiple_take_profit
    //   的同时，又冗余产出 phase=exit + condition=volatility.atr_threshold + action.close_*
    //   的退出规则。canonical-spec-builder 把它原样投到 canonical rule（phase=exit）。
    //   compileCondition 的 compileAtom 没有 volatility.atr_threshold 分支 → throw
    //   `canonical_spec_v2_condition_unsupported:volatility.atr_threshold`。
    //   通用对策：与 phase=gate 的 EXPRESSION_GUARD/BLOCK_NEW_ENTRY 对称，扩展到
    //   phase=exit + CLOSE_LONG/CLOSE_SHORT → EXPRESSION_GUARD/FORCE_EXIT（position scope）。
    //   仅复用 compilePhase1GateAtom 已支持的 atom 白名单，不引入新 atom，不做模板化。
    if (
      rule.phase === 'exit'
      && (rule.condition.key === 'volume.threshold'
        || rule.condition.key === 'volatility.atr_threshold'
        || rule.condition.key === 'strategy.time_window'
        || rule.condition.key === 'strategy.multi_timeframe'
        || rule.condition.key === 'indicator.cross_over'
        || rule.condition.key === 'indicator.cross_under'
        || rule.condition.key === 'indicator.threshold_gte'
        || rule.condition.key === 'indicator.threshold_lte')
      && rule.actions.some(action => action.type === 'CLOSE_LONG' || action.type === 'CLOSE_SHORT')
    ) {
      const predicateRef = this.compilePhase1GateAtom(rule.condition, context, rule.id)
      if (!predicateRef) {
        return null
      }
      return {
        id: `guard_${rule.id}`,
        kind: 'EXPRESSION_GUARD',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        predicateRef,
        onBreach: 'FORCE_EXIT',
      }
    }

    if (rule.phase !== 'risk') {
      return null
    }

    const threshold = this.readNumber([rule.condition.value], 0)
    const percentRiskThreshold = this.readNumber(
      [rule.condition.value, rule.condition.params?.valuePct],
      Number.NaN,
    )
    const onBreach = rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')
      ? 'BLOCK_NEW_ENTRY'
      : 'FORCE_EXIT'
    const hasReduceAction = rule.actions.some(action => action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT')

    if (rule.condition.key === 'position_loss_pct') {
      const thresholdPct = this.normalizeRiskGuardPctThreshold(
        percentRiskThreshold,
        'canonical_spec_v2_position_loss_pct_invalid_pct',
        rule.id,
      )
      return {
        id: `guard_${rule.id}`,
        kind: 'STOP_LOSS_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: thresholdPct,
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

    // risk.stop_loss_pct ghost-atom fix (P3, #1264).
    //
    // canonical-spec-builder rewrites this atom into `position_loss_pct` via
    // buildPercentRiskCanonicalRule, so normal builder paths are already covered.
    // However spec authors and contract tests can inject `risk.stop_loss_pct`
    // directly; without an explicit branch the rule falls through
    // compileConditionAtom and throws condition_unsupported.
    //
    // Boundary semantics mirror the existing position_loss_pct case:
    //   rawValue ∈ (0, 1] → fraction form → * 100 with toFixed(4)
    //   rawValue > 1      → already percentage, passed through verbatim
    //
    // Fail-closed: thresholdPct ∉ (0, 100) → throw. Silent skip is forbidden:
    // a skipped stop-loss guard is indistinguishable from "no stop-loss" at runtime.
    if (rule.condition.key === 'risk.stop_loss_pct') {
      const thresholdPct = this.normalizeRiskGuardPctThreshold(
        percentRiskThreshold,
        'canonical_spec_v2_stop_loss_pct_invalid_pct',
        rule.id,
      )
      return {
        id: `guard_${rule.id}`,
        kind: 'STOP_LOSS_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: thresholdPct,
        onBreach,
      }
    }

    // risk.max_single_loss_pct ghost-atom fix (P3, #1264).
    //
    // canonical-spec-builder emits phase:'risk', condition.key:'risk.max_single_loss_pct',
    // condition.value = valuePct/100 (fraction). The MAX_SINGLE_LOSS_PCT RiskGuard.kind is
    // already declared in canonical-strategy-ir.ts but no compile branch existed —
    // leaving the atom as a ghost (rule fell through to condition_unsupported).
    //
    // Boundary semantics and fail-closed contract mirror risk.stop_loss_pct above.
    if (rule.condition.key === 'risk.max_single_loss_pct') {
      const thresholdPct = this.normalizeRiskGuardPctThreshold(
        percentRiskThreshold,
        'canonical_spec_v2_max_single_loss_pct_invalid_pct',
        rule.id,
      )
      return {
        id: `guard_${rule.id}`,
        kind: 'MAX_SINGLE_LOSS_PCT',
        scope: 'position',
        appliesTo: this.toRiskGuardAppliesTo(rule.sideScope),
        value: thresholdPct,
        onBreach,
      }
    }

    return null
  }

  /**
   * risk.max_drawdown_pct ghost-atom fix (#1242).
   *
   * canonical-spec-builder emits this atom as a rule (phase:'risk',
   * condition.kind:'atom', condition.key:'risk.max_drawdown_pct',
   * condition.value = valuePct/100 as fraction).
   * The runtime evaluator lives in evaluate-orchestration-portfolio-risks.ts
   * and expects a CompiledPortfolioDrawdownRisk (scope:'portfolio').
   *
   * Dispatch fall-through: returns null when the rule does not match this atom,
   * letting downstream compilers handle it.
   *
   * Fail-closed: when the rule matches but valuePct lies outside (0, 100),
   * throws `codegen.canonical_spec_v2_max_drawdown_invalid_pct`. The upstream
   * canonical-spec-builder already validates valuePct; reaching this branch
   * indicates a contract violation (hand-written canonical spec, LLM direct
   * injection). Silent skip is forbidden — it would let users believe the
   * drawdown guard is in effect when it is not.
   */
  /**
   * action.add_position ghost-atom fix (#1251).
   *
   * canonical-spec-builder emits add_position rules as phase:'entry'/'exit'
   * with action type ADD_LONG or ADD_SHORT and metadata.addPosition carrying
   * { stateKey, addMode, addRatio, maxLayers, maxExposurePct }.
   *
   * The runtime (run-add-position.ts) uses addMode to branch between three
   * semantically distinct behaviors:
   *   signal_confirm — fire on repeated entry signal
   *   profit_pct     — fire when position PnL exceeds profitThreshold
   *   drawdown_pct   — fire when unrealised drawdown exceeds drawdownThreshold
   *
   * Without compile-time validation, a missing addMode produces an ADD_LONG
   * in the IR that the runtime silently falls through, making all three modes
   * behaviourally identical — a ghost-atom equivalent.
   *
   * Contract:
   *   • Returns void (null-equivalent) — lets the rule proceed through the
   *     normal ruleBlock path unmodified.
   *   • Throws fail-closed when:
   *       – addMode is absent or not a string
   *       – addRatio is present but outside (0, 1]
   *
   * Guard logic mirrors tryCompileRiskMaxDrawdownPct: we only intercept rules
   * that are unambiguously add_position rules (have ADD_LONG or ADD_SHORT
   * action AND metadata.addPosition). Rules that lack metadata.addPosition
   * (e.g. hand-crafted ADD_LONG without lifecycle metadata) are passed through
   * without validation — they do not claim to be add_position lifecycle rules.
   */
  private tryCompileActionAddPosition(rule: CanonicalRuleV2): void {
    const addPositionMeta = rule.metadata?.addPosition
    if (!addPositionMeta) {
      // Not an add_position lifecycle rule — nothing to validate.
      return
    }

    const hasAddAction = rule.actions.some(
      a => a.type === 'ADD_LONG' || a.type === 'ADD_SHORT',
    )
    if (!hasAddAction) {
      // metadata.addPosition present but no ADD action — odd shape; skip.
      return
    }

    // addMode is required: runtime cannot dispatch without it.
    if (typeof addPositionMeta.addMode !== 'string' || addPositionMeta.addMode.trim() === '') {
      throw new Error(
        `codegen.canonical_spec_v2_add_position_invalid_addMode:${rule.id}`,
      )
    }

    // addRatio, when present, must be a positive fraction in (0, 1].
    // Values >1 look like accidental percentages (e.g. 20 instead of 0.20);
    // values ≤0 are semantically incoherent.
    const addRatio = addPositionMeta.addRatio
    if (addRatio !== undefined) {
      const ratio = Number(addRatio)
      if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
        throw new Error(
          `codegen.canonical_spec_v2_add_position_invalid_addRatio:${rule.id}:${addRatio}`,
        )
      }
    }
  }

  /**
   * risk.max_drawdown_pct ghost-atom fix (#1242).
   *
   * canonical-spec-builder emits this atom as a rule (phase:'risk',
   * condition.kind:'atom', condition.key:'risk.max_drawdown_pct',
   * condition.value = valuePct/100 as fraction).
   * The runtime evaluator lives in evaluate-orchestration-portfolio-risks.ts
   * and expects a CompiledPortfolioDrawdownRisk (scope:'portfolio').
   *
   * Dispatch fall-through: returns null when the rule does not match this atom,
   * letting downstream compilers handle it.
   *
   * Fail-closed: when the rule matches but valuePct lies outside (0, 100),
   * throws `codegen.canonical_spec_v2_max_drawdown_invalid_pct`. The upstream
   * canonical-spec-builder already validates valuePct; reaching this branch
   * indicates a contract violation (hand-written canonical spec, LLM direct
   * injection). Silent skip is forbidden — it would let users believe the
   * drawdown guard is in effect when it is not.
   */
  private tryCompileRiskMaxDrawdownPct(
    rule: CanonicalRuleV2,
  ): IrOrchestrationPortfolioRisk | null {
    if (
      rule.phase !== 'risk'
      || rule.condition.kind !== 'atom'
      || rule.condition.key !== 'risk.max_drawdown_pct'
    ) {
      return null
    }

    // canonical-spec-builder currently stores valuePct as a fraction (valuePct / 100),
    // but other risk atoms (stop_loss_pct, take_profit_pct, trailing_stop_pct) accept
    // both fraction (≤1) and percentage (>1) via the same heuristic — see
    // tryCompileRiskGuard. Mirror that contract here so upstream changes do not silently
    // produce a 1500% threshold (which would never trigger and would not throw either).
    //
    // Boundary semantics:
    //   rawValue ∈ (0, 1] → treated as fraction, multiplied by 100 (so rawValue=1 maps
    //                       to 100% and is rejected by the (0, 100) guard below)
    //   rawValue > 1     → treated as already-percentage, passed through verbatim
    // Trade-off: fractional 99.99% drawdown (rawValue=0.9999) is the largest expressible
    // fraction; users wanting 99.x% must use percentage form (rawValue=99.x).
    const rawValue = this.readNumber([rule.condition.value], Number.NaN)
    const thresholdPct = Number.isFinite(rawValue) && rawValue <= 1
      ? Number((rawValue * 100).toFixed(4))
      : rawValue

    if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct >= 100) {
      throw new Error(
        `codegen.canonical_spec_v2_max_drawdown_invalid_pct:${rule.id}:${thresholdPct}`,
      )
    }

    return {
      id: rule.id,
      scope: 'portfolio',
      mode: 'enforce',
      thresholdPct,
      effectWhenTriggered: 'block_new_entries',
    }
  }

  private tryCompileRiskDailyLossLimit(
    rule: CanonicalRuleV2,
  ): IrOrchestrationPortfolioRisk | null {
    if (
      rule.phase !== 'risk'
      || rule.condition.kind !== 'atom'
      || rule.condition.key !== 'risk.daily_loss_limit'
    ) {
      return null
    }

    const rawValue = this.readNumber([rule.condition.value], Number.NaN)
    const thresholdPct = Number.isFinite(rawValue) && rawValue <= 1
      ? Number((rawValue * 100).toFixed(4))
      : rawValue

    if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct >= 100) {
      throw new Error(
        `codegen.canonical_spec_v2_daily_loss_invalid_pct:${rule.id}:${thresholdPct}`,
      )
    }

    return {
      id: rule.id,
      scope: 'portfolio',
      metric: 'daily_loss_pct',
      mode: 'enforce',
      thresholdPct,
      effectWhenTriggered: 'block_new_entries',
    }
  }

  private tryReadMaxConcurrentPositions(rule: CanonicalRuleV2): number | null {
    if (
      rule.phase !== 'gate'
      || rule.condition.kind !== 'atom'
      || rule.condition.key !== 'position.max_concurrent_positions'
    ) {
      return null
    }
    const count = this.readNumber([rule.condition.params?.count, rule.condition.value], Number.NaN)
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`codegen.canonical_spec_v2_max_concurrent_positions_invalid_count:${rule.id}:${count}`)
    }
    return Math.max(1, Math.floor(count))
  }

  private tryCompileActionReversePosition(
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
    context: CompileContext,
    supportedSymbolScopeIds: ReadonlySet<string>,
    supportedLegScopeIds: ReadonlySet<string>,
    supportedTimeframeScopeIds: ReadonlySet<string>,
    supportedDataSourceScopeIds: ReadonlySet<string>,
    supportedSubStrategyScopeIds: ReadonlySet<string>,
  ): RuleBlock | null {
    const reverseMeta = rule.metadata?.reversePosition
    if (!reverseMeta) {
      return null
    }

    // fail-closed: fromSide must be 'long' | 'short'
    if (reverseMeta.fromSide !== 'long' && reverseMeta.fromSide !== 'short') {
      throw new Error(
        `codegen.canonical_spec_v2_reverse_position_invalid_from_side:${rule.id}:${reverseMeta.fromSide}`,
      )
    }

    // fail-closed: toSide must be 'long' | 'short'
    if (reverseMeta.toSide !== 'long' && reverseMeta.toSide !== 'short') {
      throw new Error(
        `codegen.canonical_spec_v2_reverse_position_invalid_to_side:${rule.id}:${reverseMeta.toSide}`,
      )
    }

    // fail-closed: fromSide and toSide must differ (reversing to same side is a no-op)
    if (reverseMeta.fromSide === reverseMeta.toSide) {
      throw new Error(
        `codegen.canonical_spec_v2_reverse_position_invalid_same_side:${rule.id}:${reverseMeta.fromSide}`,
      )
    }

    // fail-closed: sameBarPolicy must be known
    if (reverseMeta.sameBarPolicy !== 'allow' && reverseMeta.sameBarPolicy !== 'next_bar_only') {
      throw new Error(
        `codegen.canonical_spec_v2_reverse_position_invalid_same_bar_policy:${rule.id}:${reverseMeta.sameBarPolicy}`,
      )
    }

    // fail-closed: sizingSource must be known
    if (
      reverseMeta.sizingSource !== 'current_position'
      && reverseMeta.sizingSource !== 'fixed'
      && reverseMeta.sizingSource !== 'position_sizing'
    ) {
      throw new Error(
        `codegen.canonical_spec_v2_reverse_position_invalid_sizing_source:${rule.id}:${reverseMeta.sizingSource}`,
      )
    }

    const when = this.compileCondition(rule.condition, context, rule.id)
    const actions = this.compileActions(rule, spec, fallbackPositionPct, context)
    if (actions.length === 0) {
      return null
    }

    this.collectPositionLifecycleRuntimeRequirements(rule, actions, context)

    // Reuse the scope-id Sets already computed in buildIr so that
    // symbolScopeRef / timeframeScopeRef / dataSourceScopeRef / subStrategyScopeRef
    // are subject to the same whitelist checks as rules compiled via the generic path.
    const metadata = this.toRuleBlockMetadata(
      rule.metadata!,
      supportedSymbolScopeIds,
      supportedLegScopeIds,
      supportedTimeframeScopeIds,
      supportedDataSourceScopeIds,
      supportedSubStrategyScopeIds,
    )

    return {
      id: rule.id,
      phase: this.mapRulePhase(rule, actions),
      when,
      priority: rule.priority,
      cooldownBars: typeof rule.cooldownBars === 'number' && rule.cooldownBars > 0 ? rule.cooldownBars : undefined,
      actions,
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    }
  }

  private tryCompileReduceActionRule(
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
    context: CompileContext,
  ): RuleBlock | null {
    // Issue #1313 PR3：partial-take-profit rule-block emit 沉淀至
    //   ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].emit.ruleBlockShape
    //   （atom-contracts/atom-contract-rule-block-emits.ts，行为与原 inline body
    //    严格等价，IR snapshot byte-equal）。
    //   rule.condition.kind 必须是 'atom' 才能拿到 atom key 反查 registry；
    //   非 partial_take_profit rule 直接 null 兜底（与原 fail-fast 守门等价）。
    if (rule.condition.kind !== 'atom') {
      return null
    }
    const registryEntry = ATOM_CONTRACT_REGISTRY[rule.condition.key as AtomContractKey]
    const emit = registryEntry?.emit as AtomContractEmit | undefined
    if (emit?.capabilityStatus !== 'pr3e-rule-block' || !emit.ruleBlockShape) {
      return null
    }
    // `RuleLikeInput` / `SpecLikeInput` 仍是 `Readonly<Record<string, unknown>>` 占位
    //   （PR2 / PR4 兼容），shape 实现内部再 cast 回 canonical 真实类型。
    return emit.ruleBlockShape(
      rule.condition,
      rule as unknown as Readonly<Record<string, unknown>>,
      spec as unknown as Readonly<Record<string, unknown>>,
      fallbackPositionPct,
      { compileContext: context, helpers: this.irHelpers, seed: rule.id },
    ) as RuleBlock | null
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

    // ---------------------------------------------------------------------
    // Wave 2 P3 ghost-atom 修复 (Issue #1262)：indicator.cross_over /
    // indicator.cross_under / indicator.threshold_gte / indicator.threshold_lte
    //
    // canonical-spec-builder 中这 4 atom 会被改写为 ma.golden_cross /
    // rsi.cross_over / macd.golden_cross 等子 atom；但 contract spec 直接构造
    // 原始 atom 进入 IR-compiler，绕过 builder rewrite，因此需要 IR-compiler
    // 层独立识别。
    //
    // 路由规则（与 canonical-spec-builder.service.ts 的 indicator.cross_*
    // case 行为对齐）：
    //   - params.indicator='macd'：cross_* 走 MACD_LINE × MACD_SIGNAL；
    //     threshold_gte/lte 不接受（MACD 没有"指标 vs 常量阈值"语义）
    //   - params.indicator='rsi'：cross_* 走 RSI × const(value)；
    //     threshold_gte/lte 走 RSI × const(value)
    //   - params.indicator='ema'：cross_* 走 EMA(fast) × EMA(slow)；
    //     threshold_gte/lte 走 EMA(period) × const(value)
    //   - params.indicator='ma' | 'sma' | 缺省：SMA 对应实现
    //
    // fail-closed：indicator 不识别 / period 缺失或非正整数 / cross 缺失
    // fastPeriod 或 slowPeriod / threshold 缺失 value → 抛
    //   `codegen.canonical_spec_v2_indicator_cross_invalid_*` /
    //   `codegen.canonical_spec_v2_indicator_threshold_invalid_*`
    // 直接 throw 而非 return null，避免静默吞掉 BLOCK_NEW_ENTRY guard。
    if (
      atom.key === 'indicator.cross_over'
      || atom.key === 'indicator.cross_under'
    ) {
      return this.compileIndicatorCrossGateAtom(atom, context, seed)
    }

    if (
      atom.key === 'indicator.threshold_gte'
      || atom.key === 'indicator.threshold_lte'
    ) {
      return this.compileIndicatorThresholdGateAtom(atom, context, seed)
    }

    return null
  }

  private compileIndicatorCrossGateAtom(
    atom: CanonicalConditionAtom,
    context: CompileContext,
    seed: string,
  ): string {
    const indicator = typeof atom.params?.indicator === 'string'
      ? atom.params.indicator.trim().toLowerCase()
      : ''
    const timeframe = this.resolveOperandTimeframe(
      typeof atom.params?.timeframe === 'string' ? atom.params.timeframe : undefined,
      context.timeframe,
    )
    const operator: 'CROSS_OVER' | 'CROSS_UNDER' = atom.key === 'indicator.cross_over' ? 'CROSS_OVER' : 'CROSS_UNDER'

    if (indicator === 'macd') {
      const macd = this.resolveMacdAtomConfig(atom, context.macd, 'codegen.canonical_spec_v2_indicator_cross')
      const macdLineRef = this.ensureMacdSeries(context, 'MACD_LINE', timeframe, macd)
      const macdSignalRef = this.ensureMacdSeries(context, 'MACD_SIGNAL', timeframe, macd)
      const crossRef = this.upsertPredicate(
        context.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_macd`,
        operator,
        [macdLineRef, macdSignalRef],
      )
      return this.upsertPredicate(context.predicateMap, `${seed}_${atom.key.replace(/\./g, '_')}_macd_breach`, 'NOT', [crossRef])
    }

    if (indicator === 'rsi') {
      const period = this.readNumber([atom.params?.period], context.rsi.period)
      if (!Number.isFinite(period) || period <= 0) {
        throw new Error(`codegen.canonical_spec_v2_indicator_cross_invalid_period:${atom.key}:${period}`)
      }
      const value = this.readNumber([atom.value], Number.NaN)
      if (!Number.isFinite(value)) {
        throw new Error(`codegen.canonical_spec_v2_indicator_cross_invalid_value:${atom.key}:${atom.value}`)
      }
      const rsiRef = this.ensureIndicatorSeries(context, 'RSI', period, timeframe)
      const thresholdRef = this.ensureConstSeries(context, value)
      const crossRef = this.upsertPredicate(
        context.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_rsi`,
        operator,
        [rsiRef, thresholdRef],
      )
      return this.upsertPredicate(context.predicateMap, `${seed}_${atom.key.replace(/\./g, '_')}_rsi_breach`, 'NOT', [crossRef])
    }

    if (indicator === 'ema' || indicator === 'ma' || indicator === 'sma' || indicator.length === 0) {
      const fastPeriod = this.readNumber([atom.params?.fastPeriod], Number.NaN)
      const slowPeriod = this.readNumber([atom.params?.slowPeriod], Number.NaN)
      if (!Number.isFinite(fastPeriod) || fastPeriod <= 0) {
        throw new Error(`codegen.canonical_spec_v2_indicator_cross_invalid_fast_period:${atom.key}:${fastPeriod}`)
      }
      if (!Number.isFinite(slowPeriod) || slowPeriod <= 0) {
        throw new Error(`codegen.canonical_spec_v2_indicator_cross_invalid_slow_period:${atom.key}:${slowPeriod}`)
      }
      const seriesKind: Extract<SeriesDef['kind'], 'SMA' | 'EMA'> = indicator === 'ema' ? 'EMA' : 'SMA'
      const fastRef = this.ensureIndicatorSeries(context, seriesKind, fastPeriod, timeframe)
      const slowRef = this.ensureIndicatorSeries(context, seriesKind, slowPeriod, timeframe)
      const crossRef = this.upsertPredicate(
        context.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${seriesKind.toLowerCase()}`,
        operator,
        [fastRef, slowRef],
      )
      return this.upsertPredicate(context.predicateMap, `${seed}_${atom.key.replace(/\./g, '_')}_${seriesKind.toLowerCase()}_breach`, 'NOT', [crossRef])
    }

    throw new Error(`codegen.canonical_spec_v2_indicator_cross_invalid_indicator:${atom.key}:${indicator}`)
  }

  private compileIndicatorThresholdGateAtom(
    atom: CanonicalConditionAtom,
    context: CompileContext,
    seed: string,
  ): string {
    const indicator = typeof atom.params?.indicator === 'string'
      ? atom.params.indicator.trim().toLowerCase()
      : ''
    const timeframe = this.resolveOperandTimeframe(
      typeof atom.params?.timeframe === 'string' ? atom.params.timeframe : undefined,
      context.timeframe,
    )
    const value = this.readNumber([atom.value], Number.NaN)
    if (!Number.isFinite(value)) {
      throw new Error(`codegen.canonical_spec_v2_indicator_threshold_invalid_value:${atom.key}:${atom.value}`)
    }

    // gate phase：用户 op 描述的是"通过 gate 的条件"，guard 需要触发的是反向比较；
    // 与 volume.threshold / volatility.atr_threshold 的 flipGateOperator 用法一致。
    const userOp: 'GTE' | 'LTE' = atom.key === 'indicator.threshold_gte' ? 'GTE' : 'LTE'
    const predicateKind = this.flipGateOperator(userOp)

    if (indicator === 'rsi') {
      const period = this.readNumber([atom.params?.period], context.rsi.period)
      if (!Number.isFinite(period) || period <= 0) {
        throw new Error(`codegen.canonical_spec_v2_indicator_threshold_invalid_period:${atom.key}:${period}`)
      }
      const rsiRef = this.ensureIndicatorSeries(context, 'RSI', period, timeframe)
      const thresholdRef = this.ensureConstSeries(context, value)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_rsi`,
        predicateKind,
        [rsiRef, thresholdRef],
      )
    }

    if (indicator === 'ema' || indicator === 'ma' || indicator === 'sma' || indicator.length === 0) {
      const period = this.readNumber(
        [atom.params?.period, atom.params?.slowPeriod, atom.params?.fastPeriod],
        Number.NaN,
      )
      if (!Number.isFinite(period) || period <= 0) {
        throw new Error(`codegen.canonical_spec_v2_indicator_threshold_invalid_period:${atom.key}:${period}`)
      }
      const seriesKind: Extract<SeriesDef['kind'], 'SMA' | 'EMA'> = indicator === 'ema' ? 'EMA' : 'SMA'
      const indicatorRef = this.ensureIndicatorSeries(context, seriesKind, period, timeframe)
      const thresholdRef = this.ensureConstSeries(context, value)
      return this.upsertPredicate(
        context.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${seriesKind.toLowerCase()}`,
        predicateKind,
        [indicatorRef, thresholdRef],
      )
    }

    // MACD 没有"指标 vs 常量阈值"语义 — 显式拒绝，与 builder 改写口径一致
    throw new Error(`codegen.canonical_spec_v2_indicator_threshold_invalid_indicator:${atom.key}:${indicator}`)
  }

  private resolveMacdAtomConfig(
    atom: CanonicalConditionAtom,
    fallback: CompileContext['macd'],
    errorPrefix: string,
  ): CompileContext['macd'] {
    const fastPeriod = this.readRequiredPositiveNumberParam(
      atom.params?.fastPeriod,
      fallback.fastPeriod,
      `${errorPrefix}_invalid_fast_period`,
    )
    const slowPeriod = this.readRequiredPositiveNumberParam(
      atom.params?.slowPeriod,
      fallback.slowPeriod,
      `${errorPrefix}_invalid_slow_period`,
    )
    const signalPeriod = this.readRequiredPositiveNumberParam(
      atom.params?.signalPeriod,
      fallback.signalPeriod,
      `${errorPrefix}_invalid_signal_period`,
    )

    return { fastPeriod, slowPeriod, signalPeriod }
  }

  private readRequiredPositiveNumberParam(value: unknown, fallback: number, errorCode: string): number {
    const resolved = value === undefined ? fallback : this.readNumber([value], Number.NaN)
    if (!Number.isFinite(resolved) || resolved <= 0) {
      throw new Error(`${errorCode}:${value ?? resolved}`)
    }
    return resolved
  }

  private toRiskGuardAppliesTo(sideScope: CanonicalRuleSideScope | undefined): NonNullable<RiskGuard['appliesTo']> {
    if (sideScope === 'long' || sideScope === 'short') return sideScope
    return 'both'
  }

  /**
   * Issue #1313 PR5c：6 个 action atom 的 emit 沉淀到
   *   ATOM_CONTRACT_REGISTRY['action.*'].emit.actionShape
   *   （atom-contracts/atom-contract-action-emits.ts，行为与本方法原 enum case body
   *    严格等价，IR snapshot byte-equal）。
   *
   * 调度优先级：
   *   1. action.atomKey 命中 REGISTRY + emit.capabilityStatus === 'pr3e-action' +
   *      emit.actionShape 挂载 → 走 REGISTRY shape；
   *   2. 其它 case（启发式 / risk / fallback 路径无 atomKey，或 REDUCE_* /
   *      FORCE_EXIT / BLOCK_NEW_ENTRY 4 case 不在本 6 atom 集合内）→ 走 enum 兜底。
   *
   * 兜底 case 一律保留：reduce / force_exit / block_new_entry 仍由本方法内 enum
   * 直接 emit，分别归属 `action.reduce_position` / `risk.partial_take_profit` /
   * `portfolioRisk.drawdown_block` 等 atom 各自的 rule-level / spec-level shape；
   * 此处不依赖 REGISTRY 反查。
   */
  private compileActions(
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
    context: CompileContext,
  ): ActionDef[] {
    const actions: ActionDef[] = []
    const emitContext = this.buildRuleLevelEmitContext(context, rule.id)

    for (const action of rule.actions) {
      // PR5c：atomKey 反查 REGISTRY 优先；未命中 / 未挂 shape → 落 enum 兜底（保持
      //   启发式 / risk 路径下"无 atomKey 时 IR 不变"的 byte-equal 不变量）。
      // PR6 fail-loud：仅当 atomKey 以 `action.` 开头时，必须命中 pr3e-action shape；
      //   否则 spec 漂移或 REGISTRY 漂移（PR5d invariant 已类型层守门，此处是 runtime
      //   兜底）。非 action.* atomKey（如 risk.* / portfolioRisk.*）由各自 rule-level /
      //   spec-level shape 承担，本 dispatcher 不识别，正常落 enum 兜底。
      const atomKey = action.atomKey
      if (typeof atomKey === 'string') {
        const entry = ATOM_CONTRACT_REGISTRY[atomKey as AtomContractKey] as
          | { readonly emit?: AtomContractEmit }
          | undefined
        const emit = entry?.emit
        if (emit?.capabilityStatus === 'pr3e-action' && emit.actionShape) {
          // ActionShape 的 `atom` 第一参用于与现有 IrShapeBuilder / RiskGuardShape /
          //   RuleBlockShape 等 dispatch 入参形态保持一致；compileActions 路径无真实
          //   CanonicalConditionAtom（dispatch key 来自 action.atomKey），传 synthetic
          //   `{ kind: 'atom', key: atomKey }` 即可（emit body 不消费 atom 字段，详见
          //   atom-contract-emit.types.ts ActionShape doc）。
          const syntheticAtom: CanonicalConditionAtom = { kind: 'atom', key: atomKey }
          const emitted = emit.actionShape(
            syntheticAtom,
            action as unknown as Readonly<Record<string, unknown>>,
            rule as unknown as Readonly<Record<string, unknown>>,
            spec as unknown as Readonly<Record<string, unknown>>,
            fallbackPositionPct,
            emitContext,
          ) as unknown as readonly ActionDef[]
          actions.push(...emitted)
          continue
        }
        if (atomKey.startsWith('action.') && atomKey !== 'action.limit_order' && atomKey !== 'action.conditional_order' && atomKey !== 'action.reduce_position') {
          throw new Error(
            `[#1313 PR6] action atomKey '${atomKey}' did not resolve to a pr3e-action shape `
            + `(entry=${entry ? 'present' : 'missing'}, capabilityStatus=${emit?.capabilityStatus ?? 'undefined'}). `
            + `spec 漂移或 REGISTRY 漂移；不允许 silent 回落 enum。`,
          )
        }
      }

      switch (action.type) {
        case 'OPEN_LONG':
        case 'OPEN_SHORT':
        case 'ADD_LONG':
        case 'ADD_SHORT':
          actions.push({
            kind: action.type,
            quantity: this.resolveActionQuantity(action, spec.sizing, fallbackPositionPct),
            ...this.buildActionOrderMetadata(action, rule),
          })
          break

        case 'CLOSE_LONG':
        case 'CLOSE_SHORT':
          actions.push({
            kind: action.type,
            quantity: { mode: 'position_pct', value: 100 },
            ...this.buildActionOrderMetadata(action, rule),
          })
          break

        case 'REDUCE_LONG':
        case 'REDUCE_SHORT':
          actions.push({
            kind: action.type,
            quantity: action.sizing
              ? this.resolveReduceActionQuantity(action, spec.sizing, fallbackPositionPct)
              : { mode: 'position_pct', value: 50 },
            ...this.buildActionOrderMetadata(action, rule),
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

  private buildActionOrderMetadata(
    action: CanonicalRuleAction,
    rule: CanonicalRuleV2,
  ): Pick<ActionDef, 'order'> {
    const limitPrice = this.readOptionalNumber(action.params?.limitPrice)
    const rawTimeInForce = action.params?.timeInForce
    const timeInForce = rawTimeInForce === 'ioc' || rawTimeInForce === 'fok' ? rawTimeInForce : 'gtc'
    if (action.atomKey === 'action.limit_order') {
      if (limitPrice === null) {
        throw new Error(`codegen.canonical_spec_v2_action_limit_order_missing_limit_price:${rule.id}`)
      }
      return {
        order: {
          orderType: 'limit',
          limitPrice,
          timeInForce,
        },
      }
    }
    if (action.atomKey === 'action.conditional_order') {
      return {
        order: {
          orderType: limitPrice !== null ? 'limit' : 'market',
          ...(limitPrice !== null ? { limitPrice } : {}),
          ...(limitPrice !== null ? { timeInForce } : {}),
          triggerConditionRef: rule.metadata?.sourcePath ? `${rule.metadata.sourcePath}.condition` : rule.id,
        },
      }
    }
    return {}
  }

  /**
   * Issue #1313 PR5c：rule-level emit shape（RiskGuard / RuleBlock / Action）共用入口的
   * 上下文构造 helper。与 `buildSpecLevelEmitContext` 同形，额外携带 `seed = rule.id`
   * 供 shape 派生 predicate id 命名（compileActions 路径暂无 series/predicate 写入
   * 需求，seed 仍按现有 RuleLevelEmitContext 接口透传）。
   */
  private buildRuleLevelEmitContext(context: CompileContext, seed: string): RuleLevelEmitContext {
    return {
      compileContext: context,
      helpers: this.irHelpers,
      seed,
    }
  }

  private withRuleSourcePath<T extends { sourcePath?: string }>(item: T, rule: CanonicalRuleV2): T {
    const sourcePath = typeof rule.metadata?.sourcePath === 'string'
      ? rule.metadata.sourcePath.trim()
      : ''
    if (!sourcePath) return item
    return { ...item, sourcePath }
  }

  private withRuleBlockSourcePath(block: RuleBlock, rule: CanonicalRuleV2): RuleBlock {
    const sourcePath = typeof rule.metadata?.sourcePath === 'string'
      ? rule.metadata.sourcePath.trim()
      : ''
    if (!sourcePath) return block
    return {
      ...block,
      metadata: {
        ...block.metadata,
        sourcePath,
      },
    }
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

  private toRuleBlockMetadata(
    metadata: NonNullable<CanonicalRuleV2['metadata']>,
    supportedScopeIds?: ReadonlySet<string>,
    supportedLegScopeIds?: ReadonlySet<string>,
    supportedTimeframeScopeIds?: ReadonlySet<string>,
    supportedDataSourceScopeIds?: ReadonlySet<string>,
    supportedSubStrategyScopeIds?: ReadonlySet<string>,
  ): RuleBlock['metadata'] {
    // Phase 5 S2 (#1104): symbolScopeRef silent skip 透传
    //   仅当 ref trim 后非空且 ∈ supportedScopeIds 时透传；否则丢弃 + 让 readiness/runtime fail-closed
    const ref = metadata.symbolScopeRef
    const refValid = typeof ref === 'string'
      && ref.trim() !== ''
      && (!supportedScopeIds || supportedScopeIds.has(ref.trim()))
    // Phase 5 S11 (#1112): legScopeRef silent skip 透传（与 symbolScopeRef 同形）
    const legRef = metadata.legScopeRef
    const legRefValid = typeof legRef === 'string'
      && legRef.trim() !== ''
      && (!supportedLegScopeIds || supportedLegScopeIds.has(legRef.trim()))
    // Phase 5 S3 (#1109): timeframeScopeRef silent skip 透传（与 symbolScopeRef 同形）
    const tfRef = metadata.timeframeScopeRef
    const tfRefValid = typeof tfRef === 'string'
      && tfRef.trim() !== ''
      && (!supportedTimeframeScopeIds || supportedTimeframeScopeIds.has(tfRef.trim()))
    // Phase 5 S9 (#1110): dataSourceScopeRef silent skip 透传（与 symbolScopeRef 平级）
    const dsRef = metadata.dataSourceScopeRef
    const dsRefValid = typeof dsRef === 'string'
      && dsRef.trim() !== ''
      && (!supportedDataSourceScopeIds || supportedDataSourceScopeIds.has(dsRef.trim()))
    // Phase 5 S10 (#1111): subStrategyScopeRef silent skip 透传（与 symbolScopeRef 平行）
    const subRef = metadata.subStrategyScopeRef
    const subRefValid = typeof subRef === 'string'
      && subRef.trim() !== ''
      && (!supportedSubStrategyScopeIds || supportedSubStrategyScopeIds.has(subRef.trim()))
    return {
      ...(typeof metadata.sourcePath === 'string' && metadata.sourcePath.trim() !== '' ? { sourcePath: metadata.sourcePath.trim() } : {}),
      ...(metadata.partialTakeProfit ? { partialTakeProfit: { ...metadata.partialTakeProfit } } : {}),
      ...(metadata.reversePosition ? { reversePosition: { ...metadata.reversePosition } } : {}),
      ...(metadata.addPosition ? { addPosition: { ...metadata.addPosition } } : {}),
      ...(metadata.pyramidingHint ? { pyramidingHint: { ...metadata.pyramidingHint } } : {}),
      ...(metadata.dcaSchedule ? { dcaSchedule: { ...metadata.dcaSchedule } } : {}),
      ...(refValid && typeof ref === 'string' ? { symbolScopeRef: ref.trim() } : {}),
      ...(legRefValid && typeof legRef === 'string' ? { legScopeRef: legRef.trim() } : {}),
      ...(tfRefValid && typeof tfRef === 'string' ? { timeframeScopeRef: tfRef.trim() } : {}),
      ...(dsRefValid && typeof dsRef === 'string' ? { dataSourceScopeRef: dsRef.trim() } : {}),
      ...(subRefValid && typeof subRef === 'string' ? { subStrategyScopeRef: subRef.trim() } : {}),
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

  /**
   * Issue #1313 PR4：lifecycle pyramiding 聚合改走 REGISTRY 调度，
   * 行为沉淀到 `position.pyramiding_limit` atom 的 `emit.lifecyclePyramidingShape`
   * （`atom-contract-lifecycle-emits.ts`）。本方法退化为通过 REGISTRY 查找并调用。
   *
   * 类型守门（atom-contract-invariants.ts `_LifecyclePyramidingEmitAllReal`）保证
   * `position.pyramiding_limit` 的 `capabilityStatus === 'pr3e-lifecycle'`，
   * `lifecyclePyramidingShape` 字段在编译期必然挂载；运行时若意外缺失则
   * fail-loud（与原 service helper "永远返回值" 的契约一致）。
   */
  private resolveLifecyclePyramiding(rules: CanonicalRuleV2[], context: CompileContext): LifecyclePyramidingShapeOutput {
    const pyramidingEmit = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].emit
    const shape = pyramidingEmit.lifecyclePyramidingShape
    if (!shape) {
      throw new Error('[#1313 PR4] position.pyramiding_limit emit.lifecyclePyramidingShape missing — REGISTRY invariant violated')
    }
    // `RuleLikeInput` 是 atom-contracts 内的占位 `Record<string, unknown>`，
    // 避免 atom-contracts → canonical-strategy-ir 反向 import 形成环；
    // `CanonicalRuleV2` 不实现 string index signature，需要双 cast 显式声明 widening
    // 是有意的（接口语义已在 emit.types `LifecyclePyramidingShape` doc 锁定）。
    return shape(rules as unknown as readonly RuleLikeInput[], this.buildSpecLevelEmitContext(context))
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
      || action.type === 'CLOSE_LONG'
    )))
    const hasShort = rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
      || action.type === 'REDUCE_SHORT'
      || action.type === 'ADD_SHORT'
      || action.type === 'CLOSE_SHORT'
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
        const movingAverage = this.resolveMovingAverageAtomConfig(condition, config.movingAverage)
        return `${operator}(${movingAverage.kind}(CLOSE,${movingAverage.fast}),${movingAverage.kind}(CLOSE,${movingAverage.slow}))`
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
        const macd = this.resolveMacdAtomConfig(condition, config.macd, 'codegen.canonical_spec_v2_macd_cross')
        return `${operator}(MACD_LINE(CLOSE,${macd.fastPeriod},${macd.slowPeriod},${macd.signalPeriod}),MACD_SIGNAL(CLOSE,${macd.fastPeriod},${macd.slowPeriod},${macd.signalPeriod}))`
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
      case 'bollinger.touch_upper': {
        const rawMode = readBandTouchConfirmationMode(condition.params)
        // touch_* key 缺省 mode 且未显式提供 condition.op 时按 'touch' 处理；upper_break 维持
        // 原 breakout 默认；显式 op 时尊重 op 派发，避免被默认 touch 覆盖。
        const mode = rawMode ?? (condition.key === 'bollinger.touch_upper' && condition.op === undefined ? 'touch' : undefined)
        const bandExpr = `UPPER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})`
        if (mode === 'touch') return `GTE(HIGH,${bandExpr})`
        if (mode === 'close_confirm') return `GTE(CLOSE,${bandExpr})`
        if (condition.op === 'GTE' || condition.op === 'GT' || condition.op === 'LT' || condition.op === 'LTE' || condition.op === 'EQ') {
          return `${condition.op}(CLOSE,${bandExpr})`
        }
        return `CROSS_OVER(CLOSE,${bandExpr})`
      }

      case 'bollinger.lower_break':
      case 'bollinger.touch_lower': {
        const rawMode = readBandTouchConfirmationMode(condition.params)
        const mode = rawMode ?? (condition.key === 'bollinger.touch_lower' && condition.op === undefined ? 'touch' : undefined)
        const bandExpr = `LOWER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})`
        if (mode === 'touch') return `LTE(LOW,${bandExpr})`
        if (mode === 'close_confirm') return `LTE(CLOSE,${bandExpr})`
        if (condition.op === 'LTE' || condition.op === 'LT' || condition.op === 'GT' || condition.op === 'GTE' || condition.op === 'EQ') {
          return `${condition.op}(CLOSE,${bandExpr})`
        }
        return `CROSS_UNDER(CLOSE,${bandExpr})`
      }

      case 'bollinger.middle_revert':
      case 'bollinger.touch_middle':
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

  private describeBollingerBandOperator(
    operator: NonNullable<CanonicalConditionAtom['op']>,
    band: 'UPPER_BAND' | 'LOWER_BAND',
    config: { bollinger: CompileContext['bollinger'] },
  ): string {
    return `${operator}(CLOSE,${band}(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`
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

  private buildMarketDataPredicateParams(
    atom: CanonicalConditionAtom,
    schemaRef: string,
    defaultFeedId: string,
  ): PredicateDef['params'] {
    const params: Record<string, number | string | boolean> = {
      schemaRef,
      sourceFeedId: this.readStringParam(atom.params?.sourceFeedId) ?? defaultFeedId,
      operator: atom.op ?? 'GT',
    }
    const timeframe = this.readStringParam(atom.params?.timeframe)
    if (timeframe) params.timeframe = timeframe
    const side = this.readStringParam(atom.params?.side)
    if (side) params.side = side
    const direction = this.readStringParam(atom.params?.direction)
    if (direction) params.direction = direction
    const value = this.readOptionalNumber(atom.value)
      ?? this.readOptionalNumber(atom.params?.value)
      ?? this.readOptionalNumber(atom.params?.valuePct)
      ?? this.readOptionalNumber(atom.params?.thresholdPct)
      ?? this.readOptionalNumber(atom.params?.changePct)
      ?? this.readOptionalNumber(atom.params?.notionalUsd)
    if (value !== null) params.value = value
    const window = this.readStringParam(atom.params?.window)
    if (window) params.window = window
    return params
  }

  private readStringParam(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }

  private readNestedParam(params: Record<string, unknown> | undefined, objectKey: string, fieldKey: string): unknown {
    const value = params?.[objectKey]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return (value as Record<string, unknown>)[fieldKey]
  }

  private readOptionalNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
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

  private normalizeRiskGuardPctThreshold(value: number, errorCode: string, ruleId: string): number {
    const thresholdPct = value <= 1 ? Number((value * 100).toFixed(4)) : value
    if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct >= 100) {
      throw new Error(`codegen.${errorCode}:${ruleId}:${thresholdPct}`)
    }
    return thresholdPct
  }

  private normalizeRangePositionThreshold(value: number): number {
    if (!Number.isFinite(value)) return 0.5
    const normalized = value > 1 ? value / 100 : value
    return Number(Math.min(1, Math.max(0, normalized)).toFixed(4))
  }

  // ─────────────────────────────────────────────────────────────
  // Issue #1279 PR3a — IR shape helper exposure
  //
  // 把 service 内 private ensure*/upsertPredicate/readNumber/resolveComparisonKind
  // 等 helper 绑定成 IrCompileHelpers，供 atom-contract-registry 内 emit.irShape
  // 真实实现消费。helpers 对象在第一次访问时缓存，避免每个 atom 重复 bind。
  // ─────────────────────────────────────────────────────────────

  private __irHelpers?: IrCompileHelpers

  private get irHelpers(): IrCompileHelpers {
    if (!this.__irHelpers) {
      this.__irHelpers = {
        ensurePriceSeries: this.ensurePriceSeries.bind(this),
        ensureMovingAverageSeries: this.ensureMovingAverageSeries.bind(this),
        ensureRsiSeries: this.ensureRsiSeries.bind(this),
        ensureBollingerSeries: this.ensureBollingerSeries.bind(this),
        ensureChannelSeries: this.ensureChannelSeries.bind(this),
        ensureRangePositionSeries: this.ensureRangePositionSeries.bind(this),
        ensureGridLevelSet: this.ensureGridLevelSet.bind(this),
        ensureStateContextSeries: this.ensureStateContextSeries.bind(this),
        ensureConstSeries: this.ensureConstSeries.bind(this),
        ensureIndicatorReferenceSeries: this.ensureIndicatorReferenceSeries.bind(this),
        resolveIndicatorCompareLeftRef: this.resolveIndicatorCompareLeftRef.bind(this),
        upsertPredicate: this.upsertPredicate.bind(this),
        readNumber: this.readNumber.bind(this),
        resolveComparisonKind: this.resolveComparisonKind.bind(this),
        normalizeRangePositionThreshold: this.normalizeRangePositionThreshold.bind(this),
        resolveMovingAverageAtomConfig: this.resolveMovingAverageAtomConfig.bind(this),
        // Issue #1313 PR3：rule-level emit shape 真实兑现需要的额外 helper（risk.partial_take_profit 等）
        ensurePositionSeries: this.ensurePositionSeries.bind(this),
        compileActions: this.compileActions.bind(this),
        // Issue #1313 PR5c：action atom 的 `emit.actionShape` 真实兑现需要 sizing 解析 helper
        //   mirror service 私有 `resolveActionQuantity`，用于 OPEN/ADD 路径的 sizing 解析。
        resolveActionQuantity: this.resolveActionQuantity.bind(this),
        // Issue #1498 S1 + S2：condition.sequence / price.previous_extrema_retest emit
        //   迁移所需的额外 helper bind 暴露。
        ensureIndicatorSeries: this.ensureIndicatorSeries.bind(this),
        ensureVolumeSeries: this.ensureVolumeSeries.bind(this),
        ensureSmaVolumeSeries: this.ensureSmaVolumeSeries.bind(this),
        readStringParam: this.readStringParam.bind(this),
        normalizeNumberToken: this.normalizeNumberToken.bind(this),
      }
    }
    return this.__irHelpers
  }

  private buildAtomIrShapeContext(context: CompileContext, seed: string, closeRef: string): IrBuildContext {
    return {
      seed,
      compileContext: context,
      helpers: this.irHelpers,
      closeRef,
    }
  }

  /**
   * Issue #1313 PR4：spec-level atom emit shape（`lifecyclePyramidingShape`，
   * 后续可能扩展 `orchestrationPortfolioRiskShape`）的调用上下文。
   * 与 `IrBuildContext` 同形但不携带 `seed` / `closeRef`（spec-level emit 在 IR 编译
   * 末段单次调用，无 per-atom seed 派生需求）。
   */
  private buildSpecLevelEmitContext(context: CompileContext): SpecLevelEmitContext {
    return {
      compileContext: context,
      helpers: this.irHelpers,
    }
  }
}
