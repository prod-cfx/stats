import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class LlmSubscriptionUserQueryDto {
  @ApiProperty({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string
}
