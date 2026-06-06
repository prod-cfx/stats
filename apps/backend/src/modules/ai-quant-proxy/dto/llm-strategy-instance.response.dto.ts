import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstanceResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  strategyId!: string

  @ApiProperty()
  strategyName!: string

  @ApiPropertyOptional({ nullable: true })
  strategyDescription?: string | null

  @ApiProperty()
  name!: string

  @ApiPropertyOptional({ nullable: true })
  description?: string | null

  @ApiProperty({ enum: ['running', 'paused', 'stopped'] })
  status!: 'running' | 'paused' | 'stopped'

  @ApiProperty({ enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  mode!: 'LIVE' | 'PAPER' | 'BACKTEST'

  @ApiProperty()
  llmModel!: string

  @ApiPropertyOptional({ nullable: true })
  lastRunAt?: string | null

  @ApiProperty()
  isSubscribed!: boolean

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}
