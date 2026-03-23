import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

export class AccountAiQuantActionRequestDto {
  @ApiProperty({ enum: ['run', 'stop'] })
  @IsIn(['run', 'stop'])
  action!: 'run' | 'stop'
}
