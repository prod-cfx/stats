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
  @ApiProperty({ description: '浜ゆ槗瀵?, example: 'BTCUSDT' })
  @IsString()
  symbol!: string

  @ApiProperty({ description: '鏈€鏂颁环鏍?, example: '65000.12' })
  @Matches(DECIMAL_PATTERN, { message: 'price 蹇呴』鏄暟瀛楀瓧绗︿覆' })
  price!: string

  @ApiProperty({ description: '鏉ユ簮', example: 'BINANCE', required: false })
  @IsOptional()
  @IsString()
  source?: string

  @ApiProperty({ description: '浜嬩欢鏃堕棿', required: false })
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
