import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import type { DecisionProgramNode, ExprNode, GuardProgramNode, OrderProgramNode, StrategyAstV1 } from '../types/canonical-strategy-ast'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'

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

function hashCanonicalJson(value: unknown): `sha256:${string}` {
  const digest = createHash('sha256').update(stableJsonStringify(value)).digest('hex')
  return `sha256:${digest}`
}

@Injectable()
export class CanonicalStrategyAstCompilerService {
  compile(ir: CanonicalStrategyIrV1): StrategyAstV1 {
    const exprPool = this.compileExprPool(ir)
    const guards = this.compileGuards(ir)
    const decisionPrograms = this.compileDecisionPrograms(ir)
    const orderPrograms = this.compileOrderPrograms(ir)
    const topology = this.buildTopology({ exprPool, guards, decisionPrograms, orderPrograms })

    return {
      astVersion: 'csa.v1',
      manifest: this.buildManifest(ir, { exprPool, guards, decisionPrograms, orderPrograms, topology }),
      executionModel: this.buildExecutionModel(ir),
      dataRequirements: ir.dataRequirements,
      exprPool,
      guards,
      decisionPrograms,
      orderPrograms,
      topology,
    }
  }

  private compileExprPool(ir: CanonicalStrategyIrV1): ExprNode[] {
    const seriesIndex = new Map(ir.signalCatalog.series.map(series => [series.id, series]))

    const orderedSeries = [...ir.signalCatalog.series].sort((left, right) => {
      const leftRank = this.seriesRank(left, seriesIndex)
      const rightRank = this.seriesRank(right, seriesIndex)
      if (leftRank !== rightRank) return leftRank - rightRank

      const leftPeriod = left.params?.period
      const rightPeriod = right.params?.period
      if (typeof leftPeriod === 'number' && typeof rightPeriod === 'number' && leftPeriod !== rightPeriod) {
        return leftPeriod - rightPeriod
      }

      return left.id.localeCompare(right.id)
    })

    const orderedLevelSets = [...ir.signalCatalog.levelSets].sort((left, right) => left.id.localeCompare(right.id))

    const predicatePriority = new Map<string, number>()
    for (const ruleBlock of ir.ruleBlocks) {
      const current = predicatePriority.get(ruleBlock.when)
      if (current === undefined || ruleBlock.priority < current) {
        predicatePriority.set(ruleBlock.when, ruleBlock.priority)
      }
    }

    const orderedPredicates = [...ir.signalCatalog.predicates].sort((left, right) => {
      const leftPriority = predicatePriority.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPriority = predicatePriority.get(right.id) ?? Number.MAX_SAFE_INTEGER
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return left.id.localeCompare(right.id)
    })

    const seriesNodes = orderedSeries.map((series, index) => ({
      id: `expr_${String(index + 1).padStart(2, '0')}_${series.id}`,
      sourceRef: series.id,
      nodeType: 'series' as const,
      payload: series,
      deps: (series.inputs ?? []).map(dep => this.exprIdFor(dep, ir)),
    }))

    const levelSetNodes = orderedLevelSets.map((levelSet, index) => ({
      id: `expr_${String(seriesNodes.length + index + 1).padStart(2, '0')}_${levelSet.id}`,
      sourceRef: levelSet.id,
      nodeType: 'level_set' as const,
      payload: levelSet,
      deps: [
        levelSet.anchorRef,
        levelSet.hardBounds?.lowerRef,
        levelSet.hardBounds?.upperRef,
      ].filter((dep): dep is string => typeof dep === 'string').map(dep => this.exprIdFor(dep, ir)),
    }))

    const predicateNodes = orderedPredicates.map((predicate, index) => ({
      id: `expr_${String(seriesNodes.length + levelSetNodes.length + index + 1).padStart(2, '0')}_${predicate.id}`,
      sourceRef: predicate.id,
      nodeType: 'predicate' as const,
      payload: predicate,
      deps: predicate.args.map(dep => this.exprIdFor(dep, ir)),
    }))

    return [...seriesNodes, ...levelSetNodes, ...predicateNodes]
  }

  private compileGuards(ir: CanonicalStrategyIrV1): GuardProgramNode[] {
    return ir.riskPolicy.guards.map((guard, index) => ({
      id: `guard_${String(index + 1).padStart(2, '0')}_${guard.id}`,
      sourceRef: guard.id,
      payload: guard,
    }))
  }

  private compileDecisionPrograms(ir: CanonicalStrategyIrV1): DecisionProgramNode[] {
    return ir.ruleBlocks.map((ruleBlock, index) => ({
      id: `decision_${String(index + 1).padStart(2, '0')}_${ruleBlock.id}`,
      sourceRef: ruleBlock.id,
      phase: ruleBlock.phase,
      when: this.exprIdFor(ruleBlock.when, ir),
      priority: ruleBlock.priority,
      actions: ruleBlock.actions,
    }))
  }

