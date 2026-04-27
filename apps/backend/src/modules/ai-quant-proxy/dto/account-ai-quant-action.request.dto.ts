import { AccountStrategyAction, type AccountStrategyAction as AccountStrategyActionValue } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

const accountStrategyActionValues = Object.values(AccountStrategyAction)

export class AccountAiQuantActionRequestDto {
  @ApiProperty({ enum: accountStrategyActionValues })
  @IsIn(accountStrategyActionValues)
  action!: AccountStrategyActionValue
}
