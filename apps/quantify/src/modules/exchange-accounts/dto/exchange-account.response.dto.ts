import type { ExchangeId } from '@/modules/trading/core/types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExchangeAccountResponseDto {
  @ApiProperty({ description: '账户 ID' })
  id!: string

  @ApiProperty({
    description: '交易所标识',
    enum: ['binance', 'okx', 'hyperliquid'],
  })
  exchangeId!: ExchangeId

  @ApiPropertyOptional({ description: '账户别名' })
  name?: string | null

  @ApiProperty({ description: '是否测试网', default: false })
  isTestnet!: boolean

  @ApiPropertyOptional({ description: '最近一次验证时间' })
  lastValidatedAt?: Date | null

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date
}


