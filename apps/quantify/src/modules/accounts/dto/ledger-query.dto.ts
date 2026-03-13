import { ApiPropertyOptional } from '@nestjs/swagger'
import { LedgerEntryType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LedgerQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '过滤类型',
    enum: LedgerEntryType,
  })
  @IsOptional()
  @IsEnum(LedgerEntryType)
  type?: LedgerEntryType

  @ApiPropertyOptional({
    description: '开始时间',
  })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({
    description: '结束时间',
  })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({
    description: '是否只返回有 referenceId 的流水',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSystemOnly?: boolean
}

