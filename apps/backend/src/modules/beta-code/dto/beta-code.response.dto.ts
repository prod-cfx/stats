import { ApiProperty } from '@nestjs/swagger'

export class BetaCodeResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  code!: string

  @ApiProperty()
  maxUses!: number

  @ApiProperty()
  usedCount!: number

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  createdAt!: Date
}
