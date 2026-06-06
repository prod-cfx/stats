import { ApiProperty } from '@nestjs/swagger'

class WhaleNotificationDeliveryMapDto {
  @ApiProperty({ example: 'SENT' })
  web!: 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING'

  @ApiProperty({ example: 'SKIPPED' })
  email!: 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING'

  @ApiProperty({ example: 'SKIPPED' })
  telegram!: 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING'
}

export class WhaleNotificationInboxResponseDto {
  @ApiProperty({ description: '站内信 ID', example: 'inbox_01HXYZ' })
  id!: string

  @ApiProperty({ description: '通知标题', example: '鲸鱼大额转账预警' })
  title!: string

  @ApiProperty({ description: '通知内容', example: '检测到 1000 BTC 转入交易所' })
  content!: string

  @ApiProperty({ description: '触发该通知的规则 ID', example: 'rule_01HXYZ', required: false })
  ruleId?: string

  @ApiProperty({ type: WhaleNotificationDeliveryMapDto })
  channels!: WhaleNotificationDeliveryMapDto

  @ApiProperty({ description: '是否已读', example: false })
  read!: boolean

  @ApiProperty({ description: '创建时间（ISO 8601）', example: '2026-06-06T08:00:00.000Z' })
  createdAt!: string
}
