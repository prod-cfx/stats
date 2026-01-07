import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator'

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
    description: '基础资产符号，例如 BTC / ETH（会自动转为大写并去除空格）',
    example: 'BTC',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'symbol 必须是字符串' })
  @IsNotEmpty({ message: 'symbol 不能为空' })
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'symbol 必须是 2-10 位大写字母或数字',
  })
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

