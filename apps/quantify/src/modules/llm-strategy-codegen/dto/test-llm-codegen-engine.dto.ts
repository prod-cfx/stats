import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class TestLlmCodegenEngineDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '本轮生成指令' })
  @IsString()
  @IsNotEmpty()
  message!: string

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

  @ApiPropertyOptional({ description: 'LLM 提供商编码，默认 uniapi' })
  @IsOptional()
  @IsString()
  providerCode?: string

  @ApiPropertyOptional({ description: 'LLM 模型名，默认 gpt-4' })
  @IsOptional()
  @IsString()
  model?: string

  @ApiPropertyOptional({ description: '采样温度，范围 0-2', minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @ApiPropertyOptional({ description: '最大输出 token 数', minimum: 1, maximum: 4000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  maxTokens?: number
}

