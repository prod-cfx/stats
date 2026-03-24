import { AccountStrategyAction } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export { AccountStrategyAction }

export class AccountStrategyActionDto {
  @ApiProperty({ description: '业务用户 ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string

  @ApiProperty({ enum: AccountStrategyAction })
  @IsEnum(AccountStrategyAction)
  action!: AccountStrategyAction
}
