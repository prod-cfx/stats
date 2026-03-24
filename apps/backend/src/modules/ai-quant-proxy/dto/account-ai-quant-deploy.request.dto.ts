import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class AccountAiQuantDeployRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({ enum: ['binance', 'okx', 'hyperliquid'] })
  @IsIn(['binance', 'okx', 'hyperliquid'])
  exchange!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  timeframe!: string

  @ApiProperty()
  @IsNumber()
  positionPct!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangeAccountId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strategyInstanceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangeAccountName?: string
}
