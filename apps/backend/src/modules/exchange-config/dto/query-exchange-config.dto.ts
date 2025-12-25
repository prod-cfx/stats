import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

export class QueryExchangeConfigDto {
  @ApiPropertyOptional({ description: '按 code 精确筛选（例如 BINANCE）' })
  @IsString()
  @IsOptional()
  code?: string

  @ApiPropertyOptional({ description: '按名称模糊筛选（包含匹配）' })
  @IsString()
  @IsOptional()
  name?: string

  @ApiPropertyOptional({ description: '交易场所类型筛选', enum: ['CEX', 'DEX'] })
  @IsEnum(['CEX', 'DEX'])
  @IsOptional()
  venueType?: 'CEX' | 'DEX'

  @ApiPropertyOptional({ description: '是否仅返回已启用的配置' })
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  enabledOnly?: boolean
}

