import { ApiProperty } from '@nestjs/swagger'

export class TelegramDesktopIntentResponseDto {
  @ApiProperty({ description: '登录意图 ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  intentId!: string

  @ApiProperty({
    description: 'Telegram 客户端深链（tg:// 协议）',
    example: 'tg://resolve?domain=example_bot&start=intent_xxx',
  })
  deepLink!: string

  @ApiProperty({
    description: 'Telegram 网页链接（无客户端时回退）',
    example: 'https://t.me/example_bot?start=intent_xxx',
  })
  webLink!: string

  @ApiProperty({
    description: '登录确认回调地址',
    example: 'https://example.com/auth/telegram/callback?intent=xxx',
  })
  callbackUrl!: string

  @ApiProperty({ description: '意图过期时间（秒）', example: 300 })
  expiresInSeconds!: number
}
