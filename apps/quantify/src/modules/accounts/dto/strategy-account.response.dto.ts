import { ApiProperty } from '@nestjs/swagger'

export class StrategyAccountResponseDto {
  @ApiProperty({ description: '璐︽埛 ID' })
  id!: string

  @ApiProperty({ description: '鐢ㄦ埛 ID' })
  userId!: string

  @ApiProperty({ description: '绛栫暐 ID' })
  strategyId!: string

  @ApiProperty({ description: '绛栫暐鍚嶇О', nullable: true })
  strategyName?: string | null

  @ApiProperty({ description: '绛栫暐鐗堟湰', nullable: true })
  strategyVersion?: string | null

  @ApiProperty({ description: '鍩虹璐у竵' })
  baseCurrency!: string

  @ApiProperty({ description: '鍒濆璧勯噾' })
  initialBalance!: string

  @ApiProperty({ description: '鍙敤浣欓' })
  balance!: string

  @ApiProperty({ description: '璐︽埛鏉冪泭锛堜綑棰?+ 鏈疄鐜扮泩浜忥級' })
  equity!: string

  @ApiProperty({ description: '绱宸插疄鐜扮泩浜? })
  totalRealizedPnl!: string

  @ApiProperty({ description: '鏈疄鐜扮泩浜忔眹鎬? })
  totalUnrealizedPnl!: string

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt!: string

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt!: string

  @ApiProperty({
    description: '鏈€杩戜竴娆℃棩搴︽敹鐩婏紙濡傚瓨鍦級',
    nullable: true,
  })
  latestDailyStat?: {
    date: string
    equityEnd: string
    realizedPnl: string
    unrealizedPnl: string
  } | null
}
