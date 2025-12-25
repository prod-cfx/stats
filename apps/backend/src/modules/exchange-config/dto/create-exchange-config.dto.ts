import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class CreateExchangeConfigDto {
  @ApiProperty({
    description: '交易所唯一标识（建议与其他表中的 venue 对齐，通常全大写）',
    example: 'BINANCE',
    pattern: '^[A-Z0-9_]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, { message: 'code 只能包含大写字母/数字/下划线' })
  code!: string

  @ApiProperty({ description: '交易所展示名称', example: 'Binance' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiPropertyOptional({ description: '头像/Logo URL（建议使用对象存储 URL）', nullable: true })
  @IsUrl({ require_protocol: true }, { message: 'avatarUrl 必须是合法 URL（包含 http/https 协议）' })
  @IsOptional()
  avatarUrl?: string | null

  @ApiPropertyOptional({ description: '简介', nullable: true })
  @IsString()
  @IsOptional()
  intro?: string | null

  @ApiPropertyOptional({ description: '官网链接', nullable: true })
  @IsUrl({ require_protocol: true }, { message: 'websiteUrl 必须是合法 URL（包含 http/https 协议）' })
  @IsOptional()
  websiteUrl?: string | null

  @ApiPropertyOptional({ description: '交易场所类型', enum: ['CEX', 'DEX'], nullable: true })
  @IsEnum(['CEX', 'DEX'])
  @IsOptional()
  venueType?: 'CEX' | 'DEX' | null

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @ApiPropertyOptional({
    description: '排序（数字越小越靠前）',
    type: Number,
    minimum: 0,
    maximum: 100000,
    default: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100000)
  @Type(() => Number)
  @IsOptional()
  sort?: number

  @ApiPropertyOptional({
    description: '扩展信息（JSON）',
    example: { country: 'CN', aliases: ['binance', 'bn'] },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, unknown> | null
}

