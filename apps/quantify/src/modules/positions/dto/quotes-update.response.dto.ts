import { ApiProperty } from '@nestjs/swagger'

export class QuotesUpdateResponseDto {
  @ApiProperty()
  updatedPositions!: number

  @ApiProperty()
  updatedAccounts!: number
}
