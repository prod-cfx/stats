import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmSubscriptionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  llmStrategyInstanceId!: string

  @ApiProperty()
  llmStrategyInstanceName!: string

  @ApiProperty()
  llmStrategyName!: string

  @ApiPropertyOptional({ nullable: true })
  llmStrategyDescription?: string | null

  @ApiProperty({ enum: ['active', 'paused', 'cancelled'] })
  status!: 'active' | 'paused' | 'cancelled'

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ nullable: true })
  exchangeId?: string | null

  @ApiPropertyOptional({ nullable: true })
  exchangeName?: string | null

  @ApiProperty()
  subscribedAt!: string

  @ApiPropertyOptional({ nullable: true })
  unsubscribedAt?: string | null

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}
