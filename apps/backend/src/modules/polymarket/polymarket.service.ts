/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他模块一致 */

import { Injectable } from '@nestjs/common'
import { convertDecimalsInObject } from '@/common/utils/decimal-converter'
import type { PolymarketMarketWithOutcomes } from './polymarket.repository'
import type {
  PredictionMarketCardDto,
  PredictionMarketOutcomeDto,
  PredictionMarketRulesDto,
} from './dto/responses/prediction-market.response.dto'
// Nest 注入需要运行时引用 PolymarketRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from './polymarket.repository'

@Injectable()
export class PolymarketService {
  constructor(private readonly repo: PolymarketRepository) {}

  private isSuspectZeroProbability(input: {
    probability?: string | null
    price?: string | null
    rawPayload: unknown
  }): boolean {
    if (!input.probability) return false

    const probabilityNum = Number.parseFloat(input.probability)
    if (Number.isNaN(probabilityNum) || probabilityNum !== 0) return false

    const priceNum = input.price ? Number.parseFloat(input.price) : Number.NaN
    const isPriceMissingOrZero = !input.price || (Number.isFinite(priceNum) && priceNum === 0)
    if (!isPriceMissingOrZero) return false

    const raw = input.rawPayload
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true

    const rawObject = raw as Record<string, unknown>
    const hasAnySourceKey =
      Object.prototype.hasOwnProperty.call(rawObject, 'probability') ||
      Object.prototype.hasOwnProperty.call(rawObject, 'price') ||
      Object.prototype.hasOwnProperty.call(rawObject, 'outcomePrice') ||
      Object.prototype.hasOwnProperty.call(rawObject, 'outcome_price')

    return !hasAnySourceKey
  }

  /**
   * 列出用于前端展示的预测市场读模型。
   *
   * 约定：
   * - status 始终转换为大写（例如 open -> OPEN），便于前端做状态比较；
   * - volume24h/volumeTotal/openInterest 返回原始字符串（不带货币符号/缩写），由前端负责格式化展示；
   * - probability 保留为原始小数字符串（如 "0.6"），前端可根据需要转成百分比。
   */
  async listPredictionMarkets(params: {
    category?: string
    onlyActive?: boolean
    offset?: number
    limit?: number
  }): Promise<PredictionMarketCardDto[]> {
    const markets = await this.repo.listMarketsWithOutcomes({
      category: params.category,
      onlyActive: params.onlyActive,
      offset: params.offset,
      limit: params.limit,
    })

    return markets.map(market => this.mapMarketToCard(market))
  }

  private mapMarketToCard(market: PolymarketMarketWithOutcomes): PredictionMarketCardDto {
    const outcomes: PredictionMarketOutcomeDto[] | undefined = market.outcomes.length
      ? market.outcomes.map(outcome => {
          const { probability, price } = convertDecimalsInObject(outcome, ['probability', 'price'])

          // 最小兼容处理：只在“疑似历史兜底写 0 且无任何来源字段”的情况下将其视为缺失。
          // 注意：真实概率为 0 的场景需要保留为 "0"。
          const normalizedProbability = this.isSuspectZeroProbability({
            probability,
            price,
            rawPayload: outcome.rawPayload,
          })
            ? ''
            : probability

          return {
            label: outcome.shortName ?? outcome.name ?? outcome.outcomeTokenId,
            // 不要用 "0" 兜底：缺失数据会被前端展示为 0%，造成误导
            probability: normalizedProbability ?? price ?? '',
          }
        })
      : undefined

    const { volume24h, volumeTotal, openInterest } = convertDecimalsInObject(market, [
      'volume24h',
      'volumeTotal',
      'openInterest',
    ])

    const rules = this.buildRulesFromMarket(market)

    return {
      id: market.marketId,
      title: market.question ?? market.eventTitle ?? market.slug ?? market.marketId,
      options: outcomes,
      status: market.status ? market.status.toUpperCase() : undefined,
      volume24h: volume24h ?? undefined,
      volumeTotal: volumeTotal ?? undefined,
      openInterest: openInterest ?? undefined,
      rules,
    }
  }

  private buildRulesFromMarket(
    market: PolymarketMarketWithOutcomes,
  ): PredictionMarketRulesDto | undefined {
    const paragraphs: string[] = []

    if (market.resolutionSource) {
      paragraphs.push(`Resolution source: ${market.resolutionSource}`)
    }

    if (market.eventStartTime || market.eventEndTime) {
      const start = market.eventStartTime?.toISOString()
      const end = market.eventEndTime?.toISOString()
      if (start && end) {
        paragraphs.push(`Event window: ${start} ~ ${end}`)
      } else if (start) {
        paragraphs.push(`Event starts at: ${start}`)
      } else if (end) {
        paragraphs.push(`Event ends at: ${end}`)
      }
    }

    if (!paragraphs.length) return undefined

    return {
      paragraphs,
      createdAt: (market.lastUpdatedAt ?? market.createdAt).toISOString(),
    }
  }
}
