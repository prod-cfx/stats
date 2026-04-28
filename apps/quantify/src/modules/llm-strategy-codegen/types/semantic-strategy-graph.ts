import type { z } from 'zod'
import type {
  actionKindSchema,
  actionNodeSchema,
  logicalGroupParamsSchema,
  phaseSchema,
  semanticSeriesReferenceSchema,
  semanticStrategyGraphSchema,
  timeframeSchema,
  riskNodeSchema,
  riskKindSchema,
  riskEffectSchema,
  semanticExpressionOperandSchema,
  semanticGraphExpressionOperandSchema,
  semanticExpressionOperatorSchema,
  semanticPredicateGraphNodeSchema,
  semanticPredicateGraphEdgeSchema,
  semanticPredicateLogicalGroupNodeSchema,
  semanticPredicateNodeSchema,
  semanticStrategyGraphV1Schema,
  semanticStrategyPredicateGraphSchema,
} from './semantic-strategy-graph.zod'

export type SemanticStrategyGraph = z.infer<typeof semanticStrategyGraphV1Schema>
export type SemanticLegacyStrategyGraph = SemanticStrategyGraph
export type SemanticStrategyGraphContract = z.infer<typeof semanticStrategyGraphSchema>
export type SemanticStrategyGraphAny = SemanticStrategyGraphContract
export type SemanticPredicateStrategyGraph = z.infer<typeof semanticStrategyPredicateGraphSchema>
export type SemanticStrategyNode = SemanticLegacyStrategyGraph['nodes'][number]
export type SemanticPredicateNode = z.infer<typeof semanticPredicateNodeSchema>
export type SemanticPredicateLogicalGroupNode = z.infer<typeof semanticPredicateLogicalGroupNodeSchema>
export type SemanticPredicateGraphNode = z.infer<typeof semanticPredicateGraphNodeSchema>
export type SemanticPredicateGraphEdge = z.infer<typeof semanticPredicateGraphEdgeSchema>
export type SemanticActionNode = z.infer<typeof actionNodeSchema>
export type SemanticRiskNode = z.infer<typeof riskNodeSchema>

export type SemanticNodePhase = z.infer<typeof phaseSchema>
export type TimeframeString = z.infer<typeof timeframeSchema>
export type SemanticBooleanJoin = z.infer<typeof logicalGroupParamsSchema>['join']
export type SemanticActionKind = z.infer<typeof actionKindSchema>
export type SemanticRiskKind = z.infer<typeof riskKindSchema>
export type SemanticRiskEffect = z.infer<typeof riskEffectSchema>
export type SemanticSeriesReference = z.infer<typeof semanticSeriesReferenceSchema>
export type SemanticGraphExpressionOperator = z.infer<typeof semanticExpressionOperatorSchema>
export type SemanticGraphExpressionOperand = z.infer<typeof semanticGraphExpressionOperandSchema>

export type PriceChangePctNode = Extract<SemanticStrategyNode, { kind: 'price_change_pct' }>
export type PositionPnlPctNode = Extract<SemanticStrategyNode, { kind: 'position_pnl_pct' }>
export type BollingerBandTouchNode = Extract<SemanticStrategyNode, { kind: 'bollinger_band_touch' }>
export type BollingerBarsOutsideNode = Extract<SemanticStrategyNode, { kind: 'bollinger_bars_outside' }>
export type GridLevelTouchNode = Extract<SemanticStrategyNode, { kind: 'grid_level_touch' }>
export type LogicalGroupNode = Extract<SemanticStrategyNode, { kind: 'logical_group' }>

export type PriceChangePctParams = PriceChangePctNode['params']
export type PositionPnlPctParams = PositionPnlPctNode['params']
export type BollingerBandTouchParams = BollingerBandTouchNode['params']
export type BollingerBarsOutsideParams = BollingerBarsOutsideNode['params']
export type GridLevelTouchParams = GridLevelTouchNode['params']
export type LogicalGroupParams = LogicalGroupNode['params']
