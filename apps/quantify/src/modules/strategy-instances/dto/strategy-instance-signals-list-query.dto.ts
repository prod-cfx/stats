import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

/**
 * 绛栫暐瀹炰緥淇″彿鍒楄〃鏌ヨ鍙傛暟
 * 鐩墠浠呮敮鎸佸垎椤靛弬鏁帮紝鍚庣画鍙墿灞曟寜鐘舵€佺瓑绛涢€?
 */
export class StrategyInstanceSignalsListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId: string
}
