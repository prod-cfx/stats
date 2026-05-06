import type { ActionDef, CanonicalStrategyIrV1, PredicateDef, RiskGuard, SeriesDef } from '../types/canonical-strategy-ir'
import type { ParsedOperatorNode, StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import type { CanonicalStrategyIrCanonicalizerService } from './canonical-strategy-ir-canonicalizer.service'
import type { CanonicalStrategyIrValidatorService } from './canonical-strategy-ir-validator.service'
import type { GraphOperatorParserService } from './graph-operator-parser.service'
import type { GraphSemanticProjectionService } from './graph-semantic-projection.service'
import { Injectable } from '@nestjs/common'

interface CompiledSignals {
  series: SeriesDef[]
  predicates: PredicateDef[]
  predicateRef: string
  maxLookback: number
}

@Injectable()
export class CanonicalStrategyIrCompilerService {
  constructor(
    private readonly parser: GraphOperatorParserService,
    private readonly projection: GraphSemanticProjectionService,
    private readonly validator: CanonicalStrategyIrValidatorService,
    private readonly canonicalizer: CanonicalStrategyIrCanonicalizerService,
  ) {}

  compile(graph: StrategyLogicGraphSnapshot): CanonicalStrategyIrV1 {
    this.assertJoinConsistency(graph)

    const timeframe = graph.meta.timeframe.split('/')[0] || '1h'
    const entrySignals = this.compilePhaseSignals(graph, 'entry', timeframe)
    const exitSignals = this.compilePhaseSignals(graph, 'exit', timeframe)
    const riskGuards = this.compileRisk(graph.risk)

    const ir: CanonicalStrategyIrV1 = {
      irVersion: 'csi.v1',
      source: this.projection.buildSource(graph),
      market: {
        venue: graph.meta.exchange,
        instrumentType: 'spot',
        symbol: graph.meta.symbol,
        timeframes: [timeframe],
        priceFeed: 'close',
      },
      portfolio: {
        positionMode: 'long_only',
        sizing: {
          mode: 'pct_equity',
          value: graph.meta.positionPct,
        },
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: Math.max(entrySignals.maxLookback, exitSignals.maxLookback, 1),
        maxLookback: Math.max(entrySignals.maxLookback, exitSignals.maxLookback, 1),
        requiredTimeframes: [timeframe],
      },
      signalCatalog: {
        series: this.mergeSeries(entrySignals.series, exitSignals.series),
        levelSets: [],
        predicates: this.mergePredicates(entrySignals.predicates, exitSignals.predicates),
      },
      ruleBlocks: [
        ...(entrySignals.predicateRef
          ? [{
              id: 'entry_long',
              phase: 'entry' as const,
              when: entrySignals.predicateRef,
              priority: 200,
              actions: [this.compileAction('BUY', graph.meta.positionPct)],
            }]
          : []),
        ...(exitSignals.predicateRef
          ? [{
              id: 'exit_long',
              phase: 'exit' as const,
              when: exitSignals.predicateRef,
              priority: 100,
              actions: [this.compileAction('SELL', graph.meta.positionPct)],
            }]
          : []),
      ],
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

  private assertJoinConsistency(graph: StrategyLogicGraphSnapshot): void {
    const phaseJoins = new Map<string, Set<string>>()

    for (const node of graph.trigger) {
      if (!node.join) continue
      const joins = phaseJoins.get(node.phase) ?? new Set<string>()
      joins.add(node.join)
      phaseJoins.set(node.phase, joins)
      if (joins.size > 1) {
        throw new Error('codegen.graph_join_ambiguous')
      }
    }
  }

  private compilePhaseSignals(
    graph: StrategyLogicGraphSnapshot,
    phase: 'entry' | 'exit',
    timeframe: string,
  ): CompiledSignals {
    const nodes = graph.trigger.filter(item => item.phase === phase)
    if (nodes.length === 0) {
      return {
        series: [],
        predicates: [],
        predicateRef: '',
        maxLookback: 1,
      }
    }

    const seriesMap = new Map<string, SeriesDef>()
    const predicateMap = new Map<string, PredicateDef>()
    let maxLookback = 1
    let predicateRef = ''

    for (const node of nodes) {
      const parsed = this.parser.parse(node.operator)
      const compiled = this.compilePredicateNode(parsed, timeframe, seriesMap, predicateMap)
      predicateRef = compiled
      maxLookback = Math.max(maxLookback, this.readLookbackFromTree(parsed))
    }

    return {
      series: [...seriesMap.values()],
      predicates: [...predicateMap.values()],
      predicateRef,
      maxLookback,
    }
  }

  private compilePredicateNode(
    node: ParsedOperatorNode,
    timeframe: string,
    seriesMap: Map<string, SeriesDef>,
    predicateMap: Map<string, PredicateDef>,
  ): string {
    if (node.kind !== 'CALL') {
      throw new Error('codegen.graph_operator_invalid')
    }

    const predicateKind = this.readPredicateKind(node.name)
    if (!predicateKind) {
      throw new Error('codegen.graph_operator_invalid')
    }

    const args = node.args.map(arg => this.compileOperand(arg, timeframe, seriesMap, predicateMap))
    const predicateId = this.buildPredicateId(predicateKind, args)

    if (!predicateMap.has(predicateId)) {
      predicateMap.set(predicateId, {
        id: predicateId,
        kind: predicateKind,
        args,
      })
    }

    return predicateId
  }

  private compileOperand(
    node: ParsedOperatorNode,
    timeframe: string,
    seriesMap: Map<string, SeriesDef>,
    predicateMap: Map<string, PredicateDef>,
  ): string {
    if (node.kind === 'IDENT') {
      if (node.name === 'CLOSE') {
        const id = `close_${timeframe}`
        if (!seriesMap.has(id)) {
          seriesMap.set(id, {
            id,
            kind: 'PRICE',
            timeframe,
            field: 'close',
          })
        }
        return id
      }

      return node.name.toLowerCase()
    }

    if (node.kind === 'NUMBER') {
      const value = Number(node.value)
      const id = `const_${String(value).replace('.', '_')}`
      if (!seriesMap.has(id)) {
        seriesMap.set(id, {
          id,
          kind: 'CONST',
          value,
        })
      }
      return id
    }

    const indicatorKind = this.readSeriesKind(node.name)
    if (indicatorKind) {
      const primaryInput = node.args[0] ? this.compileOperand(node.args[0], timeframe, seriesMap, predicateMap) : undefined
      const period = this.readPeriod(node.args[1])
      const id = `${node.name.toLowerCase()}_${period}`

      if (!seriesMap.has(id)) {
        seriesMap.set(id, {
          id,
          kind: indicatorKind,
          inputs: primaryInput ? [primaryInput] : undefined,
          params: period ? { period } : undefined,
        })
      }

      return id
    }

    return this.compilePredicateNode(node, timeframe, seriesMap, predicateMap)
  }

  private compileAction(action: 'BUY' | 'SELL' | 'CLOSE', positionPct: number): ActionDef {
    if (action === 'BUY') {
      return {
        kind: 'OPEN_LONG',
        quantity: { mode: 'pct_equity', value: positionPct },
      }
    }

    return {
      kind: 'CLOSE_LONG',
      quantity: { mode: 'position_pct', value: 100 },
    }
  }

  private compileRisk(riskRules: string[]): RiskGuard[] {
    const guards: RiskGuard[] = []

    for (const risk of riskRules) {
      const expression = risk.includes(':') ? risk.split(':').slice(1).join(':').trim() : risk.trim()
      if (!expression) continue

      const parsed = this.parser.parse(expression)
      if (parsed.kind !== 'CALL') continue
      const value = this.readPeriod(parsed.args[0])
      if (!value) continue

      if (parsed.name === 'STOP_LOSS_PCT') {
        guards.push({
          id: `stop_loss_${value}`,
          kind: 'STOP_LOSS_PCT',
          scope: 'position',
          value,
          onBreach: 'FORCE_EXIT',
        })
      }
    }

    return guards
  }

  private mergeSeries(left: SeriesDef[], right: SeriesDef[]): SeriesDef[] {
    const merged = new Map<string, SeriesDef>()
    for (const item of [...left, ...right]) {
      merged.set(item.id, item)
    }
    return [...merged.values()]
  }

  private mergePredicates(left: PredicateDef[], right: PredicateDef[]): PredicateDef[] {
    const merged = new Map<string, PredicateDef>()
    for (const item of [...left, ...right]) {
      merged.set(item.id, item)
    }
    return [...merged.values()]
  }

  private readSeriesKind(name: string): SeriesDef['kind'] | null {
    switch (name) {
      case 'EMA':
        return 'EMA'
      case 'SMA':
        return 'SMA'
      case 'RSI':
        return 'RSI'
      case 'ATR':
        return 'ATR'
      default:
        return null
    }
  }

  private readPredicateKind(name: string): PredicateDef['kind'] | null {
    switch (name) {
      case 'CROSS_OVER':
      case 'CROSS_UNDER':
      case 'GT':
      case 'GTE':
      case 'LT':
      case 'LTE':
      case 'EQ':
      case 'TOUCH_LEVEL_UP':
      case 'TOUCH_LEVEL_DOWN':
      case 'AND':
      case 'OR':
      case 'NOT':
      case 'allOf':
      case 'anyOf':
      case 'sequence':
      case 'compare':
      case 'cross':
        return name
      default:
        return null
    }
  }

  private buildPredicateId(kind: PredicateDef['kind'], args: string[]): string {
    if (kind === 'CROSS_OVER') return 'entry_cross'
    if (kind === 'CROSS_UNDER') return 'exit_cross'
    return `${kind.toLowerCase()}_${args.join('_')}`
  }

  private readPeriod(node: ParsedOperatorNode | undefined): number | undefined {
    return node?.kind === 'NUMBER' && Number.isFinite(node.value) ? node.value : undefined
  }

  private readLookbackFromTree(node: ParsedOperatorNode): number {
    if (node.kind === 'NUMBER') return node.value
    if (node.kind !== 'CALL') return 1
    return node.args.reduce((max, arg) => Math.max(max, this.readLookbackFromTree(arg)), 1)
  }
}
