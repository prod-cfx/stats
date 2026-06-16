import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsObject, IsOptional } from 'class-validator'

export class TelegramBotWebhookRequestDto {
  @ApiPropertyOptional({ description: 'Telegram update id' })
  @IsInt()
  @IsOptional()
  update_id?: number

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  message?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  edited_message?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  channel_post?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  edited_channel_post?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  callback_query?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  inline_query?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  chosen_inline_result?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  shipping_query?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  pre_checkout_query?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  poll?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  poll_answer?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  my_chat_member?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  chat_member?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  chat_join_request?: Record<string, unknown>
}
