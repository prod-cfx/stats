import { ApiProperty } from '@nestjs/swagger'

export class TelegramWebAuthorizeUrlResponseDto {
  @ApiProperty({
    description: 'Telegram 网页授权地址（前端跳转用）',
    example: 'https://oauth.telegram.org/auth?bot_id=123&origin=https%3A%2F%2Fexample.com',
  })
  authorizeUrl!: string
}
