import { ApiProperty } from '@nestjs/swagger'

export class MarketBarDto {
  @ApiProperty({ description: '鏃堕棿锛圛SO 瀛楃涓诧級' })
  time!: string

  @ApiProperty({ description: '鍛ㄦ湡', example: '1m' })
  timeframe!: string

  @ApiProperty({ description: '寮€鐩樹环', example: '60000.12' })
  open!: string

  @ApiProperty({ description: '鏈€楂樹环', example: '60123.45' })
  high!: string

  @ApiProperty({ description: '鏈€浣庝环', example: '59800.00' })
  low!: string

  @ApiProperty({ description: '鏀剁洏浠?, example: '60010.15' })
  close!: string

  @ApiProperty({ description: '鎴愪氦閲?, example: '123.456', nullable: true })
  volume?: string | null

  @ApiProperty({ description: '鎴愪氦棰?, example: '123456.78', nullable: true })
  quoteVolume?: string | null

  @ApiProperty({ description: '鎴愪氦绗旀暟', example: 1234, nullable: true })
  trades?: number | null

  @ApiProperty({ description: '鏄惁闂悎', example: true })
  isFinal!: boolean
}
