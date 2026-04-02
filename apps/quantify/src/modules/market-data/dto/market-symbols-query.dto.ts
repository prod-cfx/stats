import { MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class MarketSymbolsQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '交易所（如 BINANCE）', example: 'BINANCE' })
  @IsOptional()
  @IsString()
  exchange?: string

  @ApiPropertyOptional({ description: '合约/标的类型', enum: MARKET_SYMBOL_TYPES })
  @IsOptional()
  @IsIn(MARKET_SYMBOL_TYPES as unknown as string[])
  type?: string

  @ApiPropertyOptional({ description: '交易对状态', enum: MARKET_SYMBOL_STATUSES })
  @IsOptional()
  @IsIn(MARKET_SYMBOL_STATUSES as unknown as string[])
  status?: string

  @ApiPropertyOptional({ description: '合约形态', enum: MARKET_INSTRUMENT_TYPES })
  @IsOptional()
  @IsIn(MARKET_INSTRUMENT_TYPES as unknown as string[])
  instrumentType?: string

  @ApiPropertyOptional({ description: '根据交易对代码模糊搜索', example: 'BTC' })
  @IsOptional()
  @IsString()
  keyword?: string
}

