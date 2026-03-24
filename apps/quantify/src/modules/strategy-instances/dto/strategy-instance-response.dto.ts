import { StrategyInstanceMode, StrategyInstanceStatus } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'

import { StrategyInstanceStatsDto } from './strategy-instance-stats.dto'

export class StrategyInstanceResponseDto {
  @ApiProperty({ description: '实例 ID' })
  id: string

  @ApiProperty({ description: '策略模板 ID' })
  strategyTemplateId: string

  @ApiProperty({ description: '策略模板名称', required: false })
  strategyTemplateName?: string

  @ApiProperty({ description: '实例名称' })
  name: string

  @ApiProperty({ description: '实例描述', required: false })
  description?: string | null

  @ApiProperty({ description: 'LLM 模型' })
  llmModel: string

  @ApiProperty({ description: '实例参数', required: false })
  params?: Record<string, unknown> | null

  @ApiProperty({ description: '实例状态', enum: StrategyInstanceStatus })
  status: StrategyInstanceStatus

  @ApiProperty({ description: '运行模式：BACKTEST=历史回测，PAPER=纸上交易，TESTNET=测试网交易，LIVE=实盘交易', enum: StrategyInstanceMode })
  mode: StrategyInstanceMode

  @ApiProperty({ description: '启动时间', required: false })
  startedAt?: Date | null

  @ApiProperty({ description: '停止时间', required: false })
  stoppedAt?: Date | null

  @ApiProperty({ description: '创建者 ID', required: false })
  createdBy?: string | null

  @ApiProperty({ description: '更新者 ID', required: false })
  updatedBy?: string | null

  @ApiProperty({ description: '元数据', required: false })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  @ApiProperty({ description: '统计数据', type: StrategyInstanceStatsDto, required: false })
  stats?: StrategyInstanceStatsDto
}
