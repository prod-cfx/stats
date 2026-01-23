import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Min, Validate, ValidatorConstraint } from 'class-validator'

@ValidatorConstraint({ name: 'timeRangeValidator', async: false })
class TimeRangeValidator implements ValidatorConstraintInterface {
  validate(to: number, args: ValidationArguments) {
    const obj = args.object as QueryKlineDto
    const maxRange = 7 * 24 * 60 * 60 // 7 天（秒）
    if (to < obj.from) {
      return false
    }

    return to - obj.from <= maxRange
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as QueryKlineDto
    const to = args.value as number

    if (to < obj.from) {
      return 'End time must be greater than or equal to start time'
    }

    return 'Time range exceeds 7 days'
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
