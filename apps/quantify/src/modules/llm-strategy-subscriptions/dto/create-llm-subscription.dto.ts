import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class CreateLlmSubscriptionDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: 'LLM 策略实例 ID' })
  @IsString()
  @IsNotEmpty()
  llmStrategyInstanceId!: string

  @ApiPropertyOptional({
    description: '用户自定义参数（可选）',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiProperty({ description: '绑定的交易所账户 ID（必填）' })
  @IsString()
  @IsNotEmpty()
  exchangeAccountId!: string
}
