import type {
  ActionDef,
  CanonicalStrategyIrV1,
  HashString,
  LevelSetDef,
  PredicateDef,
  RiskGuard,
  RuleBlock,
  SeriesDef,
} from '../types/canonical-strategy-ir'
import type {
  SemanticActionNode,
  SemanticStrategyGraph,
  SemanticStrategyNode,
} from '../types/semantic-strategy-graph'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { CanonicalStrategyIrCanonicalizerService } from './canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from './canonical-strategy-ir-validator.service'

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

function hashCanonicalJson(value: unknown): HashString {
  const digest = createHash('sha256').update(stableJsonStringify(value)).digest('hex')
  return `sha256:${digest}`
}

interface CompilerBollingerBandTouchNode {
  id: string
  kind: 'bollinger_band_touch'
  phase: 'entry' | 'exit' | 'risk'
  params: {
    timeframe: string
    band: 'upper' | 'middle' | 'lower'
    direction: 'breakout' | 'breakdown'
    actionBias: 'long' | 'short'
    period: number
    stdDev: number
  }
}

interface CompilerBollingerBarsOutsideNode {
  id: string
  kind: 'bollinger_bars_outside'
  phase: 'entry' | 'exit' | 'risk'
  params: {
    timeframe: string
    bandSide: 'outside' | 'upper' | 'lower'
    bars: number
    effect: 'FORCE_EXIT' | 'REDUCE_POSITION' | 'BLOCK_ENTRY'
  }
}

interface CompilerGridLevelTouchNode {
  id: string
  kind: 'grid_level_touch'
  phase: 'entry' | 'exit' | 'risk'
  params: {
    timeframe: string
    range: {
      min: number
      max: number
    }
    stepPct: number
    levelCount: number
  }
}

@Injectable()
export class SemanticGraphCompilerService {
  constructor(
    private readonly validator: CanonicalStrategyIrValidatorService = new CanonicalStrategyIrValidatorService(),
    private readonly canonicalizer: CanonicalStrategyIrCanonicalizerService = new CanonicalStrategyIrCanonicalizerService(),
  ) {}

