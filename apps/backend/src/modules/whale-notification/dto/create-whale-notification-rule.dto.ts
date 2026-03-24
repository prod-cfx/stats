import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { WhaleNotificationRuleType } from '@ai/shared'
import { WhaleNotificationChannelsDto } from './whale-notification-channels.dto'

export class CreateWhaleNotificationRuleDto {
  @ApiProperty({ enum: WhaleNotificationRuleType, example: WhaleNotificationRuleType.ADDRESS })
  @IsEnum(WhaleNotificationRuleType)
  type!: WhaleNotificationRuleType

  @ApiProperty({ required: false, example: '0x123abc' })
  @IsOptional()
  @IsString()
  address?: string

  @ApiProperty({ required: false, example: 'BTC' })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  thresholdUsd!: number

  @ApiProperty({ required: false, example: 'focus this whale' })
  @IsOptional()
  @IsString()
  note?: string

  @ApiProperty({ type: WhaleNotificationChannelsDto })
  @ValidateNested()
  @Type(() => WhaleNotificationChannelsDto)
  channels!: WhaleNotificationChannelsDto
}
