import type { ExchangeId } from '@/modules/trading/core/types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExchangeAccountResponseDto {
  @ApiPropertyOptional({ description: '账户 ID', nullable: true })
  id!: string | null

  @ApiProperty({
    description: '交易所标识',
    enum: ['binance', 'okx', 'hyperliquid'],
  })
  exchangeId!: ExchangeId

  @ApiProperty({ description: '是否已绑定' })
  isBound!: boolean

  @ApiPropertyOptional({ description: '账户别名', nullable: true })
  name?: string | null

  @ApiPropertyOptional({ description: '脱敏后的凭据', nullable: true })
  maskedCredential?: string | null

  @ApiPropertyOptional({ description: '是否测试网', default: false, nullable: true })
  isTestnet!: boolean | null

  @ApiPropertyOptional({ description: '最近一次验证时间', nullable: true })
  lastValidatedAt?: Date | null

  @ApiPropertyOptional({ description: '创建时间', nullable: true })
  createdAt!: Date | null
}

