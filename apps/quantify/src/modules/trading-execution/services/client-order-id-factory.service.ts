import { Injectable } from '@nestjs/common'
import type { ExchangeId } from '@/modules/trading/core/types'
import type { OrderIntentSource } from '../types/trading-execution.types'

interface CreateClientOrderIdInput {
  exchangeId: ExchangeId
  source: OrderIntentSource
  sourceId: string
  maxLength: number
  pattern: string
}

const SOURCE_PREFIX: Record<OrderIntentSource, string> = {
  grid: 'g',
  signal: 's',
  position_tool: 'p',
}

@Injectable()
export class ClientOrderIdFactoryService {
  create(input: CreateClientOrderIdInput): string {
    const prefix = SOURCE_PREFIX[input.source]
    const alphanumeric = `${prefix}${input.sourceId}`.replace(/[^a-z0-9]/gi, '')
    const truncated = alphanumeric.slice(0, input.maxLength)
    const pattern = new RegExp(input.pattern, 'u')
    if (!pattern.test(truncated) || truncated.length === 0) {
      throw new Error('trading_execution_invalid_client_order_id')
    }
    return truncated
  }
}
