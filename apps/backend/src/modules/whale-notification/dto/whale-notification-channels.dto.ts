import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class WhaleNotificationChannelsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  web!: boolean

  @ApiProperty({ example: false })
  @IsBoolean()
  email!: boolean

  @ApiProperty({ example: true })
  @IsBoolean()
  telegram!: boolean
}
