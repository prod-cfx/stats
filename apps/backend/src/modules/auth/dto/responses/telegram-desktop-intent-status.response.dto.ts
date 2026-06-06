import { ApiProperty } from '@nestjs/swagger'

export class TelegramDesktopIntentStatusResponseDto {
  @ApiProperty({
    description: '登录意图状态',
    enum: ['pending', 'confirmed', 'expired'],
    example: 'pending',
  })
  status!: 'pending' | 'confirmed' | 'expired'
}
