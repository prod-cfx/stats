import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class LlmSubscriptionUpdateRequestDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  status?: 'active' | 'paused' | 'cancelled'

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  exchangeAccountId?: string | null
}
