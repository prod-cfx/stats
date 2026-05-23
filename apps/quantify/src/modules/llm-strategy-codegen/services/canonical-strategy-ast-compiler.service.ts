import type { DecisionProgramNode, ExprNode, GuardProgramNode, OrderProgramNode, RiskPredicateProgramNode, StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1, PredicateDef, RiskPredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
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
  const digest = createHash('sha256').update(canonicalSerialize(value)).digest('hex')
  return `sha256:${digest}`
}

function projectByTopologyOrder<T extends { id: string }>(items: readonly T[], order: readonly string[] | undefined): T[] {
  if (!order || order.length === 0) return [...items]
  const itemIndex = new Map(items.map(item => [item.id, item]))
  return order
    .map(id => itemIndex.get(id))
    .filter((item): item is T => item !== undefined)
}

export function buildStrategyAstDigestProjection(
  ast: Omit<StrategyAstV1, 'manifest'>,
): Record<string, unknown> {
  const riskPredicates = projectByTopologyOrder(ast.riskPredicates ?? [], ast.topology.riskPredicateOrder)

  return {
    astVersion: ast.astVersion,
    executionModel: ast.executionModel,
    dataRequirements: ast.dataRequirements,
    runtimeRequirements: ast.runtimeRequirements,
    exprPool: projectByTopologyOrder(ast.exprPool, ast.topology.exprOrder),
    guards: projectByTopologyOrder(ast.guards, ast.topology.guardOrder),
    riskPredicates,
    decisionPrograms: projectByTopologyOrder(ast.decisionPrograms, ast.topology.decisionOrder),
    orderPrograms: projectByTopologyOrder(ast.orderPrograms, ast.topology.orderProgramOrder),
    ...((ast.orchestrationPortfolioRisks ?? []).length > 0 ? { orchestrationPortfolioRisks: ast.orchestrationPortfolioRisks } : {}),
    ...((ast.orchestrationPrograms ?? []).length > 0 ? { orchestrationPrograms: ast.orchestrationPrograms } : {}),
    topology: ast.topology,
  }
}

@Injectable()
export class CanonicalStrategyAstCompilerService {
  compile(ir: CanonicalStrategyIrV1): StrategyAstV1 {
    const exprPool = this.compileExprPool(ir)
    const guards = this.compileGuards(ir)
    const riskPredicates = this.compileRiskPredicates(ir)
    const decisionPrograms = this.compileDecisionPrograms(ir)
    const orderPrograms = this.compileOrderPrograms(ir)
    const orchestrationPortfolioRisks = ir.orchestrationPortfolioRisks ?? []
    const orchestrationPrograms = ir.orchestrationPrograms ?? []
    const topology = this.buildTopology({ exprPool, guards, riskPredicates, decisionPrograms, orderPrograms })

    const astBody: Omit<StrategyAstV1, 'manifest'> = {
      astVersion: 'csa.v1',
      executionModel: this.buildExecutionModel(ir),
      dataRequirements: ir.dataRequirements,
      ...(ir.runtimeRequirements ? { runtimeRequirements: ir.runtimeRequirements } : {}),
      exprPool,
      guards,
      ...(riskPredicates.length > 0 ? { riskPredicates } : {}),
      decisionPrograms,
      orderPrograms,
      ...(orchestrationPortfolioRisks.length > 0 ? { orchestrationPortfolioRisks } : {}),
      ...(orchestrationPrograms.length > 0 ? { orchestrationPrograms } : {}),
      // Phase 5 S2 (#1104): scope.symbol substrate
      ...((ir.orchestrationScopes ?? []).length > 0 ? { orchestrationScopes: ir.orchestrationScopes } : {}),
      // Phase 5 S11 (#1112): scope.leg substrate
      ...((ir.orchestrationLegScopes ?? []).length > 0 ? { orchestrationLegScopes: ir.orchestrationLegScopes } : {}),
      topology,
    }

    return {
      astVersion: astBody.astVersion,
      manifest: this.buildManifest(ir, astBody),
      executionModel: astBody.executionModel,
      dataRequirements: astBody.dataRequirements,
      ...(astBody.runtimeRequirements ? { runtimeRequirements: astBody.runtimeRequirements } : {}),
      exprPool: astBody.exprPool,
      guards: astBody.guards,
      ...(astBody.riskPredicates ? { riskPredicates: astBody.riskPredicates } : {}),
      decisionPrograms: astBody.decisionPrograms,
      orderPrograms: astBody.orderPrograms,
      ...(astBody.orchestrationPortfolioRisks ? { orchestrationPortfolioRisks: astBody.orchestrationPortfolioRisks } : {}),
      ...(astBody.orchestrationPrograms ? { orchestrationPrograms: astBody.orchestrationPrograms } : {}),
      ...(astBody.orchestrationScopes ? { orchestrationScopes: astBody.orchestrationScopes } : {}),
      ...(astBody.orchestrationLegScopes ? { orchestrationLegScopes: astBody.orchestrationLegScopes } : {}),
      topology: astBody.topology,
    }
  }

