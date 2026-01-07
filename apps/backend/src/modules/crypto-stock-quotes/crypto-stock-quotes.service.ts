import type { CryptoStockQuote } from '@prisma/client'
import type { CryptoStockQuoteResponseDto } from './dto/crypto-stock-quote.dto'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 CryptoStockQuotesRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { CryptoStockQuotesRepository } from './crypto-stock-quotes.repository'
import { PUBLIC_COMPANY_CONFIG } from './public-companies.config'

@Injectable()
export class CryptoStockQuotesService {
  constructor(private readonly repo: CryptoStockQuotesRepository) {}

  /**
   * 获取指定股票代码列表的最新报价
   *
   * - 如果未传 symbols，则返回最近一段时间内每个 symbol 的最新一条记录
   * - 如果传入 symbols，则仅返回这些 symbol 的最新记录
   */
  async getLatestQuotes(
    symbols?: string[] | null,
    source?: string,
  ): Promise<CryptoStockQuoteResponseDto[]> {
    if (symbols && symbols.length > 0) {
      const entities = await this.repo.findLatestQuotesForSymbols(symbols, source)
      return entities.map(entity => this.toResponseDto(entity))
    }

    const entities = await this.repo.findLatestQuotesForAllSymbols(source)
    return entities.map(entity => this.toResponseDto(entity))
  }

  /**
   * 将 Prisma 实体映射为对外响应 DTO
   *
   * - 所有数值字段统一转为字符串，避免前后端小数精度问题
   */
  private toResponseDto(entity: CryptoStockQuote): CryptoStockQuoteResponseDto {
    const config = PUBLIC_COMPANY_CONFIG[entity.symbol]

    return {
      id: entity.id,
      symbol: entity.symbol,
      name: entity.name,
      exchange: entity.exchange,
      price: entity.price.toString(),
      openPrice: entity.openPrice != null ? entity.openPrice.toString() : null,
      highPrice: entity.highPrice != null ? entity.highPrice.toString() : null,
      lowPrice: entity.lowPrice != null ? entity.lowPrice.toString() : null,
      closePrice: entity.closePrice != null ? entity.closePrice.toString() : null,
      volume: entity.volume != null ? entity.volume.toString() : null,
      turnover: entity.turnover != null ? entity.turnover.toString() : null,
      priceChange: entity.priceChange != null ? entity.priceChange.toString() : null,
      priceChangePercent:
        entity.priceChangePercent != null ? entity.priceChangePercent.toString() : null,
      marketCap: entity.marketCap != null ? entity.marketCap.toString() : null,
      peRatio: entity.peRatio != null ? entity.peRatio.toString() : null,
      high52Week: entity.high52Week != null ? entity.high52Week.toString() : null,
      low52Week: entity.low52Week != null ? entity.low52Week.toString() : null,
      assetSymbol: config?.assetSymbol ?? null,
      assetLogoUrl: config?.assetLogoUrl ?? null,
      companyLogoUrl: config?.companyLogoUrl ?? null,
      holdingsValue: config?.holdingsValue ?? null,
      holdingsAmount: config?.holdingsAmount ?? null,
      mNav: config?.mNav ?? null,
      infoParagraphs: config?.infoParagraphs,
      source: entity.source,
      quoteTimestamp: entity.quoteTimestamp,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }
  }
}







