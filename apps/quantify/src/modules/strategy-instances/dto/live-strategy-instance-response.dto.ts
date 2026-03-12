import { ApiProperty } from '@nestjs/swagger'

import { StrategyInstanceStatsDto } from './strategy-instance-stats.dto'

export class StrategyInstancePublicResponseDto {
  @ApiProperty({ description: '瀹炰緥 ID' })
  id: string

  @ApiProperty({ description: '绛栫暐妯℃澘 ID' })
  strategyTemplateId: string

  @ApiProperty({ description: '绛栫暐妯℃澘鍚嶇О', required: false })
  strategyTemplateName?: string

  @ApiProperty({ description: '绛栫暐妯℃澘鎻忚堪', required: false })
  strategyTemplateDescription?: string

  @ApiProperty({ description: '瀹炰緥鍚嶇О' })
  name: string

  @ApiProperty({ description: '瀹炰緥鎻忚堪', required: false, nullable: true })
  description?: string | null

  @ApiProperty({ description: 'LLM 妯″瀷' })
  llmModel: string

  @ApiProperty({ description: '鍚姩鏃堕棿', required: false, nullable: true })
  startedAt?: Date | null

  @ApiProperty({ description: '鏄惁宸茶闃呭搴旂殑绛栫暐妯℃澘', required: false })
  isSubscribed?: boolean

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt: Date

  @ApiProperty({ description: '缁熻鏁版嵁', type: StrategyInstanceStatsDto, required: false })
  stats?: StrategyInstanceStatsDto
}
