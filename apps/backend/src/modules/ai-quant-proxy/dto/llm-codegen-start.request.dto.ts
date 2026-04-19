import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class LlmCodegenStartRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initialMessage?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  guideConfig?: Record<string, unknown>
}
