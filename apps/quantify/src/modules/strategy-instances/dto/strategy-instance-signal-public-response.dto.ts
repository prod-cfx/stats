import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SignalDirection, SignalType } from '@prisma/client'

import { convertDecimalToString } from '@/common/utils/decimal-converter'

/**
 * 闈㈠悜澶栭儴璋冪敤鏂圭殑绛栫暐瀹炰緥淇″彿鍝嶅簲 DTO锛堝凡鑴辨晱锛?
 * 浠呭寘鍚澶栨秷璐规墍闇€鐨勫叧閿俊鎭紝閬垮厤鏆撮湶鍐呴儴 prompt銆佸師濮嬪搷搴斿拰涓婁笅鏂囩粏鑺傘€?
 */
export class StrategyInstanceSignalPublicResponseDto {
  @ApiProperty({ description: '淇″彿 ID' })
  id: string

  @ApiPropertyOptional({ description: '鏍囩殑浠ｇ爜', example: 'BTCUSDT', nullable: true })
  symbolCode?: string

  @ApiProperty({ description: '淇″彿绫诲瀷', enum: SignalType })
  signalType: SignalType

  @ApiProperty({ description: '鏂瑰悜', enum: SignalDirection })
  direction: SignalDirection

  @ApiPropertyOptional({ description: '鍏ュ満浠锋牸', nullable: true })
  entryPrice?: string | null

  @ApiPropertyOptional({ description: '寤鸿浠撲綅澶у皬锛堟姤浠峰竵绉嶉噾棰濓級', nullable: true })
  positionSizeQuote?: string | null

  @ApiPropertyOptional({ description: 'AI 鏂囨湰鐞嗙敱', nullable: true })
  aiReasoning?: string | null

  @ApiProperty({ description: '鍙戝竷鏃堕棿' })
  publishedAt: string

  constructor(data: any) {
    this.id = data.id
    this.symbolCode = data.symbol?.code
    this.signalType = data.signalType
    this.direction = data.direction
    this.entryPrice = convertDecimalToString(data.entryPrice)
    this.positionSizeQuote = convertDecimalToString(data.positionSizeQuote)
    this.aiReasoning = data.aiReasoning
    this.publishedAt = data.publishedAt?.toISOString()
  }
}