  private compileOrderPrograms(ir: CanonicalStrategyIrV1): OrderProgramNode[] {
    return ir.orderPrograms.map((program, index) => ({
      id: `order_${String(index + 1).padStart(2, '0')}_${program.id}`,
      sourceRef: program.id,
      payload: program,
    }))
  }

  private buildTopology(input: {
    exprPool: ExprNode[]
    guards: GuardProgramNode[]
    decisionPrograms: DecisionProgramNode[]
    orderPrograms: OrderProgramNode[]
  }): StrategyAstV1['topology'] {
    return {
      exprOrder: input.exprPool.map(item => item.id),
      guardOrder: input.guards.map(item => item.id),
      decisionOrder: input.decisionPrograms.map(item => item.id),
      orderProgramOrder: input.orderPrograms.map(item => item.id),
    }
  }

  private buildExecutionModel(ir: CanonicalStrategyIrV1): StrategyAstV1['executionModel'] {
    return {
      venue: ir.market.venue,
      instrumentType: ir.market.instrumentType,
      symbol: ir.market.symbol,
      primaryTimeframe: ir.market.timeframes[0] ?? '1h',
      timeframeAlignment: ir.executionPolicy.timeframeAlignment,
      signalEvaluation: ir.executionPolicy.signalEvaluation,
      fillPolicy: ir.executionPolicy.fillPolicy,
      defaultOrderType: ir.executionPolicy.orderTypeDefault,
      allowPartialFill: ir.executionPolicy.allowPartialFill,
    }
  }

  private buildManifest(
    ir: CanonicalStrategyIrV1,
    projection: {
      exprPool: ExprNode[]
      guards: GuardProgramNode[]
      decisionPrograms: DecisionProgramNode[]
      orderPrograms: OrderProgramNode[]
      topology: StrategyAstV1['topology']
    },
  ): StrategyAstV1['manifest'] {
    const structuralProjection = {
      exprPool: projection.exprPool,
      guards: projection.guards,
      decisionPrograms: projection.decisionPrograms,
      orderPrograms: projection.orderPrograms,
      topology: projection.topology,
      executionModel: this.buildExecutionModel(ir),
      dataRequirements: ir.dataRequirements,
    }

    return {
      irVersion: ir.irVersion,
      irHash: hashCanonicalJson(ir),
      specHash: ir.source.specHash,
      compileVersion: 'compiler.v1',
      structuralDigest: hashCanonicalJson(structuralProjection),
    }
  }

  private exprIdFor(sourceRef: string, ir: CanonicalStrategyIrV1): string {
    const seriesPosition = ir.signalCatalog.series.findIndex(item => item.id === sourceRef)
    if (seriesPosition >= 0) {
      return `expr_${String(seriesPosition + 1).padStart(2, '0')}_${sourceRef}`
    }

    const orderedLevelSets = [...ir.signalCatalog.levelSets].sort((left, right) => left.id.localeCompare(right.id))
    const levelSetPosition = orderedLevelSets.findIndex(item => item.id === sourceRef)
    const seriesCount = ir.signalCatalog.series.length
    if (levelSetPosition >= 0) {
      return `expr_${String(seriesCount + levelSetPosition + 1).padStart(2, '0')}_${sourceRef}`
    }

    const predicatePriority = new Map<string, number>()
    for (const ruleBlock of ir.ruleBlocks) {
      const current = predicatePriority.get(ruleBlock.when)
      if (current === undefined || ruleBlock.priority < current) {
        predicatePriority.set(ruleBlock.when, ruleBlock.priority)
      }
    }
    const orderedPredicates = [...ir.signalCatalog.predicates].sort((left, right) => {
      const leftPriority = predicatePriority.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPriority = predicatePriority.get(right.id) ?? Number.MAX_SAFE_INTEGER
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return left.id.localeCompare(right.id)
    })
    const predicatePosition = orderedPredicates.findIndex(item => item.id === sourceRef)
    return `expr_${String(seriesCount + orderedLevelSets.length + predicatePosition + 1).padStart(2, '0')}_${sourceRef}`
  }

  private seriesRank(series: SeriesDef, seriesIndex: Map<string, SeriesDef>): number {
    if (series.kind === 'PRICE' || series.kind === 'CONST') return 0
    if (!series.inputs || series.inputs.length === 0) return 1

    const inputRank = series.inputs.reduce((max, input) => {
      const nested = seriesIndex.get(input)
      return Math.max(max, nested ? this.seriesRank(nested, seriesIndex) : 0)
    }, 0)

    return inputRank + 1
  }
}
