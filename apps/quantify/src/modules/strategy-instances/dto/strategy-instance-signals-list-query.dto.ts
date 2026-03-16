import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

/**
 * 策略实例信号列表查询参数
 * 目前仅支持分页参数，后续可扩展按状态等筛选
 */
export class StrategyInstanceSignalsListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId: string
}
