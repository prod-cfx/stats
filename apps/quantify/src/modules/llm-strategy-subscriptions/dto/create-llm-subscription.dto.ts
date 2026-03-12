import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class CreateLlmSubscriptionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: 'LLM 绛栫暐瀹炰緥 ID' })
  @IsString()
  @IsNotEmpty()
  llmStrategyInstanceId!: string

  @ApiPropertyOptional({
    description: '鐢ㄦ埛鑷畾涔夊弬鏁帮紙鍙€夛級',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiProperty({ description: '缁戝畾鐨勪氦鏄撴墍璐︽埛 ID锛堝繀濉級' })
  @IsString()
  @IsNotEmpty()
  exchangeAccountId!: string
}
