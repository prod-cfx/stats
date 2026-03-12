import { MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class MarketSymbolsQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '浜ゆ槗鎵€锛堝 BINANCE锛?, example: 'BINANCE' })
  @IsOptional()
  @IsString()
  exchange?: string

  @ApiPropertyOptional({ description: '鍚堢害/鏍囩殑绫诲瀷', enum: MARKET_SYMBOL_TYPES })
  @IsOptional()
  @IsIn(MARKET_SYMBOL_TYPES as unknown as string[])
  type?: string

  @ApiPropertyOptional({ description: '浜ゆ槗瀵圭姸鎬?, enum: MARKET_SYMBOL_STATUSES })
  @IsOptional()
  @IsIn(MARKET_SYMBOL_STATUSES as unknown as string[])
  status?: string

  @ApiPropertyOptional({ description: '鍚堢害褰㈡€?, enum: MARKET_INSTRUMENT_TYPES })
  @IsOptional()
  @IsIn(MARKET_INSTRUMENT_TYPES as unknown as string[])
  instrumentType?: string

  @ApiPropertyOptional({ description: '鏍规嵁浜ゆ槗瀵逛唬鐮佹ā绯婃悳绱?, example: 'BTC' })
  @IsOptional()
  @IsString()
  keyword?: string
}
