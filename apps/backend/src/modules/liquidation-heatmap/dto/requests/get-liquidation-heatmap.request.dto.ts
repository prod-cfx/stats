import type { LiquidationHeatmapModelType } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'

export class GetLiquidationHeatmapRequestDto {
  @ApiPropertyOptional({
    description: '基础交易标的，例如 BTC',
    example: 'BTC',
  })
  @IsString()
  symbol!: string

  @ApiPropertyOptional({
    description: '交易所代码，例如 BINANCE、OKX',
    example: 'BINANCE',
  })
  @IsOptional()
  @IsString()
  exchangeCode?: string

  @ApiPropertyOptional({
    description: '合约类型，例如 PERPETUAL',
    example: 'PERPETUAL',
  })
  @IsOptional()
  @IsString()
  contractType?: string

  @ApiPropertyOptional({
    description: 'Coinglass Heatmap 模型类型（MODEL1 / MODEL2 / MODEL3）',
    enum: ['MODEL1', 'MODEL2', 'MODEL3'],
    default: 'MODEL3',
  })
  @IsOptional()
  @IsEnum(['MODEL1', 'MODEL2', 'MODEL3'])
  modelType?: LiquidationHeatmapModelType
}

