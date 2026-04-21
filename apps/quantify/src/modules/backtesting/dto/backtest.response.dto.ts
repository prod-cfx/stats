import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class BacktestJobRangeDto {
  @ApiProperty()
  fromTs!: number

  @ApiProperty()
  toTs!: number
}

export class BacktestJobSummaryDto {
  @ApiProperty()
  netProfit!: number

  @ApiProperty()
  netProfitPct!: number

  @ApiProperty()
  maxDrawdownPct!: number

  @ApiProperty()
  winRate!: number

  @ApiProperty({ nullable: true })
  profitFactor!: number | null

  @ApiProperty()
  totalTrades!: number

  @ApiPropertyOptional()
  totalOpenTrades?: number

  @ApiPropertyOptional()
  openPnl?: number
}

export class BacktestJobErrorDetailsDto {
  @ApiPropertyOptional()
  code?: string

  @ApiProperty()
  message!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  args?: Record<string, unknown>
}

export class BacktestJobInputSummaryDto {
  @ApiProperty({ type: [String] })
  symbols!: string[]

  @ApiProperty()
  baseTimeframe!: string

  @ApiProperty({ type: [String] })
  stateTimeframes!: string[]

  @ApiProperty()
  initialCash!: number

  @ApiPropertyOptional({ nullable: true })
  leverage?: number | null

  @ApiProperty({ enum: ['spot', 'perp'] })
  marketType!: 'spot' | 'perp'

  @ApiProperty({ type: BacktestJobRangeDto })
  dataRange!: BacktestJobRangeDto

  @ApiProperty({ type: BacktestJobRangeDto })
  requestedRange!: BacktestJobRangeDto

  @ApiPropertyOptional({ type: BacktestJobRangeDto })
  appliedRange?: BacktestJobRangeDto

  @ApiProperty()
  allowPartial!: boolean

  @ApiProperty()
  isPartial!: boolean

  @ApiProperty()
  strategyId!: string

  @ApiPropertyOptional()
  strategyInstanceId?: string

  @ApiPropertyOptional()
  strategyTemplateId?: string

  @ApiPropertyOptional()
  snapshotId?: string

  @ApiPropertyOptional()
  snapshotHash?: string

  @ApiPropertyOptional()
  scriptHash?: string

  @ApiPropertyOptional()
  specHash?: string
}

export class BacktestJobResponseDto {
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

  @ApiPropertyOptional({ type: BacktestJobErrorDetailsDto })
  errorDetails?: BacktestJobErrorDetailsDto

  @ApiProperty({ type: BacktestJobInputSummaryDto })
  inputSummary!: BacktestJobInputSummaryDto

  @ApiPropertyOptional({ type: BacktestJobSummaryDto })
  resultSummary?: BacktestJobSummaryDto
}

export class BacktestCapabilitiesResponseDto {
  @ApiProperty({ type: [String] })
  allowedBaseTimeframes!: string[]
}

export class BacktestSymbolSupportResponseDto {
  @ApiProperty({ enum: ['supported', 'not_supported'] })
  status!: 'supported' | 'not_supported'

  @ApiPropertyOptional()
  reasonCode?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  args?: Record<string, unknown>
}

export class BacktestEquityPointDto {
  @ApiProperty()
  ts!: number

  @ApiProperty()
  equity!: number
}

export class BacktestTradeRecordDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  symbol!: string

  @ApiProperty({ enum: ['LONG', 'SHORT'] })
  side!: 'LONG' | 'SHORT'

  @ApiProperty()
  entryTs!: number

  @ApiProperty()
  entryPrice!: number

  @ApiProperty()
  exitTs!: number

  @ApiProperty()
  exitPrice!: number

  @ApiProperty()
  qty!: number

  @ApiProperty()
  fee!: number

  @ApiProperty()
  pnl!: number

  @ApiProperty()
  returnPct!: number

  @ApiPropertyOptional()
  reasonOpen?: string

  @ApiPropertyOptional()
  reasonOpenSource?: string

  @ApiPropertyOptional()
  reasonClose?: string

  @ApiPropertyOptional()
  reasonCloseSource?: string

  @ApiPropertyOptional()
  exitReason?: string

  @ApiPropertyOptional()
  exitSource?: string
}

export class BacktestTradeMarkerDto {
  @ApiProperty()
  symbol!: string

  @ApiProperty()
  ts!: number

  @ApiProperty()
  price!: number

  @ApiProperty({ enum: ['entry_long', 'entry_short', 'exit_long', 'exit_short'] })
  kind!: 'entry_long' | 'entry_short' | 'exit_long' | 'exit_short'

  @ApiProperty()
  tradeId!: string
}

export class BacktestBySymbolDto {
  @ApiProperty()
  symbol!: string

  @ApiProperty()
  pnl!: number

  @ApiProperty()
  trades!: number

  @ApiProperty()
  winRate!: number
}

export class BacktestOpenPositionDto {
  @ApiProperty()
  symbol!: string

  @ApiProperty()
  qty!: number

  @ApiProperty()
  avgEntryPrice!: number

  @ApiProperty()
  unrealizedPnl!: number
}

export class BacktestPendingSignalDto {
  @ApiProperty()
  symbol!: string

  @ApiProperty()
  ts!: number

  @ApiProperty()
  deltaQty!: number

  @ApiPropertyOptional()
  reason?: string

  @ApiProperty()
  reasonSource!: string
}

export class BacktestReportResponseDto {
  @ApiProperty({ type: BacktestJobSummaryDto })
  summary!: BacktestJobSummaryDto

  @ApiProperty({ type: [BacktestEquityPointDto] })
  equityCurve!: BacktestEquityPointDto[]

  @ApiProperty({ type: [BacktestTradeRecordDto] })
  trades!: BacktestTradeRecordDto[]

  @ApiProperty({ type: [BacktestTradeMarkerDto] })
  markers!: BacktestTradeMarkerDto[]

  @ApiProperty({ type: [BacktestBySymbolDto] })
  bySymbol!: BacktestBySymbolDto[]

  @ApiPropertyOptional({ type: [BacktestOpenPositionDto] })
  openPositions?: BacktestOpenPositionDto[]

  @ApiPropertyOptional({ type: [BacktestPendingSignalDto] })
  pendingSignals?: BacktestPendingSignalDto[]
}
