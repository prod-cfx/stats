import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export enum WhaleAlertSide {
  Long = 'Long',
  Short = 'Short',
}

export class RealtimeWhaleAlertDto {
  @ApiProperty({ description: '鲸鱼地址（Hyperliquid 用户地址）', example: '0x481234567890abcdef1234567890abcdef1234af' })
  @IsString()
  user_address: string

  @ApiProperty({ description: '币种符号，例如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '持仓大小（正数=多头，负数=空头）',
    example: 52.06421,
  })
  @IsNumber()
  position_size: number

  @ApiProperty({
    description: '入场价格（USD）',
    example: 86148.8,
  })
  @IsNumber()
  entry_price: number

  @ApiProperty({
    description: '清算价格（USD）',
    example: 75000,
  })
  @IsNumber()
  liq_price: number

  @ApiProperty({
    description: '持仓名义价值（USD）',
    example: 4_473_877.57,
  })
  @IsNumber()
  position_value_usd: number

  @ApiProperty({
    description: '持仓操作类型：1 = 开仓, 2 = 平仓',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(2)
  position_action: number

  @ApiProperty({
    description: '持仓创建/变动时间（ISO 时间字符串）',
    example: '2025-01-01T08:00:00.000Z',
  })
  @IsDateString()
  create_time: string

  @ApiProperty({
    description:
      '持仓方向：Long / Short（由 position_size 正负推导，>= 0 视为 Long，< 0 视为 Short）',
    example: 'Long',
    enum: WhaleAlertSide,
    enumName: 'WhaleAlertSide',
  })
  @IsEnum(WhaleAlertSide)
  side: WhaleAlertSide
}

export class QueryRealtimeWhaleAlertDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '币种符号过滤，例如 BTC',
    example: 'BTC',
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiPropertyOptional({
    description: '筛选最小名义价值（USD），默认 1_000',
    example: 1_000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  min_position_value_usd?: number

  @ApiPropertyOptional({
    description: '返回记录上限，默认 50，最大 200',
    example: 50,
    default: 50,
    maximum: 200,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(200)
  override limit: number = 50

  @ApiPropertyOptional({
    description: '起始时间，用于仅返回该时间之后的记录（ISO 时间字符串），默认过去 24 小时',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  since?: string
}







