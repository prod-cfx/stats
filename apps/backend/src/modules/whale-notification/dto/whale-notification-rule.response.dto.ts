import { WhaleNotificationRuleType } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'
import { WhaleNotificationChannelsDto } from './whale-notification-channels.dto'

export class WhaleNotificationRuleResponseDto {
  @ApiProperty({ description: '通知规则 ID', example: 'rule_01HXYZ' })
  id!: string

  @ApiProperty({ description: '规则类型', enum: WhaleNotificationRuleType })
  type!: WhaleNotificationRuleType

  @ApiProperty({ required: false })
  address?: string

  @ApiProperty({ required: false })
  symbol?: string

  @ApiProperty({ example: 100000 })
  thresholdUsd!: number

  @ApiProperty({ required: false })
  note?: string

  @ApiProperty({ type: WhaleNotificationChannelsDto })
  channels!: WhaleNotificationChannelsDto

  @ApiProperty({ description: '规则是否启用', example: true })
  isActive!: boolean

  @ApiProperty({ description: '创建时间（ISO 8601）', example: '2026-06-06T08:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ description: '更新时间（ISO 8601）', example: '2026-06-06T09:00:00.000Z' })
  updatedAt!: string
}