  compile(graph: SemanticStrategyGraph): CanonicalStrategyIrV1 {
    const seriesMap = new Map<string, SeriesDef>()
    const levelSetMap = new Map<string, LevelSetDef>()
    const predicateMap = new Map<string, PredicateDef>()
    const timeframes = new Set<string>([graph.market.primaryTimeframe])
    const ruleBlocks: RuleBlock[] = []

    const entryWhen = this.compilePhasePredicate(graph.nodes, 'entry', seriesMap, levelSetMap, predicateMap, timeframes)
    const exitWhen = this.compilePhasePredicate(graph.nodes, 'exit', seriesMap, levelSetMap, predicateMap, timeframes)
    const rebalanceRuleBlocks = this.compileRiskRuleBlocks(graph.nodes, seriesMap, levelSetMap, predicateMap, timeframes, graph.actions)
    const actions = this.groupActions(graph.actions)
    const riskGuards = this.compileRisk(graph.risk)
    const primaryOpenAction = graph.actions.find(action => action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT')
    const positionMode = this.resolvePositionMode(graph.actions)
    const sizingValue = primaryOpenAction?.sizePct ?? 10
    const requiredTimeframes = [...timeframes].sort()

    if (entryWhen && actions.entry.length > 0) {
      ruleBlocks.push({
        id: 'entry_rule',
        phase: 'entry',
        when: entryWhen,
        priority: 200,
        actions: actions.entry,
      })
    }

    if (exitWhen && actions.exit.length > 0) {
      ruleBlocks.push({
        id: 'exit_rule',
        phase: 'exit',
        when: exitWhen,
        priority: 100,
        actions: actions.exit,
      })
    }

    ruleBlocks.push(...rebalanceRuleBlocks)

    const ir: CanonicalStrategyIrV1 = {
      irVersion: 'csi.v1',
      source: {
        graphVersion: graph.version,
        graphDigest: hashCanonicalJson(graph),
        specHash: hashCanonicalJson(graph),
      },
      market: {
        venue: 'binance',
        instrumentType: 'spot',
        symbol: graph.market.symbol,
        timeframes: requiredTimeframes,
        priceFeed: 'close',
      },
      portfolio: {
        positionMode,
        sizing: {
          mode: 'position_pct',
          value: sizingValue,
        },
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: 1,
        maxLookback: 1,
        requiredTimeframes,
      },
      signalCatalog: {
        series: [...seriesMap.values()],
        levelSets: [...levelSetMap.values()],
        predicates: [...predicateMap.values()],
      },
      ruleBlocks,
      orderPrograms: [],
      riskPolicy: {
        guards: riskGuards,
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

    this.validator.validate(ir)
    return this.canonicalizer.canonicalize(ir)
  }

  private compilePhasePredicate(
    nodes: SemanticStrategyNode[],
    phase: 'entry' | 'exit',
    seriesMap: Map<string, SeriesDef>,
    levelSetMap: Map<string, LevelSetDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    const phaseNodes = nodes.filter(node => node.phase === phase && node.kind !== 'logical_group')
    const predicateRefs = phaseNodes
      .map(node => this.compileNode(node, seriesMap, levelSetMap, predicateMap, timeframes))
      .filter((value): value is string => value.length > 0)

    if (predicateRefs.length === 0) return ''
    if (predicateRefs.length === 1) return predicateRefs[0] ?? ''

    const predicateId = `${phase}_and_${predicateRefs.join('_')}`
    predicateMap.set(predicateId, {
      id: predicateId,
      kind: 'AND',
      args: predicateRefs,
    })
    return predicateId
  }

  private compileNode(
    node: SemanticStrategyNode,
    seriesMap: Map<string, SeriesDef>,
    levelSetMap: Map<string, LevelSetDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    if (node.kind === 'price_change_pct') {
      timeframes.add(node.params.timeframe)
      const currentSeriesId = this.ensureCloseSeries(node.params.timeframe, 0, seriesMap)
      const compareSeriesId = this.ensureCloseSeries(node.params.timeframe, node.params.right.offsetBars, seriesMap)
      const derivedSeriesId = `price_change_pct_${node.id}`
      const constId = this.ensureConstSeries(node.params.valuePct, seriesMap)
      const predicateId = `predicate_${node.id}`

      seriesMap.set(derivedSeriesId, {
        id: derivedSeriesId,
        kind: 'PRICE_CHANGE_PCT',
        timeframe: node.params.timeframe,
        inputs: [currentSeriesId, compareSeriesId],
      })
      predicateMap.set(predicateId, {
        id: predicateId,
        kind: node.params.op === 'lte' ? 'LTE' : 'GTE',
        args: [derivedSeriesId, constId],
      })
      return predicateId
    }

    if (node.kind === 'position_pnl_pct') {
      timeframes.add(node.params.timeframe)
      const seriesId = `position_pnl_pct_${node.id}`
      const constId = this.ensureConstSeries(node.params.valuePct, seriesMap)
      const predicateId = `predicate_${node.id}`

      seriesMap.set(seriesId, {
        id: seriesId,
        kind: 'POSITION_PNL_PCT',
        timeframe: node.params.timeframe,
      })
      predicateMap.set(predicateId, {
        id: predicateId,
        kind: node.params.op === 'lte' ? 'LTE' : 'GTE',
        args: [seriesId, constId],
      })
      return predicateId
    }

    if (this.isBollingerBandTouchNode(node)) {
      return this.compileBollingerBandTouch(node, seriesMap, predicateMap, timeframes)
    }

    if (this.isBollingerBarsOutsideNode(node)) {
      return this.compileBollingerBarsOutside(node, seriesMap, predicateMap, timeframes)
    }

    if (this.isGridLevelTouchNode(node)) {
      return this.compileGridLevelTouch(node, seriesMap, levelSetMap, predicateMap, timeframes)
    }

    throw new Error('codegen.semantic_graph_node_not_supported')
  }

  private compileBollingerBandTouch(
    node: CompilerBollingerBandTouchNode,
    seriesMap: Map<string, SeriesDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    timeframes.add(node.params.timeframe)
    const closeSeriesId = this.ensureCloseSeries(node.params.timeframe, 0, seriesMap)
    const bandSeriesId = this.ensureBandSeries(node, seriesMap)

    if (node.params.band === 'middle') {
      const aboveId = `predicate_${node.id}_above`
      const belowId = `predicate_${node.id}_below`
      const unionId = `predicate_${node.id}`

      predicateMap.set(aboveId, {
        id: aboveId,
        kind: 'CROSS_OVER',
        args: [closeSeriesId, bandSeriesId],
      })
      predicateMap.set(belowId, {
        id: belowId,
        kind: 'CROSS_UNDER',
        args: [closeSeriesId, bandSeriesId],
      })
      predicateMap.set(unionId, {
        id: unionId,
        kind: 'OR',
        args: [aboveId, belowId],
      })

      return unionId
    }

    const predicateId = `predicate_${node.id}`
    predicateMap.set(predicateId, {
      id: predicateId,
      kind: node.params.band === 'upper' ? 'CROSS_OVER' : 'CROSS_UNDER',
      args: [closeSeriesId, bandSeriesId],
    })
    return predicateId
  }

  private compileBollingerBarsOutside(
    node: CompilerBollingerBarsOutsideNode,
    seriesMap: Map<string, SeriesDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    timeframes.add(node.params.timeframe)
    const seriesId = `bollinger_bars_outside_${node.id}`
    const constId = this.ensureConstSeries(node.params.bars, seriesMap)
    const predicateId = `predicate_${node.id}`

    if (!seriesMap.has(seriesId)) {
      seriesMap.set(seriesId, {
        id: seriesId,
        kind: 'BOLLINGER_BARS_OUTSIDE',
        timeframe: node.params.timeframe,
        params: {
          bandSide: node.params.bandSide,
          bars: node.params.bars,
        },
      })
    }

    predicateMap.set(predicateId, {
      id: predicateId,
      kind: 'GTE',
      args: [seriesId, constId],
    })
    return predicateId
  }

  private compileGridLevelTouch(
    node: CompilerGridLevelTouchNode,
    seriesMap: Map<string, SeriesDef>,
    levelSetMap: Map<string, LevelSetDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    timeframes.add(node.params.timeframe)
    const closeSeriesId = this.ensureCloseSeries(node.params.timeframe, 0, seriesMap)
    const lowerConstId = this.ensureConstSeries(node.params.range.min, seriesMap)
    const upperConstId = this.ensureConstSeries(node.params.range.max, seriesMap)
    const levelSetId = this.ensureGridLevelSet(node, lowerConstId, upperConstId, levelSetMap)
    const predicateId = `predicate_${node.id}`

    predicateMap.set(predicateId, {
      id: predicateId,
      kind: node.phase === 'entry' ? 'TOUCH_LEVEL_DOWN' : 'TOUCH_LEVEL_UP',
      args: [closeSeriesId, levelSetId],
    })

    return predicateId
  }

  private ensureCloseSeries(
    timeframe: string,
    offsetBars: number,
    seriesMap: Map<string, SeriesDef>,
  ): string {
    const id = `close_${timeframe}_${offsetBars}`
    if (!seriesMap.has(id)) {
      seriesMap.set(id, {
        id,
        kind: 'PRICE',
        timeframe,
        field: 'close',
        offsetBars,
      })
    }
    return id
  }

  private ensureConstSeries(value: number, seriesMap: Map<string, SeriesDef>): string {
    const id = `const_${String(value).replace(/[.-]/gu, '_')}`
    if (!seriesMap.has(id)) {
      seriesMap.set(id, {
        id,
        kind: 'CONST',
        value,
      })
    }
    return id
  }

  private ensureBandSeries(
    node: CompilerBollingerBandTouchNode,
    seriesMap: Map<string, SeriesDef>,
  ): string {
    const closeSeriesId = this.ensureCloseSeries(node.params.timeframe, 0, seriesMap)
    const kind = node.params.band === 'upper'
      ? 'UPPER_BAND'
      : node.params.band === 'lower'
        ? 'LOWER_BAND'
        : 'MID_BAND'
    const id = `${kind.toLowerCase()}_${node.params.timeframe}_${node.params.period}_${String(node.params.stdDev).replace('.', '_')}`

    if (!seriesMap.has(id)) {
      seriesMap.set(id, {
        id,
        kind,
        timeframe: node.params.timeframe,
        inputs: [closeSeriesId],
        params: {
          period: node.params.period,
          stdDev: node.params.stdDev,
        },
      })
    }

    return id
  }

  private ensureGridLevelSet(
    node: CompilerGridLevelTouchNode,
    lowerConstId: string,
    upperConstId: string,
    levelSetMap: Map<string, LevelSetDef>,
  ): string {
    const id = `grid_${node.params.timeframe}_${node.params.range.min}_${node.params.range.max}_${node.params.stepPct}_${node.params.levelCount}`
    if (!levelSetMap.has(id)) {
      levelSetMap.set(id, {
        id,
        kind: 'ARITHMETIC_LEVEL_SET',
        anchorRef: lowerConstId,
        spacing: {
          mode: 'pct',
          value: node.params.stepPct,
        },
        levelsPerSide: {
          down: 0,
          up: Math.max(0, node.params.levelCount - 1),
        },
        hardBounds: {
          lowerRef: lowerConstId,
          upperRef: upperConstId,
        },
      })
    }
    return id
  }

  private groupActions(actions: SemanticActionNode[]): { entry: ActionDef[]; exit: ActionDef[] } {
    return actions.reduce(
      (acc, action) => {
        const compiled = this.compileAction(action)
        if (action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT') {
          acc.entry.push(compiled)
        } else if (action.kind === 'CLOSE_LONG' || action.kind === 'CLOSE_SHORT') {
          acc.exit.push(compiled)
        }
        return acc
      },
      { entry: [] as ActionDef[], exit: [] as ActionDef[] },
    )
  }

  private compileAction(action: SemanticActionNode): ActionDef {
    if (action.kind === 'REDUCE_POSITION') {
      return {
        kind: 'REDUCE_LONG',
        quantity: {
          mode: 'position_pct',
          value: action.sizePct,
        },
      }
    }

    return {
      kind: action.kind,
      quantity: {
        mode: 'position_pct',
        value: action.kind.startsWith('OPEN_') ? action.sizePct : 100,
      },
    }
  }

  private compileRisk(riskNodes: SemanticStrategyGraph['risk']): RiskGuard[] {
    return riskNodes.map((riskNode) => ({
      id: riskNode.id,
      kind: riskNode.kind,
      scope: 'position',
      value: riskNode.valuePct,
      onBreach: riskNode.effect === 'BLOCK_ENTRY' ? 'BLOCK_NEW_ENTRY' : 'FORCE_EXIT',
    }))
  }

  private compileRiskRuleBlocks(
    nodes: SemanticStrategyNode[],
    seriesMap: Map<string, SeriesDef>,
    levelSetMap: Map<string, LevelSetDef>,
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
    actions: SemanticActionNode[],
  ): RuleBlock[] {
    const riskNodes = nodes.filter(node => node.phase === 'risk')
    const ruleBlocks: RuleBlock[] = []
    const hasLong = actions.some(action => action.kind === 'OPEN_LONG' || action.kind === 'CLOSE_LONG')
    const hasShort = actions.some(action => action.kind === 'OPEN_SHORT' || action.kind === 'CLOSE_SHORT')

    for (const node of riskNodes) {
      if (!this.isBollingerBarsOutsideNode(node) || node.params.effect !== 'REDUCE_POSITION') {
        continue
      }

      const when = this.compileNode(node, seriesMap, levelSetMap, predicateMap, timeframes)
      const rebalanceActions: ActionDef[] = []
      if (hasLong) {
        rebalanceActions.push({
          kind: 'REDUCE_LONG',
          quantity: { mode: 'position_pct', value: 50 },
        })
      }
      if (hasShort) {
        rebalanceActions.push({
          kind: 'REDUCE_SHORT',
          quantity: { mode: 'position_pct', value: 50 },
        })
      }

      if (when && rebalanceActions.length > 0) {
        ruleBlocks.push({
          id: `rebalance_${node.id}`,
          phase: 'rebalance',
          when,
          priority: 50,
          actions: rebalanceActions,
        })
      }
    }

    return ruleBlocks
  }

  private resolvePositionMode(actions: SemanticActionNode[]): CanonicalStrategyIrV1['portfolio']['positionMode'] {
    const hasLong = actions.some(action => action.kind === 'OPEN_LONG' || action.kind === 'CLOSE_LONG')
    const hasShort = actions.some(action => action.kind === 'OPEN_SHORT' || action.kind === 'CLOSE_SHORT')
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private isBollingerBandTouchNode(node: SemanticStrategyNode): node is CompilerBollingerBandTouchNode {
    return node.kind === 'bollinger_band_touch'
  }

  private isBollingerBarsOutsideNode(node: SemanticStrategyNode): node is CompilerBollingerBarsOutsideNode {
    return node.kind === 'bollinger_bars_outside'
  }

  private isGridLevelTouchNode(node: SemanticStrategyNode): node is CompilerGridLevelTouchNode {
    return node.kind === 'grid_level_touch'
  }
}

export const __test__ = {
  hashCanonicalJson,
  stableJsonStringify,
}
