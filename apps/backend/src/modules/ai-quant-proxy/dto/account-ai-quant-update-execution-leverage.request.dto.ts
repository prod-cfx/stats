import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Min } from 'class-validator'

export class AccountAiQuantUpdateExecutionLeverageRequestDto {
  @ApiProperty({ description: 'The next-cycle leverage to apply to the deployed strategy instance.' })
  @IsNumber()
  @Min(1)
  leverage!: number
}
