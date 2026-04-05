import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

const EXCHANGES = ['binance', 'okx', 'hyperliquid'] as const

export class AccountStrategyDeployDto {
  @ApiPropertyOptional({ description: '业务用户 ID（可由 x-user-id 注入）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiProperty({ description: '策略名称' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({ description: '部署请求幂等 ID（前端点击一次生成一次）' })
  @IsString()
  @IsNotEmpty()
  deployRequestId!: string

  @ApiProperty({ description: '发布快照 ID（部署与运行唯一绑定来源）' })
  @IsString()
  @IsNotEmpty()
  publishedSnapshotId!: string

  @ApiPropertyOptional({ description: '交易所（展示字段，后端以 publishedSnapshotId 快照为准）', enum: EXCHANGES })
  @IsOptional()
  @IsIn(EXCHANGES)
  exchange?: 'binance' | 'okx' | 'hyperliquid'

  @ApiPropertyOptional({ description: '交易对，如 BTCUSDT（展示字段，后端以 publishedSnapshotId 快照为准）' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  symbol?: string

  @ApiPropertyOptional({ description: '周期，如 5m/15m（展示字段，后端以 publishedSnapshotId 快照为准）' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timeframe?: string

  @ApiPropertyOptional({ description: '仓位百分比（0-100，展示字段，后端以 publishedSnapshotId 快照为准）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionPct?: number

  @ApiPropertyOptional({ description: '交易所账户 ID（后端真实账户）' })
  @IsOptional()
  @IsString()
  exchangeAccountId?: string

  @ApiPropertyOptional({ description: '当前 AI 会话发布出的策略实例 ID' })
  @IsOptional()
  @IsString()
  strategyInstanceId?: string

  @ApiPropertyOptional({ description: '部署模式（默认按账户网络自动推导）', enum: ['TESTNET', 'LIVE'] })
  @IsOptional()
  @IsIn(['TESTNET', 'LIVE'])
  mode?: 'TESTNET' | 'LIVE'

  @ApiPropertyOptional({ description: '用户单笔下单上限（报价币种）', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  userPerOrderMaxQuote?: number

  @ApiPropertyOptional({ description: '用户单日下单上限（报价币种）', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  userDailyMaxQuote?: number

  @ApiPropertyOptional({ description: '用户最大风险比例（0-1）', example: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  userMaxRiskFraction?: number

  @ApiPropertyOptional({ description: '交易所账户名称（本地/兜底）' })
  @IsOptional()
  @IsString()
  exchangeAccountName?: string
}
