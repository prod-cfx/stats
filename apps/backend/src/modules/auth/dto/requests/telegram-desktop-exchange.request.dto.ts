import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class TelegramDesktopExchangeRequestDto {
  @ApiProperty({ description: 'Telegram 桌面登录 intentId' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  intentId: string

  @ApiProperty({ required: false, description: '内测码，首次创建用户时必填' })
  @IsOptional()
  @IsString()
  betaCode?: string
}
