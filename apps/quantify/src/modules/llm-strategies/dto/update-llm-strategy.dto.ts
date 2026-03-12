import type { LlmStrategyStatus } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator'

export class UpdateLlmStrategyDto {
  @ApiPropertyOptional({ description: '绛栫暐鍚嶇О', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '绛栫暐鎻忚堪', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ description: '绛栫暐鐘舵€?, enum: ['draft', 'live', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'live', 'archived'])
  status?: LlmStrategyStatus

  @ApiPropertyOptional({ description: '绯荤粺鎻愮ず璇?, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string

  @ApiPropertyOptional({ description: '鍒濆鎻愮ず璇嶆ā鏉?, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  initialPromptTemplate?: string

  @ApiPropertyOptional({
    description: '鍏佽鐨勪氦鏄撳鍒楄〃',
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @IsString({ each: true })
  allowedSymbols?: string[] | null

  @ApiPropertyOptional({
    description: '鍏佽鐨勬椂闂村懆鏈?,
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @IsString({ each: true })
  allowedTimeframes?: string[] | null

  @ApiPropertyOptional({
    description: '椋庨櫓閰嶇疆鍙傛暟',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  riskConfig?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '棰濆鍏冩暟鎹?,
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鏇存柊浜烘爣璇?, example: 'system-operator' })
  @IsOptional()
  @IsString()
  updatedBy?: string
}
