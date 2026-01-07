import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'
import { IsValidMetadata } from '@/common/validation/metadata.validator'

export class UpdateTradesPairConfigDto {
  @ApiPropertyOptional({ description: '是否启用订阅' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @ApiPropertyOptional({ 
    description: '优先级（数字越小优先级越高）', 
    type: Number,
    minimum: 1,
    maximum: 1000 
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  @IsOptional()
  priority?: number

  @ApiPropertyOptional({
    description: '扩展配置（JSON格式）。最大深度5层，最大10KB',
    example: { okxInstId: 'BTC-USDT-SWAP', minTradeValue: 10000 },
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsObject()
  @IsValidMetadata({ maxDepth: 5, maxSizeBytes: 10240 })
  metadata?: Record<string, any> | null

  @ApiPropertyOptional({ description: '备注说明', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  description?: string | null
}


