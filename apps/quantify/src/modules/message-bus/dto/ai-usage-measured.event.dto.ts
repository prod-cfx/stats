import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class AIUsageMeasuredV1Dto {
  @ApiProperty({ description: '全局唯一 usage ID（事件幂等）' })
  @IsUUID()
  usageId!: string

  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId!: string

  @ApiProperty({ description: '虚拟模型ID（用于定价）', required: true })
  @IsString()
  virtualModelId!: string

  @ApiPropertyOptional({ description: '物理模型ID' })
  @IsString()
  @IsOptional()
  modelId?: string

  @ApiProperty({ description: '输入 tokens 数' })
  @IsInt()
  @Min(0)
  inputTokens!: number

  @ApiProperty({ description: '输出 tokens 数' })
  @IsInt()
  @Min(0)
  outputTokens!: number

  @ApiProperty({ description: 'tokens 总数' })
  @IsInt()
  @Min(0)
  totalTokens!: number

  @ApiProperty({ description: '来源：chat | stream' })
  @IsString()
  source!: string

  @ApiPropertyOptional({ description: '故事ID' })
  @IsString()
  @IsOptional()
  storyId?: string

  @ApiPropertyOptional({ description: '消息ID' })
  @IsString()
  @IsOptional()
  messageId?: string

  @ApiPropertyOptional({ description: '会话/流ID' })
  @IsString()
  @IsOptional()
  sessionId?: string

  @ApiProperty({ description: '事件发生时间（ISO8601）' })
  @IsISO8601()
  occurredAt!: string
}