  private compileExprPool(ir: CanonicalStrategyIrV1): ExprNode[] {
    const orderedSeries = this.orderedSeries(ir)
    const orderedLevelSets = this.orderedLevelSets(ir)
    const orderedPredicates = this.orderedPredicates(ir)
    const exprIdIndex = this.buildExprIdIndex(ir, orderedSeries, orderedLevelSets, orderedPredicates)

    const seriesNodes = orderedSeries.map((series, index) => ({
      id: `expr_${String(index + 1).padStart(2, '0')}_${series.id}`,
      sourceRef: series.id,
      nodeType: 'series' as const,
      payload: series,
      deps: (series.inputs ?? []).map(dep => this.exprIdFor(dep, exprIdIndex)),
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
      ].filter((dep): dep is string => typeof dep === 'string').map(dep => this.exprIdFor(dep, exprIdIndex)),
    }))

    const predicateNodes = orderedPredicates.map((predicate, index) => ({
      id: `expr_${String(seriesNodes.length + levelSetNodes.length + index + 1).padStart(2, '0')}_${predicate.id}`,
      sourceRef: predicate.id,
      nodeType: 'predicate' as const,
      payload: predicate,
      deps: predicate.args.map(dep => this.exprIdFor(dep, exprIdIndex)),
    }))

