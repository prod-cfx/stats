import { ApiProperty } from '@nestjs/swagger'
import { StrategyInstanceMode, StrategyInstanceStatus } from '@prisma/client'

import { StrategyInstanceStatsDto } from './strategy-instance-stats.dto'

export class StrategyInstanceResponseDto {
  @ApiProperty({ description: '瀹炰緥 ID' })
  id: string

  @ApiProperty({ description: '绛栫暐妯℃澘 ID' })
  strategyTemplateId: string

  @ApiProperty({ description: '绛栫暐妯℃澘鍚嶇О', required: false })
  strategyTemplateName?: string

  @ApiProperty({ description: '瀹炰緥鍚嶇О' })
  name: string

  @ApiProperty({ description: '瀹炰緥鎻忚堪', required: false })
  description?: string | null

  @ApiProperty({ description: 'LLM 妯″瀷' })
  llmModel: string

  @ApiProperty({ description: '瀹炰緥鍙傛暟', required: false })
  params?: Record<string, unknown> | null

  @ApiProperty({ description: '瀹炰緥鐘舵€?, enum: StrategyInstanceStatus })
  status: StrategyInstanceStatus

  @ApiProperty({ description: '杩愯妯″紡锛欱ACKTEST=鍘嗗彶鍥炴祴锛孭APER=绾镐笂浜ゆ槗锛孴ESTNET=娴嬭瘯缃戜氦鏄擄紝LIVE=瀹炵洏浜ゆ槗', enum: StrategyInstanceMode })
  mode: StrategyInstanceMode

  @ApiProperty({ description: '鍚姩鏃堕棿', required: false })
  startedAt?: Date | null

  @ApiProperty({ description: '鍋滄鏃堕棿', required: false })
  stoppedAt?: Date | null

  @ApiProperty({ description: '鍒涘缓鑰?ID', required: false })
  createdBy?: string | null

  @ApiProperty({ description: '鏇存柊鑰?ID', required: false })
  updatedBy?: string | null

  @ApiProperty({ description: '鍏冩暟鎹?, required: false })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt: Date

  @ApiProperty({ description: '缁熻鏁版嵁', type: StrategyInstanceStatsDto, required: false })
  stats?: StrategyInstanceStatsDto
}
