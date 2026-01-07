import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

export class QueryTradesPairConfigDto {
  @ApiPropertyOptional({ description: '交易所标识筛选' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  exchange?: string

  @ApiPropertyOptional({ description: '交易品种类型筛选', enum: ['SPOT', 'PERPETUAL', 'FUTURE'] })
  @IsEnum(['SPOT', 'PERPETUAL', 'FUTURE'])
  @IsOptional()
  instrumentType?: 'SPOT' | 'PERPETUAL' | 'FUTURE'

  @ApiPropertyOptional({ description: '是否仅返回已启用的配置' })
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  enabledOnly?: boolean
}







