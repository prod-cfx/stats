import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class RecoverAiQuantEditConversationRequestDto {
  @ApiProperty({ description: '已发布策略实例 ID' })
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  strategyInstanceId!: string

  @ApiPropertyOptional({ description: '已发布快照 ID' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  publishedSnapshotId?: string

  @ApiPropertyOptional({ description: '原 AI Quant conversation ID' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  conversationId?: string

  @ApiPropertyOptional({ description: '原 codegen session ID' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  sessionId?: string

  @ApiPropertyOptional({ enum: ['account-detail', 'backtest', 'plaza', 'ai-quant'] })
  @IsOptional()
  @IsIn(['account-detail', 'backtest', 'plaza', 'ai-quant'])
  source?: 'account-detail' | 'backtest' | 'plaza' | 'ai-quant'
}
