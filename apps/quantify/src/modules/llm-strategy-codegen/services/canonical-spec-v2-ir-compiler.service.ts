import type {
  ActionDef,
  CanonicalStrategyIrV1,
  PredicateDef,
  RiskGuard,
  RuleBlock,
  SeriesDef,
} from '../types/canonical-strategy-ir'
import type {
  CanonicalConditionAtom,
  CanonicalConditionNode,
  CanonicalRuleAction,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import { Injectable } from '@nestjs/common'
import { CanonicalStrategyIrCanonicalizerService } from './canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from './canonical-strategy-ir-validator.service'
import { CanonicalSpecV2DigestService } from './canonical-spec-v2-digest.service'
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
  predicateMap: Map<string, PredicateDef>
  movingAverage: {
    kind: 'EMA' | 'SMA'
    fast: number
    slow: number
  }
  bollinger: {
    period: number
    stdDev: number
  }
}

@Injectable()
export class CanonicalSpecV2IrCompilerService {
  constructor(
    private readonly digest: CanonicalSpecV2DigestService = new CanonicalSpecV2DigestService(),
    private readonly specDescBuilder: SpecDescBuilderService = new SpecDescBuilderService(),
    private readonly validator: CanonicalStrategyIrValidatorService = new CanonicalStrategyIrValidatorService(),
    private readonly canonicalizer: CanonicalStrategyIrCanonicalizerService = new CanonicalStrategyIrCanonicalizerService(),
  ) {}

  compile(input: CompileCanonicalSpecV2ToIrInput): CompileCanonicalSpecV2ToIrResult {
    if (input.canonicalSpec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }

    const specHash = this.digest.hash(input.canonicalSpec)
    const graphSnapshot = this.buildGraphSnapshot(input)
    const rawIr = this.buildIr(input, specHash, graphSnapshot.version)
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
    graphVersion: number,
  ): CanonicalStrategyIrV1 {
    const exchange = input.canonicalSpec.market.exchange || input.fallback.exchange
    const symbol = input.canonicalSpec.market.symbol || input.fallback.symbol
    const timeframe = input.canonicalSpec.market.timeframe || input.fallback.baseTimeframe
    const requiredTimeframes = this.resolveRequiredTimeframes(input.canonicalSpec, timeframe)
    const seriesMap = new Map<string, SeriesDef>()
    const predicateMap = new Map<string, PredicateDef>()
    const context: CompileContext = {
      timeframe,
      seriesMap,
      predicateMap,
      movingAverage: this.resolveMovingAverageConfig(input.canonicalSpec),
      bollinger: this.resolveBollingerConfig(input.canonicalSpec),
    }

    const ruleBlocks: RuleBlock[] = []
    const guards: RiskGuard[] = []

    for (const rule of input.canonicalSpec.rules) {
      const guard = this.tryCompileRiskGuard(rule)
      if (guard) {
        guards.push(guard)
        continue
      }

      const when = this.compileCondition(rule.condition, context, rule.id)
      const actions = this.compileActions(rule, input.canonicalSpec, input.fallback.positionPct)
      if (actions.length === 0) {
        continue
      }

      ruleBlocks.push({
        id: rule.id,
        phase: this.mapRulePhase(rule, actions),
        when,
        priority: rule.priority,
        actions,
      })
    }

    const maxLookback = this.resolveMaxLookback(seriesMap)
    const positionMode = this.resolvePositionMode(input.canonicalSpec.rules)

    return {
      irVersion: 'csi.v1',
      source: {
        graphVersion,
        graphDigest: specHash,
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
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: maxLookback,
        maxLookback,
        requiredTimeframes,
      },
      signalCatalog: {
        series: [...seriesMap.values()],
        levelSets: [],
        predicates: [...predicateMap.values()],
      },
      ruleBlocks,
      orderPrograms: [],
      riskPolicy: {
        guards,
      },
      executionPolicy: {
        signalEvaluation: 'bar_close',
        fillPolicy: 'next_bar_open',
        timeframeAlignment: 'strict',
        orderTypeDefault: 'market',
        timeInForce: 'gtc',
        allowPartialFill: false,
      },
    }
  }

