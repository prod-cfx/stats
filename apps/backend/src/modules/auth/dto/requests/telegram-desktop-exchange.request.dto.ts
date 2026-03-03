import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class TelegramDesktopExchangeRequestDto {
  @ApiProperty({ description: 'Telegram 桌面登录 intentId' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  intentId: string
}
