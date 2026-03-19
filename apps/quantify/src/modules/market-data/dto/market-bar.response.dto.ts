import { ApiProperty } from '@nestjs/swagger'

export class MarketBarDto {
  @ApiProperty({ description: '时间（ISO 字符串）' })
  time!: string

  @ApiProperty({ description: '周期', example: '1m' })
  timeframe!: string

  @ApiProperty({ description: '开盘价', example: '60000.12' })
  open!: string

  @ApiProperty({ description: '最高价', example: '60123.45' })
  high!: string

  @ApiProperty({ description: '最低价', example: '59800.00' })
  low!: string

  @ApiProperty({ description: '收盘价', example: '60010.15' })
  close!: string

  @ApiProperty({ description: '成交量', example: '123.456', nullable: true })
  volume?: string | null

  @ApiProperty({ description: '成交额', example: '123456.78', nullable: true })
  quoteVolume?: string | null

  @ApiProperty({ description: '成交笔数', example: 1234, nullable: true })
  trades?: number | null

  @ApiProperty({ description: '是否闭合', example: true })
  isFinal!: boolean
}

