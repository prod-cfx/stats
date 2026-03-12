import { ApiProperty } from '@nestjs/swagger'

/**
 * 绛栫暐瀹炰緥缁熻鏁版嵁 DTO
 */
export class StrategyInstanceStatsDto {
  @ApiProperty({ description: '鎶曞叆鏈噾 (USDT)', example: 5000.0 })
  investedAmount: number

  @ApiProperty({ description: '褰撳墠鍑€鍊?(USDT)', example: 5860.0 })
  currentValue: number

  @ApiProperty({ description: '绱鐩堜簭 (USDT)', example: 860.0 })
  totalPnl: number

  @ApiProperty({ description: '绱鏀剁泭鐜?(%)', example: 17.2 })
  totalPnlRate: number

  @ApiProperty({ description: '浠婃棩鐩堜簭 (USDT)', example: 126.4, required: false })
  todayPnl?: number

  @ApiProperty({ description: '浠婃棩鏀剁泭鐜?(%)', example: 2.5, required: false })
  todayPnlRate?: number

  @ApiProperty({ description: '鎸佷粨鏁伴噺', example: 3 })
  openPositionsCount: number

  @ApiProperty({ description: '宸插钩浠撴暟閲?, example: 16 })
  closedPositionsCount: number

  @ApiProperty({
    description: '骞充粨鎬绘暟锛堢敤浜庤绠楄儨鐜囷紝涓?closedPositionsCount 鐩稿悓锛?,
    example: 19
  })
  totalTradesCount: number

  @ApiProperty({ description: '鐩堝埄骞充粨鏁?, example: 15 })
  winningTradesCount: number

  @ApiProperty({ description: '鑳滅巼 (%)', example: 78.95, required: false })
  winRate?: number

  @ApiProperty({ description: '鏈€澶у洖鎾?(%)', example: -9.4, required: false })
  maxDrawdown?: number

  @ApiProperty({ description: '澶忔櫘姣旂巼', example: 1.85, required: false })
  sharpeRatio?: number

  @ApiProperty({ description: '鏈€鍚庢洿鏂版椂闂? })
  lastUpdatedAt: Date
}
