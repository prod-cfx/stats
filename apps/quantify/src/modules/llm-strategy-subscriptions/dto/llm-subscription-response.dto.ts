import type { SubscriptionStatus } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmSubscriptionResponseDto {
  @ApiProperty({ description: '订阅ID' })
  id: string

  @ApiProperty({ description: '用户ID' })
  userId: string

  @ApiProperty({ description: 'LLM 策略实例ID' })
  llmStrategyInstanceId: string

  @ApiProperty({ description: 'LLM 策略实例名称' })
  llmStrategyInstanceName: string

  @ApiProperty({ description: 'LLM 策略名称' })
  llmStrategyName: string

  @ApiPropertyOptional({ description: 'LLM 策略描述', nullable: true })
  llmStrategyDescription?: string | null

  @ApiProperty({ description: '订阅状态', enum: ['active', 'paused', 'cancelled'] })
  status: SubscriptionStatus

  @ApiPropertyOptional({
    description: '用户自定义参数',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '绑定的交易所账户 ID（可选）', nullable: true })
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '交易所标识（如 binance, okx, hyperliquid）', nullable: true })
  exchangeId?: string | null

  @ApiPropertyOptional({ description: '交易所账户别名（可选）', nullable: true })
  exchangeName?: string | null

  @ApiProperty({ description: '订阅时间' })
  subscribedAt: Date

  @ApiPropertyOptional({ description: '取消订阅时间', nullable: true })
  unsubscribedAt?: Date | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date
}

