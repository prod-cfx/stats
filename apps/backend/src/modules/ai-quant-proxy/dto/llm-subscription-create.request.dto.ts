import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class LlmSubscriptionCreateRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  llmStrategyInstanceId!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  exchangeAccountId!: string
}
