import type {
  CanonicalConditionAtom,
  CanonicalConditionNode,
  CanonicalRulePhase,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec-v2'
import type { SemanticGraphExpressionOperand, SemanticPredicateGraphNode, SemanticPredicateStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyLogicGraphActionNode, StrategyLogicGraphSnapshot, StrategyLogicGraphTriggerNode } from '../types/strategy-logic-graph-snapshot'
import { Injectable } from '@nestjs/common'
import { semanticStrategyPredicateGraphSchema } from '../types/semantic-strategy-graph.zod'

interface GraphSpecMarket {
  symbols?: unknown
  timeframes?: unknown
}

interface GraphSpecDesc {
  market?: GraphSpecMarket
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

interface BuildGraphSnapshotInput {
  version: number
  specDesc: Record<string, unknown>
  fallback: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
    executionTags?: string[]
  }
}

interface BuildSemanticArtifactsInput {
  canonicalSpec: CanonicalStrategySpecV2
}

function asStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function stringifyRiskRule(key: string, value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`
  }

  return `${key}: ${JSON.stringify(value)}`
}

@Injectable()
export class CodegenGraphSnapshotService {
  /**
   * Legacy checklist graph snapshot builder. It preserves the old publication
   * boundary that stores human-readable trigger operators from specDesc.
   */
  build(input: BuildGraphSnapshotInput): StrategyLogicGraphSnapshot {
    const spec = (input.specDesc && typeof input.specDesc === 'object' ? input.specDesc : {}) as GraphSpecDesc
    const entryRules = asStringList(spec.entryRules)
    const exitRules = asStringList(spec.exitRules)
    const marketSymbols = asStringList(spec.market?.symbols)
    const timeframes = asStringList(spec.market?.timeframes)
    const riskRules = spec.riskRules && typeof spec.riskRules === 'object' ? spec.riskRules : {}
    const symbol = marketSymbols[0] || input.fallback.symbol

    return {
      version: input.version,
      status: 'confirmed',
      trigger: this.buildTriggerNodes(input.version, entryRules, exitRules),
      actions: this.buildActionNodes(input.version, symbol, input.fallback.positionPct, entryRules, exitRules),
      risk: Object.entries(riskRules).map(([key, value]) => stringifyRiskRule(key, value)),
      meta: {
        exchange: input.fallback.exchange,
        symbol,
        timeframe: timeframes.length > 0 ? timeframes.join('/') : input.fallback.baseTimeframe,
        positionPct: input.fallback.positionPct,
        executionTags: input.fallback.executionTags ?? [],
      },
    }
  }

  buildFromSemanticArtifacts(input: BuildSemanticArtifactsInput): SemanticPredicateStrategyGraph {
    const nodes: SemanticPredicateGraphNode[] = []

    input.canonicalSpec.rules.forEach((rule) => {
      this.appendPredicateGraphNodeFromCondition(rule, rule.condition, nodes, [])
    })

    return semanticStrategyPredicateGraphSchema.parse({
      version: 2,
      nodes,
      edges: [],
    })
  }

  private appendPredicateGraphNodeFromCondition(
    rule: CanonicalRuleV2,
    condition: CanonicalConditionNode,
    nodes: SemanticPredicateGraphNode[],
    path: string[],
  ): string {
    const phase = this.toPredicatePhase(rule.phase)

    if (condition.kind === 'expression') {
      const id = this.resolvePredicateNodeId(rule.id, path, nodes)

      nodes.push({
        id,
        kind: 'predicate',
        phase,
        op: condition.op,
        left: condition.left,
        right: condition.right,
      })
      return id
    }

    if (condition.kind === 'atom') {
      const id = this.resolvePredicateNodeId(rule.id, path, nodes)
      nodes.push({
        id,
        kind: 'predicate',
        phase,
        op: condition.op ?? 'EQ',
        left: this.buildAtomGraphLeftOperand(condition),
        right: this.buildAtomGraphRightOperand(condition),
      })
      return id
    }

    if (condition.kind === 'AND' || condition.kind === 'OR' || condition.kind === 'NOT') {
      const id = this.resolvePredicateNodeId(rule.id, path, nodes)
      const childIds = condition.children.map((child, index) => {
        return this.appendPredicateGraphNodeFromCondition(
          rule,
          child,
          nodes,
          [...path, `${condition.kind.toLowerCase()}-${index + 1}`],
        )
      })
      nodes.push({
        id,
        kind: 'logical_group',
        phase,
        join: condition.kind,
        members: childIds,
      })
      return id
    }
    throw new Error('codegen.semantic_graph_condition_unsupported')
  }

  private buildAtomGraphLeftOperand(condition: CanonicalConditionAtom): SemanticGraphExpressionOperand {
    if (condition.key === 'price.change_pct') {
      return {
        kind: 'atom',
        key: condition.key,
        params: {
          basis: condition.params?.basis ?? 'prev_close',
          timeframe: condition.params?.timeframe ?? '',
          lookbackBars: condition.params?.lookbackBars ?? 1,
        },
      }
    }

    if (condition.key === 'position_gain_pct' || condition.key === 'position_loss_pct') {
      return {
        kind: 'position',
        field: 'pnl_pct',
      }
    }

    if (condition.key === 'position.has_position') {
      return {
        kind: 'position',
        field: 'has_position',
        side: typeof condition.params?.side === 'string'
          && (condition.params.side === 'long' || condition.params.side === 'short' || condition.params.side === 'both')
          ? condition.params.side
          : undefined,
      }
    }

    return {
      kind: 'atom',
      key: condition.key,
      params: {
        ...(condition.params ?? {}),
      },
    }
  }

  private buildAtomGraphRightOperand(condition: CanonicalConditionAtom): SemanticGraphExpressionOperand {
    const value = condition.value
    return {
      kind: 'constant',
      value: typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
        ? value
        : true,
    }
  }

  private resolvePredicateNodeId(ruleId: string, path: string[], nodes: SemanticPredicateGraphNode[]): string {
    const preferredId = path.length === 0 ? ruleId : `${ruleId}-${path.join('-')}`
    if (!nodes.some(node => node.id === preferredId)) {
      return preferredId
    }

    let suffix = 2
    while (nodes.some(node => node.id === `${preferredId}-${suffix}`)) {
      suffix += 1
    }
    return `${preferredId}-${suffix}`
  }

  private toPredicatePhase(phase: CanonicalRulePhase): SemanticPredicateGraphNode['phase'] {
    if (phase === 'entry' || phase === 'exit' || phase === 'risk' || phase === 'gate') {
      return phase
    }
    throw new Error(`codegen.semantic_graph_phase_unsupported:${phase}`)
  }

  private buildTriggerNodes(version: number, entryRules: string[], exitRules: string[]): StrategyLogicGraphTriggerNode[] {
    return [
      ...entryRules.map((rule, index) => ({
        id: `trigger-entry-${version}-${index}`,
        phase: 'entry' as const,
        operator: rule,
        join: index > 0 ? 'AND' as const : undefined,
      })),
      ...exitRules.map((rule, index) => ({
        id: `trigger-exit-${version}-${index}`,
        phase: 'exit' as const,
        operator: rule,
        join: (index > 0 || entryRules.length > 0) ? 'AND' as const : undefined,
      })),
    ]
  }

  private buildActionNodes(
    version: number,
    symbol: string,
    positionPct: number,
    entryRules: string[],
    exitRules: string[],
  ): StrategyLogicGraphActionNode[] {
    const actions: StrategyLogicGraphActionNode[] = []

    if (entryRules.length > 0) {
      actions.push({
        id: `action-buy-${version}`,
        action: 'BUY',
        target: symbol,
        amount: `${positionPct}%`,
      })
    }

    if (exitRules.length > 0) {
      actions.push({
        id: `action-sell-${version}`,
        action: 'SELL',
        target: symbol,
        amount: `${positionPct}%`,
      })
    }

    return actions
  }
}