  private buildGraphSnapshot(input: CompileCanonicalSpecV2ToIrInput): StrategyLogicGraphSnapshot {
    const symbol = input.canonicalSpec.market.symbol || input.fallback.symbol
    const timeframe = input.canonicalSpec.market.timeframe || input.fallback.baseTimeframe
    const positionPct = this.resolvePositionPct(input.canonicalSpec.sizing, input.fallback.positionPct)
    const movingAverage = this.resolveMovingAverageConfig(input.canonicalSpec)
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
          operator: this.describeCondition(rule.condition, { movingAverage, bollinger }),
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
            amount: `${positionPct}%`,
          }))
      }),
      risk: input.canonicalSpec.rules
        .filter(rule => rule.phase === 'risk')
        .map(rule => `${rule.id}: ${this.describeCondition(rule.condition, { movingAverage, bollinger })}`),
      meta: {
        exchange: input.canonicalSpec.market.exchange || input.fallback.exchange,
        symbol,
        timeframe,
        positionPct,
        executionTags: input.fallback.executionTags ?? [],
      },
    }
  }

  private resolveRequiredTimeframes(spec: CanonicalStrategySpecV2, timeframe: string): string[] {
    const ordered = new Set<string>()
    ordered.add(timeframe)
    for (const item of spec.dataRequirements.requiredTimeframes) {
      if (item.trim().length > 0) {
        ordered.add(item.trim())
      }
    }
    return [...ordered]
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

  private compileCondition(
    condition: CanonicalConditionNode,
    context: CompileContext,
    seed: string,
  ): string {
    if (condition.kind === 'AND' || condition.kind === 'OR') {
      const childRefs = condition.children.map((child, index) => this.compileCondition(child, context, `${seed}_${index + 1}`))
      return this.upsertPredicate(context.predicateMap, `${seed}_${condition.kind.toLowerCase()}`, condition.kind, childRefs)
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

    throw new Error('codegen.canonical_spec_v2_condition_unsupported')
  }

  private compileAtom(atom: CanonicalConditionAtom, context: CompileContext, seed: string): string {
    const closeRef = this.ensurePriceSeries(context, 'close')

    switch (atom.key) {
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

      case 'bollinger.upper_break':
      case 'bollinger.lower_break': {
        const bandRef = atom.key === 'bollinger.upper_break'
          ? this.ensureBollingerSeries(context, 'UPPER_BAND')
          : this.ensureBollingerSeries(context, 'LOWER_BAND')
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}`,
          atom.key === 'bollinger.upper_break' ? 'CROSS_OVER' : 'CROSS_UNDER',
          [closeRef, bandRef],
        )
      }

      case 'bollinger.middle_revert': {
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
        const thresholdRef = this.ensureConstSeries(context, this.readNumber([atom.value], 0))
        return this.upsertPredicate(
          context.predicateMap,
          `${seed}_position_loss_pct`,
          this.resolveComparisonKind(atom.op),
          [lossRef, thresholdRef],
        )
      }

      default:
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}`)
    }
  }

  private ensurePriceSeries(context: CompileContext, field: 'close'): string {
    const id = `${field}_${context.timeframe}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'PRICE',
        timeframe: context.timeframe,
        field,
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

  private ensureConstSeries(context: CompileContext, value: number): string {
    const id = `const_${this.normalizeNumberToken(value)}`
    if (!context.seriesMap.has(id)) {
      context.seriesMap.set(id, {
        id,
        kind: 'CONST',
        value,
      })
    }
    return id
  }

  private upsertPredicate(
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
  ): string {
    const signature = `${kind}:${args.join('|')}`
    const existing = [...predicateMap.values()].find(predicate => `${predicate.kind}:${predicate.args.join('|')}` === signature)
    if (existing) {
      return existing.id
    }

    const id = baseId.replace(/[^a-zA-Z0-9_]+/g, '_')
    predicateMap.set(id, {
      id,
      kind,
      args,
    })
    return id
  }

  private tryCompileRiskGuard(rule: CanonicalRuleV2): RiskGuard | null {
    if (rule.phase !== 'risk' || rule.condition.kind !== 'atom' || rule.condition.key !== 'position_loss_pct') {
      return null
    }

    const threshold = this.readNumber([rule.condition.value], 0)
    const onBreach = rule.actions.some(action => action.type === 'BLOCK_NEW_ENTRY')
      ? 'BLOCK_NEW_ENTRY'
      : 'FORCE_EXIT'

    return {
      id: `guard_${rule.id}`,
      kind: 'STOP_LOSS_PCT',
      scope: 'position',
      value: threshold <= 1 ? Number((threshold * 100).toFixed(4)) : threshold,
      onBreach,
    }
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
              ? this.resolveActionQuantity(action, spec.sizing, fallbackPositionPct)
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

  private resolveActionQuantity(
    action: CanonicalRuleAction,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
  ): ActionDef['quantity'] {
    const sizing = action.sizing ?? defaultSizing
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
      }
    }

    return {
      mode: 'fixed_base',
      value: sizing.value,
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
      }
    }

    return {
      mode: 'fixed_base',
      value: spec.sizing.value,
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
    const hasShort = rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
      || action.type === 'CLOSE_SHORT'
      || action.type === 'REDUCE_SHORT'
    )))

    return hasShort ? 'long_short' : 'long_only'
  }

  private resolveMaxLookback(seriesMap: Map<string, SeriesDef>): number {
    return Math.max(1, ...[...seriesMap.values()].map(series => {
      const period = typeof series.params?.period === 'number' ? series.params.period : 1
      const bars = typeof series.params?.bars === 'number' ? series.params.bars : 1
      return Math.max(period, bars)
    }))
  }

  private describeCondition(
    condition: CanonicalConditionNode,
    config: {
      movingAverage: CompileContext['movingAverage']
      bollinger: CompileContext['bollinger']
    },
  ): string {
    if (condition.kind === 'AND' || condition.kind === 'OR') {
      return `${condition.kind}(${condition.children.map(child => this.describeCondition(child, config)).join(',')})`
    }

    if (condition.kind === 'NOT') {
      return `NOT(${this.describeCondition(condition.children[0] ?? { kind: 'atom', key: 'unknown' }, config)})`
    }

    if (!this.isConditionAtom(condition)) {
      return 'unsupported'
    }

    switch (condition.key) {
      case 'ma.golden_cross':
      case 'ma.death_cross': {
        const operator = condition.key === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER'
        return `${operator}(${config.movingAverage.kind}(CLOSE,${config.movingAverage.fast}),${config.movingAverage.kind}(CLOSE,${config.movingAverage.slow}))`
      }

      case 'bollinger.upper_break':
        return `CROSS_OVER(CLOSE,UPPER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`

      case 'bollinger.lower_break':
        return `CROSS_UNDER(CLOSE,LOWER_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev}))`

      case 'bollinger.middle_revert':
        return `OR(CROSS_OVER(CLOSE,MID_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})),CROSS_UNDER(CLOSE,MID_BAND(CLOSE,${config.bollinger.period},${config.bollinger.stdDev})))`

      case 'bollinger.bars_outside': {
        const bars = this.readNumber([condition.params?.bars, condition.value], 1)
        return `GTE(BOLLINGER_BARS_OUTSIDE(CLOSE,${config.bollinger.period},${config.bollinger.stdDev},${bars}),${this.readNumber([condition.value], bars)})`
      }

      case 'position_loss_pct':
        return `GTE(POSITION_LOSS_PCT,${this.readNumber([condition.value], 0)})`

      default:
        return condition.key
    }
  }

  private mapGraphAction(action: CanonicalRuleAction): StrategyLogicGraphSnapshot['actions'][number]['action'] | null {
    switch (action.type) {
      case 'OPEN_LONG':
        return 'BUY'
      case 'OPEN_SHORT':
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

  private resolveComparisonKind(op: CanonicalConditionAtom['op']): Extract<PredicateDef['kind'], 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'> {
    if (op === 'GTE' || op === 'LTE' || op === 'EQ') {
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
}
