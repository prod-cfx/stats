import { StrategyInstanceMode, StrategyInstanceStatus } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsJSON, IsOptional, IsString } from 'class-validator'

export class UpdateStrategyInstanceDto {
  @ApiProperty({ description: '实例名称', required: false })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({ description: '实例描述', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'LLM 模型', required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({
    description: '实例状态',
    enum: StrategyInstanceStatus,
    required: false,
  })
  @IsEnum(StrategyInstanceStatus)
  @IsOptional()
  status?: StrategyInstanceStatus

  @ApiProperty({
    description: '运行模式：BACKTEST=历史回测，PAPER=纸上交易，TESTNET=测试网交易，LIVE=实盘交易。注意：运行中的实例无法切换模式，LIVE模式不能切换到BACKTEST模式，已停止的实例不能切换模式',
    enum: StrategyInstanceMode,
    required: false,
    example: 'PAPER',
  })
  @IsEnum(StrategyInstanceMode)
  @IsOptional()
  mode?: StrategyInstanceMode

  @ApiProperty({ description: '实例参数（JSON 格式）', required: false })
  @IsJSON()
  @IsOptional()
  params?: Record<string, unknown>

  @ApiProperty({ description: '元数据（JSON 格式）', required: false })
  @IsJSON()
  @IsOptional()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '更新人标识', example: 'system-operator' })
  @IsString()
  @IsOptional()
  updatedBy?: string
}
