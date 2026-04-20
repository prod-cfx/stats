import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RuntimeExecutionStateDto {
  @ApiProperty()
  executionSemanticKey!: string

  @ApiProperty()
  status!: string

  @ApiPropertyOptional({ nullable: true })
  failureReason!: string | null

  @ApiPropertyOptional({ nullable: true })
  failureCode!: string | null

  @ApiPropertyOptional({ nullable: true })
  lastAttemptAt!: string | null

  @ApiPropertyOptional({ nullable: true })
  consumedAt!: string | null

  @ApiPropertyOptional({ nullable: true })
  cooldownUntil!: string | null

  @ApiProperty()
  publishedSnapshotId!: string

  @ApiProperty()
  snapshotHash!: string
}
