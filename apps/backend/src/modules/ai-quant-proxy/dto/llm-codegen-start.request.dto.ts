import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator'

export class LlmCodegenStartRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initialMessage?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  guideConfig?: Record<string, unknown>

  @ApiPropertyOptional({ enum: ['zh', 'en'], description: 'Preferred assistant conversation language' })
  @IsOptional()
  @IsIn(['zh', 'en'])
  locale?: 'zh' | 'en'
}
