import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { RuntimeExecutionStateDto } from '@/modules/strategy-signals/dto/runtime-execution-state.dto'
import { AccountStrategyListItemDto } from './account-strategy-list-item.dto'

export class AccountStrategyLeverageRangeDto {
  @ApiProperty()
  min!: number

  @ApiProperty()
  max!: number
}

export class AccountStrategyExecutionConfigDto {
  @ApiPropertyOptional({ nullable: true })
  leverage!: number | null

  @ApiPropertyOptional({ nullable: true })
  priceSource!: string | null

  @ApiPropertyOptional({ nullable: true })
  orderType!: string | null

  @ApiPropertyOptional({ nullable: true })
  timeInForce!: string | null
}

export class AccountStrategyCompatibilityMetadataDto {
  @ApiProperty()
  isLegacySnapshot!: boolean

  @ApiProperty()
  missingStrategyConfig!: boolean

  @ApiProperty()
  missingBacktestConfigDefaults!: boolean

  @ApiProperty()
  missingDeploymentExecutionDefaults!: boolean

  @ApiProperty()
  missingDeploymentExecutionConstraints!: boolean

  @ApiProperty()
  requiresRepublishForBacktest!: boolean

  @ApiProperty()
  requiresRepublishForDeploy!: boolean

  @ApiPropertyOptional({ nullable: true })
  invalidBinding?: boolean | null
}

export class AccountStrategyConsistencySummaryDto {
  @ApiProperty()
  isConsistent!: boolean

  @ApiProperty({ type: [String] })
  driftReasons!: string[]

  @ApiPropertyOptional({ nullable: true })
  consistencyScore!: number | null
}

export class AccountStrategyDeploymentDto {
  @ApiPropertyOptional({ nullable: true })
  exchangeAccountId!: string | null

  @ApiPropertyOptional({ nullable: true })
  exchangeAccountName!: string | null

  @ApiProperty({ type: AccountStrategyExecutionConfigDto })
  executionConfig!: AccountStrategyExecutionConfigDto

  @ApiPropertyOptional({ nullable: true })
  executionConfigVersion!: number | null

  @ApiPropertyOptional({ nullable: true, type: AccountStrategyLeverageRangeDto })
  effectiveAllowedLeverageRange!: AccountStrategyLeverageRangeDto | null

  @ApiProperty({ type: [String] })
  driftFields!: string[]

  @ApiProperty()
  reReadAtNextEligibleExecutionCycle!: boolean

  @ApiPropertyOptional({ nullable: true })
  updatedBy!: string | null
}

export class AccountStrategyEquityPointDto {
  @ApiProperty()
  ts!: string

  @ApiProperty()
  value!: number
}

export class AccountStrategyTimelineEventDto {
  @ApiProperty()
  at!: string

  @ApiProperty({ enum: ['system', 'trade'] })
  eventType!: 'system' | 'trade'

  @ApiProperty()
  event!: string

  @ApiPropertyOptional({ nullable: true })
  note?: string | null
}

export class AccountStrategyAccountOverviewDto {
  @ApiPropertyOptional({ nullable: true })
  initialBalance!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalEquity!: number | null

  @ApiPropertyOptional({ nullable: true })
  availableBalance!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  todayPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  baseCurrency!: string | null
}

export class AccountStrategyPositionOverviewDto {
  @ApiPropertyOptional({ nullable: true })
  openPositionsCount!: number | null

  @ApiPropertyOptional({ nullable: true })
  closedPositionsCount!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalRealizedPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalUnrealizedPnl!: number | null
}

export class AccountStrategyLatestOrderDto {
  @ApiProperty()
  executedAt!: string

  @ApiProperty()
  side!: string

  @ApiProperty()
  symbol!: string

  @ApiPropertyOptional({ nullable: true })
  price!: number | null

  @ApiPropertyOptional({ nullable: true })
  quantity!: number | null

  @ApiPropertyOptional({ nullable: true })
  fee!: number | null

  @ApiPropertyOptional({ nullable: true })
  feeCurrency!: string | null

  @ApiPropertyOptional({ nullable: true })
  orderId!: string | null
}

export class AccountStrategyRuleSummaryItemDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null

  @ApiPropertyOptional({ nullable: true })
  phase!: string | null

  @ApiPropertyOptional({ nullable: true })
  conditionKey!: string | null

  @ApiPropertyOptional({ nullable: true })
  operator!: string | null

  @ApiPropertyOptional({ nullable: true })
  value!: number | null

  @ApiProperty({ type: [String] })
  actions!: string[]
}

export class AccountStrategyRuleSummaryDto {
  @ApiProperty({ type: [AccountStrategyRuleSummaryItemDto] })
  rules!: AccountStrategyRuleSummaryItemDto[]

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  executionPolicy!: Record<string, unknown> | null
}

export class AccountStrategySnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  publishedSnapshotId!: string | null

  @ApiPropertyOptional({ nullable: true })
  snapshotHash!: string | null

  @ApiPropertyOptional({ nullable: true })
  exchange!: string | null

  @ApiPropertyOptional({ nullable: true })
  symbol!: string | null

  @ApiPropertyOptional({ nullable: true })
  timeframe!: string | null

  @ApiPropertyOptional({ nullable: true })
  positionPct!: number | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramValues!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  strategyConfig!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  backtestConfigDefaults!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  deploymentExecutionBaseline!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  deploymentExecutionCurrent!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  deploymentExecutionConstraints!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: AccountStrategyLeverageRangeDto })
  effectiveAllowedLeverageRange!: AccountStrategyLeverageRangeDto | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  compatibilityMetadata!: AccountStrategyCompatibilityMetadataDto | null

  @ApiPropertyOptional({ nullable: true, type: AccountStrategyConsistencySummaryDto })
  consistencySummary!: AccountStrategyConsistencySummaryDto | null

  @ApiPropertyOptional({ nullable: true, type: AccountStrategyRuleSummaryDto })
  ruleSummary!: AccountStrategyRuleSummaryDto | null

  @ApiPropertyOptional({ nullable: true })
  executionConfigVersion!: number | null

  @ApiPropertyOptional({ nullable: true })
  schemaVersion!: string | null

  @ApiPropertyOptional({ nullable: true })
  deployAccountName?: string | null

  @ApiPropertyOptional({ nullable: true })
  deployAt?: string | null
}

export class AccountStrategyDetailResponseDto extends AccountStrategyListItemDto {
  @ApiPropertyOptional({ nullable: true })
  totalPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  todayPnl!: number | null

  @ApiProperty({ type: [AccountStrategyEquityPointDto] })
  equitySeries!: AccountStrategyEquityPointDto[]

  @ApiProperty({ type: AccountStrategySnapshotDto })
  snapshot!: AccountStrategySnapshotDto

  @ApiProperty({ type: [AccountStrategyTimelineEventDto] })
  timeline!: AccountStrategyTimelineEventDto[]

  @ApiProperty({ type: AccountStrategyAccountOverviewDto })
  accountOverview!: AccountStrategyAccountOverviewDto

  @ApiProperty({ type: AccountStrategyPositionOverviewDto })
  positionOverview!: AccountStrategyPositionOverviewDto

  @ApiProperty({ type: [AccountStrategyLatestOrderDto] })
  latestOrders!: AccountStrategyLatestOrderDto[]

  @ApiProperty({ type: [RuntimeExecutionStateDto] })
  runtimeExecutionStates!: RuntimeExecutionStateDto[]

  @ApiPropertyOptional({ nullable: true, type: AccountStrategyDeploymentDto })
  deployment?: AccountStrategyDeploymentDto | null
}
