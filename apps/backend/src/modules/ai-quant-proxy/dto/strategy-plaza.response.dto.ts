import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AccountAiQuantStrategyDetailResponseDto } from './account-ai-quant-strategy.response.dto'

export class StrategyPlazaDisplayMetricsResponseDto {
  @ApiProperty({ enum: ['official_sample_backtest'] })
  label!: 'official_sample_backtest'

  @ApiPropertyOptional({ nullable: true })
  returnPct!: number | null

  @ApiPropertyOptional({ nullable: true })
  winRatePct!: number | null

  @ApiPropertyOptional({ nullable: true })
  maxDrawdownPct!: number | null
}

export class StrategyPlazaTemplateResponseDto {
  @ApiProperty({ description: '策略模板 ID', example: 'tpl_01HXYZ' })
  id!: string

  @ApiProperty({ description: '策略模板名称', example: '趋势跟随策略' })
  name!: string

  @ApiProperty({ description: '策略描述', example: '基于均线交叉的趋势跟随策略' })
  description!: string

  @ApiProperty({ description: '策略逻辑说明', example: '快线上穿慢线买入，下穿卖出' })
  logicDescription!: string

  @ApiProperty({ description: '标签列表', type: [String], example: ['trend', 'ma'] })
  tags!: string[]

  @ApiProperty({ description: '风险等级', enum: ['low', 'medium', 'high'], example: 'medium' })
  riskLevel!: 'low' | 'medium' | 'high'

  @ApiProperty({ description: '适用场景', example: '震荡偏趋势行情' })
  scenario!: string

  @ApiProperty({ description: '交易所', enum: ['okx'], example: 'okx' })
  exchange!: 'okx'

  @ApiProperty({ description: '运行环境', enum: ['demo'], example: 'demo' })
  environment!: 'demo'

  @ApiProperty({ description: '市场类型', enum: ['spot', 'perp'], example: 'spot' })
  marketType!: 'spot' | 'perp'

  @ApiProperty({ description: '交易对符号', example: 'BTCUSDT' })
  symbol!: string

  @ApiProperty({ description: 'K 线周期', example: '1h' })
  timeframe!: string

  @ApiProperty({ description: '仓位百分比（%）', example: 50 })
  positionPct!: number

  @ApiPropertyOptional({ description: '杠杆倍数（现货为 null）', example: 3, nullable: true })
  leverage!: number | null

  @ApiProperty({ description: '展示状态', enum: ['live', 'hidden'], example: 'live' })
  status!: 'live' | 'hidden'

  @ApiProperty({ description: '展示排序值', example: 10 })
  displayOrder!: number

  @ApiProperty({ description: '展示用回测指标', type: StrategyPlazaDisplayMetricsResponseDto })
  displayMetrics!: StrategyPlazaDisplayMetricsResponseDto
}

export class StrategyPlazaEditSessionResponseDto {
  @ApiProperty({ description: '编辑会话 ID', example: 'sess_01HXYZ' })
  sessionId!: string

  @ApiProperty({ description: '关联策略模板 ID', example: 'tpl_01HXYZ' })
  templateId!: string

  @ApiProperty({ description: '初始消息内容', example: '基于该模板帮我调整参数' })
  initialMessage!: string
}

export class StrategyPlazaRunExistingResponseDto {
  @ApiProperty({ enum: ['existing'], example: 'existing' })
  result!: 'existing'

  @ApiProperty({ type: AccountAiQuantStrategyDetailResponseDto })
  strategy!: AccountAiQuantStrategyDetailResponseDto
}

export type StrategyPlazaRunResponseDto =
  | AccountAiQuantStrategyDetailResponseDto
  | StrategyPlazaRunExistingResponseDto
