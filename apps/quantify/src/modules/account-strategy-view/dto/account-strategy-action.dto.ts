import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export enum AccountStrategyAction {
  RUN = 'run',
  STOP = 'stop',
}

export class AccountStrategyActionDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ enum: AccountStrategyAction })
  @IsEnum(AccountStrategyAction)
  action!: AccountStrategyAction
}
