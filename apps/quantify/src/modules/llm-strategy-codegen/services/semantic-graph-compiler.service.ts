import type {
  ActionDef,
  CanonicalStrategyIrV1,
  HashString,
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

@Injectable()
export class SemanticGraphCompilerService {
  constructor(
    private readonly validator: CanonicalStrategyIrValidatorService = new CanonicalStrategyIrValidatorService(),
    private readonly canonicalizer: CanonicalStrategyIrCanonicalizerService = new CanonicalStrategyIrCanonicalizerService(),
  ) {}

  compile(graph: SemanticStrategyGraph): CanonicalStrategyIrV1 {
    const seriesMap = new Map<string, SeriesDef>()
    const predicateMap = new Map<string, PredicateDef>()
    const timeframes = new Set<string>([graph.market.primaryTimeframe])
    const ruleBlocks: RuleBlock[] = []

    const entryWhen = this.compilePhasePredicate(graph.nodes, 'entry', seriesMap, predicateMap, timeframes)
    const exitWhen = this.compilePhasePredicate(graph.nodes, 'exit', seriesMap, predicateMap, timeframes)
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
        levelSets: [],
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
    predicateMap: Map<string, PredicateDef>,
    timeframes: Set<string>,
  ): string {
    const phaseNodes = nodes.filter(node => node.phase === phase && node.kind !== 'logical_group')
    const predicateRefs = phaseNodes
      .map(node => this.compileNode(node, seriesMap, predicateMap, timeframes))
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

    throw new Error('codegen.semantic_graph_node_not_supported')
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

  private resolvePositionMode(actions: SemanticActionNode[]): CanonicalStrategyIrV1['portfolio']['positionMode'] {
    const hasLong = actions.some(action => action.kind === 'OPEN_LONG' || action.kind === 'CLOSE_LONG')
    const hasShort = actions.some(action => action.kind === 'OPEN_SHORT' || action.kind === 'CLOSE_SHORT')
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }
}

export const __test__ = {
  hashCanonicalJson,
  stableJsonStringify,
}
