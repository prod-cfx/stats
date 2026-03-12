import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

/**
 * 鐢ㄦ埛渚э細LLM 绛栫暐瀹炰緥淇″彿鍒楄〃鏌ヨ鍙傛暟
 * 鐩墠浠呮敮鎸佸熀纭€鍒嗛〉鍙傛暟锛屽悗缁闇€鎸夋椂闂淬€佺姸鎬佺瓑绛涢€夊彲鍦ㄦ鎵╁睍
 */
export class LiveLlmStrategySignalsQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId: string
}
