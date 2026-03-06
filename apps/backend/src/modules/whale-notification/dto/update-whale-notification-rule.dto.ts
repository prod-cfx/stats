import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { WhaleNotificationChannelsDto } from './whale-notification-channels.dto'

export class UpdateWhaleNotificationRuleDto {
  @ApiProperty({ required: false, example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  thresholdUsd?: number

  @ApiProperty({ required: false, example: 'updated note' })
  @IsOptional()
  @IsString()
  note?: string

  @ApiProperty({ required: false, type: WhaleNotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhaleNotificationChannelsDto)
  channels?: WhaleNotificationChannelsDto

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
