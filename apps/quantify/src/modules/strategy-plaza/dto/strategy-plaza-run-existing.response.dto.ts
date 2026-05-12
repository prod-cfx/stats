import { ApiProperty } from '@nestjs/swagger'
import { AccountStrategyDetailResponseDto } from '@/modules/account-strategy-view/dto/account-strategy-detail.response.dto'

export class StrategyPlazaRunExistingResponseDto {
  @ApiProperty({ enum: ['existing'], example: 'existing' })
  result!: 'existing'

  @ApiProperty({ type: AccountStrategyDetailResponseDto })
  strategy!: AccountStrategyDetailResponseDto
}

export type StrategyPlazaRunResponseDto =
  | AccountStrategyDetailResponseDto
  | StrategyPlazaRunExistingResponseDto
