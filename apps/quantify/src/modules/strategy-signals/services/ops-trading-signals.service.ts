import type { SignalStatus } from '@ai/shared'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { TradingSignalRepository } from '../repositories/trading-signal.repository'

@Injectable()
export class OpsTradingSignalsService {
  constructor(
    private readonly tradingSignalRepository: TradingSignalRepository,
  ) {}

  findMany(params: {
    strategyInstanceId?: string
    strategyId?: string
    llmStrategyId?: string
    llmStrategyInstanceId?: string
    symbolId?: string
    status?: SignalStatus
    page: number
    limit: number
  }) {
    return this.tradingSignalRepository.findMany(params)
  }
}
