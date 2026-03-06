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
  @ApiProperty()
  id!: string

  @ApiProperty()
  title!: string

  @ApiProperty()
  content!: string

  @ApiProperty({ required: false })
  ruleId?: string

  @ApiProperty({ type: WhaleNotificationDeliveryMapDto })
  channels!: WhaleNotificationDeliveryMapDto

  @ApiProperty({ example: false })
  read!: boolean

  @ApiProperty()
  createdAt!: string
}
