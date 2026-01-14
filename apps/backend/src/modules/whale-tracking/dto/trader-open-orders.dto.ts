import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'

/**
 * 挂单详情 DTO
 */
export class OpenOrderDto {
  @ApiProperty({
    description: '订单 ID',
    example: 265007812594,
  })
  @IsNumber()
  orderId!: number

  @ApiProperty({
    description: '币种符号',
    example: 'ETH',
  })
  @IsString()
  coin!: string

  @ApiProperty({
    description: '订单方向',
    enum: ['BUY', 'SELL'],
    example: 'SELL',
  })
  @IsString()
  side!: 'BUY' | 'SELL'

  @ApiProperty({
    description: '订单类型',
    example: 'limit',
  })
  @IsString()
  type!: string

  @ApiProperty({
    description: '限价',
    example: 4277.0,
  })
  @IsNumber()
  price!: number

  @ApiProperty({
    description: '订单数量',
    example: 22000.0,
  })
  @IsNumber()
  size!: number

  @ApiProperty({
    description: '原始数量',
    example: 22000.0,
  })
  @IsNumber()
  origSize!: number

  @ApiProperty({
    description: '订单名义价值（USD）',
    example: 94094000.0,
  })
  @IsNumber()
  value!: number

  @ApiProperty({
    description: '订单创建时间（ISO 8601 格式）',
    example: '2025-12-11T10:30:00.000Z',
  })
  @IsString()
  timestamp!: string

  @ApiProperty({
    description: '触发价格（止损/止盈订单）',
    required: false,
    example: null,
  })
  @IsNumber()
  @IsOptional()
  triggerPrice?: number | null

  @ApiProperty({
    description: '触发条件',
    required: false,
    example: null,
  })
  @IsString()
  @IsOptional()
  triggerCondition?: string | null

  @ApiProperty({
    description: '是否只减仓',
    example: false,
  })
  reduceOnly!: boolean
}

/**
 * 鲸鱼交易者挂单列表响应 DTO
 */
export class TraderOpenOrdersResponseDto {
  @ApiProperty({
    description: '挂单列表',
    type: () => OpenOrderDto,
    isArray: true,
  })
  orders!: OpenOrderDto[]
}

/**
 * 查询挂单列表参数 DTO
 */
export class QueryTraderOpenOrdersDto {
  @ApiProperty({
    description: '币种符号筛选（可选）',
    required: false,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  coin?: string

  @ApiProperty({
    description: '是否跳过缓存，强制实时查询',
    required: false,
    example: false,
  })
  @IsOptional()
  skipCache?: boolean
}
