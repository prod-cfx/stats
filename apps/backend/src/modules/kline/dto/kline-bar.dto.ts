import { ApiProperty } from '@nestjs/swagger'

export class KlineBarDto {
  @ApiProperty({ example: 1704067200000, description: '时间戳（毫秒）' })
  time: number

  @ApiProperty({ example: 50123.45, description: '开盘价' })
  open: number

  @ApiProperty({ example: 50234.56, description: '最高价' })
  high: number

  @ApiProperty({ example: 50012.34, description: '最低价' })
  low: number

  @ApiProperty({ example: 50156.78, description: '收盘价' })
  close: number

  @ApiProperty({ example: 1234567.89, description: '成交量（USD）' })
  volume: number
}
