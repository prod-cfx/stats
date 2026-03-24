import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { TelegramDesktopIntentKind, TelegramDesktopIntentLanguage } from '@ai/shared'

export { TelegramDesktopIntentKind, TelegramDesktopIntentLanguage }

export class CreateTelegramDesktopIntentRequestDto {
  @ApiProperty({ enum: TelegramDesktopIntentKind, required: false, default: TelegramDesktopIntentKind.LOGIN })
  @IsEnum(TelegramDesktopIntentKind)
  @IsOptional()
  intent?: TelegramDesktopIntentKind

  @ApiProperty({ enum: TelegramDesktopIntentLanguage, required: false, default: TelegramDesktopIntentLanguage.ZH })
  @IsEnum(TelegramDesktopIntentLanguage)
  @IsOptional()
  lng?: TelegramDesktopIntentLanguage

  @ApiProperty({ required: false, description: '登录成功后回跳路径，仅允许站内绝对路径，例如 /zh/ai-quant' })
  @IsString()
  @IsOptional()
  redirect?: string
}
