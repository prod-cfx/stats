import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class BacktestingReportResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  summary!: Record<string, unknown>

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  equityCurve!: Record<string, unknown>[]

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  trades!: Record<string, unknown>[]

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  markers!: Record<string, unknown>[]

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  bySymbol!: Record<string, unknown>[]

  @ApiPropertyOptional({ type: 'array', items: { type: 'object', additionalProperties: true } })
  openPositions?: Record<string, unknown>[]

  @ApiPropertyOptional({ type: 'array', items: { type: 'object', additionalProperties: true } })
  pendingSignals?: Record<string, unknown>[]
}
