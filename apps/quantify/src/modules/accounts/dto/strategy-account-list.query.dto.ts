import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class StrategyAccountListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '绛涢€夌瓥鐣?ID',
    example: 'strategy-grid-btc',
  })
  @IsOptional()
  @IsString()
  strategyId?: string

  @ApiPropertyOptional({
    description: '鍏抽敭瀛楋紙鏀寔绛栫暐鍚嶇О妯＄硦鍖归厤锛?,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  keyword?: string

  @ApiPropertyOptional({
    description: '鏄惁杩斿洖鏈€杩戠殑鏃ュ害鏀剁泭鎽樿',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withDailyStats?: boolean

  @ApiPropertyOptional({
    description: '鏄惁鍙繑鍥炴湭骞充粨鐨勭瓥鐣ヨ处鎴凤紙榛樿 false锛?,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyActive?: boolean

  @ApiPropertyOptional({
    description: '绛涢€夎浠疯揣甯?,
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/)
  baseCurrency?: string
}
