import { z } from 'zod'

export const timeframeSchema = z.string().regex(/^\d+(m|h|d)$/u)
export const phaseSchema = z.enum(['entry', 'exit', 'risk'])
export const actionKindSchema = z.enum(['OPEN_LONG', 'CLOSE_LONG', 'OPEN_SHORT', 'CLOSE_SHORT', 'REDUCE_POSITION'])
export const riskKindSchema = z.enum(['STOP_LOSS_PCT', 'TAKE_PROFIT_PCT', 'MAX_SINGLE_LOSS_PCT'])
export const riskEffectSchema = z.enum(['FORCE_EXIT', 'REDUCE_POSITION', 'BLOCK_ENTRY'])

export const semanticSeriesReferenceSchema = z.object({
  source: z.literal('close'),
  offsetBars: z.number().int().min(0),
})

export const priceChangePctParamsSchema = z.object({
  timeframe: timeframeSchema,
  left: semanticSeriesReferenceSchema,
  right: semanticSeriesReferenceSchema,
  op: z.enum(['gte', 'lte']),
  valuePct: z.number(),
})

export const positionPnlPctParamsSchema = z.object({
  timeframe: timeframeSchema,
  op: z.enum(['gte', 'lte']),
  valuePct: z.number(),
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

export const semanticStrategyGraphSchema = z
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
