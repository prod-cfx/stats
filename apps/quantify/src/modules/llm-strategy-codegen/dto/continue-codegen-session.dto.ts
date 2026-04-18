import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
} from 'class-validator'
import { CodegenGuideConfigDto } from './codegen-guide-config.dto'

@ValidatorConstraint({ name: 'codegenStringRecord', async: false })
class CodegenStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    return Object.values(value as Record<string, unknown>).every(item => typeof item === 'string')
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} 必须是 value 全为 string 的对象`
  }
}

export class ContinueCodegenSessionDto {
  @ApiPropertyOptional({ description: '业务用户 ID（可选，优先使用鉴权主体）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiProperty({ description: '用户本轮输入' })
  @IsString()
  @IsNotEmpty()
  message!: string

  @ApiPropertyOptional({
    description: '结构化澄清回答（key=澄清项 key，value=回答）',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  @Validate(CodegenStringRecordConstraint)
  clarificationAnswers?: Record<string, string>

  @ApiPropertyOptional({ description: '增量更新会话引导参数配置', type: CodegenGuideConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodegenGuideConfigDto)
  guideConfig?: CodegenGuideConfigDto

  @ApiPropertyOptional({ description: '是否确认并触发代码生成（默认 false）' })
  @IsOptional()
  @IsBoolean()
  confirmGenerate?: boolean

  @ApiPropertyOptional({ description: '用户确认的 canonical spec digest' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  confirmedCanonicalDigest?: string

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
