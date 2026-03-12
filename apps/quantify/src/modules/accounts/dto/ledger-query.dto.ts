import { ApiPropertyOptional } from '@nestjs/swagger'
import { LedgerEntryType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LedgerQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '杩囨护绫诲瀷',
    enum: LedgerEntryType,
  })
  @IsOptional()
  @IsEnum(LedgerEntryType)
  type?: LedgerEntryType

  @ApiPropertyOptional({
    description: '寮€濮嬫椂闂?,
  })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({
    description: '缁撴潫鏃堕棿',
  })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({
    description: '鏄惁鍙繑鍥炴湁 referenceId 鐨勬祦姘?,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSystemOnly?: boolean
}
