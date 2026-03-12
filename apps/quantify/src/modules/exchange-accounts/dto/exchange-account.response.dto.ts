import type { ExchangeId } from '@/modules/trading/core/types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExchangeAccountResponseDto {
  @ApiProperty({ description: '璐︽埛 ID' })
  id!: string

  @ApiProperty({
    description: '浜ゆ槗鎵€鏍囪瘑',
    enum: ['binance', 'okx', 'hyperliquid'],
  })
  exchangeId!: ExchangeId

  @ApiPropertyOptional({ description: '璐︽埛鍒悕' })
  name?: string | null

  @ApiProperty({ description: '鏄惁娴嬭瘯缃?, default: false })
  isTestnet!: boolean

  @ApiPropertyOptional({ description: '鏈€杩戜竴娆￠獙璇佹椂闂? })
  lastValidatedAt?: Date | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt!: Date
}
