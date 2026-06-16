import type { WhaleNotificationOrchestratorService } from '@/modules/whale-notification/services/whale-notification-orchestrator.service'
import { Inject, Injectable } from '@nestjs/common'
import { WhaleNotificationOrchestratorService as WhaleNotificationOrchestratorServiceToken } from '@/modules/whale-notification/services/whale-notification-orchestrator.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { WhaleAlertRepository } from './whale-alert.repository'

export const WHALE_ALERT_INGESTION_SERVICE = Symbol('WHALE_ALERT_INGESTION_SERVICE')

export interface WhaleAlertIngestionPort {
  getActiveWhaleAddresses(): Promise<string[]>
  recordWhaleTrade(data: WhaleAlertTradeIngestionPayload): Promise<void>
}

export interface WhaleAlertTradeIngestionPayload {
  whaleAddress: string
  coin: string
  side: string
  tradeSize: number
  price: number
  tradeValueUsd: number
  tradeTime: Date
}

@Injectable()
export class WhaleAlertIngestionService implements WhaleAlertIngestionPort {
  constructor(
    private readonly whaleAlertRepository: WhaleAlertRepository,
    @Inject(WhaleNotificationOrchestratorServiceToken)
    private readonly whaleNotificationOrchestrator: WhaleNotificationOrchestratorService,
  ) {}

  async getActiveWhaleAddresses(): Promise<string[]> {
    const rows = await this.whaleAlertRepository.findDistinctWhaleAddresses()

    const addresses: string[] = []
    for (const row of rows) {
      const address = row.userAddress?.trim().toLowerCase()
      if (!address) continue
      addresses.push(address)
    }

    return addresses
  }

  async recordWhaleTrade(data: WhaleAlertTradeIngestionPayload): Promise<void> {
    const { whaleAddress, coin, side, tradeSize, price, tradeValueUsd, tradeTime } = data

    const insertResult = await this.whaleAlertRepository.createManyTrades([{
      userAddress: whaleAddress,
      symbol: coin,
      side,
      tradeSize,
      price,
      tradeValueUsd,
      tradeTime,
    }])

    if (insertResult.count === 0) {
      return
    }

    // 仅在首次插入成交时触发编排，避免重放历史成交产生重复通知
    await this.whaleNotificationOrchestrator.processTradeEvent({
      whaleAddress,
      symbol: coin,
      side,
      tradeValueUsd,
      tradeTime,
    })
  }
}