    return [...seriesNodes, ...levelSetNodes, ...predicateNodes]
  }

  private compileGuards(ir: CanonicalStrategyIrV1): GuardProgramNode[] {
    const exprIdIndex = this.buildExprIdIndex(
      ir,
      this.orderedSeries(ir),
      this.orderedLevelSets(ir),
      this.orderedPredicates(ir),
    )
    return ir.riskPolicy.guards.map((guard, index) => ({
      id: `guard_${String(index + 1).padStart(2, '0')}_${guard.id}`,
      sourceRef: guard.id,
      payload: guard.predicateRef
        ? { ...guard, predicateRef: this.exprIdFor(guard.predicateRef, exprIdIndex) }
        : guard,
    }))
  }

  private compileRiskPredicates(ir: CanonicalStrategyIrV1): RiskPredicateProgramNode[] {
    return this.orderedRiskPredicates(ir).map((riskPredicate, index) => ({
      id: `risk_predicate_${String(index + 1).padStart(2, '0')}_${riskPredicate.id}`,
      sourceRef: riskPredicate.id,
      payload: riskPredicate,
    }))
  }

  private orderedRiskPredicates(ir: CanonicalStrategyIrV1): RiskPredicateDef[] {
    return [...(ir.riskPolicy.riskPredicates ?? [])].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
      const leftParams = stableJsonStringify(left.params)
      const rightParams = stableJsonStringify(right.params)
      if (leftParams !== rightParams) return leftParams.localeCompare(rightParams)
      return left.id.localeCompare(right.id)
    })
  }

  private compileDecisionPrograms(ir: CanonicalStrategyIrV1): DecisionProgramNode[] {
    const exprIdIndex = this.buildExprIdIndex(
      ir,
      this.orderedSeries(ir),
      this.orderedLevelSets(ir),
      this.orderedPredicates(ir),
    )
    return ir.ruleBlocks.map((ruleBlock, index) => ({
      id: `decision_${String(index + 1).padStart(2, '0')}_${ruleBlock.id}`,
      sourceRef: ruleBlock.id,
      phase: ruleBlock.phase,
      when: this.exprIdFor(ruleBlock.when, exprIdIndex),
      priority: ruleBlock.priority,
      cooldownBars: ruleBlock.cooldownBars,
      actions: ruleBlock.actions,
      ...(ruleBlock.metadata ? { metadata: ruleBlock.metadata } : {}),
    }))
  }

  private compileOrderPrograms(ir: CanonicalStrategyIrV1): OrderProgramNode[] {
    const exprIdIndex = this.buildExprIdIndex(
      ir,
      this.orderedSeries(ir),
      this.orderedLevelSets(ir),
      this.orderedPredicates(ir),
    )
    return ir.orderPrograms.map((program, index) => {
      const activeWhen = this.exprIdFor(program.activeWhen, exprIdIndex)
      return {
        id: `order_${String(index + 1).padStart(2, '0')}_${program.id}`,
        sourceRef: program.id,
        payload: program.priceSource === 'level_set'
          ? {
              ...program,
              activeWhen,
              levelSetRef: this.exprIdFor(program.levelSetRef, exprIdIndex),
            }
          : {
              ...program,
              activeWhen,
            },
      }
    })
  }

  private buildTopology(input: {
    exprPool: ExprNode[]
    guards: GuardProgramNode[]
    riskPredicates: RiskPredicateProgramNode[]
    decisionPrograms: DecisionProgramNode[]
    orderPrograms: OrderProgramNode[]
  }): StrategyAstV1['topology'] {
    return {
      exprOrder: input.exprPool.map(item => item.id),
      guardOrder: input.guards.map(item => item.id),
      ...(input.riskPredicates.length > 0 ? { riskPredicateOrder: input.riskPredicates.map(item => item.id) } : {}),
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
    astBody: Omit<StrategyAstV1, 'manifest'>,
  ): StrategyAstV1['manifest'] {
    const astProjection = buildStrategyAstDigestProjection(astBody)
    const structuralProjection = {
      exprPool: astBody.exprPool,
      guards: astBody.guards,
      riskPredicates: astBody.riskPredicates ?? [],
      decisionPrograms: astBody.decisionPrograms,
      orderPrograms: astBody.orderPrograms,
      topology: astBody.topology,
      executionModel: astBody.executionModel,
      dataRequirements: astBody.dataRequirements,
      runtimeRequirements: astBody.runtimeRequirements,
    }

    return {
      irVersion: ir.irVersion,
      irHash: hashCanonicalJson(ir),
      specHash: ir.source.specHash,
      astDigest: hashCanonicalJson(astProjection),
      compileVersion: 'compiler.v1',
      structuralDigest: hashCanonicalJson(structuralProjection),
    }
  }

  private exprIdFor(sourceRef: string, exprIdIndex: Map<string, string>): string {
    return exprIdIndex.get(sourceRef) ?? `expr_unknown_${sourceRef}`
  }

  private buildExprIdIndex(
    ir: CanonicalStrategyIrV1,
    orderedSeries = this.orderedSeries(ir),
    orderedLevelSets = this.orderedLevelSets(ir),
    orderedPredicates = this.orderedPredicates(ir),
  ): Map<string, string> {
    const index = new Map<string, string>()

    orderedSeries.forEach((series, position) => {
      index.set(series.id, `expr_${String(position + 1).padStart(2, '0')}_${series.id}`)
    })
    orderedLevelSets.forEach((levelSet, position) => {
      index.set(levelSet.id, `expr_${String(orderedSeries.length + position + 1).padStart(2, '0')}_${levelSet.id}`)
    })
    orderedPredicates.forEach((predicate, position) => {
      index.set(
        predicate.id,
        `expr_${String(orderedSeries.length + orderedLevelSets.length + position + 1).padStart(2, '0')}_${predicate.id}`,
      )
    })

    return index
  }

  private orderedSeries(ir: CanonicalStrategyIrV1): SeriesDef[] {
    const seriesIndex = new Map(ir.signalCatalog.series.map(series => [series.id, series]))

    return [...ir.signalCatalog.series].sort((left, right) => {
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
  }

  private orderedLevelSets(ir: CanonicalStrategyIrV1) {
    return [...ir.signalCatalog.levelSets].sort((left, right) => left.id.localeCompare(right.id))
  }

  private orderedPredicates(ir: CanonicalStrategyIrV1): PredicateDef[] {
    const predicatePriority = new Map<string, number>()
    for (const ruleBlock of ir.ruleBlocks) {
      const current = predicatePriority.get(ruleBlock.when)
      if (current === undefined || ruleBlock.priority < current) {
        predicatePriority.set(ruleBlock.when, ruleBlock.priority)
      }
    }

    const predicateIndex = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    const baseOrdered = [...ir.signalCatalog.predicates].sort((left, right) => {
      const leftPriority = predicatePriority.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPriority = predicatePriority.get(right.id) ?? Number.MAX_SAFE_INTEGER
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return left.id.localeCompare(right.id)
    })
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const ordered: PredicateDef[] = []

    const visit = (predicate: PredicateDef) => {
      if (visited.has(predicate.id)) return
      if (visiting.has(predicate.id)) return

      visiting.add(predicate.id)
      predicate.args.forEach((arg) => {
        const dependency = predicateIndex.get(arg)
        if (dependency) visit(dependency)
      })
      visiting.delete(predicate.id)
      visited.add(predicate.id)
      ordered.push(predicate)
    }

    baseOrdered.forEach(predicate => visit(predicate))
    return ordered
  }

  private seriesRank(series: SeriesDef, seriesIndex: Map<string, SeriesDef>): number {
    if (
      series.kind === 'PRICE'
      || series.kind === 'CONST'
      || series.kind === 'MARKET_REGIME'
      || series.kind === 'TREND_DIRECTION'
      || series.kind === 'VOLATILITY_STATE'
    ) return 0
    if (!series.inputs || series.inputs.length === 0) return 1

    const inputRank = series.inputs.reduce((max, input) => {
      const nested = seriesIndex.get(input)
      return Math.max(max, nested ? this.seriesRank(nested, seriesIndex) : 0)
    }, 0)

    return inputRank + 1
  }
}
