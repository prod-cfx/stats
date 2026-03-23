import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { z } from 'zod'
import { DomainException } from '@/common/exceptions/domain.exception'

export const HyperliquidLeverageSchema = z.object({
  type: z.enum(['cross', 'isolated']),
  value: z.number(),
})

export const HyperliquidPositionSchema = z.object({
  coin: z.string(),
  szi: z.string(),
  entryPx: z.string(),
  positionValue: z.string(),
  marginUsed: z.string(),
  unrealizedPnl: z.string(),
  liquidationPx: z.string().nullable(),
  leverage: HyperliquidLeverageSchema,
  returnOnEquity: z.string(),
  cumFunding: z.object({
    allTime: z.string(),
    sinceChange: z.string(),
    sinceOpen: z.string(),
  }),
})

export const HyperliquidAssetPositionSchema = z.object({
  position: HyperliquidPositionSchema,
})

export const HyperliquidMarginSummarySchema = z.object({
  accountValue: z.string(),
  totalMarginUsed: z.string(),
  totalNtlPos: z.string(),
  totalRawUsd: z.string().optional(),
})

export const HyperliquidClearinghouseStateSchema = z.object({
  marginSummary: HyperliquidMarginSummarySchema,
  withdrawable: z.string(),
  assetPositions: z.array(HyperliquidAssetPositionSchema),
  crossMarginSummary: HyperliquidMarginSummarySchema.optional(),
  crossMaintenanceMarginUsed: z.string().optional(),
  time: z.number(),
})

export const HyperliquidSpotBalanceSchema = z.object({
  coin: z.string(),
  token: z.number(),
  total: z.string(),
  hold: z.string(),
  entryNtl: z.string(),
})

export const HyperliquidSpotClearinghouseStateSchema = z.object({
  balances: z.array(HyperliquidSpotBalanceSchema),
})

export const HyperliquidSpotMetaUniverseSchema = z.object({
  tokens: z.array(z.number()),
  name: z.string(),
  index: z.number(),
  isCanonical: z.boolean(),
})

export const HyperliquidSpotMetaTokenSchema = z.object({
  name: z.string(),
  index: z.number(),
  tokenId: z.string(),
})

export const HyperliquidSpotMetaSchema = z.object({
  universe: z.array(HyperliquidSpotMetaUniverseSchema),
  tokens: z.array(HyperliquidSpotMetaTokenSchema),
})

export const HyperliquidAllMidsSchema = z.record(z.string(), z.string())

export const HyperliquidOpenOrderSchema = z.object({
  oid: z.number(),
  coin: z.string(),
  side: z.enum(['A', 'B']),
  limitPx: z.string(),
  sz: z.string(),
  origSz: z.string(),
  timestamp: z.number(),
  orderType: z.string().optional(),
  triggerPx: z.string().optional(),
  triggerCondition: z.string().optional(),
  reduceOnly: z.boolean().optional(),
})

export const HyperliquidUserFillSchema = z.object({
  coin: z.string(),
  px: z.string(),
  sz: z.string(),
  side: z.string(),
  time: z.number(),
  startPosition: z.string(),
  dir: z.string(),
  closedPnl: z.string(),
  hash: z.string(),
  oid: z.number(),
  crossed: z.boolean(),
  fee: z.string(),
  tid: z.number(),
  feeToken: z.string(),
})

export type HyperliquidLeverage = z.infer<typeof HyperliquidLeverageSchema>
export type HyperliquidPosition = z.infer<typeof HyperliquidPositionSchema>
export type HyperliquidAssetPosition = z.infer<typeof HyperliquidAssetPositionSchema>
export type HyperliquidMarginSummary = z.infer<typeof HyperliquidMarginSummarySchema>
export type HyperliquidClearinghouseState = z.infer<typeof HyperliquidClearinghouseStateSchema>
export type HyperliquidSpotBalance = z.infer<typeof HyperliquidSpotBalanceSchema>
export type HyperliquidSpotClearinghouseState = z.infer<
  typeof HyperliquidSpotClearinghouseStateSchema
>
export type HyperliquidSpotMeta = z.infer<typeof HyperliquidSpotMetaSchema>
export type HyperliquidAllMids = z.infer<typeof HyperliquidAllMidsSchema>
export type HyperliquidOpenOrder = z.infer<typeof HyperliquidOpenOrderSchema>
export type HyperliquidUserFill = z.infer<typeof HyperliquidUserFillSchema>

export function validateHyperliquidResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string,
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new DomainException('whale_tracking.schema_validation_error', {
        code: ErrorCode.WHALE_TRACKING_API_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Hyperliquid API response validation failed${context ? ` (${context})` : ''}: ${errorDetails}` },
      })
    }
    throw error
  }
}
