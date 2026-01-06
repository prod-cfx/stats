import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsString } from 'class-validator'

export const EXCHANGE_LONG_SHORT_TIME_RANGES = [
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '12h',
  '24h',
] as const

export type ExchangeLongShortTimeRange = (typeof EXCHANGE_LONG_SHORT_TIME_RANGES)[number]

export class GetExchangeLongShortRatioRequestDto {
  @ApiProperty({
    description: '基础资产符号，例如 BTC / ETH',
    example: 'BTC',
  })
  @IsString({ message: 'symbol 必须是字符串' })
  symbol!: string

  @ApiProperty({
    description: '统计时间范围，可选值：5m / 15m / 30m / 1h / 4h / 12h / 24h',
    example: '4h',
    enum: EXCHANGE_LONG_SHORT_TIME_RANGES,
  })
  @Type(() => String)
  @IsIn(EXCHANGE_LONG_SHORT_TIME_RANGES, {
    message: `timeRange 必须是以下值之一：${EXCHANGE_LONG_SHORT_TIME_RANGES.join(', ')}`,
  })
  timeRange!: ExchangeLongShortTimeRange
}

