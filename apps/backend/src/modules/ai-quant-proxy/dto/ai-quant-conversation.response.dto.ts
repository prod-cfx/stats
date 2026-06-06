import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class AiQuantConversationMessageResponseDto {
  @ApiProperty({ description: '对话消息角色', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: '对话消息内容' })
  content!: string
}

class AiQuantConversationLastBacktestSummaryResponseDto {
  @ApiProperty({ description: '最大回撤百分比（%）', example: 8.5 })
  maxDrawdownPct!: number

  @ApiProperty({ description: '总收益率百分比（%）', example: 15.2 })
  totalReturnPct!: number

  @ApiProperty({ description: '胜率百分比（%）', example: 62 })
  winRatePct!: number

  @ApiProperty({ description: '总成交笔数', example: 42 })
  tradeCount!: number

  @ApiPropertyOptional({ description: '当前持仓笔数', example: 1 })
  openTradeCount?: number

  @ApiPropertyOptional({ description: '当前持仓未实现盈亏', example: 120.5 })
  openPnl?: number

  @ApiPropertyOptional({ description: '市场类型', enum: ['spot', 'perp'], example: 'perp' })
  marketType?: 'spot' | 'perp'
}

export class AiQuantConversationBacktestRangeResponseDto {
  @ApiProperty({ description: '回测区间预设', enum: ['7D', '30D', '90D', '1Y', 'CUSTOM'], example: '30D' })
  preset!: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'

  @ApiPropertyOptional({ description: '自定义区间开始时间（ISO 8601）', example: '2026-05-01T00:00:00.000Z' })
  startAt?: string

  @ApiPropertyOptional({ description: '自定义区间结束时间（ISO 8601）', example: '2026-06-01T00:00:00.000Z' })
  endAt?: string
}

export class AiQuantConversationBacktestExecutionResponseDto {
  @ApiProperty({ description: '初始资金', example: 10000 })
  initialCash!: number

  @ApiPropertyOptional({ description: '杠杆倍数（现货为 null）', example: 3, nullable: true })
  leverage!: number | null

  @ApiProperty({ description: '滑点（基点 bps）', example: 5 })
  slippageBps!: number

  @ApiProperty({ description: '手续费（基点 bps）', example: 10 })
  feeBps!: number

  @ApiProperty({ description: '成交参考价来源', enum: ['open', 'close', 'mid'], example: 'close' })
  priceSource!: 'open' | 'close' | 'mid'

  @ApiProperty({ description: '是否允许部分数据回测', example: false })
  allowPartial!: boolean
}

export class AiQuantConversationBacktestConfigResponseDto {
  @ApiProperty({ type: AiQuantConversationBacktestRangeResponseDto })
  range!: AiQuantConversationBacktestRangeResponseDto

  @ApiProperty({ type: AiQuantConversationBacktestExecutionResponseDto })
  execution!: AiQuantConversationBacktestExecutionResponseDto
}

class AiQuantConversationLastBacktestRefResponseDto {
  @ApiProperty({ description: '回测任务 ID', example: 'job_01HXYZ' })
  jobId!: string

  @ApiProperty({ description: '已发布快照 ID', example: 'snap_01HXYZ' })
  publishedSnapshotId!: string

  @ApiProperty({ description: '回测配置', type: AiQuantConversationBacktestConfigResponseDto })
  config!: AiQuantConversationBacktestConfigResponseDto

  @ApiProperty({ description: '回测结果摘要', type: AiQuantConversationLastBacktestSummaryResponseDto })
  summary!: AiQuantConversationLastBacktestSummaryResponseDto

  @ApiProperty({ description: '回测完成时间（ISO 8601）', example: '2026-06-06T08:00:00.000Z' })
  completedAt!: string
}

export class AiQuantConversationResponseDto {
  @ApiProperty({ description: '对话 ID' })
  id!: string

  @ApiPropertyOptional({ description: '当前关联的代码生成会话 ID' })
  activeCodegenSessionId?: string | null

  @ApiPropertyOptional({ description: '对话标题' })
  conversationTitle?: string

  @ApiPropertyOptional({ description: '结构化对话记录', type: [AiQuantConversationMessageResponseDto] })
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>

  @ApiPropertyOptional({ description: '当前代码生成状态' })
  status?: string

  @ApiPropertyOptional({ description: '对话创建时间' })
  createdAt?: string

  @ApiPropertyOptional({ description: '对话更新时间' })
  updatedAt?: string

  @ApiPropertyOptional({ description: '当前显式回测草稿配置', type: AiQuantConversationBacktestConfigResponseDto, nullable: true })
  backtestDraftConfig?: AiQuantConversationBacktestConfigResponseDto | null

  @ApiPropertyOptional({ description: '最近可恢复的回测引用', type: AiQuantConversationLastBacktestRefResponseDto, nullable: true })
  lastBacktestRef?: AiQuantConversationLastBacktestRefResponseDto | null

  @ApiPropertyOptional({ description: '待确认的规范化摘要' })
  canonicalDigest?: string | null

  @ApiPropertyOptional({ description: '结构化策略描述载荷', type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '语义图载荷', type: 'object', additionalProperties: true })
  semanticGraph?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '语义图校验报告', type: 'object', additionalProperties: true })
  validationReport?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '澄清门载荷', type: 'object', additionalProperties: true })
  clarificationGate?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '发布门载荷', type: 'object', additionalProperties: true })
  publicationGate?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布脚本代码' })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: '已发布快照 ID' })
  publishedSnapshotId?: string | null

  @ApiPropertyOptional({ description: '快照绑定的参数值（用于已发布回测/展示语义）', type: 'object', additionalProperties: true })
  publishedSnapshotParamValues?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布快照的正式策略配置', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotStrategyConfig?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布快照的正式回测默认值', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotBacktestConfigDefaults?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布快照的正式部署默认值', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotDeploymentExecutionDefaults?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布快照的正式部署约束', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotDeploymentExecutionConstraints?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布快照的兼容性元数据', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotCompatibilityMetadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '已发布策略实例 ID' })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: '终止拒绝原因' })
  rejectReason?: string | null
}
