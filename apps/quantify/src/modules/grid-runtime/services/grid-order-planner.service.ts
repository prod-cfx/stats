import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type {
  GridLevelPlan,
  GridOrderPlan,
  GridOrderRole,
  GridOrderSide,
  GridPlannedOrder,
  GridRuntimeConfigSnapshot,
  PlanGridOrdersInput,
} from '../types/grid-runtime.types'

@Injectable()
export class GridOrderPlannerService {
  planInitialOrders(input: PlanGridOrdersInput): GridOrderPlan {
    this.assertValidConfig(input.config)

    const currentPrice = this.decimal(input.currentPrice)
    if (!currentPrice.isPositive()) {
      throw new Error('grid_runtime_invalid_current_price')
    }

    const levels = this.buildLevels(input.config)
    const orders = levels.flatMap((level) => {
      const price = this.decimal(level.price)
      const comparison = price.comparedTo(currentPrice)
      if (comparison === 0) return []

      return this.buildOrdersForLevel(input.config, level.levelIndex, price, comparison)
    })

    return {
      config: input.config,
      levels,
      orders,
    }
  }

  private buildLevels(config: GridRuntimeConfigSnapshot): GridLevelPlan[] {
    return Array.from({ length: config.gridCount }, (_, levelIndex) => {
      const price = this.derivePrice(config, levelIndex)
      return {
        levelIndex,
        price: this.formatDecimal(price),
        side: config.mode === 'perp_neutral' ? 'neutral' : this.levelSideForMode(config.mode, price, config),
        role: null,
        baseQuantity: null,
        quoteBudget: config.perOrderQuote,
        status: 'planned',
      }
    })
  }

  private buildOrdersForLevel(
    config: GridRuntimeConfigSnapshot,
    levelIndex: number,
    price: Prisma.Decimal,
    comparisonToCurrent: number,
  ): GridPlannedOrder[] {
    const specs = this.orderSpecsForMode(config.mode, comparisonToCurrent)

    return specs.map(({ side, role }) => ({
      levelIndex,
      side,
      role,
      orderType: config.orderType,
      timeInForce: config.timeInForce,
      price: this.formatDecimal(price),
      quantity: this.formatDecimal(this.decimal(config.perOrderQuote).div(price)),
      quoteBudget: config.perOrderQuote,
      baseAsset: config.baseAsset,
      quoteAsset: config.quoteAsset,
    }))
  }

  private orderSpecsForMode(
    mode: GridRuntimeConfigSnapshot['mode'],
    comparisonToCurrent: number,
  ): Array<{ side: GridOrderSide, role: GridOrderRole }> {
    const belowCurrent = comparisonToCurrent < 0

    switch (mode) {
      case 'spot':
        return belowCurrent ? [{ side: 'buy', role: 'spot_buy' }] : []
      case 'perp_long':
        return belowCurrent
          ? [{ side: 'buy', role: 'open_long' }]
          : [{ side: 'sell', role: 'close_long' }]
      case 'perp_short':
        return belowCurrent
          ? [{ side: 'buy', role: 'close_short' }]
          : [{ side: 'sell', role: 'open_short' }]
      case 'perp_neutral':
        return belowCurrent
          ? [
              { side: 'buy', role: 'open_long' },
              { side: 'buy', role: 'close_short' },
            ]
          : [
              { side: 'sell', role: 'close_long' },
              { side: 'sell', role: 'open_short' },
            ]
    }
  }

  private levelSideForMode(
    mode: GridRuntimeConfigSnapshot['mode'],
    price: Prisma.Decimal,
    config: GridRuntimeConfigSnapshot,
  ): GridOrderSide {
    if (mode === 'spot') return 'buy'

    const midPrice = this.decimal(config.lowerPrice).plus(this.decimal(config.upperPrice)).div(2)
    if (mode === 'perp_long') return price.lt(midPrice) ? 'buy' : 'sell'
    if (mode === 'perp_short') return price.gt(midPrice) ? 'sell' : 'buy'

    return price.lt(midPrice) ? 'buy' : 'sell'
  }

  private derivePrice(config: GridRuntimeConfigSnapshot, levelIndex: number): Prisma.Decimal {
    const lower = this.decimal(config.lowerPrice)
    const upper = this.decimal(config.upperPrice)
    const step = upper.minus(lower).div(config.gridCount - 1)

    return lower.plus(step.times(levelIndex))
  }

  private assertValidConfig(config: GridRuntimeConfigSnapshot): void {
    const lower = this.decimal(config.lowerPrice)
    const upper = this.decimal(config.upperPrice)
    const perOrderQuote = this.decimal(config.perOrderQuote)

    if (!lower.isPositive() || !upper.gt(lower)) {
      throw new Error('grid_runtime_invalid_price_bounds')
    }
    if (!Number.isInteger(config.gridCount) || config.gridCount < 2) {
      throw new Error('grid_runtime_invalid_grid_count')
    }
    if (!perOrderQuote.isPositive()) {
      throw new Error('grid_runtime_invalid_per_order_quote')
    }
  }

  private decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value)
  }

  private formatDecimal(value: Prisma.Decimal): string {
    return value.toFixed()
  }
}
