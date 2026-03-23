import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AccountExchangeAccountResponseDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null

  @ApiProperty({ enum: ['binance', 'okx', 'hyperliquid'] })
  exchangeId!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty()
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
