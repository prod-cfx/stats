import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

/**
 * 用户侧：LLM 策略实例信号列表查询参数
 * 目前仅支持基础分页参数，后续如需按时间、状态等筛选可在此扩展
 */
export class LiveLlmStrategySignalsQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId: string
}
