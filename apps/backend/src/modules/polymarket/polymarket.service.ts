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
          const { probability } = convertDecimalsInObject(outcome, ['probability'])
          return {
            label: outcome.shortName ?? outcome.name ?? outcome.outcomeTokenId,
            probability: probability ?? '',
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

  private buildRulesFromMarket(market: PolymarketMarketWithOutcomes): PredictionMarketRulesDto | undefined {
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


