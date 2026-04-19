import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
} from 'class-validator'

@ValidatorConstraint({ name: 'proxyStringRecord', async: false })
class ProxyStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    return Object.values(value as Record<string, unknown>).every(item => typeof item === 'string')
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an object whose values are all strings`
  }
}

export class LlmCodegenContinueRequestDto {
  @ApiProperty()
  @IsString()
  message!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  @Validate(ProxyStringRecordConstraint)
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
