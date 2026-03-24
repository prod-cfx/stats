import { StrategyInstanceMode } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsJSON, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateStrategyInstanceDto {
  @ApiProperty({ description: '策略模板 ID' })
  @IsString()
  @IsNotEmpty()
  strategyTemplateId: string

  @ApiProperty({ description: '实例名称' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ description: '实例描述', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'LLM 模型', example: 'gpt-4' })
  @IsString()
  @IsNotEmpty()
  llmModel: string

  @ApiProperty({ 
    description: '运行模式：BACKTEST=历史回测（使用历史数据测试策略），PAPER=纸上交易（使用实时数据模拟交易），TESTNET=测试网交易（在测试网络执行真实交易），LIVE=实盘交易（在主网执行真实交易）。未指定时数据库默认为 PAPER', 
    enum: StrategyInstanceMode,
    required: false,
    example: 'PAPER',
    examples: {
      backtest: { 
        value: 'BACKTEST', 
        summary: '历史回测',
        description: '使用历史数据进行策略回测，不执行真实交易，适合策略开发和优化' 
      },
      paper: { 
        value: 'PAPER', 
        summary: '纸上交易',
        description: '使用实时市场数据模拟交易，不执行真实订单，适合策略验证' 
      },
      testnet: { 
        value: 'TESTNET', 
        summary: '测试网交易',
        description: '在测试网络执行真实交易，使用测试代币，适合上线前测试' 
      },
      live: { 
        value: 'LIVE', 
        summary: '实盘交易',
        description: '在主网执行真实交易，使用真实资金，请谨慎使用' 
      },
    }
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

  @ApiPropertyOptional({ description: '创建人标识', example: 'system-operator' })
  @IsString()
  @IsOptional()
  createdBy?: string
}
