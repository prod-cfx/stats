import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'

export enum TelegramDesktopIntentKind {
  LOGIN = 'login',
  BIND = 'bind',
}

export enum TelegramDesktopIntentLanguage {
  ZH = 'zh',
  EN = 'en',
}

export class CreateTelegramDesktopIntentRequestDto {
  @ApiProperty({ enum: TelegramDesktopIntentKind, required: false, default: TelegramDesktopIntentKind.LOGIN })
  @IsEnum(TelegramDesktopIntentKind)
  @IsOptional()
  intent?: TelegramDesktopIntentKind

  @ApiProperty({ enum: TelegramDesktopIntentLanguage, required: false, default: TelegramDesktopIntentLanguage.ZH })
  @IsEnum(TelegramDesktopIntentLanguage)
  @IsOptional()
  lng?: TelegramDesktopIntentLanguage
}
