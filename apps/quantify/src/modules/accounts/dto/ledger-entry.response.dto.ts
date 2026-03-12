import { ApiProperty } from '@nestjs/swagger'
import { LedgerEntryType } from '@prisma/client'

export class LedgerEntryResponseDto {
  @ApiProperty({ description: '娴佹按 ID' })
  id!: string

  @ApiProperty({ description: '璐︽埛 ID' })
  userStrategyAccountId!: string

  @ApiProperty({ description: '浠撲綅 ID', nullable: true })
  positionId?: string | null

  @ApiProperty({ description: '娴佹按绫诲瀷', enum: LedgerEntryType })
  type!: LedgerEntryType

  @ApiProperty({ description: '閲戦锛堝崄杩涘埗瀛楃涓诧級' })
  amount!: string

  @ApiProperty({ description: '鍙樻洿鍚庣殑浣欓' })
  balanceAfter!: string

  @ApiProperty({ description: '鍏宠仈 ID', nullable: true })
  referenceId?: string | null

  @ApiProperty({ description: '鎻忚堪', nullable: true })
  description?: string | null

  @ApiProperty({ description: '鍙戠敓鏃堕棿 ISO 瀛楃涓? })
  occurredAt!: string

  @ApiProperty({ description: '鍏冩暟鎹?, nullable: true })
  meta?: Record<string, unknown> | null
}
