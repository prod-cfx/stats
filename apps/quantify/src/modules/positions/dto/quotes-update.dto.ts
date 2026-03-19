import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator'

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

export class QuoteInputDto {
  @ApiProperty({ description: '交易对', example: 'BTCUSDT' })
  @IsString()
  symbol!: string

  @ApiProperty({ description: '最新价格', example: '65000.12' })
  @Matches(DECIMAL_PATTERN, { message: 'price 必须是数字字符串' })
  price!: string

  @ApiProperty({ description: '来源', example: 'BINANCE', required: false })
  @IsOptional()
  @IsString()
  source?: string

  @ApiProperty({ description: '事件时间', required: false })
  @IsOptional()
  @IsDateString()
  eventTime?: string
}

export class QuotesUpdateDto {
  @ApiProperty({ type: [QuoteInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteInputDto)
  quotes!: QuoteInputDto[]
}



