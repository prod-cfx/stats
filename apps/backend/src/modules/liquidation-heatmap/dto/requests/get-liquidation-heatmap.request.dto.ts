import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
// Nest 校验需要运行时枚举值，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { LiquidationHeatmapModelType } from '@prisma/client'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class GetLiquidationHeatmapRequestDto {
  @ApiProperty({
    description: '基础交易标的，例如 BTC',
    example: 'BTC',
  })
  @IsString()
  @IsNotEmpty()
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
    description: 'Coinglass 热力图模型类型',
    enum: Object.values(LiquidationHeatmapModelType),
    default: LiquidationHeatmapModelType.MODEL3,
  })
  @IsOptional()
  @IsEnum(LiquidationHeatmapModelType)
  modelType?: LiquidationHeatmapModelType
}


