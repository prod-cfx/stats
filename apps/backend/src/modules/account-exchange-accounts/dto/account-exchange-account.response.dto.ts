import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AccountExchangeAccountResponseDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null

  @ApiProperty({ enum: ['binance', 'okx', 'hyperliquid'] })
  exchangeId!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty({ description: '该交易所是否已绑定账户', example: true })
  isBound!: boolean

  @ApiPropertyOptional({ nullable: true })
  name!: string | null

  @ApiPropertyOptional({ nullable: true })
  maskedCredential!: string | null

  @ApiPropertyOptional({ nullable: true })
  isTestnet!: boolean | null

  @ApiPropertyOptional({ nullable: true })
  lastValidatedAt!: Date | null

  @ApiPropertyOptional({ nullable: true })
  createdAt!: Date | null
}
