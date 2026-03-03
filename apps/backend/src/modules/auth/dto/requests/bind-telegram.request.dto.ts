import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class BindTelegramRequestDto {
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

  @ApiProperty({ description: 'Telegram first name', required: false })
  @IsOptional()
  @IsString()
  firstName?: string

  @ApiProperty({ description: 'Telegram last name', required: false })
  @IsOptional()
  @IsString()
  lastName?: string

  @ApiProperty({ description: 'Telegram username', required: false })
  @IsOptional()
  @IsString()
  username?: string

  @ApiProperty({ description: 'Telegram avatar url', required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string
}
