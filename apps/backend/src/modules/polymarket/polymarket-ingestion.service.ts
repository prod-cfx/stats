import type {
  MarketTranslationSnapshot,
  OutcomeTokenRecord,
  PolymarketMarketWriteInput,
  PolymarketOrderbookSnapshotInput,
  PolymarketOutcomeWriteWithoutMarketInput,
} from './polymarket.repository'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from './polymarket.repository'

@Injectable()
export class PolymarketIngestionService {
  constructor(private readonly repository: PolymarketRepository) {}

  upsertMarketWithOutcomes(
    market: PolymarketMarketWriteInput,
    outcomes: PolymarketOutcomeWriteWithoutMarketInput[],
  ): Promise<void> {
    return this.repository.upsertMarketWithOutcomes(market, outcomes)
  }

  listOutcomeTokens(params: {
    category?: string | null
    limit?: number
    offset?: number
  }): Promise<OutcomeTokenRecord[]> {
    return this.repository.listOutcomeTokens(params)
  }

  saveOrderbookSnapshot(input: PolymarketOrderbookSnapshotInput): Promise<void> {
    return this.repository.saveOrderbookSnapshot(input)
  }

  findMarketsForTranslation(ids: string[]): Promise<MarketTranslationSnapshot[]> {
    return this.repository.findMarketsForTranslation(ids)
  }
}
