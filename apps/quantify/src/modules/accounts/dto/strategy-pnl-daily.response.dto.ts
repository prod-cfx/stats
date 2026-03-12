import { ApiProperty } from '@nestjs/swagger'

export class StrategyPnlDailyResponseDto {
  @ApiProperty({ description: '璁板綍 ID' })
  id!: string

  @ApiProperty({ description: '璐︽埛 ID' })
  userStrategyAccountId!: string

  @ApiProperty({ description: '鏃ユ湡 (UTC)' })
  date!: string

  @ApiProperty({ description: '鏈熷垵鏉冪泭' })
  equityStart!: string

  @ApiProperty({ description: '鏈熸湯鏉冪泭' })
  equityEnd!: string

  @ApiProperty({ description: '宸插疄鐜扮泩浜? })
  realizedPnl!: string

  @ApiProperty({ description: '鏈疄鐜扮泩浜? })
  unrealizedPnl!: string

  @ApiProperty({ description: '鏈熼棿鍏ラ噾' })
  deposits!: string

  @ApiProperty({ description: '鏈熼棿鍑洪噾' })
  withdrawals!: string

  @ApiProperty({ description: '鏈€澶у洖鎾? })
  maxDrawdown!: string
}
