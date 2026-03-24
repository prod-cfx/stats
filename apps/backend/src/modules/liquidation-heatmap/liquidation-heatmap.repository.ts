import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type {
  LiquidationHeatmapCandle,
  LiquidationHeatmapCell,
  LiquidationHeatmapSnapshot,
  LiquidationHeatmapYAxis,
} from '@/prisma/prisma.types'
import type { LiquidationHeatmapModelType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface CoinglassHeatmapPayload {
  yAxis: number[]
  liquidationLeverageData: [number, number, number][]
  priceCandlesticks: [number, string, string, string, string, string][]
}

export interface CreateHeatmapSnapshotInput {
  source: 'COINGLASS'
  modelType: LiquidationHeatmapModelType
  exchangeCode?: string | null
  symbol: string
  tradingPair?: string | null
  contractType?: string | null
  timeInterval?: string | null
  valueCurrency?: string | null
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
  rawPayload?: unknown
  payload: CoinglassHeatmapPayload
}

export interface HeatmapQueryCriteria {
  symbol: string
  exchangeCode?: string | null
  contractType?: string | null
  timeInterval?: string | null
  modelType?: LiquidationHeatmapModelType
}

export interface HeatmapSnapshotWithData {
  snapshot: LiquidationHeatmapSnapshot
  yAxis: LiquidationHeatmapYAxis[]
  candles: LiquidationHeatmapCandle[]
  cells: LiquidationHeatmapCell[]
}

@Injectable()
export class LiquidationHeatmapRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /**
   * 创建一条新的 Heatmap 快照及其所有明细数据。
   */
  async createSnapshotWithData(input: CreateHeatmapSnapshotInput): Promise<HeatmapSnapshotWithData> {
    const snapshot = await this.txHost.tx.liquidationHeatmapSnapshot.create({
      data: {
        source: 'COINGLASS',
        modelType: input.modelType,
        exchangeCode: input.exchangeCode ?? null,
        symbol: input.symbol,
        tradingPair: input.tradingPair ?? null,
        contractType: input.contractType ?? null,
        timeInterval: input.timeInterval ?? null,
        valueCurrency: input.valueCurrency ?? 'USD',
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        rawPayload: input.rawPayload as any,
      },
    })

    const snapshotId = snapshot.id

    const { yAxis, liquidationLeverageData, priceCandlesticks } = input.payload

    if (yAxis.length > 0) {
      await this.txHost.tx.liquidationHeatmapYAxis.createMany({
        data: yAxis.map((price, index) => ({
          snapshotId,
          axisIndex: index,
          price: price.toString(),
        })),
      })
    }

    if (priceCandlesticks.length > 0) {
      await this.txHost.tx.liquidationHeatmapCandle.createMany({
        data: priceCandlesticks.map((candle, index) => {
          const [timestampSec, open, high, low, close, volume] = candle
          return {
            snapshotId,
            candleIndex: index,
            timestamp: new Date(timestampSec * 1000),
            open,
            high,
            low,
            close,
            volume,
          }
        }),
      })
    }

    if (liquidationLeverageData.length > 0) {
      await this.txHost.tx.liquidationHeatmapCell.createMany({
        data: liquidationLeverageData.map(([xIndex, yIndex, value]) => ({
          snapshotId,
          xIndex,
          yIndex,
          value: value.toString(),
          valueCurrency: input.valueCurrency ?? 'USD',
        })),
      })
    }

    const [yAxisRows, candles, cells] = await Promise.all([
      this.txHost.tx.liquidationHeatmapYAxis.findMany({
        where: { snapshotId },
        orderBy: { axisIndex: 'asc' },
      }),
      this.txHost.tx.liquidationHeatmapCandle.findMany({
        where: { snapshotId },
        orderBy: { candleIndex: 'asc' },
      }),
      this.txHost.tx.liquidationHeatmapCell.findMany({
        where: { snapshotId },
        orderBy: [{ xIndex: 'asc' }, { yIndex: 'asc' }],
      }),
    ])

    return {
      snapshot,
      yAxis: yAxisRows,
      candles,
      cells,
    }
  }

  /**
   * 查询最近的一条 Heatmap 快照。
   */
  async findLatestSnapshot(criteria: HeatmapQueryCriteria): Promise<LiquidationHeatmapSnapshot | null> {
    return this.txHost.tx.liquidationHeatmapSnapshot.findFirst({
      where: {
        symbol: criteria.symbol,
        // 保留三态语义：undefined=不筛选；null=只匹配 NULL；string=精确匹配
        exchangeCode: criteria.exchangeCode === undefined ? undefined : criteria.exchangeCode,
        contractType: criteria.contractType === undefined ? undefined : criteria.contractType,
        timeInterval: criteria.timeInterval === undefined ? undefined : criteria.timeInterval,
        modelType: criteria.modelType === undefined ? undefined : criteria.modelType,
      },
      orderBy: {
        fetchedAt: 'desc',
      },
    })
  }

  async getSnapshotWithDataById(id: number): Promise<HeatmapSnapshotWithData | null> {
    const snapshot = await this.txHost.tx.liquidationHeatmapSnapshot.findUnique({
      where: { id },
    })

    if (!snapshot) return null

    const [yAxis, candles, cells] = await Promise.all([
      this.txHost.tx.liquidationHeatmapYAxis.findMany({
        where: { snapshotId: id },
        orderBy: { axisIndex: 'asc' },
      }),
      this.txHost.tx.liquidationHeatmapCandle.findMany({
        where: { snapshotId: id },
        orderBy: { candleIndex: 'asc' },
      }),
      this.txHost.tx.liquidationHeatmapCell.findMany({
        where: { snapshotId: id },
        orderBy: [{ xIndex: 'asc' }, { yIndex: 'asc' }],
      }),
    ])

    return { snapshot, yAxis, candles, cells }
  }

  async getLatestSnapshotWithData(criteria: HeatmapQueryCriteria): Promise<HeatmapSnapshotWithData | null> {
    const latest = await this.findLatestSnapshot(criteria)
    if (!latest) return null
    return this.getSnapshotWithDataById(latest.id)
  }
}
