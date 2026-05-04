import { createHash } from 'node:crypto'
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

const HASH_LENGTH = 8

@Injectable()
export class ClientOrderIdFactoryService {
  create(input: CreateClientOrderIdInput): string {
    const prefix = SOURCE_PREFIX[input.source]
    const readable = input.sourceId.replace(/[^a-z0-9]/gi, '')
    const hash = this.hashSuffix(input)
    const hashLength = Math.min(HASH_LENGTH, Math.max(1, input.maxLength - prefix.length))
    const readableLength = input.maxLength - prefix.length - hashLength
    const generated = `${prefix}${readable.slice(0, Math.max(0, readableLength))}${hash.slice(0, hashLength)}`
    const truncated = generated.slice(0, input.maxLength)
    const pattern = new RegExp(input.pattern, 'u')
    if (!pattern.test(truncated) || truncated.length === 0) {
      throw new Error('trading_execution_invalid_client_order_id')
    }
    return truncated
  }

  private hashSuffix(input: CreateClientOrderIdInput): string {
    return createHash('sha256')
      .update(`${input.exchangeId}:${input.source}:${input.sourceId}`)
      .digest('hex')
      .slice(0, HASH_LENGTH)
  }
}
