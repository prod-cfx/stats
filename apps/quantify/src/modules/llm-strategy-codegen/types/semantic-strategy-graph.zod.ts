import { z } from 'zod'

export const timeframeSchema = z.string().regex(/^\d+([mhd])$/u)
export const phaseSchema = z.enum(['entry', 'exit', 'risk'])
export const predicatePhaseSchema = z.enum(['entry', 'exit', 'risk', 'gate'])
export const actionKindSchema = z.enum(['OPEN_LONG', 'CLOSE_LONG', 'OPEN_SHORT', 'CLOSE_SHORT', 'REDUCE_POSITION'])
export const riskKindSchema = z.enum(['STOP_LOSS_PCT', 'TAKE_PROFIT_PCT', 'MAX_SINGLE_LOSS_PCT'])
export const riskEffectSchema = z.enum(['FORCE_EXIT', 'REDUCE_POSITION', 'BLOCK_ENTRY'])
export const semanticExpressionOperatorSchema = z.enum([
  'GT',
  'GTE',
  'LT',
  'LTE',
  'EQ',
  'CROSS_OVER',
  'CROSS_UNDER',
])
export const basisSchema = z.enum([
  'prev_close',
  'entry_avg_price',
  'position_pnl',
  'peak_equity',
  'peak_position_pnl',
  'upper_band',
  'lower_band',
  'middle_band',
  'last_high',
  'last_low',
])

export const semanticSeriesReferenceSchema = z.object({
  source: z.literal('close'),
  offsetBars: z.number().int().min(0),
})

export const semanticExpressionSeriesOperandSchema = z.object({
  kind: z.literal('series'),
  source: z.literal('bar'),
  field: z.enum(['open', 'high', 'low', 'close']),
  offsetBars: z.number().int().min(0).optional(),
  timeframe: timeframeSchema.optional(),
})

export const semanticExpressionIndicatorOperandSchema = z.object({
  kind: z.literal('indicator'),
  name: z.enum(['sma', 'ema', 'rsi', 'macd']),
  params: z.record(z.unknown()),
  output: z.string().optional(),
})

export const semanticExpressionPositionOperandSchema = z.object({
  kind: z.literal('position'),
  field: z.enum(['avg_price', 'pnl_pct', 'bars_held', 'has_position']),
  side: z.enum(['long', 'short', 'both']).optional(),
})

export const semanticExpressionConstantOperandSchema = z.object({
  kind: z.literal('constant'),
  value: z.union([z.number(), z.string(), z.boolean()]),
  unit: z.enum(['quote', 'base', 'ratio', 'percent', 'price']).optional(),
})

export const semanticExpressionAccountOperandSchema = z.object({
  kind: z.literal('account'),
  field: z.literal('drawdown_pct'),
})

export const semanticExpressionOperandSchema = z.discriminatedUnion('kind', [
  semanticExpressionSeriesOperandSchema,
  semanticExpressionIndicatorOperandSchema,
  semanticExpressionPositionOperandSchema,
  semanticExpressionAccountOperandSchema,
  semanticExpressionConstantOperandSchema,
])

export const semanticGraphAtomOperandSchema = z.object({
  kind: z.literal('atom'),
  key: z.string().min(1),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
})

export const semanticGraphExpressionOperandSchema = z.discriminatedUnion('kind', [
  semanticExpressionSeriesOperandSchema,
  semanticExpressionIndicatorOperandSchema,
  semanticExpressionPositionOperandSchema,
  semanticExpressionAccountOperandSchema,
  semanticExpressionConstantOperandSchema,
  semanticGraphAtomOperandSchema,
])

export const priceChangePctParamsSchema = z.object({
  timeframe: timeframeSchema,
  left: semanticSeriesReferenceSchema,
  right: semanticSeriesReferenceSchema,
  op: z.enum(['gte', 'lte']),
  valuePct: z.number(),
  basis: basisSchema.optional(),
})

export const positionPnlPctParamsSchema = z.object({
  timeframe: timeframeSchema,
  op: z.enum(['gte', 'lte']),
  valuePct: z.number(),
  basis: basisSchema.optional(),
})

export const priceChangePctNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('price_change_pct'),
  params: priceChangePctParamsSchema,
})

export const positionPnlPctNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('position_pnl_pct'),
  params: positionPnlPctParamsSchema,
})

export const bollingerBandTouchParamsSchema = z.object({
  timeframe: timeframeSchema,
  band: z.enum(['upper', 'middle', 'lower']),
  direction: z.enum(['breakout', 'breakdown']),
  actionBias: z.enum(['long', 'short']),
  period: z.number().int().positive(),
  stdDev: z.number().positive(),
})

export const bollingerBandTouchNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('bollinger_band_touch'),
  params: bollingerBandTouchParamsSchema,
})

export const bollingerBarsOutsideParamsSchema = z.object({
  timeframe: timeframeSchema,
  bandSide: z.enum(['outside', 'upper', 'lower']),
  bars: z.number().int().positive(),
  effect: riskEffectSchema,
})

