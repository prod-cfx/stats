import { StrategyInstanceMode, StrategyInstanceStatus } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class StrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '策略模板 ID 筛选', required: false })
  @IsString()
  @IsOptional()
  strategyTemplateId?: string

  @ApiProperty({
    description: '状态筛选',
    enum: StrategyInstanceStatus,
    required: false,
  })
  @IsEnum(StrategyInstanceStatus)
  @IsOptional()
  status?: StrategyInstanceStatus

  @ApiProperty({
    description: '运行模式筛选：BACKTEST=历史回测，PAPER=纸上交易，TESTNET=测试网交易，LIVE=实盘交易',
    enum: StrategyInstanceMode,
    required: false,
  })
  @IsEnum(StrategyInstanceMode)
  @IsOptional()
  mode?: StrategyInstanceMode

  @ApiProperty({ description: 'LLM 模型筛选', required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({ 
    description: '是否包含统计数据', 
    required: false,
    default: true,
    type: Boolean
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) return false
    if (value === 'true' || value === true) return true
    return true
  })
  includeStats?: boolean = true
}
