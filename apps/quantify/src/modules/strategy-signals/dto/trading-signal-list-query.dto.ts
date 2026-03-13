import { ApiProperty } from '@nestjs/swagger'
import { SignalStatus } from '@prisma/client'
import { IsEnum, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class TradingSignalListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '策略实例 ID 筛选（旧版策略）', required: false })
  @IsString()
  @IsOptional()
  strategyInstanceId?: string

  @ApiProperty({ description: '策略模板 ID 筛选（旧版策略）', required: false })
  @IsString()
  @IsOptional()
  strategyId?: string

  @ApiProperty({ description: 'LLM 策略 ID 筛选', required: false })
  @IsString()
  @IsOptional()
  llmStrategyId?: string

  @ApiProperty({ description: 'LLM 策略实例 ID 筛选', required: false })
  @IsString()
  @IsOptional()
  llmStrategyInstanceId?: string

  @ApiProperty({ description: '标的代码筛选', required: false })
  @IsString()
  @IsOptional()
  symbolId?: string

  @ApiProperty({
    description: '信号状态筛选',
    enum: SignalStatus,
    required: false,
  })
  @IsEnum(SignalStatus)
  @IsOptional()
  status?: SignalStatus
}
