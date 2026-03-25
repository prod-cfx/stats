import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { CodegenGuideConfigDto } from './codegen-guide-config.dto'

export class StartCodegenSessionDto {
  @ApiPropertyOptional({ description: '业务用户 ID（可选，优先使用鉴权主体）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional({ description: '对策略目标的第一轮描述' })
  @IsOptional()
  @IsString()
  initialMessage?: string

  @ApiPropertyOptional({ description: '标的列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({ description: '周期列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]

  @ApiPropertyOptional({ description: '入场规则列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entryRules?: string[]

  @ApiPropertyOptional({ description: '出场规则列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exitRules?: string[]

  @ApiPropertyOptional({ description: '风控规则', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  riskRules?: Record<string, unknown>

  @ApiPropertyOptional({ description: '会话级引导参数配置', type: CodegenGuideConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodegenGuideConfigDto)
  guideConfig?: CodegenGuideConfigDto
}
