import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Min, Validate, ValidatorConstraint } from 'class-validator'

@ValidatorConstraint({ name: 'timeRangeValidator', async: false })
class TimeRangeValidator implements ValidatorConstraintInterface {
  private getMaxRangeByInterval(interval: string): number {
    const DAY = 24 * 60 * 60
    switch (interval) {
      case '1m':
      case '5m':
      case '15m':
        return 7 * DAY // 7 天
      case '1h':
        return 30 * DAY // 30 天
      case '4h':
        return 90 * DAY // 90 天
      case '1d':
        return 365 * DAY // 365 天
      default:
        return 7 * DAY // 默认 7 天
    }
  }

  private getMaxRangeDays(interval: string): number {
    switch (interval) {
      case '1m':
      case '5m':
      case '15m':
        return 7
      case '1h':
        return 30
      case '4h':
        return 90
      case '1d':
        return 365
      default:
        return 7
    }
  }

  validate(to: number, args: ValidationArguments) {
    const obj = args.object as QueryKlineDto
    if (to < obj.from) {
      return false
    }

    const maxRange = this.getMaxRangeByInterval(obj.interval)
    return to - obj.from <= maxRange
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as QueryKlineDto
    const to = args.value as number

    if (to < obj.from) {
      return 'End time must be greater than or equal to start time'
    }

    const maxDays = this.getMaxRangeDays(obj.interval)
    return `Time range exceeds ${maxDays} days for interval ${obj.interval}`
  }
}

export class QueryKlineDto {
  @ApiProperty({ example: 'BTC', description: '币种符号' })
  @IsString()
  symbol: string

  @ApiProperty({
    example: '15m',
    enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
    description: '时间粒度',
  })
  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval: string

  @ApiProperty({ example: 1704067200, description: '起始时间（秒）' })
  @IsInt()
  @Min(0)
  from: number

  @ApiProperty({ example: 1704153600, description: '结束时间（秒）' })
  @IsInt()
  @Min(0)
  @Validate(TimeRangeValidator)
  to: number

  @ApiProperty({
    required: false,
    example: 'binance',
    description: '交易所代码（可选，不传则聚合所有交易所）',
  })
  @IsOptional()
  @IsString()
  exchange?: string
}
