import type { SettingValue } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateSettingDto {
  @ApiProperty({
    description: '配置值（可以是字符串、数字、布尔值或JSON对象）',
    example: 'New Value',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array' },
    ],
  })
  @IsNotEmpty()
    value!: SettingValue

  @ApiPropertyOptional({
    description: '值类型',
    example: 'string',
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsString()
  @IsOptional()
    type?: string

  @ApiPropertyOptional({ description: '配置描述', example: '更新后的描述' })
  @IsString()
  @IsOptional()
    description?: string

  @ApiPropertyOptional({ description: '配置分类', example: 'general' })
  @IsString()
  @IsOptional()
    category?: string

  @ApiPropertyOptional({ description: '是否系统配置', example: false })
  @IsBoolean()
  @IsOptional()
    isSystem?: boolean
}
