import { ApiProperty } from '@nestjs/swagger'

export class TelegramBotWebhookResponseDto {
  @ApiProperty({ description: 'Webhook 处理成功标记（固定 true）', example: true })
  ok!: boolean
}
