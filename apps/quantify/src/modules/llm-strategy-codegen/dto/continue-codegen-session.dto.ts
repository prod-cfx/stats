import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CodegenGuideConfigDto } from './codegen-guide-config.dto'

export class ContinueCodegenSessionDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '用户本轮输入' })
  @IsString()
  @IsNotEmpty()
  message!: string

  @ApiPropertyOptional({ description: '增量更新的标的列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({ description: '增量更新的周期列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]

  @ApiPropertyOptional({ description: '增量更新的入场规则', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entryRules?: string[]

  @ApiPropertyOptional({ description: '增量更新的出场规则', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exitRules?: string[]

  @ApiPropertyOptional({ description: '增量更新风控规则', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  riskRules?: Record<string, unknown>

  @ApiPropertyOptional({ description: '增量更新会话引导参数配置', type: CodegenGuideConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodegenGuideConfigDto)
  guideConfig?: CodegenGuideConfigDto

  @ApiPropertyOptional({ description: '是否确认并触发代码生成（默认 false）' })
  @IsOptional()
  @IsBoolean()
  confirmGenerate?: boolean

  @ApiPropertyOptional({ description: 'LLM 提供商编码（本轮覆盖）' })
  @IsOptional()
  @IsString()
  providerCode?: string

  @ApiPropertyOptional({ description: 'LLM 模型名（本轮覆盖）' })
  @IsOptional()
  @IsString()
  model?: string

  @ApiPropertyOptional({ description: '采样温度，范围 0-2（本轮覆盖）', minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @ApiPropertyOptional({ description: '最大输出 token 数（本轮覆盖）', minimum: 1, maximum: 4000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  maxTokens?: number
}
