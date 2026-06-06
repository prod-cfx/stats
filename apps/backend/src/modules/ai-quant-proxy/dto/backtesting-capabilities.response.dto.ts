import { ApiProperty } from '@nestjs/swagger'

export class BacktestingCapabilitiesResponseDto {
  @ApiProperty({ type: [String] })
  allowedBaseTimeframes!: string[]
}