export const bollingerBarsOutsideNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('bollinger_bars_outside'),
  params: bollingerBarsOutsideParamsSchema,
})

export const gridLevelTouchParamsSchema = z.object({
  timeframe: timeframeSchema,
  range: z.object({
    min: z.number(),
    max: z.number(),
  }),
  stepPct: z.number().positive(),
  levelCount: z.number().int().min(1),
})

export const gridLevelTouchNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('grid_level_touch'),
  params: gridLevelTouchParamsSchema,
})

export const logicalGroupParamsSchema = z.object({
  join: z.enum(['AND', 'OR']),
  members: z.array(z.string().min(1)).min(1),
})

export const logicalGroupNodeSchema = z.object({
  id: z.string().min(1),
  phase: phaseSchema,
  kind: z.literal('logical_group'),
  params: logicalGroupParamsSchema,
})

export const actionNodeSchema = z.object({
  id: z.string().min(1),
  kind: actionKindSchema,
  sizePct: z.number().positive().max(100),
})

export const riskNodeSchema = z.object({
  id: z.string().min(1),
  kind: riskKindSchema,
  valuePct: z.number().positive(),
  effect: riskEffectSchema,
})

export const semanticStrategyGraphV1Schema = z
  .object({
    version: z.literal(1),
    market: z.object({
      symbol: z.string().min(1),
      primaryTimeframe: timeframeSchema,
    }),
    nodes: z.array(
      z.discriminatedUnion('kind', [
        priceChangePctNodeSchema,
        positionPnlPctNodeSchema,
        bollingerBandTouchNodeSchema,
        bollingerBarsOutsideNodeSchema,
        gridLevelTouchNodeSchema,
        logicalGroupNodeSchema,
      ]),
    ),
    actions: z.array(actionNodeSchema),
    risk: z.array(riskNodeSchema),
  })
  .superRefine((graph, ctx) => {
    const seenIds = new Map<string, number>()

    graph.nodes.forEach((node, index) => {
      if (seenIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate node id '${node.id}'`,
          path: ['nodes', index, 'id'],
        })
      } else {
        seenIds.set(node.id, index)
      }
    })

    graph.nodes.forEach((node, index) => {
      if (node.kind === 'logical_group') {
        node.params.members.forEach((memberId, memberIndex) => {
          if (!seenIds.has(memberId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `logical group references unknown node '${memberId}'`,
              path: ['nodes', index, 'params', 'members', memberIndex],
            })
          }
        })
      }

      if (node.kind === 'grid_level_touch') {
        if (node.params.range.min > node.params.range.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'grid level range must have min <= max',
            path: ['nodes', index, 'params', 'range'],
          })
        }
      }
    })
  })

export const semanticPredicateNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('predicate'),
  phase: predicatePhaseSchema,
  op: semanticExpressionOperatorSchema,
  left: semanticGraphExpressionOperandSchema,
  right: semanticGraphExpressionOperandSchema,
})

export const semanticPredicateLogicalGroupNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('logical_group'),
  phase: predicatePhaseSchema,
  join: z.enum(['AND', 'OR', 'NOT']),
  members: z.array(z.string().min(1)).min(1),
})

export const semanticPredicateGraphNodeSchema = z.discriminatedUnion('kind', [
  semanticPredicateNodeSchema,
  semanticPredicateLogicalGroupNodeSchema,
])

export const semanticPredicateGraphEdgeSchema = z.object({
  id: z.string().min(1).optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(['requires', 'blocks', 'enables', 'group_member']).optional(),
})

export const semanticStrategyPredicateGraphSchema = z
  .object({
    version: z.literal(2),
    nodes: z.array(semanticPredicateGraphNodeSchema),
    edges: z.array(semanticPredicateGraphEdgeSchema),
  })
  .superRefine((graph, ctx) => {
    const seenIds = new Map<string, number>()

    graph.nodes.forEach((node, index) => {
      if (seenIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate node id '${node.id}'`,
          path: ['nodes', index, 'id'],
        })
      } else {
        seenIds.set(node.id, index)
      }
    })

    graph.nodes.forEach((node, index) => {
      if (node.kind !== 'logical_group') return

      node.members.forEach((memberId, memberIndex) => {
        if (!seenIds.has(memberId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `logical group references unknown node '${memberId}'`,
            path: ['nodes', index, 'members', memberIndex],
          })
        }
      })

      if (node.join === 'NOT' && node.members.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'NOT logical group must have exactly one member',
          path: ['nodes', index, 'members'],
        })
      }
    })

    graph.edges.forEach((edge, index) => {
      if (!seenIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge references unknown source node '${edge.from}'`,
          path: ['edges', index, 'from'],
        })
      }
      if (!seenIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge references unknown target node '${edge.to}'`,
          path: ['edges', index, 'to'],
        })
      }
    })
  })

export const semanticStrategyGraphSchema = z.union([
  semanticStrategyGraphV1Schema,
  semanticStrategyPredicateGraphSchema,
])
