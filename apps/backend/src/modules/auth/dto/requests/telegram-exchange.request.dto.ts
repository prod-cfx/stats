import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export enum TelegramLoginSource {
  WEB = 'web',
  DESKTOP = 'desktop',
  WEBAPP = 'webapp',
}

export class TelegramExchangeRequestDto {
  @ApiProperty({ description: 'Telegram unique identifier', example: '123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  telegramId: string

  @ApiProperty({ description: 'Telegram auth date (unix timestamp)', example: '1735689600' })
  @IsString()
  @IsNotEmpty()
  authDate: string

  @ApiProperty({ description: 'Telegram login hash', example: 'c7a1...f9' })
  @IsString()
  @IsNotEmpty()
  hash: string

  @ApiProperty({ description: 'Telegram first name', example: 'Alice', required: false })
  @IsString()
  @IsOptional()
  firstName?: string

  @ApiProperty({ description: 'Telegram last name', example: 'Chen', required: false })
  @IsString()
  @IsOptional()
  lastName?: string

  @ApiProperty({ description: 'Telegram username', example: 'alice_bot', required: false })
  @IsString()
  @IsOptional()
  username?: string

  @ApiProperty({ description: 'Telegram avatar url', required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string

  @ApiProperty({ description: 'Telegram login source', enum: TelegramLoginSource, required: false })
  @IsEnum(TelegramLoginSource)
  @IsOptional()
  source?: TelegramLoginSource
}
