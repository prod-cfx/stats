import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class MutateBalanceDto {
  @ApiProperty({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @MaxLength(128)
  userId!: string

  @ApiProperty({
    description: '閲戦锛堟鏁帮級',
    example: '500.00',
  })
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount 蹇呴』鏄鏁? })
  amount!: string

  @ApiPropertyOptional({
    description: '澶栭儴寮曠敤 ID锛堝箓绛夋牎楠岋級',
    example: 'deposit-20251118-01',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string

  @ApiPropertyOptional({
    description: '澶囨敞鎻忚堪',
    example: '鐢ㄦ埛鍏呭€?,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  description?: string
}
