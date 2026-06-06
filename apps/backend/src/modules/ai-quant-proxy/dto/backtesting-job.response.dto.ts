import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class BacktestingJobResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: ['queued', 'running', 'succeeded', 'failed'] })
  status!: 'queued' | 'running' | 'succeeded' | 'failed'

  @ApiProperty()
  createdAt!: string

  @ApiPropertyOptional()
  startedAt?: string

  @ApiPropertyOptional()
  finishedAt?: string

  @ApiPropertyOptional()
  error?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  errorDetails?: Record<string, unknown>

  @ApiProperty({ type: 'object', additionalProperties: true })
  inputSummary!: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  resultSummary?: Record<string, unknown>
}
