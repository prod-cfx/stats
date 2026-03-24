import { ApiProperty } from '@nestjs/swagger'
import { WhaleNotificationRuleType } from '@ai/shared'
import { WhaleNotificationChannelsDto } from './whale-notification-channels.dto'

export class WhaleNotificationRuleResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: WhaleNotificationRuleType })
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

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}
