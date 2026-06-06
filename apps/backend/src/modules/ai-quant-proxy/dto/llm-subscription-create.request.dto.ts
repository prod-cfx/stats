import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class LlmSubscriptionCreateRequestDto {
  @ApiProperty({ description: 'LLM 策略实例 ID', example: 'llm_inst_01HXYZ' })
  @IsString()
  @IsNotEmpty()
  llmStrategyInstanceId!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiProperty({ description: '交易所账户 ID', example: 'exacc_01HXYZ' })
  @IsString()
  @IsNotEmpty()
  exchangeAccountId!: string
}
