import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator'

export class LlmCodegenContinueRequestDto {
  @ApiProperty()
  @IsString()
  message!: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entryRules?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exitRules?: string[]

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  riskRules?: Record<string, unknown>

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  clarificationAnswers?: Record<string, string>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  guideConfig?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmGenerate?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmedCanonicalDigest?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  maxTokens?: number
}
