import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class UpdateOrderbookPairConfigDto {
  @ApiPropertyOptional({ description: '是否启用拉取' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @ApiPropertyOptional({ description: '拉取频率（秒），null 表示使用全局默认值' })
  @IsInt()
  @IsPositive()
  @IsOptional()
  pullIntervalSeconds?: number | null

  @ApiPropertyOptional({ description: '深度层级（买卖各多少档）' })
  @IsInt()
  @Min(5)
  @Max(500)
  @IsOptional()
  depthLevels?: number | null

  @ApiPropertyOptional({ description: '优先级（数字越小优先级越高）' })
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  @IsOptional()
  priority?: number

  @ApiPropertyOptional({
    description: '扩展配置（JSON格式）',
    example: { apiEndpoint: 'https://api.example.com', rateLimit: 100 },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any> | null

  @ApiPropertyOptional({ description: '备注说明' })
  @IsString()
  @IsOptional()
  description?: string | null
}
