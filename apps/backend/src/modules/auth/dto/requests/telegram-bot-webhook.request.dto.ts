import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional } from 'class-validator'

export class TelegramBotWebhookRequestDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  message?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  edited_message?: Record<string, unknown>
}
