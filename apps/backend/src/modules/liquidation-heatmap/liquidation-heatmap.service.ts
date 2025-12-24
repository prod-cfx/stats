import type { LiquidationHeatmapModelType } from '@prisma/client'
import type { HeatmapQueryCriteria, HeatmapSnapshotWithData } from './liquidation-heatmap.repository'
import { Injectable, NotFoundException } from '@nestjs/common'
// Nest 注入需要运行时引用 Repository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { LiquidationHeatmapRepository } from './liquidation-heatmap.repository'

export interface GetLatestHeatmapParams {
  symbol: string
  exchangeCode?: string | null
  contractType?: string | null
  modelType?: LiquidationHeatmapModelType
}

export interface LiquidationHeatmapApiShape {
  snapshotId: number
  symbol: string
  exchangeCode: string | null
  tradingPair: string | null
  contractType: string | null
  modelType: LiquidationHeatmapModelType
  timeInterval: string | null
  valueCurrency: string
  fetchedAt: Date
  effectiveFrom: Date | null
  effectiveTo: Date | null
  y_axis: number[]
  liquidation_leverage_data: [number, number, number][]
  price_candlesticks: [number, string, string, string, string, string][]
}

@Injectable()
export class LiquidationHeatmapService {
  constructor(private readonly repo: LiquidationHeatmapRepository) {}

  async getLatestHeatmap(params: GetLatestHeatmapParams): Promise<LiquidationHeatmapApiShape> {
    const criteria: HeatmapQueryCriteria = {
      symbol: params.symbol,
      exchangeCode: params.exchangeCode ?? null,
      contractType: params.contractType ?? null,
      modelType: params.modelType,
    }

    const result = await this.repo.getLatestSnapshotWithData(criteria)
    if (!result) {
      throw new NotFoundException('No liquidation heatmap snapshot found for given criteria')
    }

    return this.toApiShape(result)
  }

  private toApiShape(data: HeatmapSnapshotWithData): LiquidationHeatmapApiShape {
    const { snapshot, yAxis, candles, cells } = data

    const y_axis = yAxis
      .sort((a, b) => a.axisIndex - b.axisIndex)
      .map(y => Number(y.price))

    const price_candlesticks: [number, string, string, string, string, string][] = candles
      .sort((a, b) => a.candleIndex - b.candleIndex)
      .map(c => [
        Math.floor(c.timestamp.getTime() / 1000),
        c.open.toString(),
        c.high.toString(),
        c.low.toString(),
        c.close.toString(),
        c.volume.toString(),
      ])

    const liquidation_leverage_data: [number, number, number][] = cells
      .sort((a, b) => {
        if (a.xIndex !== b.xIndex) return a.xIndex - b.xIndex
        return a.yIndex - b.yIndex
      })
      .map(cell => [cell.xIndex, cell.yIndex, Number(cell.value)])

    return {
      snapshotId: snapshot.id,
      symbol: snapshot.symbol,
      exchangeCode: snapshot.exchangeCode,
      tradingPair: snapshot.tradingPair,
      contractType: snapshot.contractType,
      modelType: snapshot.modelType,
      timeInterval: snapshot.timeInterval,
      valueCurrency: snapshot.valueCurrency,
      fetchedAt: snapshot.fetchedAt,
      effectiveFrom: snapshot.effectiveFrom,
      effectiveTo: snapshot.effectiveTo,
      y_axis,
      liquidation_leverage_data,
      price_candlesticks,
    }
  }
}


