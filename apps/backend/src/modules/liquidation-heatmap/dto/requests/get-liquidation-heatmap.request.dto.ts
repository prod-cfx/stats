import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
// Nest 校验需要运行时枚举值，保留值导入
import { LiquidationHeatmapModelType } from '@/prisma/prisma.types'
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
    description: '时间区间/粒度，例如 15m、1h（用于区分不同 interval 的快照）',
    example: '15m',
    default: '15m',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timeInterval?: string

  @ApiPropertyOptional({
    description: 'Coinglass 热力图模型类型',
    enum: Object.values(LiquidationHeatmapModelType),
    default: LiquidationHeatmapModelType.MODEL3,
  })
  @IsOptional()
  @IsEnum(LiquidationHeatmapModelType)
  modelType?: LiquidationHeatmapModelType
}


