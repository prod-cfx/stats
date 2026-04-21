import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RuntimeExecutionStateDto {
  @ApiProperty()
  executionSemanticKey!: string

  @ApiProperty({ enum: ['ready', 'consumed', 'failed', 'cooldown'] })
  status!: 'ready' | 'consumed' | 'failed' | 'cooldown'

  @ApiPropertyOptional({ nullable: true, enum: ['binding', 'activation', 'execution', 'persistence'] })
  failureFamily!: 'binding' | 'activation' | 'execution' | 'persistence' | null

  @ApiPropertyOptional({ nullable: true })
  failureReason!: string | null

  @ApiPropertyOptional({ nullable: true })
  failureCode!: string | null

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastAttemptAt!: string | null

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  consumedAt!: string | null

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  cooldownUntil!: string | null

  @ApiProperty()
  publishedSnapshotId!: string

  @ApiProperty()
  snapshotHash!: string
}
